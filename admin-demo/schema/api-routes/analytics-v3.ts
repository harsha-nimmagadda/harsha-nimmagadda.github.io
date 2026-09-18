// ============================================================
// BRILLIANCE API — Analytics V3 Routes
// 21 endpoints for batch, student, and parent analytics pages
// ============================================================

import { Hono, type Context } from "hono";
import { createMiddleware } from "hono/factory";
import { compress } from "hono/compress";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  dbRead,
  users,
  students,
  studentInsights,
  studentPredictionsV3,
  parentStudentLinks,
} from "@brilliance/db";
import { authMiddleware } from "../middleware/auth";
import { requireAnyPermission, requirePermission } from "../middleware/rbac";
import { tenantScope, CROSS_BRANCH_ROLES } from "../middleware/tenant-scope";
import {
  isBatchInScope,
  verifyUserOwnership,
  getEffectiveBranchIds,
} from "../lib/tenant-guard";
import { success, error, paginated } from "../lib/response";
import { slotExclusionSql, slotMatchSql } from "@brilliance/exam-schedule/server";
import { selfDirectedPracticeSql } from "../lib/exam-category";
import {
  examTypeGuardSql,
  isCanonicalTargetExam,
  type CanonicalTargetExam,
} from "../lib/exam-scope";
import {
  responseCacheKey,
  getCachedResponse,
  setCachedResponse,
} from "../lib/response-cache";
import {
  generatePTAReport,
  getPTAReportByToken,
} from "../lib/pta-report/generate";
import {
  buildWhyNarrative,
  buildRecommendedAction,
  type AtRiskSignals,
  type ErrorClass,
} from "../lib/at-risk-narrative";
import {
  parseCohortKey,
  formatCohortName,
} from "../lib/cohort-helpers";
import {
  buildExcelBuffer,
  isSupportedFormat,
  XLSX_CONTENT_TYPE,
} from "../lib/analytics-exports";
import Anthropic from "@anthropic-ai/sdk";

const analyticsV3 = new Hono();

analyticsV3.use("*", authMiddleware);

/** Staff drills under `/student/:studentId/*` — not `/student/me/*`. */
const staffStudentOwnership = createMiddleware(async (c, next) => {
  const studentId = c.req.param("studentId");
  if (!studentId) {
    return c.json(error("NOT_FOUND", "Student not found", 404), 404);
  }
  try {
    if (!(await verifyUserOwnership(studentId, c))) {
      return c.json(error("NOT_FOUND", "Student not found", 404), 404);
    }
  } catch {
    return c.json(error("NOT_FOUND", "Student not found", 404), 404);
  }
  await next();
});

const staffStudentGates = [
  requirePermission("analytics:batch"),
  staffStudentOwnership,
] as const;

const batchScopeGuard = createMiddleware(async (c, next) => {
  const batchId = c.req.param("id");
  if (batchId && !isBatchInScope(c, batchId)) {
    return c.json(error("FORBIDDEN", "This batch is outside your data scope", 403), 403);
  }
  await next();
});

analyticsV3.use("/batch/:id", tenantScope);
analyticsV3.use("/batch/:id/*", tenantScope);
analyticsV3.use("/batch/:id", requirePermission("analytics:batch"));
analyticsV3.use("/batch/:id/*", requirePermission("analytics:batch"));
analyticsV3.use("/batch/:id", batchScopeGuard);
analyticsV3.use("/batch/:id/*", batchScopeGuard);

const toRows = (result: any): any[] =>
  Array.isArray(result) ? result : (result?.rows ?? []);

/**
 * Parse ?examType= — a canonical exam type ('jee_mains', 'jee_advanced', …)
 * expanded to all its known DB spellings by examTypeGuardSql. Returns null
 * when absent and "invalid" for unknown values so handlers 400 instead of
 * silently serving an unfiltered (blended) average.
 */
const parseExamType = (c: Context): CanonicalTargetExam | null | "invalid" => {
  const raw = c.req.query("examType");
  if (!raw) return null;
  return isCanonicalTargetExam(raw) ? raw : "invalid";
};

/** Fetch student user IDs for a given batch */
async function getBatchStudentIds(batchId: string): Promise<string[]> {
  const rows = toRows(
    await db.execute(sql`SELECT user_id FROM students WHERE batch_id = ${batchId}`)
  );
  return rows.map((r: any) => r.user_id);
}

// ── Helpers (home endpoints) ──────────────────────────────────

type SessionUser = { sub: string; role: string };

type HomeInsightRow = {
  id: string;
  kind: string;
  severity: "info" | "warning" | "critical" | "celebrate";
  title: string;
  body: string;
  recommendedActions: unknown;
};

async function fetchTopStudentInsights(
  studentId: string,
  limit = 5,
): Promise<HomeInsightRow[]> {
  const rows = await db
    .select({
      id: studentInsights.id,
      kind: studentInsights.kind,
      severity: studentInsights.severity,
      title: studentInsights.title,
      body: studentInsights.body,
      recommendedActions: studentInsights.recommendedActions,
      generatedAt: studentInsights.generatedAt,
    })
    .from(studentInsights)
    .where(
      and(
        eq(studentInsights.studentId, studentId),
        isNull(studentInsights.dismissedAt),
      ),
    )
    .orderBy(desc(studentInsights.generatedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as string,
    severity: r.severity as HomeInsightRow["severity"],
    title: r.title,
    body: r.body,
    recommendedActions: r.recommendedActions ?? [],
  }));
}

async function fetchStudentPrediction(studentId: string) {
  const [row] = await db
    .select()
    .from(studentPredictionsV3)
    .where(eq(studentPredictionsV3.studentId, studentId))
    .limit(1);
  return row ?? null;
}

// ── GET /home — dashboard persona home (admin + faculty) ─────

analyticsV3.get("/home", async (c) => {
  const user = c.get("user") as SessionUser;
  if (!user) {
    return c.json(error("UNAUTHORIZED", "Login required", 401), 401);
  }

  try {
    const sampleInsights = await db
      .select({
        id: studentInsights.id,
        kind: studentInsights.kind,
        severity: studentInsights.severity,
        title: studentInsights.title,
        body: studentInsights.body,
        recommendedActions: studentInsights.recommendedActions,
      })
      .from(studentInsights)
      .where(isNull(studentInsights.dismissedAt))
      .orderBy(desc(studentInsights.generatedAt))
      .limit(5);

    // For admin/faculty roles, reframe student-scoped insight text to
    // institution/branch scope so it reads correctly on the admin dashboard.
    const isAdmin = user.role === "super_admin" || user.role === "branch_admin";
    const insights = sampleInsights.map((i) => {
      let title = i.title;
      let body = i.body;
      if (isAdmin) {
        title = title
          .replace(/\bYou're\b/g, "Students are")
          .replace(/\byou're\b/g, "students are")
          .replace(/\bYour\b/g, "Institution's")
          .replace(/\byour\b/g, "the institution's")
          .replace(/\bYou\b/g, "Students")
          .replace(/\byou\b/g, "students");
        body = body
          .replace(/\bYou're\b/g, "Students are")
          .replace(/\byou're\b/g, "students are")
          .replace(/\bYour\b/g, "The institution's")
          .replace(/\byour\b/g, "the institution's")
          .replace(/\bYou\b/g, "Students")
          .replace(/\byou\b/g, "students");
      }
      return {
        id: i.id,
        kind: i.kind as string,
        severity: i.severity as HomeInsightRow["severity"],
        title,
        body,
        recommendedActions: i.recommendedActions ?? [],
      };
    });

    return c.json(
      success({
        scope: user.role === "super_admin" ? "institution" : "branch",
        headline:
          user.role === "super_admin"
            ? "Your institution at a glance"
            : user.role === "branch_admin"
              ? "Your branch this week"
              : "Your batches this week",
        subHeadline: "Fresh insights generated in the last hour.",
        insights,
      }),
    );
  } catch (err) {
    console.error("[analytics-v3 /home] error:", err);
    return c.json(error("SERVER_ERROR", "Could not load home", 500), 500);
  }
});

// ── GET /home-v2 — dense dashboard home (admin + faculty) ────
//
// Returns the full payload for the analytics landing page in a single
// round-trip. All queries run in parallel inside Promise.all; no LLM
// calls, no external services. Results are cached per-scope for 60s to
// absorb rapid reloads from the same operator without re-hitting the DB.

type HomeV2Cache = { ts: number; payload: unknown };
const homeV2Cache = new Map<string, HomeV2Cache>();
const HOME_V2_TTL_MS = 60_000;

function dotForBatch(avgPct: number | null, lastAttempt: Date | null): "green" | "amber" | "red" | "muted" {
  if (avgPct == null) return "muted";
  const stale = !lastAttempt || Date.now() - new Date(lastAttempt).getTime() > 21 * 24 * 60 * 60 * 1000;
  if (stale) return "muted";
  if (avgPct >= 65) return "green";
  if (avgPct >= 45) return "amber";
  return "red";
}

analyticsV3.get(
  "/home-v2",
  requireAnyPermission("analytics:institution", "analytics:branch", "analytics:batch"),
  async (c) => {
  const user = c.get("user") as SessionUser & { institutionId?: string; branchId?: string };
  if (!user) {
    return c.json(error("UNAUTHORIZED", "Login required", 401), 401);
  }

  const institutionId = user.institutionId;
  if (!institutionId) {
    return c.json(error("FORBIDDEN", "Institution context required", 403), 403);
  }
  const branchId = user.branchId;
  const scopeToBranch =
    user.role === "branch_admin" || user.role === "faculty" || user.role === "branch_faculty";
  const branchFilter = scopeToBranch && branchId ? branchId : null;

  const cacheKey = `${institutionId}::${branchFilter ?? "all"}::${user.role}`;
  const cached = homeV2Cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < HOME_V2_TTL_MS) {
    return c.json(success(cached.payload));
  }

  try {
    // SQL fragments used by multiple queries to scope to the right branch.
    const userBranchClause = branchFilter
      ? sql`AND u.branch_id = ${branchFilter}`
      : sql``;
    const batchBranchClause = branchFilter
      ? sql`AND b.branch_id = ${branchFilter}`
      : sql``;
    const examBranchClause = branchFilter
      ? sql`AND e.branch_id = ${branchFilter}`
      : sql``;
    // active result holds are excluded from cohort math — every score-bearing
    // aggregate below drops held submissions (bare participation counts keep them).
    const notHeld = sql`AND NOT EXISTS (
      SELECT 1 FROM exam_result_holds erh
      WHERE erh.exam_id = es.exam_id
        AND erh.student_id = es.student_id
        AND erh.released_at IS NULL
    )`;

    const [
      pulseRow,
      atRiskRow,
      trendRows,
      moversRows,
      batchRows,
      countdownRows,
      insightRows,
    ] = await Promise.all([
      // 1. PULSE — counts + rolling averages with prior-week deltas.
      db.execute(sql`
        SELECT
          (SELECT COUNT(*)::int
             FROM users u
             WHERE u.role = 'student'
               AND u.institution_id = ${institutionId}
               AND u.status = 'active'
               ${userBranchClause}
          ) AS active_students,

          (SELECT ROUND(AVG(es.percentage::numeric), 1)
             FROM exam_submissions es
             JOIN users u ON u.id = es.student_id
             WHERE u.institution_id = ${institutionId}
               AND es.submitted_at >= NOW() - INTERVAL '7 days'
               AND es.percentage IS NOT NULL
               ${userBranchClause}
               ${notHeld}
          ) AS avg_score_7d,

          (SELECT ROUND(AVG(es.percentage::numeric), 1)
             FROM exam_submissions es
             JOIN users u ON u.id = es.student_id
             WHERE u.institution_id = ${institutionId}
               AND es.submitted_at >= NOW() - INTERVAL '14 days'
               AND es.submitted_at <  NOW() - INTERVAL '7 days'
               AND es.percentage IS NOT NULL
               ${userBranchClause}
               ${notHeld}
          ) AS avg_score_prior_7d,

          (SELECT ROUND(
                    100.0 * SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::numeric
                    / NULLIF(COUNT(*), 0), 1)
             FROM attendance a
             JOIN users u ON u.id = a.student_id
             WHERE u.institution_id = ${institutionId}
               AND a.date >= CURRENT_DATE - 7
               ${userBranchClause}
          ) AS attendance_7d,

          (SELECT ROUND(
                    100.0 * SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::numeric
                    / NULLIF(COUNT(*), 0), 1)
             FROM attendance a
             JOIN users u ON u.id = a.student_id
             WHERE u.institution_id = ${institutionId}
               AND a.date >= CURRENT_DATE - 14
               AND a.date <  CURRENT_DATE - 7
               ${userBranchClause}
          ) AS attendance_prior_7d,

          (SELECT COUNT(*)::int
             FROM exams e
             WHERE e.institution_id = ${institutionId}
               AND e.scheduled_start >= NOW() - INTERVAL '7 days'
               AND e.scheduled_start <  NOW() + INTERVAL '7 days'
               ${examBranchClause}
          ) AS tests_this_week,

          (SELECT COUNT(*)::int
             FROM exam_submissions es
             JOIN users u ON u.id = es.student_id
             WHERE u.institution_id = ${institutionId}
               AND es.submitted_at >= NOW() - INTERVAL '24 hours'
               ${userBranchClause}
          ) AS submissions_24h
      `),

      // 2. AT-RISK COUNT — students with rolling-avg < 50% OR latest < 40%.
      db.execute(sql`
        WITH recent AS (
          SELECT es.student_id,
                 es.percentage::numeric AS pct,
                 ROW_NUMBER() OVER (PARTITION BY es.student_id
                                    ORDER BY es.submitted_at DESC) AS rn
          FROM exam_submissions es
          JOIN users u ON u.id = es.student_id
          WHERE u.institution_id = ${institutionId}
            AND es.percentage IS NOT NULL
            AND es.submitted_at >= NOW() - INTERVAL '90 days'
            ${userBranchClause}
            ${notHeld}
        ),
        t AS (
          SELECT student_id,
                 AVG(pct) AS avg_pct,
                 MAX(CASE WHEN rn = 1 THEN pct END) AS latest
          FROM recent
          WHERE rn <= 3
          GROUP BY student_id
        )
        SELECT COUNT(*)::int AS n
        FROM t
        WHERE latest < 40 OR avg_pct < 50
      `),

      // 3. 30-DAY TREND — daily institution-wide average score.
      db.execute(sql`
        SELECT DATE_TRUNC('day', es.submitted_at)::date AS day,
               ROUND(AVG(es.percentage::numeric), 1)    AS avg_pct,
               COUNT(*)::int                            AS n
        FROM exam_submissions es
        JOIN users u ON u.id = es.student_id
        WHERE u.institution_id = ${institutionId}
          AND es.submitted_at >= NOW() - INTERVAL '30 days'
          AND es.percentage IS NOT NULL
          ${userBranchClause}
          ${notHeld}
        GROUP BY day
        ORDER BY day ASC
      `),

      // 4. RISERS + FALLERS — recent-3 vs prior-3 delta per student.
      // We pull the top 30 by absolute delta, partition into ±5 client-side.
      db.execute(sql`
        WITH ranked AS (
          SELECT es.student_id,
                 es.percentage::numeric AS pct,
                 ROW_NUMBER() OVER (PARTITION BY es.student_id
                                    ORDER BY es.submitted_at DESC) AS rn
          FROM exam_submissions es
          JOIN users u ON u.id = es.student_id
          WHERE u.institution_id = ${institutionId}
            AND es.percentage IS NOT NULL
            AND es.submitted_at >= NOW() - INTERVAL '90 days'
            ${userBranchClause}
            ${notHeld}
        ),
        deltas AS (
          SELECT student_id,
                 AVG(CASE WHEN rn <= 3 THEN pct END)             AS recent_avg,
                 AVG(CASE WHEN rn BETWEEN 4 AND 6 THEN pct END)  AS prior_avg,
                 COUNT(CASE WHEN rn <= 3 THEN 1 END)             AS recent_n,
                 COUNT(CASE WHEN rn BETWEEN 4 AND 6 THEN 1 END)  AS prior_n
          FROM ranked
          GROUP BY student_id
        )
        SELECT d.student_id,
               u.name,
               u.avatar_url,
               ROUND(d.recent_avg, 1)                  AS recent,
               ROUND(d.prior_avg,  1)                  AS prior,
               ROUND(d.recent_avg - d.prior_avg, 1)    AS delta,
               b.name                                   AS batch_name,
               s.batch_id                               AS batch_id
        FROM deltas d
        JOIN users u           ON u.id = d.student_id
        LEFT JOIN students s   ON s.user_id = d.student_id
        LEFT JOIN batches  b   ON b.id = s.batch_id
        WHERE d.recent_n >= 2
          AND d.prior_n  >= 1
        ORDER BY ABS(d.recent_avg - d.prior_avg) DESC
        LIMIT 30
      `),

      // 5. BATCH HEALTH GRID — top 12 batches with rolling avg + last attempt.
      // Pull branch + academic_year so batches sharing a stream-code `name`
      // (e.g. "SR MPC" across multiple branches/years) stay disambiguated.
      db.execute(sql`
        SELECT
          b.id            AS batch_id,
          b.name          AS batch_name,
          b.target_exam   AS target_exam,
          b.academic_year AS academic_year,
          b.year_group    AS year_group,
          b.stream        AS stream,
          br.name         AS branch_name,
          (SELECT COUNT(*)::int FROM students s WHERE s.batch_id = b.id) AS size,
          (SELECT ROUND(AVG(es.percentage::numeric), 1)
             FROM exam_submissions es
             JOIN students s ON s.user_id = es.student_id
             WHERE s.batch_id = b.id
               AND es.submitted_at >= NOW() - INTERVAL '21 days'
               AND es.percentage IS NOT NULL
               ${notHeld}
          ) AS avg_pct,
          (SELECT MAX(es.submitted_at)
             FROM exam_submissions es
             JOIN students s ON s.user_id = es.student_id
             WHERE s.batch_id = b.id
          ) AS last_attempt_at
        FROM batches b
        JOIN branches br ON br.id = b.branch_id
        WHERE br.institution_id = ${institutionId}
          AND b.status <> 'archived'
          ${batchBranchClause}
        ORDER BY size DESC NULLS LAST, b.name ASC
        LIMIT 12
      `),

      // 6. UPCOMING-EXAM COUNTDOWN — next mock per target_exam.
      db.execute(sql`
        SELECT DISTINCT ON (b.target_exam)
          b.target_exam,
          e.id            AS exam_id,
          e.title         AS exam_title,
          e.scheduled_start
        FROM batches b
        JOIN branches br ON br.id = b.branch_id
        LEFT JOIN exams e
               ON e.institution_id = br.institution_id
              AND e.exam_type      = b.target_exam
              AND e.scheduled_start > NOW()
              AND e.status IN ('published', 'approved', 'in_progress')
        WHERE br.institution_id = ${institutionId}
          AND b.target_exam IS NOT NULL
          AND b.status <> 'archived'
          ${batchBranchClause}
        ORDER BY b.target_exam, e.scheduled_start ASC NULLS LAST
        LIMIT 6
      `),

      // 7. INSIGHTS — keep the existing /home behavior (3 most recent).
      db
        .select({
          id: studentInsights.id,
          kind: studentInsights.kind,
          severity: studentInsights.severity,
          title: studentInsights.title,
          body: studentInsights.body,
          recommendedActions: studentInsights.recommendedActions,
        })
        .from(studentInsights)
        .where(isNull(studentInsights.dismissedAt))
        .orderBy(desc(studentInsights.generatedAt))
        .limit(3),
    ]);

    const pulse = (toRows(pulseRow)[0] ?? {}) as any;
    const atRisk = (toRows(atRiskRow)[0] ?? {}) as any;

    const toNum = (v: unknown) => (v == null ? null : Number(v));
    const round1 = (v: unknown) => {
      const n = toNum(v);
      return n == null ? null : Math.round(n * 10) / 10;
    };
    const delta = (a: number | null, b: number | null) =>
      a == null || b == null ? null : Math.round((a - b) * 10) / 10;

    const avg7 = round1(pulse.avg_score_7d);
    const avgPrior7 = round1(pulse.avg_score_prior_7d);
    const att7 = round1(pulse.attendance_7d);
    const attPrior7 = round1(pulse.attendance_prior_7d);

    const moversRaw = toRows(moversRows) as any[];
    const ascendingByDelta = [...moversRaw].sort(
      (x, y) => Number(x.delta) - Number(y.delta),
    );
    const fallers = ascendingByDelta
      .filter((m) => Number(m.delta) < 0)
      .slice(0, 5)
      .map((m) => ({
        studentId: m.student_id as string,
        name: m.name as string,
        avatarUrl: m.avatar_url as string | null,
        batchId: m.batch_id as string | null,
        batchName: m.batch_name as string | null,
        recent: round1(m.recent) ?? 0,
        prior: round1(m.prior) ?? 0,
        delta: round1(m.delta) ?? 0,
      }));
    const risers = [...moversRaw]
      .filter((m) => Number(m.delta) > 0)
      .sort((x, y) => Number(y.delta) - Number(x.delta))
      .slice(0, 5)
      .map((m) => ({
        studentId: m.student_id as string,
        name: m.name as string,
        avatarUrl: m.avatar_url as string | null,
        batchId: m.batch_id as string | null,
        batchName: m.batch_name as string | null,
        recent: round1(m.recent) ?? 0,
        prior: round1(m.prior) ?? 0,
        delta: round1(m.delta) ?? 0,
      }));

    const batches = (toRows(batchRows) as any[]).map((b) => {
      const avg = round1(b.avg_pct);
      const last = b.last_attempt_at ? new Date(b.last_attempt_at) : null;
      return {
        batchId: b.batch_id as string,
        batchName: b.batch_name as string,
        branchName: (b.branch_name as string | null) ?? null,
        academicYear: (b.academic_year as string | null) ?? null,
        yearGroup: (b.year_group as string | null) ?? null,
        stream: (b.stream as string | null) ?? null,
        targetExam: b.target_exam as string | null,
        size: Number(b.size ?? 0),
        avgPct: avg,
        lastAttemptAt: last ? last.toISOString() : null,
        health: dotForBatch(avg, last),
      };
    });

    const countdowns = (toRows(countdownRows) as any[])
      .filter((r) => r.scheduled_start != null)
      .map((r) => {
        const when = new Date(r.scheduled_start);
        const days = Math.max(
          0,
          Math.ceil((when.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        );
        return {
          targetExam: r.target_exam as string,
          examId: r.exam_id as string,
          examTitle: r.exam_title as string,
          scheduledStart: when.toISOString(),
          daysAway: days,
        };
      });

    const isAdmin =
      user.role === "super_admin" || user.role === "branch_admin";
    const insights = (insightRows as any[]).map((i) => {
      let title = i.title;
      let body = i.body;
      if (isAdmin) {
        const reframe = (s: string) =>
          s
            .replace(/\bYou're\b/g, "Students are")
            .replace(/\byou're\b/g, "students are")
            .replace(/\bYour\b/g, "Institution's")
            .replace(/\byour\b/g, "the institution's")
            .replace(/\bYou\b/g, "Students")
            .replace(/\byou\b/g, "students");
        title = reframe(title);
        body = reframe(body);
      }
      return {
        id: i.id,
        kind: i.kind as string,
        severity: i.severity as HomeInsightRow["severity"],
        title,
        body,
        recommendedActions: i.recommendedActions ?? [],
      };
    });

    const scope: "institution" | "branch" =
      user.role === "super_admin" ? "institution" : "branch";
    const headline =
      user.role === "super_admin"
        ? "Your institution at a glance"
        : user.role === "branch_admin"
          ? "Your branch this week"
          : "Your batches this week";

    const subHeadline = (() => {
      if (avg7 != null && avgPrior7 != null) {
        const d = delta(avg7, avgPrior7);
        if (d != null && d > 0)
          return `Average score is up ${d.toFixed(1)} pts week-over-week.`;
        if (d != null && d < 0)
          return `Average score is down ${Math.abs(d).toFixed(1)} pts week-over-week.`;
      }
      const tests = Number(pulse.tests_this_week ?? 0);
      if (tests > 0)
        return `${tests} test${tests === 1 ? "" : "s"} in the current 7-day window.`;
      return "Live numbers refresh every minute.";
    })();

    const payload = {
      scope,
      headline,
      subHeadline,
      generatedAt: new Date().toISOString(),
      pulse: {
        activeStudents: Number(pulse.active_students ?? 0),
        avgScore7d: avg7,
        avgScoreDelta: delta(avg7, avgPrior7),
        attendance7d: att7,
        attendanceDelta: delta(att7, attPrior7),
        atRiskCount: Number(atRisk.n ?? 0),
        testsThisWeek: Number(pulse.tests_this_week ?? 0),
        submissions24h: Number(pulse.submissions_24h ?? 0),
      },
      trend30d: (toRows(trendRows) as any[]).map((r) => ({
        day:
          r.day instanceof Date
            ? r.day.toISOString().slice(0, 10)
            : String(r.day).slice(0, 10),
        avgPct: round1(r.avg_pct) ?? 0,
        n: Number(r.n ?? 0),
      })),
      risers,
      fallers,
      batches,
      countdowns,
      insights,
    };

    homeV2Cache.set(cacheKey, { ts: Date.now(), payload });

    return c.json(success(payload));
  } catch (err) {
    console.error("[analytics-v3 /home-v2] error:", err);
    return c.json(error("SERVER_ERROR", "Could not load home", 500), 500);
  }
});

// ── Shared: student home data ────────────────────────────────

async function getStudentHomeData(studentId: string) {
  const [student] = await db
    .select({ userId: students.userId, name: users.name })
    .from(students)
    .innerJoin(users, eq(users.id, students.userId))
    .where(eq(students.userId, studentId))
    .limit(1);

  if (!student) return null;

  const insights = await fetchTopStudentInsights(student.userId, 5);
  const prediction = await fetchStudentPrediction(student.userId);

  const quickstart = insights.length === 0 && prediction === null;

  return {
    headline: quickstart
      ? `Hey ${student.name.split(" ")[0]}, let's get you mapped.`
      : prediction?.trend === "improving"
        ? "You're moving in the right direction"
        : prediction?.trend === "declining"
          ? "Let's get things back on track"
          : "Your learning snapshot",
    subHeadline:
      prediction?.trendNarrative ?? "Your insights update after every exam.",
    quickstart,
    insights,
  };
}

// ── Helpers shared with the matrix route (lifted from the analytics redesign) ─

/** Postgres numerics arrive as strings; null stays null so "no data" survives. */
const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

/**
 * Resolves an explicit `?branchId=` into a read scope, for surfaces that
 * address ONE named branch (the branch dossier) rather than following the
 * sidebar switcher.
 *
 * Needed because tenantScope resolves `header || query`, so the sidebar's
 * X-Branch-Id always wins — an explicit branchId is otherwise silently
 * ignored and the page renders another branch's data under this branch's
 * name, with nothing on screen to say so.
 *
 * Narrowing only: the id is checked against what the caller may already
 * read, so this can never widen scope. Returns null when it is out of
 * bounds, so the caller can refuse rather than fall back to something
 * wider.
 */
function resolveExplicitBranch(c: Context, branchId: string): string[] | null {
  const user = c.get("user") as SessionUser;
  const permitted = CROSS_BRANCH_ROLES.has(user.role)
    ? ((c.get("institutionBranchIds") as string[]) ?? [])
    : (getEffectiveBranchIds(c) ?? []);
  return permitted.includes(branchId) ? [branchId] : null;
}

/**
 * The exam_status enum carries 10 values, three of them deprecated. For
 * analytics only four states are distinguishable and actionable, so the
 * API speaks in buckets and the UI never sees the raw enum.
 */
const EXAM_STATUS_BUCKETS: Record<string, string[]> = {
  upcoming: ["draft", "published", "pending_approval", "pending_review", "approved"],
  live: ["in_progress"],
  // Written, not yet released — the queue the "Results pending" tile counts.
  grading: ["completed", "evaluated", "key_released"],
  released: ["results_released"],
};

const CONDUCTED_STATUSES = [
  ...EXAM_STATUS_BUCKETS.live,
  ...EXAM_STATUS_BUCKETS.grading,
  ...EXAM_STATUS_BUCKETS.released,
];

const pgArray = (values: string[]) =>
  sql`ARRAY[${sql.join(values.map((v) => sql`${v}`), sql`, `)}]`;

// ── GET /matrix — the score matrix behind /analytics/compare ─
//
// ONE payload: rows × exams, cells = percentage, with raw marks
// (markCells + examMax, and subjectMarkCells + subjectMax in subjects
// mode) alongside for the marks bar chart. The page computes every
// interaction client-side (include/exclude exams, running average, σ,
// rank, sort, search, pagination) from this single fetch — that is the
// whole design: an "Excel-like" surface that costs the DB one query per
// scope instead of one per toggle.
//
// Two grains: `students` (rows = a batch's — or the institute's — active
// roster) and `batches` (rows = batches, cells = per-exam batch mean).
// `subjects=1` adds per-subject cells from exam_results_snapshot — the
// frozen marks-based breakdown, so open/unsnapshotted exams read null and
// render as a dash.
//
// Reads via dbRead, cached in Redis (scope-variant, so every scope input
// is in the key) for 5 minutes.
//
// `candidates=1` is the setup wizard's list mode: it runs ONLY the two
// id+name queries (exams + roster) and returns them without cells — the
// pick lists therefore always match what the grid can show. `examIds`/
// `rowIds` then narrow the full fetch to exactly the ticked ids.

const MATRIX_TTL_MS = 300_000;
// rows × exams ceiling. Above this the payload outgrows both the Redis
// cache cap and a sticky-column DOM; the client shows "narrow your range".
// Subjects mode multiplies cells by the subject count (typically 3-4), so
// it gets a proportionally lower base budget.
const MATRIX_CELL_BUDGET = 50_000;
const MATRIX_SUBJECT_CELL_BUDGET = 12_000;
// candidates-mode guards: id+name lists, so the ceilings are row counts,
// not cells. Also caps the deep-linked students-grain-no-batch case.
const MATRIX_CANDIDATE_ROW_BUDGET = 2_000;
const MATRIX_CANDIDATE_EXAM_BUDGET = 500;
// examIds/rowIds are URL comma-lists; beyond this the URL itself is broken.
const MATRIX_ID_LIST_CAP = 200;

/** Comma id list → sorted deduped array; null = absent/empty (no filter). */
function parseIdList(raw: string | undefined): string[] | null | "toomany" {
  if (!raw) return null;
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].sort();
  if (ids.length > MATRIX_ID_LIST_CAP) return "toomany";
  return ids.length ? ids : null;
}

// Wizard-pick IN-clause. Tenant/branch clauses stay on the CTEs it's used
// in, so a foreign id in the list simply matches nothing.
const idIn = (col: string, ids: string[] | null) =>
  ids
    ? sql`AND ${sql.raw(col)} IN (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`
    : sql``;

// Bare `col IN (…)` fragment — for OR-composing the audience clause.
const inFrag = (col: string, ids: string[]) =>
  sql`${sql.raw(col)} IN (${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )})`;

// gzip only here: nothing upstream compresses (ALB → ECS, no CDN) and the
// matrix body is dense arrays of numbers/nulls — ~5x smaller on the wire.
analyticsV3.get("/matrix", compress(), tenantScope, async (c) => {
  const user = c.get("user") as SessionUser & { institutionId?: string };
  if (!user) return c.json(error("UNAUTHORIZED", "Login required", 401), 401);
  const institutionId = user.institutionId;
  if (!institutionId) {
    return c.json(error("FORBIDDEN", "Institution context required", 403), 403);
  }

  const grain = c.req.query("grain");
  if (grain !== "students" && grain !== "batches") {
    return c.json(error("BAD_REQUEST", "grain must be 'students' or 'batches'", 400), 400);
  }
  const examType = parseExamType(c);
  if (examType === "invalid") {
    return c.json(error("BAD_REQUEST", "Unknown examType", 400), 400);
  }
  const batchId = c.req.query("batchId") || undefined;
  const from = c.req.query("from") || undefined;
  const to = c.req.query("to") || undefined;
  const subjects = c.req.query("subjects") === "1";
  const candidates = c.req.query("candidates") === "1";
  const examIds = parseIdList(c.req.query("examIds"));
  const rowIds = parseIdList(c.req.query("rowIds"));
  // Audience params from the setup wizard — the AudienceTreePicker's value
  // verbatim: whole batches, hand-added students, hand-excluded students.
  // `batchId`/`rowIds` above stay untouched for legacy deep links.
  const batchIds = parseIdList(c.req.query("batchIds"));
  const plusIds = parseIdList(c.req.query("plusIds"));
  const minusIds = parseIdList(c.req.query("minusIds"));
  if (
    examIds === "toomany" ||
    rowIds === "toomany" ||
    batchIds === "toomany" ||
    plusIds === "toomany" ||
    minusIds === "toomany"
  ) {
    return c.json(
      error("BAD_REQUEST", `At most ${MATRIX_ID_LIST_CAP} ids per list`, 400),
      400,
    );
  }

  let effectiveBranchIds = getEffectiveBranchIds(c);
  const scopedBatchIds = c.get("scopedBatchIds") as string[] | null;
  const explicitBranchId = c.req.query("branchId");
  if (explicitBranchId) {
    const resolved = resolveExplicitBranch(c, explicitBranchId);
    if (!resolved) {
      return c.json(error("FORBIDDEN", "Branch is outside your access scope", 403), 403);
    }
    effectiveBranchIds = resolved;
  }

  const cacheKey = responseCacheKey("analytics-matrix:v3:", institutionId, "1", {
    grain,
    branchIds: effectiveBranchIds ? effectiveBranchIds.join(",") : "all",
    scopedBatchIds: scopedBatchIds ? scopedBatchIds.join(",") : "all",
    batchId,
    examType: examType ?? undefined,
    from,
    to,
    subjects: subjects ? "1" : "0",
    candidates: candidates ? "1" : "0",
    // Already sorted by parseIdList, so key equality is order-insensitive.
    examIds: examIds ? examIds.join(",") : undefined,
    rowIds: rowIds ? rowIds.join(",") : undefined,
    batchIds: batchIds ? batchIds.join(",") : undefined,
    plusIds: plusIds ? plusIds.join(",") : undefined,
    minusIds: minusIds ? minusIds.join(",") : undefined,
  });
  const cached = await getCachedResponse(cacheKey);
  if (cached !== undefined) return c.json(success(cached));

  try {
    const branchIn = (col: string) =>
      effectiveBranchIds === null
        ? sql``
        : effectiveBranchIds.length === 0
          ? sql`AND false`
          : sql`AND ${sql.raw(col)} IN (${sql.join(
              effectiveBranchIds.map((id) => sql`${id}`),
              sql`, `,
            )})`;

    // Audience → columns: an exam is a column only if someone in the picked
    // audience actually sits it. Batch arm: assigned_batches overlap OR a
    // non-excluded exam_schedules slot naming the batch — or a NULL-batch
    // slot on the batch's branch (null batch = every batch in the branch).
    // That slot arm is batch-shaped, so it can't reuse slotMatchSql (which
    // is THE student-shaped predicate); the hand-picked-students arm below
    // does use it, plus assigned_students / their batch in assigned_batches.
    // Without the slot arms, every wizard "per branch/section" exam (empty
    // assigned_batches — the real weekly tests) vanished from the picked
    // audience's test list, while student-only audiences saw EVERY test.
    const audienceArms: ReturnType<typeof sql>[] = [];
    if (batchIds) {
      audienceArms.push(
        sql`e.assigned_batches && ${pgArray(batchIds)}::text[]`,
        sql`EXISTS (
          SELECT 1 FROM exam_schedules es
          JOIN batches ab ON ab.id::text = ANY(${pgArray(batchIds)}::text[])
          WHERE es.exam_id = e.id
            AND es.excluded = false
            AND (es.batch_id = ab.id OR (es.batch_id IS NULL AND es.branch_id = ab.branch_id))
        )`,
      );
    }
    if (plusIds) {
      audienceArms.push(
        sql`e.assigned_students && ${pgArray(plusIds)}::text[]`,
        sql`EXISTS (
          SELECT 1 FROM students ps
          WHERE ps.user_id::text = ANY(${pgArray(plusIds)}::text[])
            AND ps.batch_id::text = ANY(e.assigned_batches)
        )`,
        sql`EXISTS (
          SELECT 1 FROM users pu
          JOIN students ps ON ps.user_id = pu.id
          LEFT JOIN batches pb ON pb.id = ps.batch_id
          WHERE pu.id::text = ANY(${pgArray(plusIds)}::text[])
            AND ${slotMatchSql(sql`e.id`, sql`pu.id`, { student: "ps", batch: "pb" })}
        )`,
      );
    }
    const audienceColumnsClause = audienceArms.length
      ? sql`AND (${sql.join(audienceArms, sql` OR `)})`
      : sql``;

    // Column set: conducted, real, undeleted exams in scope, oldest first —
    // a scheduled-future paper would be a dead all-null column.
    const examsCte = sql`
      ex AS (
        SELECT e.id, e.title, e.exam_type, e.scheduled_start
        FROM exams e
        WHERE e.institution_id = ${institutionId}
          AND e.category = 'exam'
          AND e.deleted_at IS NULL
          AND e.archived_at IS NULL
          AND e.status::text = ANY(${pgArray(CONDUCTED_STATUSES)}::text[])
          ${examType ? sql`AND ${examTypeGuardSql(examType)}` : sql``}
          ${from ? sql`AND e.scheduled_start >= ${from}::date` : sql``}
          ${to ? sql`AND e.scheduled_start < (${to}::date + INTERVAL '1 day')` : sql``}
          ${
            // A branchless exam is institution-wide and belongs to every
            // branch's view — same rule as /exams.
            effectiveBranchIds === null
              ? sql``
              : effectiveBranchIds.length === 0
                ? sql`AND false`
                : sql`AND (e.branch_id IS NULL OR e.branch_id IN (${sql.join(
                    effectiveBranchIds.map((id) => sql`${id}`),
                    sql`, `,
                  )}))`
          }
          ${
            scopedBatchIds === null
              ? sql``
              : scopedBatchIds.length === 0
                ? sql`AND false`
                : sql`AND e.assigned_batches && ${pgArray(scopedBatchIds)}::text[]`
          }
          ${batchId ? sql`AND e.assigned_batches @> ARRAY[${batchId}]::text[]` : sql``}
          ${audienceColumnsClause}
          ${idIn("e.id", examIds)}
      )`;

    // Row set: the ACTIVE roster (the batch-population rule every batch
    // surface shares), or the batch list.
    const rosterCte =
      grain === "students"
        ? sql`
      roster AS (
        SELECT u.id AS row_id, u.name, s.roll_number, s.batch_id,
               b.name AS batch_name
        FROM users u
        JOIN students s  ON s.user_id = u.id
        LEFT JOIN batches b ON b.id = s.batch_id
        WHERE u.role = 'student'
          AND u.status = 'active'
          AND u.institution_id = ${institutionId}
          ${branchIn("u.branch_id")}
          ${
            scopedBatchIds === null
              ? sql``
              : scopedBatchIds.length === 0
                ? sql`AND false`
                : sql`AND s.batch_id IN (${sql.join(scopedBatchIds.map((id) => sql`${id}`), sql`, `)})`
          }
          ${batchId ? sql`AND s.batch_id = ${batchId}` : sql``}
          ${idIn("u.id", rowIds)}
          ${
            // Audience: whole batches ∪ hand-added students, minus
            // hand-excluded. Tenant/branch clauses stay ANDed above, so a
            // foreign id matches nothing.
            batchIds && plusIds
              ? sql`AND (${inFrag("s.batch_id", batchIds)} OR ${inFrag("u.id", plusIds)})`
              : batchIds
                ? sql`AND ${inFrag("s.batch_id", batchIds)}`
                : plusIds
                  ? sql`AND ${inFrag("u.id", plusIds)}`
                  : sql``
          }
          ${minusIds ? sql`AND NOT ${inFrag("u.id", minusIds)}` : sql``}
      )`
        : sql`
      roster AS (
        SELECT b.id AS row_id, b.name, b.target_exam, br.name AS branch_name,
               (SELECT COUNT(*)::int FROM users u
                JOIN students s ON s.user_id = u.id
                WHERE s.batch_id = b.id AND u.role = 'student'
                  AND u.status = 'active') AS size
        FROM batches b
        JOIN branches br ON br.id = b.branch_id
        WHERE br.institution_id = ${institutionId}
          AND b.status <> 'archived'
          ${branchIn("b.branch_id")}
          ${
            scopedBatchIds === null
              ? sql``
              : scopedBatchIds.length === 0
                ? sql`AND false`
                : sql`AND b.id IN (${sql.join(scopedBatchIds.map((id) => sql`${id}`), sql`, `)})`
          }
          ${batchId ? sql`AND b.id = ${batchId}` : sql``}
          ${idIn("b.id", rowIds)}
          ${idIn("b.id", batchIds)}
      )`;

    const [examRowsRaw, rosterRowsRaw] = await Promise.all([
      dbRead.execute(sql`WITH ${examsCte} SELECT * FROM ex ORDER BY scheduled_start ASC`),
      dbRead.execute(sql`WITH ${rosterCte} SELECT * FROM roster ORDER BY name ASC`),
    ]);
    const examRows = toRows(examRowsRaw);
    const rosterRows = toRows(rosterRowsRaw);

    // Shared by the candidates and full payloads so the shapes can't drift.
    const examsPayload = (examRows as any[]).map((e) => ({
      id: e.id,
      title: e.title,
      examType: e.exam_type ?? null,
      date: e.scheduled_start,
    }));
    const rowMeta = (r: any) =>
      grain === "students"
        ? {
            rollNumber: r.roll_number ?? null,
            batchId: r.batch_id ?? null,
            batchName: r.batch_name ?? null,
          }
        : {
            branchName: r.branch_name ?? null,
            targetExam: r.target_exam ?? null,
            size: Number(r.size ?? 0),
          };

    if (candidates) {
      if (
        rosterRows.length > MATRIX_CANDIDATE_ROW_BUDGET ||
        examRows.length > MATRIX_CANDIDATE_EXAM_BUDGET
      ) {
        return c.json(
          {
            success: false,
            error: "Too many options to list — narrow the date range or pick a batch",
            errorCode: "MATRIX_TOO_LARGE",
            meta: { rows: rosterRows.length, exams: examRows.length },
          },
          400,
        );
      }
      const payload = {
        grain,
        examType: examType ?? null,
        exams: examsPayload,
        rows: (rosterRows as any[]).map((r) => ({
          id: r.row_id,
          name: r.name,
          meta: rowMeta(r),
        })),
      };
      await setCachedResponse(cacheKey, payload, MATRIX_TTL_MS);
      return c.json(success(payload));
    }

    const budget = subjects ? MATRIX_SUBJECT_CELL_BUDGET : MATRIX_CELL_BUDGET;
    const cells = examRows.length * rosterRows.length;
    if (cells > budget) {
      return c.json(
        {
          success: false,
          error: "Too many cells for one grid — narrow the date range or pick a batch",
          errorCode: "MATRIX_TOO_LARGE",
          meta: { cells, budget },
        },
        400,
      );
    }

    const notHeld = sql`AND NOT EXISTS (
      SELECT 1 FROM exam_result_holds erh
      WHERE erh.exam_id = es.exam_id
        AND erh.student_id = es.student_id
        AND erh.released_at IS NULL
    )`;

    const cellRows =
      grain === "students"
        ? toRows(
            await dbRead.execute(sql`
              WITH ${examsCte}, ${rosterCte}
              SELECT es.student_id AS row_id, es.exam_id,
                     ROUND(es.percentage::numeric, 1) AS pct,
                     ROUND(es.total_score::numeric, 1) AS score,
                     ROUND(es.total_max::numeric, 1) AS max_marks
              FROM exam_submissions es
              JOIN ex ON ex.id = es.exam_id
              JOIN roster r ON r.row_id = es.student_id
              WHERE es.submitted_at IS NOT NULL
                AND es.percentage IS NOT NULL
                ${notHeld}
            `),
          )
        : toRows(
            await dbRead.execute(sql`
              WITH ${examsCte}, ${rosterCte},
              members AS (
                SELECT u.id AS student_id, s.batch_id
                FROM users u
                JOIN students s ON s.user_id = u.id
                JOIN roster r  ON r.row_id = s.batch_id
                WHERE u.role = 'student' AND u.status = 'active'
              )
              SELECT m.batch_id AS row_id, es.exam_id,
                     ROUND(AVG(es.percentage), 1) AS pct,
                     ROUND(AVG(es.total_score), 1) AS score,
                     ROUND(MAX(es.total_max), 1) AS max_marks
              FROM exam_submissions es
              JOIN ex ON ex.id = es.exam_id
              JOIN members m ON m.student_id = es.student_id
              WHERE es.submitted_at IS NOT NULL
                AND es.percentage IS NOT NULL
                ${notHeld}
              GROUP BY m.batch_id, es.exam_id
            `),
          );

    // Subjects mode: frozen marks-based breakdown per (exam, student).
    // Cell unit = subject percentage (marksEarned/maxMarks), the same unit
    // as the score cells; raw marks ride alongside for the marks bar chart
    // (comparable only against each paper's own max, which is why the
    // per-(exam, subject) maxMarks is in the payload too).
    type SubjectAgg = Map<string, { sum: number; marks: number; n: number }>; // key: rowIdx|examIdx|subjIdx
    const subjectLabels: string[] = [];
    let subjectAgg: SubjectAgg | null = null;
    // key: examIdx|subjIdx → the paper's max marks (max seen across students —
    // they should agree; max is the safe reconciliation).
    const subjectMaxAgg = new Map<string, number>();
    if (subjects && examRows.length > 0 && rosterRows.length > 0) {
      const snapRows = toRows(
        await dbRead.execute(
          grain === "students"
            ? sql`
              WITH ${examsCte}, ${rosterCte}
              SELECT ers.student_id AS member_id, r.row_id, ers.exam_id,
                     ers.subject_breakdown
              FROM exam_results_snapshot ers
              JOIN ex ON ex.id = ers.exam_id
              JOIN roster r ON r.row_id = ers.student_id
              WHERE NOT EXISTS (
                SELECT 1 FROM exam_result_holds erh
                WHERE erh.exam_id = ers.exam_id
                  AND erh.student_id = ers.student_id
                  AND erh.released_at IS NULL
              )`
            : sql`
              WITH ${examsCte}, ${rosterCte},
              members AS (
                SELECT u.id AS student_id, s.batch_id
                FROM users u
                JOIN students s ON s.user_id = u.id
                JOIN roster r  ON r.row_id = s.batch_id
                WHERE u.role = 'student' AND u.status = 'active'
              )
              SELECT ers.student_id AS member_id, m.batch_id AS row_id,
                     ers.exam_id, ers.subject_breakdown
              FROM exam_results_snapshot ers
              JOIN ex ON ex.id = ers.exam_id
              JOIN members m ON m.student_id = ers.student_id
              WHERE NOT EXISTS (
                SELECT 1 FROM exam_result_holds erh
                WHERE erh.exam_id = ers.exam_id
                  AND erh.student_id = ers.student_id
                  AND erh.released_at IS NULL
              )`,
        ),
      );

      const rowIdx = new Map(rosterRows.map((r: any, i: number) => [r.row_id, i]));
      const examIdx = new Map(examRows.map((e: any, i: number) => [e.id, i]));
      const subjIdx = new Map<string, number>();
      subjectAgg = new Map();
      for (const snap of snapRows as any[]) {
        const ri = rowIdx.get(snap.row_id);
        const ei = examIdx.get(snap.exam_id);
        if (ri === undefined || ei === undefined) continue;
        const breakdown = Array.isArray(snap.subject_breakdown)
          ? snap.subject_breakdown
          : [];
        for (const sb of breakdown) {
          const name = typeof sb?.subjectName === "string" ? sb.subjectName.trim() : "";
          const max = Number(sb?.maxMarks);
          const earned = Number(sb?.marksEarned);
          if (!name || !Number.isFinite(max) || max <= 0 || !Number.isFinite(earned)) continue;
          const key = name.toLowerCase();
          let si = subjIdx.get(key);
          if (si === undefined) {
            si = subjectLabels.length;
            subjIdx.set(key, si);
            subjectLabels.push(name);
          }
          const aggKey = `${ri}|${ei}|${si}`;
          const agg = subjectAgg.get(aggKey) ?? { sum: 0, marks: 0, n: 0 };
          agg.sum += (earned / max) * 100;
          agg.marks += earned;
          agg.n += 1;
          subjectAgg.set(aggKey, agg);
          const maxKey = `${ei}|${si}`;
          const prevMax = subjectMaxAgg.get(maxKey);
          if (prevMax === undefined || max > prevMax) subjectMaxAgg.set(maxKey, max);
        }
      }
    }

    // Assemble aligned arrays.
    const examIndex = new Map(examRows.map((e: any, i: number) => [e.id, i]));
    const emptyCells = () =>
      Array.from({ length: examRows.length }, (): number | null => null);
    const cellsByRow = new Map<string, (number | null)[]>();
    const markCellsByRow = new Map<string, (number | null)[]>();
    // Paper total max per exam — a paper property, so one scalar per column.
    const examMax = emptyCells();
    for (const r of rosterRows as any[]) {
      cellsByRow.set(r.row_id, emptyCells());
      markCellsByRow.set(r.row_id, emptyCells());
    }
    for (const cell of cellRows as any[]) {
      const ei = examIndex.get(cell.exam_id);
      if (ei === undefined) continue;
      const arr = cellsByRow.get(cell.row_id);
      if (arr) arr[ei] = num(cell.pct);
      const marks = markCellsByRow.get(cell.row_id);
      if (marks) marks[ei] = num(cell.score);
      const max = num(cell.max_marks);
      if (max != null && (examMax[ei] == null || max > examMax[ei]!)) examMax[ei] = max;
    }

    // Per-(student, exam) assignment — lets the client tell "absent"
    // (assigned, results out, no marks) from "never assigned" (stays a
    // dash). Same predicate set the exam's audience stands on:
    // assigned_students / assigned_batches / a non-excluded schedule slot,
    // minus exclusion rows (slotExclusionSql).
    const assignedByRow = new Map<string, boolean[]>();
    if (grain === "students" && examRows.length > 0 && rosterRows.length > 0) {
      const assignedPairs = toRows(
        await dbRead.execute(sql`
          WITH ${examsCte}, ${rosterCte}
          SELECT r.row_id, e.id AS exam_id
          FROM ex
          JOIN exams e ON e.id = ex.id
          CROSS JOIN roster r
          JOIN students s ON s.user_id = r.row_id
          LEFT JOIN batches b ON b.id = s.batch_id
          WHERE (
            r.row_id::text = ANY(e.assigned_students)
            OR s.batch_id::text = ANY(e.assigned_batches)
            OR ${slotMatchSql(sql`e.id`, sql`r.row_id`, { student: "s", batch: "b" })}
          )
          AND NOT ${slotExclusionSql(sql`e.id`, sql`r.row_id`, { student: "s", batch: "b" })}
        `),
      );
      for (const r of rosterRows as any[])
        assignedByRow.set(
          r.row_id,
          Array.from({ length: examRows.length }, () => false),
        );
      for (const pair of assignedPairs as any[]) {
        const ei = examIndex.get(pair.exam_id);
        const arr = assignedByRow.get(pair.row_id);
        if (ei !== undefined && arr) arr[ei] = true;
      }
    }

    const payload = {
      grain,
      examType: examType ?? null,
      ...(subjects ? { subjects: subjectLabels } : {}),
      exams: examsPayload,
      examMax,
      ...(subjects
        ? {
            subjectMax: examRows.map((_e: any, ei: number) =>
              subjectLabels.map((_s, si) => subjectMaxAgg.get(`${ei}|${si}`) ?? null),
            ),
          }
        : {}),
      rows: (rosterRows as any[]).map((r, ri) => ({
        id: r.row_id,
        name: r.name,
        meta: rowMeta(r),
        cells: cellsByRow.get(r.row_id) ?? emptyCells(),
        markCells: markCellsByRow.get(r.row_id) ?? emptyCells(),
        ...(grain === "students" ? { assigned: assignedByRow.get(r.row_id) ?? [] } : {}),
        ...(subjects
          ? {
              subjectCells: examRows.map((_e: any, ei: number) =>
                subjectLabels.map((_s, si) => {
                  const agg = subjectAgg?.get(`${ri}|${ei}|${si}`);
                  return agg && agg.n > 0
                    ? Math.round((agg.sum / agg.n) * 10) / 10
                    : null;
                }),
              ),
              subjectMarkCells: examRows.map((_e: any, ei: number) =>
                subjectLabels.map((_s, si) => {
                  const agg = subjectAgg?.get(`${ri}|${ei}|${si}`);
                  return agg && agg.n > 0
                    ? Math.round((agg.marks / agg.n) * 10) / 10
                    : null;
                }),
              ),
            }
          : {}),
      })),
    };

    await setCachedResponse(cacheKey, payload, MATRIX_TTL_MS);
    return c.json(success(payload));
  } catch (err) {
    console.error("[analytics-v3 /matrix] error:", err);
    return c.json(error("SERVER_ERROR", "Could not load the score matrix", 500), 500);
  }
});
// ── GET /student/me/home — student persona home ──────────────

analyticsV3.get("/student/me/home", async (c) => {
  const user = c.get("user") as SessionUser;
  if (!user || user.role !== "student") {
    return c.json(error("FORBIDDEN", "Student login required", 403), 403);
  }

  try {
    const data = await getStudentHomeData(user.sub);
    if (!data) return c.json(error("NOT_FOUND", "Student profile missing", 404), 404);
    return c.json(success(data));
  } catch (err) {
    console.error("[analytics-v3 /student/me/home] error:", err);
    return c.json(error("SERVER_ERROR", "Could not load home", 500), 500);
  }
});

analyticsV3.get("/student/:studentId/home", ...staffStudentGates, async (c) => {
  try {
    const data = await getStudentHomeData(c.req.param("studentId"));
    if (!data) return c.json(error("NOT_FOUND", "Student profile missing", 404), 404);
    return c.json(success(data));
  } catch (err) {
    console.error("[analytics-v3 /student/:studentId/home] error:", err);
    return c.json(error("SERVER_ERROR", "Could not load home", 500), 500);
  }
});

// ── GET /parent/me/home — parent persona home ────────────────

analyticsV3.get("/parent/me/home", async (c) => {
  const user = c.get("user") as SessionUser;
  if (!user || user.role !== "parent") {
    return c.json(error("FORBIDDEN", "Parent login required", 403), 403);
  }

  try {
    // Find the first linked child. Phase 4 adds a child switcher.
    const [link] = await db
      .select({
        studentId: parentStudentLinks.studentId,
        childName: users.name,
      })
      .from(parentStudentLinks)
      .innerJoin(users, eq(users.id, parentStudentLinks.studentId))
      .where(eq(parentStudentLinks.parentId, user.sub))
      .limit(1);

    if (!link) {
      return c.json(
        success({
          childName: null,
          childId: null,
          heroScore: null,
          heroTrend: "volatile",
          heroNarrative: "No child linked to your account yet. Ask the institution to set this up.",
          insights: [],
        }),
      );
    }

    const insights = await fetchTopStudentInsights(link.studentId, 3);
    const prediction = await fetchStudentPrediction(link.studentId);

    const heroScore = prediction?.predictedNextExam
      ? Number(prediction.predictedNextExam)
      : null;
    const heroTrend = (prediction?.trend ?? "volatile") as
      | "improving"
      | "plateau"
      | "declining"
      | "volatile";
    const heroNarrative =
      prediction?.trendNarrative ??
      "We're still learning your child's pattern. Your first weekly brief arrives Sunday.";

    return c.json(
      success({
        childName: link.childName,
        childId: link.studentId,
        heroScore,
        heroTrend,
        heroNarrative,
        insights,
      }),
    );
  } catch (err) {
    console.error("[analytics-v3 /parent/me/home] error:", err);
    return c.json(error("SERVER_ERROR", "Could not load home", 500), 500);
  }
});

// ── GET /institution/faculty-impact ──────────────────────────
// Accepts ?period=rolling_90d|this_month|this_quarter|ytd (reserved for
// future filtering — currently returns all rows regardless of period).

analyticsV3.get(
  "/institution/faculty-impact",
  requireAnyPermission("analytics:institution", "analytics:branch", "analytics:batch"),
  async (c) => {
  const user = c.get("user") as SessionUser & { institutionId?: string };
  if (!user) {
    return c.json(error("UNAUTHORIZED", "Login required", 401), 401);
  }

  const institutionId = user.institutionId;
  if (!institutionId) {
    return c.json(error("FORBIDDEN", "Institution context required", 403), 403);
  }

  // `period` param accepted but not yet used for filtering
  // c.req.query("period") → future WHERE clause

  try {
    const result = await db.execute(sql`
      SELECT
        fim.faculty_id,
        u.name,
        b.name  AS batch_name,
        s.name  AS subject_name,
        fim.avg_score_delta,
        fim.student_count,
        fim.top_drivers
      FROM faculty_impact_metrics fim
      JOIN users    u ON u.id  = fim.faculty_id
      JOIN batches  b ON b.id  = fim.batch_id
      LEFT JOIN subjects s ON s.id = fim.subject_id
      WHERE u.institution_id = ${institutionId}
      ORDER BY fim.avg_score_delta DESC
    `);

    const faculty = toRows(result).map((row) => ({
      facultyId:     row.faculty_id as string,
      name:          row.name as string,
      batch:         row.batch_name as string,
      subject:       (row.subject_name as string | null) ?? null,
      avgScoreDelta: row.avg_score_delta != null ? Number(row.avg_score_delta) : null,
      studentCount:  row.student_count != null ? Number(row.student_count) : null,
      topDrivers:    row.top_drivers as string | null,
    }));

    return c.json(success({ faculty }));
  } catch (err) {
    console.error("[analytics-v3 GET /institution/faculty-impact] error:", err);
    return c.json(error("SERVER_ERROR", "Could not load faculty impact data", 500), 500);
  }
});

// ── GET /institution/cohorts ──────────────────────────────────

const MILESTONE_LABELS: Record<string, string> = {
  month_1:    "Month 1",
  month_3:    "Month 3",
  month_6:    "Month 6",
  month_9:    "Month 9",
  month_12:   "Month 12",
  final_mock: "Final Mock",
};

const MILESTONE_ORDER = [
  "month_1",
  "month_3",
  "month_6",
  "month_9",
  "month_12",
  "final_mock",
];

analyticsV3.get(
  "/institution/cohorts",
  requirePermission("analytics:institution"),
  async (c) => {
    const user = c.get("user") as SessionUser & { institutionId?: string };
    const institutionId = (user as any).institutionId as string | undefined;
    if (!institutionId) {
      return c.json(error("FORBIDDEN", "Institution context required", 403), 403);
    }

    try {
      // Discover active cohorts from `batches` (source of truth) — this
      // surfaces cohorts even before the nightly snapshot job has run.
      const cohortRows = toRows(
        await db.execute(sql`
          SELECT DISTINCT
            b.academic_year,
            b.target_exam,
            CONCAT(b.academic_year, '::', b.target_exam) AS cohort_key
          FROM batches b
          JOIN branches br ON br.id = b.branch_id
          WHERE br.institution_id = ${institutionId}
            AND b.status != 'archived'
          ORDER BY b.academic_year DESC, b.target_exam
        `),
      ) as Array<{ academic_year: string; target_exam: string; cohort_key: string }>;

      if (cohortRows.length === 0) {
        return c.json(success({ cohorts: [] }));
      }

      // Pull all snapshots for this institution in one query (small).
      const snapRows = toRows(
        await db.execute(sql`
          SELECT cohort_key, milestone, avg_score, student_count
          FROM cohort_snapshots
          WHERE institution_id = ${institutionId}
        `),
      );
      const snapsByCohort = new Map<string, any[]>();
      for (const r of snapRows as any[]) {
        const arr = snapsByCohort.get(r.cohort_key) ?? [];
        arr.push(r);
        snapsByCohort.set(r.cohort_key, arr);
      }

      // Live enrichment per cohort — runs in parallel (each cohort's 4
      // queries also Promise.all'd).
      const enrichments = await Promise.all(
        cohortRows.map(async (cr) => {
          const ay = cr.academic_year;
          const te = cr.target_exam;
          const [sizeRow, latestRow, topRow, atRiskRow] = await Promise.all([
            db.execute(sql`
              SELECT COUNT(DISTINCT s.user_id)::int AS n
              FROM students s
              JOIN batches b ON b.id = s.batch_id
              JOIN branches br ON br.id = b.branch_id
              WHERE br.institution_id = ${institutionId}
                AND b.academic_year = ${ay}
                AND b.target_exam = ${te}
                AND b.status != 'archived'
            `),
            db.execute(sql`
              SELECT AVG(es.percentage::numeric)::numeric AS pct
              FROM exam_submissions es
              JOIN students s ON s.user_id = es.student_id
              JOIN batches b ON b.id = s.batch_id
              JOIN branches br ON br.id = b.branch_id
              WHERE br.institution_id = ${institutionId}
                AND b.academic_year = ${ay}
                AND b.target_exam = ${te}
                AND es.submitted_at >= NOW() - INTERVAL '30 days'
                AND es.percentage IS NOT NULL
            `),
            db.execute(sql`
              WITH ranked AS (
                SELECT es.student_id, es.percentage::numeric AS pct,
                       ROW_NUMBER() OVER (PARTITION BY es.student_id ORDER BY es.submitted_at DESC) AS rn
                FROM exam_submissions es
                JOIN students s ON s.user_id = es.student_id
                JOIN batches b ON b.id = s.batch_id
                JOIN branches br ON br.id = b.branch_id
                WHERE br.institution_id = ${institutionId}
                  AND b.academic_year = ${ay}
                  AND b.target_exam = ${te}
                  AND es.submitted_at IS NOT NULL
                  AND es.percentage IS NOT NULL
              )
              SELECT u.id, u.name, AVG(pct)::numeric AS avg_pct
              FROM ranked r
              JOIN users u ON u.id = r.student_id
              WHERE r.rn <= 5
              GROUP BY u.id, u.name
              HAVING COUNT(*) >= 2
              ORDER BY AVG(pct) DESC
              LIMIT 1
            `),
            db.execute(sql`
              WITH recent AS (
                SELECT es.student_id, es.percentage::numeric AS pct,
                       ROW_NUMBER() OVER (PARTITION BY es.student_id ORDER BY es.submitted_at DESC) AS rn
                FROM exam_submissions es
                JOIN students s ON s.user_id = es.student_id
                JOIN batches b ON b.id = s.batch_id
                JOIN branches br ON br.id = b.branch_id
                WHERE br.institution_id = ${institutionId}
                  AND b.academic_year = ${ay}
                  AND b.target_exam = ${te}
                  AND es.percentage IS NOT NULL
              ),
              t AS (
                SELECT student_id,
                       MAX(CASE WHEN rn = 1 THEN pct END) AS p1,
                       MAX(CASE WHEN rn = 2 THEN pct END) AS p2
                FROM recent WHERE rn <= 3 GROUP BY student_id
                HAVING COUNT(*) >= 2
              )
              SELECT COUNT(*)::int AS n FROM t WHERE p1 < p2
            `),
          ]);

          const sizeN = Number((toRows(sizeRow)[0] as any)?.n ?? 0);
          const latestPct = (toRows(latestRow)[0] as any)?.pct;
          const top = toRows(topRow)[0] as any;
          const atRiskN = Number((toRows(atRiskRow)[0] as any)?.n ?? 0);

          // Velocity from snapshot deltas (uses milestone ordering)
          const snaps = (snapsByCohort.get(cr.cohort_key) ?? [])
            .slice()
            .sort(
              (a: any, b: any) =>
                MILESTONE_ORDER.indexOf(a.milestone) - MILESTONE_ORDER.indexOf(b.milestone),
            );
          let velocity: number | null = null;
          let snapshotLatest: number | null = null;
          if (snaps.length >= 1) {
            snapshotLatest = Number((snaps[snaps.length - 1] as any).avg_score);
          }
          if (snaps.length >= 2) {
            const last = Number((snaps[snaps.length - 1] as any).avg_score ?? 0);
            const prev = Number((snaps[snaps.length - 2] as any).avg_score ?? 0);
            velocity = Math.round((last - prev) * 10) / 10;
          }

          return {
            currentSize: sizeN,
            // Prefer the snapshot's most recent milestone avg if available,
            // else fall back to the live last-30-day rolling average.
            latestAvgPct:
              snapshotLatest !== null
                ? Math.round(snapshotLatest * 10) / 10
                : latestPct != null
                  ? Math.round(Number(latestPct) * 10) / 10
                  : null,
            velocity,
            topScorer: top
              ? {
                  studentId: top.id as string,
                  name: top.name as string,
                  avgPct: Math.round(Number(top.avg_pct) * 10) / 10,
                }
              : null,
            atRiskCount: atRiskN,
          };
        }),
      );

      const cohorts = cohortRows.map((cr, i) => {
        const enrich = enrichments[i]!;
        const snaps = snapsByCohort.get(cr.cohort_key) ?? [];
        return {
          cohortId: cr.cohort_key,
          cohortName: formatCohortName(cr.academic_year, cr.target_exam),
          academicYear: cr.academic_year,
          targetExam: cr.target_exam,
          currentSize: enrich.currentSize,
          latestAvgPct: enrich.latestAvgPct,
          velocity: enrich.velocity,
          topScorer: enrich.topScorer,
          atRiskCount: enrich.atRiskCount,
          milestones: snaps.map((s: any) => ({
            milestone: s.milestone as string,
            label: MILESTONE_LABELS[s.milestone] ?? s.milestone,
            avgScore: s.avg_score != null ? Number(s.avg_score) : null,
            studentCount: s.student_count != null ? Number(s.student_count) : null,
          })),
        };
      });

      return c.json(success({ cohorts }));
    } catch (err) {
      console.error("[analytics-v3 GET /institution/cohorts] error:", err);
      return c.json(error("SERVER_ERROR", "Could not load cohort data", 500), 500);
    }
});

// ── Cohort drill-downs ────────────────────────────────────────
// Three sibling endpoints that all key by `<academic_year>::<target_exam>`
// and resolve cohort membership via batches → branches → institution_id.
// All require analytics:institution and reject cross-tenant requests with
// a 404 (so callers can't probe whether a cohort exists in another tenant).

/** Resolve a cohort key to its batch/branch chain inside the requester's
 *  institution. Returns null if the cohort doesn't exist for that
 *  institution (caller should respond 404). */
async function resolveCohort(
  cohortKey: string,
  institutionId: string,
): Promise<{ academicYear: string; targetExam: string; cohortName: string } | null> {
  const parts = parseCohortKey(cohortKey);
  if (!parts) return null;
  const exists = toRows(
    await db.execute(sql`
      SELECT 1
      FROM batches b
      JOIN branches br ON br.id = b.branch_id
      WHERE br.institution_id = ${institutionId}
        AND b.academic_year = ${parts.academicYear}
        AND b.target_exam = ${parts.targetExam}
        AND b.status != 'archived'
      LIMIT 1
    `),
  );
  if (exists.length === 0) return null;
  return {
    academicYear: parts.academicYear,
    targetExam: parts.targetExam,
    cohortName: formatCohortName(parts.academicYear, parts.targetExam),
  };
}

analyticsV3.get(
  "/institution/cohorts/:cohortKey/toppers",
  requirePermission("analytics:institution"),
  async (c) => {
    const user = c.get("user") as SessionUser & { institutionId?: string };
    const institutionId = (user as any)?.institutionId as string | undefined;
    if (!institutionId) {
      return c.json({ success: false, error: "Institution context required" }, 403);
    }
    const cohortKey = c.req.param("cohortKey");
    const limit = Math.min(50, parseInt(c.req.query("limit") ?? "10", 10) || 10);
    const recentN = Math.min(20, parseInt(c.req.query("recentN") ?? "5", 10) || 5);
    try {
      const cohort = await resolveCohort(cohortKey, institutionId);
      if (!cohort) {
        return c.json({ success: false, error: "Cohort not found" }, 404);
      }
      const rows = toRows(
        await db.execute(sql`
          WITH ranked AS (
            SELECT es.student_id, es.percentage::numeric AS pct,
                   ROW_NUMBER() OVER (PARTITION BY es.student_id ORDER BY es.submitted_at DESC) AS rn
            FROM exam_submissions es
            JOIN students s ON s.user_id = es.student_id
            JOIN batches b ON b.id = s.batch_id
            JOIN branches br ON br.id = b.branch_id
            WHERE br.institution_id = ${institutionId}
              AND b.academic_year = ${cohort.academicYear}
              AND b.target_exam = ${cohort.targetExam}
              AND es.submitted_at IS NOT NULL
              AND es.percentage IS NOT NULL
              -- active result holds are excluded from cohort math
              AND NOT EXISTS (
                SELECT 1 FROM exam_result_holds erh
                WHERE erh.exam_id = es.exam_id
                  AND erh.student_id = es.student_id
                  AND erh.released_at IS NULL
              )
          ),
          recent_avg AS (
            SELECT student_id,
                   AVG(pct)::numeric AS avg_pct,
                   COUNT(*)::int AS exam_count
            FROM ranked WHERE rn <= ${recentN}
            GROUP BY student_id HAVING COUNT(*) >= 2
          )
          SELECT ra.student_id, u.name AS student_name,
                 b.id AS batch_id, b.name AS batch_name,
                 br.id AS branch_id, br.name AS branch_name,
                 ra.avg_pct, ra.exam_count
          FROM recent_avg ra
          JOIN users u ON u.id = ra.student_id
          LEFT JOIN students s ON s.user_id = ra.student_id
          LEFT JOIN batches b ON b.id = s.batch_id
          LEFT JOIN branches br ON br.id = b.branch_id
          ORDER BY ra.avg_pct DESC
          LIMIT ${limit}
        `),
      );
      const toppers = rows.map((r: any, i: number) => ({
        rank: i + 1,
        studentId: r.student_id as string,
        studentName: r.student_name as string,
        batchId: r.batch_id as string | null,
        batchName: r.batch_name as string | null,
        branchId: r.branch_id as string | null,
        branchName: r.branch_name as string | null,
        avgPercentage: Math.round(Number(r.avg_pct) * 10) / 10,
        examCount: Number(r.exam_count),
      }));
      return c.json({
        success: true,
        data: {
          cohortKey,
          cohortName: cohort.cohortName,
          recentN,
          toppers,
        },
      });
    } catch (err) {
      console.error("[Analytics V3] cohort toppers error:", err);
      return c.json({ success: false, error: "Failed to compute cohort toppers" }, 500);
    }
  },
);

analyticsV3.get(
  "/institution/cohorts/:cohortKey/distribution",
  requirePermission("analytics:institution"),
  async (c) => {
    const user = c.get("user") as SessionUser & { institutionId?: string };
    const institutionId = (user as any)?.institutionId as string | undefined;
    if (!institutionId) {
      return c.json({ success: false, error: "Institution context required" }, 403);
    }
    const cohortKey = c.req.param("cohortKey");
    const milestoneFilter = c.req.query("milestone");
    try {
      const cohort = await resolveCohort(cohortKey, institutionId);
      if (!cohort) {
        return c.json({ success: false, error: "Cohort not found" }, 404);
      }
      // Bucket each submission into a milestone using the same window the
      // refreshCohortSnapshots cron uses, then compute quartiles per bucket.
      const yearStart = `${cohort.academicYear.slice(0, 4)}-04-01`;
      const rows = toRows(
        await db.execute(sql`
          WITH bucketed AS (
            SELECT
              es.percentage::numeric AS pct,
              CASE
                WHEN EXTRACT(MONTH FROM AGE(e.scheduled_start, ${yearStart}::date)) <= 1 THEN 'month_1'
                WHEN EXTRACT(MONTH FROM AGE(e.scheduled_start, ${yearStart}::date)) <= 3 THEN 'month_3'
                WHEN EXTRACT(MONTH FROM AGE(e.scheduled_start, ${yearStart}::date)) <= 6 THEN 'month_6'
                WHEN EXTRACT(MONTH FROM AGE(e.scheduled_start, ${yearStart}::date)) <= 9 THEN 'month_9'
                WHEN EXTRACT(MONTH FROM AGE(e.scheduled_start, ${yearStart}::date)) <= 12 THEN 'month_12'
                ELSE 'final_mock'
              END AS milestone
            FROM exam_submissions es
            JOIN exams e ON e.id = es.exam_id
            JOIN students s ON s.user_id = es.student_id
            JOIN batches b ON b.id = s.batch_id
            JOIN branches br ON br.id = b.branch_id
            WHERE br.institution_id = ${institutionId}
              AND b.academic_year = ${cohort.academicYear}
              AND b.target_exam = ${cohort.targetExam}
              AND es.percentage IS NOT NULL
              AND e.scheduled_start IS NOT NULL
          )
          SELECT
            milestone,
            COUNT(*)::int AS n,
            MIN(pct)::numeric AS min_pct,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY pct)::numeric AS q1,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pct)::numeric AS median,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY pct)::numeric AS q3,
            MAX(pct)::numeric AS max_pct,
            AVG(pct)::numeric AS mean_pct
          FROM bucketed
          ${milestoneFilter ? sql`WHERE milestone = ${milestoneFilter}` : sql``}
          GROUP BY milestone
          ORDER BY
            CASE milestone
              WHEN 'month_1' THEN 1
              WHEN 'month_3' THEN 2
              WHEN 'month_6' THEN 3
              WHEN 'month_9' THEN 4
              WHEN 'month_12' THEN 5
              WHEN 'final_mock' THEN 6
              ELSE 7
            END
        `),
      );
      const distribution = rows.map((r: any) => ({
        milestone: r.milestone as string,
        label: MILESTONE_LABELS[r.milestone] ?? r.milestone,
        sampleSize: Number(r.n),
        min: Math.round(Number(r.min_pct) * 10) / 10,
        q1: Math.round(Number(r.q1) * 10) / 10,
        median: Math.round(Number(r.median) * 10) / 10,
        q3: Math.round(Number(r.q3) * 10) / 10,
        max: Math.round(Number(r.max_pct) * 10) / 10,
        mean: Math.round(Number(r.mean_pct) * 10) / 10,
      }));
      return c.json({
        success: true,
        data: {
          cohortKey,
          cohortName: cohort.cohortName,
          distribution,
        },
      });
    } catch (err) {
      console.error("[Analytics V3] cohort distribution error:", err);
      return c.json({ success: false, error: "Failed to compute distribution" }, 500);
    }
  },
);

analyticsV3.get(
  "/institution/cohorts/:cohortKey/student-rank",
  requirePermission("analytics:institution"),
  async (c) => {
    const user = c.get("user") as SessionUser & { institutionId?: string };
    const institutionId = (user as any)?.institutionId as string | undefined;
    if (!institutionId) {
      return c.json({ success: false, error: "Institution context required" }, 403);
    }
    const cohortKey = c.req.param("cohortKey");
    const studentId = c.req.query("studentId");
    if (!studentId) {
      return c.json({ success: false, error: "studentId query param required" }, 400);
    }
    try {
      const cohort = await resolveCohort(cohortKey, institutionId);
      if (!cohort) {
        return c.json({ success: false, error: "Cohort not found" }, 404);
      }

      // Verify the student belongs to this cohort + this institution.
      const stRows = toRows(
        await db.execute(sql`
          SELECT u.id, u.name
          FROM users u
          JOIN students s ON s.user_id = u.id
          JOIN batches b ON b.id = s.batch_id
          JOIN branches br ON br.id = b.branch_id
          WHERE u.id = ${studentId}
            AND br.institution_id = ${institutionId}
            AND b.academic_year = ${cohort.academicYear}
            AND b.target_exam = ${cohort.targetExam}
          LIMIT 1
        `),
      );
      if (stRows.length === 0) {
        return c.json(
          { success: false, error: "Student not in this cohort" },
          404,
        );
      }
      const student = stRows[0] as { id: string; name: string };

      // Compute per-student avg over last 5 exams for everyone in cohort,
      // then rank + percentile + medians.
      const cohortRows = toRows(
        await db.execute(sql`
          WITH ranked AS (
            SELECT es.student_id, es.percentage::numeric AS pct,
                   ROW_NUMBER() OVER (PARTITION BY es.student_id ORDER BY es.submitted_at DESC) AS rn
            FROM exam_submissions es
            JOIN students s ON s.user_id = es.student_id
            JOIN batches b ON b.id = s.batch_id
            JOIN branches br ON br.id = b.branch_id
            WHERE br.institution_id = ${institutionId}
              AND b.academic_year = ${cohort.academicYear}
              AND b.target_exam = ${cohort.targetExam}
              AND es.submitted_at IS NOT NULL
              AND es.percentage IS NOT NULL
              -- active result holds are excluded from cohort math
              AND NOT EXISTS (
                SELECT 1 FROM exam_result_holds erh
                WHERE erh.exam_id = es.exam_id
                  AND erh.student_id = es.student_id
                  AND erh.released_at IS NULL
              )
          )
          SELECT student_id, AVG(pct)::numeric AS avg_pct, COUNT(*)::int AS n
          FROM ranked
          WHERE rn <= 5
          GROUP BY student_id
          HAVING COUNT(*) >= 1
          ORDER BY AVG(pct) DESC
        `),
      ) as Array<{ student_id: string; avg_pct: string; n: number }>;

      const cohortSize = cohortRows.length;
      if (cohortSize === 0) {
        return c.json({
          success: true,
          data: {
            studentId: student.id,
            studentName: student.name,
            cohortKey,
            cohortName: cohort.cohortName,
            cohortSize: 0,
            cohortMedianPct: null,
            studentAvgPct: null,
            percentile: null,
            rankInCohort: null,
            deltaVsMedian: null,
            topScorer: null,
            gapToTop: null,
            subjectDeltas: [],
          },
        });
      }
      const studentIdx = cohortRows.findIndex(
        (r) => r.student_id === student.id,
      );
      const studentRow = studentIdx >= 0 ? cohortRows[studentIdx] : null;
      const studentAvgPct = studentRow ? Number(studentRow.avg_pct) : null;
      const rank = studentIdx >= 0 ? studentIdx + 1 : null;
      const percentile =
        rank !== null
          ? Math.round(((cohortSize - rank) / Math.max(cohortSize - 1, 1)) * 1000) / 10
          : null;
      const medianIdx = Math.floor(cohortSize / 2);
      const cohortMedianPct = Number(cohortRows[medianIdx]?.avg_pct ?? 0);
      const top = cohortRows[0];
      const topScorerName = top
        ? (
            toRows(
              await db.execute(sql`SELECT name FROM users WHERE id = ${top.student_id}`),
            )[0] as { name: string } | undefined
          )?.name ?? "Unknown"
        : null;
      const gapToTop =
        studentAvgPct !== null && top
          ? Math.round((Number(top.avg_pct) - studentAvgPct) * 10) / 10
          : null;

      // Per-subject delta vs cohort
      const subjectRows = toRows(
        await db.execute(sql`
          WITH per_student_subject AS (
            SELECT
              es.student_id,
              s.name AS subject_name,
              AVG(CASE WHEN er.is_correct THEN 1.0 ELSE 0.0 END)::numeric AS accuracy
            FROM exam_responses er
            JOIN exam_submissions es ON es.id = er.submission_id
            JOIN questions q ON q.id = er.question_id
            JOIN syllabus_tree st ON st.id = q.syllabus_node_id
            JOIN subjects s ON s.id = st.subject_id
            JOIN students stu ON stu.user_id = es.student_id
            JOIN batches b ON b.id = stu.batch_id
            JOIN branches br ON br.id = b.branch_id
            WHERE br.institution_id = ${institutionId}
              AND b.academic_year = ${cohort.academicYear}
              AND b.target_exam = ${cohort.targetExam}
              -- active result holds are excluded from cohort math
              AND NOT EXISTS (
                SELECT 1 FROM exam_result_holds erh
                WHERE erh.exam_id = es.exam_id
                  AND erh.student_id = es.student_id
                  AND erh.released_at IS NULL
              )
            GROUP BY es.student_id, s.name
          )
          SELECT
            subject_name,
            AVG(accuracy) FILTER (WHERE student_id = ${student.id})::numeric AS student_acc,
            AVG(accuracy)::numeric AS cohort_acc
          FROM per_student_subject
          GROUP BY subject_name
        `),
      ) as Array<{ subject_name: string; student_acc: string | null; cohort_acc: string }>;

      const subjectDeltas = subjectRows
        .filter((r) => r.student_acc !== null)
        .map((r) => {
          const studentPct = Math.round(Number(r.student_acc) * 1000) / 10;
          const cohortPct = Math.round(Number(r.cohort_acc) * 1000) / 10;
          return {
            subjectName: r.subject_name,
            studentPct,
            cohortAvgPct: cohortPct,
            delta: Math.round((studentPct - cohortPct) * 10) / 10,
          };
        })
        .sort((a, b) => b.delta - a.delta);

      return c.json({
        success: true,
        data: {
          studentId: student.id,
          studentName: student.name,
          cohortKey,
          cohortName: cohort.cohortName,
          cohortSize,
          cohortMedianPct: Math.round(cohortMedianPct * 10) / 10,
          studentAvgPct: studentAvgPct !== null ? Math.round(studentAvgPct * 10) / 10 : null,
          percentile,
          rankInCohort: rank,
          deltaVsMedian:
            studentAvgPct !== null
              ? Math.round((studentAvgPct - cohortMedianPct) * 10) / 10
              : null,
          topScorer: top
            ? {
                studentId: top.student_id,
                name: topScorerName,
                avgPct: Math.round(Number(top.avg_pct) * 10) / 10,
              }
            : null,
          gapToTop,
          subjectDeltas,
        },
      });
    } catch (err) {
      console.error("[Analytics V3] cohort student-rank error:", err);
      return c.json({ success: false, error: "Failed to compute student rank" }, 500);
    }
  },
);

// ── POST /pta-report/:studentId — generate PTA report ────────

analyticsV3.post(
  "/pta-report/:studentId",
  requirePermission("analytics:batch"),
  async (c) => {
  const user = c.get("user") as SessionUser;
  const studentId = c.req.param("studentId");
  if (!(await verifyUserOwnership(studentId, c))) {
    return c.json(error("NOT_FOUND", "Student not found", 404), 404);
  }

  let body: { periodStart?: string; periodEnd?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // body is optional — defaults applied below
  }

  const now = new Date();
  const periodEndDate = body.periodEnd ? new Date(body.periodEnd) : now;
  const periodStartDate = body.periodStart
    ? new Date(body.periodStart)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(periodEndDate.getTime()) || Number.isNaN(periodStartDate.getTime())) {
    return c.json(error("VALIDATION_ERROR", "Invalid periodStart or periodEnd", 400), 400);
  }
  const periodEnd = periodEndDate.toISOString();
  const periodStart = periodStartDate.toISOString();

  try {
    const report = await generatePTAReport({
      studentId,
      generatedBy: user.sub,
      periodStart,
      periodEnd,
    });
    return c.json(
      success({
        reportId: report.reportId,
        shareToken: report.shareToken,
        html: report.html,
      }),
    );
  } catch (err) {
    console.error("[analytics-v3 POST /pta-report/:studentId] error:", err);
    return c.json(error("SERVER_ERROR", "Could not generate PTA report", 500), 500);
  }
},
);

// ── GET /pta-report/shared/:token — public share link ────────
// No auth — parents access via share link.

analyticsV3.get("/pta-report/shared/:token", async (c) => {
  const token = c.req.param("token");

  try {
    const reportData = await getPTAReportByToken(token);
    if (!reportData) {
      return c.json(error("NOT_FOUND", "Report not found or link has expired", 404), 404);
    }
    return c.json(success({ data: reportData }));
  } catch (err) {
    console.error("[analytics-v3 GET /pta-report/shared/:token] error:", err);
    return c.json(error("SERVER_ERROR", "Could not load report", 500), 500);
  }
});

// ════════════════════════════════════════════════════════════════
// BATCH ENDPOINTS — /batch/:id/...
// ════════════════════════════════════════════════════════════════

// ── 1. GET /batch/:id/bell-curve ──────────────────────────────
analyticsV3.get("/batch/:id/bell-curve", async (c) => {
  const batchId = c.req.param("id");
  try {
    const [batchRow, examRow] = await Promise.all([
      db.execute(sql`SELECT name FROM batches WHERE id = ${batchId}`).then(toRows),
      db.execute(sql`
        SELECT id, title FROM exams
        WHERE ${batchId} = ANY(assigned_batches)
        ORDER BY scheduled_start DESC NULLS LAST
        LIMIT 1
      `).then(toRows),
    ]);
    const batchName = batchRow[0]?.name ?? "Unknown Batch";
    const examId = examRow[0]?.id;
    const examName = examRow[0]?.title ?? "N/A";

    if (!examId) {
      return c.json({
        success: true,
        data: { batchName, examName, buckets: [], mean: 0, stdDev: 0, totalStudents: 0 },
      });
    }

    const studentIds = await getBatchStudentIds(batchId);

    if (studentIds.length === 0) {
      return c.json({
        success: true,
        data: { batchName, examName, buckets: [], mean: 0, stdDev: 0, totalStudents: 0 },
      });
    }

    const stats = toRows(
      await db.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COALESCE(AVG(percentage::numeric), 0) AS mean,
          COALESCE(STDDEV_POP(percentage::numeric), 0) AS std_dev,
          COUNT(*) FILTER (WHERE percentage::numeric < 10)  AS b0,
          COUNT(*) FILTER (WHERE percentage::numeric >= 10 AND percentage::numeric < 20) AS b1,
          COUNT(*) FILTER (WHERE percentage::numeric >= 20 AND percentage::numeric < 30) AS b2,
          COUNT(*) FILTER (WHERE percentage::numeric >= 30 AND percentage::numeric < 40) AS b3,
          COUNT(*) FILTER (WHERE percentage::numeric >= 40 AND percentage::numeric < 50) AS b4,
          COUNT(*) FILTER (WHERE percentage::numeric >= 50 AND percentage::numeric < 60) AS b5,
          COUNT(*) FILTER (WHERE percentage::numeric >= 60 AND percentage::numeric < 70) AS b6,
          COUNT(*) FILTER (WHERE percentage::numeric >= 70 AND percentage::numeric < 80) AS b7,
          COUNT(*) FILTER (WHERE percentage::numeric >= 80 AND percentage::numeric < 90) AS b8,
          COUNT(*) FILTER (WHERE percentage::numeric >= 90) AS b9
        FROM exam_submissions
        WHERE exam_id = ${examId}
          AND student_id IN (${sql.join(studentIds.map(id => sql`${id}`), sql`, `)})
          -- active result holds are excluded from cohort math
          AND NOT EXISTS (
            SELECT 1 FROM exam_result_holds erh
            WHERE erh.exam_id = exam_submissions.exam_id
              AND erh.student_id = exam_submissions.student_id
              AND erh.released_at IS NULL
          )
      `)
    );

    const s = stats[0] ?? {};
    const buckets = [
      { range: "0-10%", count: Number(s.b0 ?? 0) },
      { range: "10-20%", count: Number(s.b1 ?? 0) },
      { range: "20-30%", count: Number(s.b2 ?? 0) },
      { range: "30-40%", count: Number(s.b3 ?? 0) },
      { range: "40-50%", count: Number(s.b4 ?? 0) },
      { range: "50-60%", count: Number(s.b5 ?? 0) },
      { range: "60-70%", count: Number(s.b6 ?? 0) },
      { range: "70-80%", count: Number(s.b7 ?? 0) },
      { range: "80-90%", count: Number(s.b8 ?? 0) },
      { range: "90-100%", count: Number(s.b9 ?? 0) },
    ];

    return c.json({
      success: true,
      data: {
        batchName,
        examName,
        buckets,
        mean: Math.round(Number(s.mean ?? 0) * 100) / 100,
        stdDev: Math.round(Number(s.std_dev ?? 0) * 100) / 100,
        totalStudents: Number(s.total ?? 0),
      },
    });
  } catch (err) {
    console.error("[Analytics V3] bell-curve error:", err);
    return c.json({ success: false, error: "Failed to compute bell curve" }, 500);
  }
});

// ── 2. GET /batch/:id/box-plot ────────────────────────────────
analyticsV3.get("/batch/:id/box-plot", async (c) => {
  const batchId = c.req.param("id");
  try {
    const studentIds = await getBatchStudentIds(batchId);

    if (studentIds.length === 0) {
      return c.json({ success: true, data: { subjects: [] } });
    }

    const rows = toRows(
      await db.execute(sql`
        WITH er_agg AS (
          SELECT
            q.subject_id,
            es.student_id,
            CASE WHEN COUNT(er.id) = 0 THEN 0
                 ELSE (SUM(CASE WHEN er.is_correct THEN 1 ELSE 0 END)::numeric / COUNT(er.id)) * 100
            END AS pct
          FROM exam_responses er
          JOIN exam_submissions es ON es.id = er.submission_id
          JOIN questions q ON q.id = er.question_id
          WHERE es.student_id IN (${sql.join(studentIds.map(id => sql`${id}`), sql`, `)})
            -- active result holds are excluded from cohort math
            AND NOT EXISTS (
              SELECT 1 FROM exam_result_holds erh
              WHERE erh.exam_id = es.exam_id
                AND erh.student_id = es.student_id
                AND erh.released_at IS NULL
            )
          GROUP BY q.subject_id, es.student_id
        ),
        quartiles AS (
          SELECT
            subject_id,
            MIN(pct) AS min_val,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY pct) AS q1,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pct) AS median,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY pct) AS q3,
            MAX(pct) AS max_val
          FROM er_agg
          GROUP BY subject_id
        )
        SELECT
          s.name,
          qr.min_val,
          qr.q1,
          qr.median,
          qr.q3,
          qr.max_val,
          COALESCE((
            SELECT COUNT(*)::int FROM er_agg ea
            WHERE ea.subject_id = qr.subject_id
              AND (ea.pct < qr.q1 - 1.5 * (qr.q3 - qr.q1)
                   OR ea.pct > qr.q3 + 1.5 * (qr.q3 - qr.q1))
          ), 0) AS outlier_count
        FROM quartiles qr
        JOIN subjects s ON s.id = qr.subject_id
        ORDER BY s.name
      `)
    );

    const subjects = rows.map((r: any) => ({
      name: r.name,
      min: Math.round(Number(r.min_val ?? 0) * 100) / 100,
      q1: Math.round(Number(r.q1 ?? 0) * 100) / 100,
      median: Math.round(Number(r.median ?? 0) * 100) / 100,
      q3: Math.round(Number(r.q3 ?? 0) * 100) / 100,
      max: Math.round(Number(r.max_val ?? 0) * 100) / 100,
      outlierCount: Number(r.outlier_count ?? 0),
    }));

    return c.json({ success: true, data: { subjects } });
  } catch (err) {
    console.error("[Analytics V3] box-plot error:", err);
    return c.json({ success: false, error: "Failed to compute box plot" }, 500);
  }
});

// ── 3. GET /batch/:id/at-risk ─────────────────────────────────
analyticsV3.get("/batch/:id/at-risk", async (c) => {
  const batchId = c.req.param("id");
  try {
    const batchRow = toRows(
      await db.execute(sql`SELECT name FROM batches WHERE id = ${batchId}`)
    );
    const batchName = batchRow[0]?.name ?? "Unknown Batch";

    // At-risk detection — previously this filter required ≥2 exams AND
    // a strictly declining trend, so a student who scored 20% on their
    // first (and only) exam was invisible until they took a second
    // exam *and* dropped further. Broaden to include three paths a
    // student becomes at-risk:
    //   • absolute latest score below 40%   (failing a recent exam)
    //   • rolling average below 50%         (consistently struggling)
    //   • strict decline across last 2/3    (original trend check)
    // Single-exam students still qualify if their only score < 40%.
    const rows = toRows(
      await db.execute(sql`
        WITH student_recent AS (
          SELECT
            es.student_id,
            es.percentage::numeric AS pct,
            ROW_NUMBER() OVER (PARTITION BY es.student_id ORDER BY es.submitted_at DESC) AS rn
          FROM exam_submissions es
          JOIN students st ON st.user_id = es.student_id
          WHERE st.batch_id = ${batchId}
            AND es.percentage IS NOT NULL
            -- active result holds are excluded from cohort math
            AND NOT EXISTS (
              SELECT 1 FROM exam_result_holds erh
              WHERE erh.exam_id = es.exam_id
                AND erh.student_id = es.student_id
                AND erh.released_at IS NULL
            )
        ),
        trends AS (
          SELECT
            student_id,
            AVG(pct) AS avg_pct,
            MAX(CASE WHEN rn = 1 THEN pct END) AS latest,
            MAX(CASE WHEN rn = 2 THEN pct END) AS second,
            MAX(CASE WHEN rn = 3 THEN pct END) AS third,
            COUNT(*) AS exam_count
          FROM student_recent
          WHERE rn <= 3
          GROUP BY student_id
        )
        SELECT
          t.student_id,
          u.name,
          t.avg_pct,
          t.latest,
          t.second,
          t.third,
          t.exam_count
        FROM trends t
        JOIN users u ON u.id = t.student_id
        WHERE t.exam_count >= 1
          AND (
            t.latest < 40
            OR t.avg_pct < 50
            OR (t.second IS NOT NULL AND t.latest < t.second)
            OR (t.third IS NOT NULL AND t.second < t.third)
          )
        ORDER BY t.avg_pct ASC
        LIMIT 100
      `)
    );

    // Compute weakest CHAPTER per at-risk student. Walks the syllabus tree
    // up to the nearest chapter ancestor so subtopic-tagged questions roll
    // up correctly (teachers think in chapters; rollup also aggregates
    // sparse data so we stop showing "Insufficient data" everywhere).
    // Ranking: weakness_score = (1 - accuracy) * LN(1 + attempts) — a
    // chapter with 8 attempts at 20% beats one with 2 attempts at 0%, but
    // the 0% chapter still surfaces with low confidence.
    const studentIds = rows.map((r: any) => r.student_id);
    type WeakChapter = {
      name: string;
      attempts: number;
      accuracy: number;
      score: number;
    };
    const weakestChapterMap = new Map<string, WeakChapter>();
    if (studentIds.length > 0) {
      const wt = toRows(
        await db.execute(sql`
          WITH RECURSIVE walk AS (
            SELECT id AS leaf_id, id AS curr_id, parent_id, level::text AS lvl, name, 0 AS depth
            FROM syllabus_tree
            WHERE id IN (
              SELECT DISTINCT q.syllabus_node_id
              FROM exam_responses er
              JOIN exam_submissions es ON es.id = er.submission_id
              JOIN questions q ON q.id = er.question_id
              WHERE es.student_id IN (${sql.join(studentIds.map((id: string) => sql`${id}`), sql`, `)})
                AND q.syllabus_node_id IS NOT NULL
            )
            UNION ALL
            SELECT w.leaf_id, p.id, p.parent_id, p.level::text, p.name, w.depth + 1
            FROM walk w
            JOIN syllabus_tree p ON p.id = w.parent_id
            WHERE w.lvl <> 'chapter' AND w.depth < 5
          ),
          chapter_for_node AS (
            -- Pick the chapter ancestor when present, else the deepest walked node.
            SELECT DISTINCT ON (leaf_id)
              leaf_id,
              curr_id AS chapter_id,
              name AS chapter_name
            FROM walk
            ORDER BY leaf_id, (lvl = 'chapter')::int DESC, depth DESC
          ),
          per_chapter AS (
            SELECT
              es.student_id,
              cfn.chapter_id,
              cfn.chapter_name,
              COUNT(er.id)::int AS attempts,
              AVG(CASE WHEN er.is_correct THEN 1.0 ELSE 0.0 END)::numeric AS accuracy
            FROM exam_responses er
            JOIN exam_submissions es ON es.id = er.submission_id
            JOIN questions q ON q.id = er.question_id
            JOIN chapter_for_node cfn ON cfn.leaf_id = q.syllabus_node_id
            WHERE es.student_id IN (${sql.join(studentIds.map((id: string) => sql`${id}`), sql`, `)})
            GROUP BY es.student_id, cfn.chapter_id, cfn.chapter_name
          ),
          ranked AS (
            SELECT
              student_id,
              chapter_name,
              attempts,
              accuracy,
              (1 - accuracy) * LN(1 + attempts) AS score,
              ROW_NUMBER() OVER (
                PARTITION BY student_id
                ORDER BY (1 - accuracy) * LN(1 + attempts) DESC, attempts DESC
              ) AS rn
            FROM per_chapter
          )
          SELECT student_id, chapter_name, attempts, accuracy, score
          FROM ranked WHERE rn = 1
        `),
      );
      for (const w of wt as any[]) {
        weakestChapterMap.set(w.student_id, {
          name: w.chapter_name,
          attempts: Number(w.attempts),
          accuracy: Number(w.accuracy),
          score: Number(w.score),
        });
      }
    }

    const students = rows.map((r: any) => {
      const examCount = Number(r.exam_count ?? 0);
      const latest = Number(r.latest ?? 0);
      const second = r.second != null ? Number(r.second) : null;
      const third = r.third != null ? Number(r.third) : null;
      const avgPct = Number(r.avg_pct ?? 0);

      // Two risk components:
      //   1. Absolute shortfall — how far below 60% is the rolling avg
      //   2. Decline — how much latest dropped vs earlier exams
      // Either can push a student into the list. The higher of the two
      // drives the score so a consistent 30%-scorer isn't scored lower
      // than a declining 70→60% student.
      const decline =
        third != null && third > 0
          ? ((third - latest) / third) * 100
          : second != null && second > 0
            ? ((second - latest) / Math.max(second, 1)) * 100
            : 0;
      const absoluteShortfall = Math.max(0, 60 - avgPct);
      const riskScore = Math.min(
        100,
        Math.round(Math.max(0, Math.max(decline, 0) + absoluteShortfall)),
      );

      // Trend label — what the UI chip shows. "declining" only when
      // we have evidence; otherwise classify by the absolute score.
      let trend: "declining" | "stagnant" | "volatile" | "improving";
      if (second != null && latest < second) {
        trend = "declining";
      } else if (third != null && second != null && second < third) {
        trend = "declining";
      } else if (avgPct < 40) {
        trend = "stagnant";
      } else if (examCount === 1) {
        trend = "stagnant";
      } else {
        trend = "stagnant";
      }

      const wc = weakestChapterMap.get(r.student_id);
      const confidence: "high" | "medium" | "low" | null = wc
        ? wc.attempts >= 8
          ? "high"
          : wc.attempts >= 3
            ? "medium"
            : "low"
        : null;

      // Coarse list-level recommended action (the detail endpoint computes
      // a richer one with full signals via buildRecommendedAction).
      const action =
        avgPct < 40
          ? {
              kind: "one_on_one" as const,
              label: "Schedule 1-on-1 review",
              href: null,
              reason: `Score ${avgPct.toFixed(0)}% — immediate intervention`,
            }
          : wc && wc.attempts >= 3
            ? {
                kind: "assign_dpp" as const,
                label: `Assign DPP — ${wc.name}`,
                href: null,
                reason: `${Math.round((1 - wc.accuracy) * 100)}% wrong across ${wc.attempts} attempts`,
              }
            : {
                kind: "diagnostic_practice" as const,
                label: "Assign diagnostic practice",
                href: null,
                reason: "Surface specific gaps with a mixed practice set",
              };

      return {
        studentId: r.student_id,
        name: r.name,
        riskScore,
        trend,
        examCount,
        // Both fields kept: topWeakTopic for the existing client field name
        // (so this PR doesn't break the current page mid-deploy), plus the
        // richer chapter object the new detail page consumes.
        topWeakTopic: wc?.name ?? "Not enough exam data yet",
        topWeakChapter: wc
          ? {
              name: wc.name,
              attempts: wc.attempts,
              accuracyPct: Math.round(wc.accuracy * 1000) / 10,
              confidence,
            }
          : null,
        recommendedAction: action,
        recentAvgPercent: Math.round(avgPct * 100) / 100,
        latestPercent: Math.round(latest * 100) / 100,
      };
    });

    return c.json({ success: true, data: { batchName, students } });
  } catch (err) {
    console.error("[Analytics V3] at-risk error:", err);
    return c.json({ success: false, error: "Failed to compute at-risk students" }, 500);
  }
});

// ── GET /batch/:id/at-risk/export — Excel of at-risk roster ──
// Same cohort as the list above (declining trend, last 3 exams) but
// materialised into a one-row-per-student spreadsheet so faculty can
// sort, filter, and print the list for a review meeting. Kept as
// Excel-only because the weakest-chapter column and recommended
// action copy read poorly in a PDF table.
analyticsV3.get("/batch/:id/at-risk/export", async (c) => {
  const batchId = c.req.param("id");
  const format = (c.req.query("format") || "xlsx").toLowerCase();
  if (!isSupportedFormat(format, ["xlsx"] as const)) {
    return c.json(error("BAD_FORMAT", "format must be xlsx", 400), 400);
  }
  try {
    const batchRow = toRows(
      await db.execute(sql`SELECT name FROM batches WHERE id = ${batchId}`),
    );
    if (batchRow.length === 0) {
      return c.json(error("NOT_FOUND", "Batch not found", 404), 404);
    }
    const batchName = String(batchRow[0]?.name ?? "Batch");

    // Same ranking as GET /batch/:id/at-risk — last 3 exams, declining
    // trend only. Re-runs the same SQL rather than sharing compute to
    // avoid risky refactor of a hot path.
    const rows = toRows(
      await db.execute(sql`
        WITH student_recent AS (
          SELECT
            es.student_id,
            es.percentage::numeric AS pct,
            ROW_NUMBER() OVER (PARTITION BY es.student_id ORDER BY es.submitted_at DESC) AS rn
          FROM exam_submissions es
          JOIN students st ON st.user_id = es.student_id
          WHERE st.batch_id = ${batchId}
            -- active result holds are excluded from cohort math
            AND NOT EXISTS (
              SELECT 1 FROM exam_result_holds erh
              WHERE erh.exam_id = es.exam_id
                AND erh.student_id = es.student_id
                AND erh.released_at IS NULL
            )
        ),
        trends AS (
          SELECT
            student_id,
            AVG(pct) AS avg_pct,
            MAX(CASE WHEN rn = 1 THEN pct END) AS latest,
            MAX(CASE WHEN rn = 2 THEN pct END) AS second,
            MAX(CASE WHEN rn = 3 THEN pct END) AS third,
            COUNT(*) AS exam_count
          FROM student_recent
          WHERE rn <= 3
          GROUP BY student_id
        )
        SELECT
          t.student_id,
          u.name,
          t.avg_pct,
          t.latest,
          t.second,
          t.third
        FROM trends t
        JOIN users u ON u.id = t.student_id
        WHERE t.exam_count >= 2
          AND (t.latest < t.second OR (t.third IS NOT NULL AND t.second < t.third))
        ORDER BY t.avg_pct ASC
        LIMIT 500
      `),
    );

    if (rows.length === 0) {
      return c.json(
        error("NO_DATA", "No at-risk students to export yet", 422),
        422,
      );
    }

    const studentRows = rows.map((r: any) => {
      const avgPct = Number(r.avg_pct ?? 0);
      const latest = Number(r.latest ?? 0);
      const second = Number(r.second ?? 0);
      const third = Number(r.third ?? 0);
      const decline =
        third > 0
          ? ((third - latest) / third) * 100
          : ((second - latest) / Math.max(second, 1)) * 100;
      const riskScore = Math.min(
        100,
        Math.round(Math.max(0, decline + (60 - avgPct))),
      );
      return {
        name: r.name,
        avgPct: Math.round(avgPct * 100) / 100,
        latest: Math.round(latest * 100) / 100,
        second: Math.round(second * 100) / 100,
        third: third ? Math.round(third * 100) / 100 : null,
        decline: Math.round(decline * 10) / 10,
        riskScore,
      };
    });

    const buf = await buildExcelBuffer(
      [
        {
          name: "At-risk students",
          note: `${batchName} — ${studentRows.length} flagged (declining trend across last 3 exams)`,
          columns: [
            { header: "Rank", key: "rank", width: 6, alignment: "right", numFmt: "0" },
            { header: "Student", key: "name", width: 28 },
            { header: "Avg %", key: "avgPct", width: 10, alignment: "right", numFmt: "0.00" },
            { header: "Latest %", key: "latest", width: 10, alignment: "right", numFmt: "0.00" },
            { header: "Previous %", key: "second", width: 12, alignment: "right", numFmt: "0.00" },
            { header: "3 exams ago %", key: "third", width: 14, alignment: "right", numFmt: "0.00" },
            { header: "Decline %", key: "decline", width: 12, alignment: "right", numFmt: "0.0" },
            { header: "Risk score", key: "riskScore", width: 12, alignment: "right", numFmt: "0" },
          ],
          rows: studentRows.map((s, i) => ({ rank: i + 1, ...s })),
        },
      ],
      {
        title: `At-risk — ${batchName}`,
        creator: "Brilliance Analytics",
        subject: "At-risk student roster",
      },
    );

    const safeStem = `at-risk-${batchName}`
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .slice(0, 80);
    c.header("Content-Type", XLSX_CONTENT_TYPE);
    c.header(
      "Content-Disposition",
      `attachment; filename="${safeStem}.xlsx"`,
    );
    return c.body(buf as unknown as ArrayBuffer);
  } catch (err) {
    console.error("[Analytics V3] at-risk export error:", err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to export at-risk students", 500),
      500,
    );
  }
});

// ── Toppers ───────────────────────────────────────────────────
// Two flavours:
//   /institution/toppers      → flat ranking across the institution, with
//                               batch + branch shown for each entry
//   /batch/:id/toppers        → top performers within one batch
// Both rank by average percentage of the student's most recent N exams
// (default 5) so a single great test can't game the ranking.

analyticsV3.get("/institution/toppers", requirePermission("analytics:institution"), async (c) => {
  const user = c.get("user") as SessionUser & { institutionId?: string };
  const institutionId = (user as any)?.institutionId as string | undefined;
  if (!institutionId) {
    return c.json({ success: false, error: "Institution context required" }, 403);
  }
  const limit = Math.min(50, parseInt(c.req.query("limit") ?? "10", 10) || 10);
  const recentN = Math.min(20, parseInt(c.req.query("recentN") ?? "5", 10) || 5);
  try {
    const rows = toRows(
      await db.execute(sql`
        WITH ranked AS (
          SELECT
            es.student_id,
            es.percentage::numeric AS pct,
            ROW_NUMBER() OVER (PARTITION BY es.student_id ORDER BY es.submitted_at DESC) AS rn
          FROM exam_submissions es
          JOIN users u ON u.id = es.student_id
          WHERE u.institution_id = ${institutionId}
            AND es.submitted_at IS NOT NULL
            AND es.percentage IS NOT NULL
            -- active result holds are excluded from cohort math
            AND NOT EXISTS (
              SELECT 1 FROM exam_result_holds erh
              WHERE erh.exam_id = es.exam_id
                AND erh.student_id = es.student_id
                AND erh.released_at IS NULL
            )
        ),
        recent_avg AS (
          SELECT student_id,
                 AVG(pct)::numeric AS avg_pct,
                 COUNT(*)::int AS exam_count
          FROM ranked
          WHERE rn <= ${recentN}
          GROUP BY student_id
          HAVING COUNT(*) >= 2
        )
        SELECT
          ra.student_id,
          u.name AS student_name,
          b.id AS batch_id,
          b.name AS batch_name,
          br.id AS branch_id,
          br.name AS branch_name,
          ra.avg_pct,
          ra.exam_count
        FROM recent_avg ra
        JOIN users u ON u.id = ra.student_id
        LEFT JOIN students s ON s.user_id = ra.student_id
        LEFT JOIN batches b ON b.id = s.batch_id
        LEFT JOIN branches br ON br.id = b.branch_id
        ORDER BY ra.avg_pct DESC
        LIMIT ${limit}
      `),
    );
    const toppers = rows.map((r: any, i: number) => ({
      rank: i + 1,
      studentId: r.student_id,
      studentName: r.student_name,
      batchId: r.batch_id,
      batchName: r.batch_name,
      branchId: r.branch_id,
      branchName: r.branch_name,
      avgPercentage: Math.round(Number(r.avg_pct) * 10) / 10,
      examCount: Number(r.exam_count),
    }));
    return c.json({ success: true, data: { toppers, recentN } });
  } catch (err) {
    console.error("[Analytics V3] institution toppers error:", err);
    return c.json({ success: false, error: "Failed to compute toppers" }, 500);
  }
});

/**
 * Institution student ranking list — used by `/analytics/students`.
 *
 * Additive endpoint. Does **not** change `GET /api/v1/users` (Users CRUD /
 * pickers stay unchanged). Computes avg score / percentile / cohort rank /
 * trend from `exam_submissions` (excluding active result holds). No schema
 * migration — read-only aggregates on existing tables.
 *
 * Query: page, limit, search, batchId, branchId (super_admin / academic_head
 * optional), section.
 */
analyticsV3.get(
  "/institution/students",
  requireAnyPermission("analytics:institution", "analytics:branch", "analytics:batch"),
  async (c) => {
    const user = c.get("user") as SessionUser & {
      institutionId?: string;
      branchId?: string;
    };
    const institutionId = user.institutionId;
    if (!institutionId) {
      return c.json(error("FORBIDDEN", "Institution context required", 403), 403);
    }

    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") ?? "20", 10) || 20));
    const offset = (page - 1) * limit;
    const search = (c.req.query("search") ?? c.req.query("q") ?? "").trim();
    const batchId = c.req.query("batchId") || null;
    const section = (c.req.query("section") ?? "").trim() || null;
    const queryBranchId = c.req.query("branchId") || null;

    // Match home-v2: branch-locked roles always scoped to JWT branch.
    // super_admin / academic_head may optionally pass ?branchId=.
    const scopeToBranch =
      user.role === "branch_admin" ||
      user.role === "faculty" ||
      user.role === "branch_faculty" ||
      user.role === "junior_lecturer";
    const branchFilter = scopeToBranch
      ? user.branchId ?? null
      : queryBranchId;

    const searchPattern = search.length > 0 ? `%${search}%` : null;

    try {
      const countRows = toRows(
        await db.execute(sql`
          SELECT COUNT(*)::int AS total
          FROM users u
          INNER JOIN students s ON s.user_id = u.id
          WHERE u.institution_id = ${institutionId}
            AND u.role = 'student'
            ${branchFilter ? sql`AND u.branch_id = ${branchFilter}` : sql``}
            ${batchId ? sql`AND s.batch_id = ${batchId}` : sql``}
            ${section ? sql`AND s.section = ${section}` : sql``}
            ${
              searchPattern
                ? sql`AND (
                    u.name ILIKE ${searchPattern}
                    OR u.email ILIKE ${searchPattern}
                    OR u.username ILIKE ${searchPattern}
                    OR s.roll_number ILIKE ${searchPattern}
                  )`
                : sql``
            }
        `),
      );
      const total = Number(countRows[0]?.total ?? 0);

      if (total === 0) {
        return c.json(paginated([], page, limit, 0));
      }

      const rows = toRows(
        await db.execute(sql`
          WITH roster AS (
            SELECT
              u.id AS student_id,
              u.name AS student_name,
              s.roll_number,
              s.batch_id,
              b.name AS batch_name,
              u.branch_id,
              br.name AS branch_name,
              s.section
            FROM users u
            INNER JOIN students s ON s.user_id = u.id
            LEFT JOIN batches b ON b.id = s.batch_id
            LEFT JOIN branches br ON br.id = u.branch_id
            WHERE u.institution_id = ${institutionId}
              AND u.role = 'student'
              ${branchFilter ? sql`AND u.branch_id = ${branchFilter}` : sql``}
              ${batchId ? sql`AND s.batch_id = ${batchId}` : sql``}
              ${section ? sql`AND s.section = ${section}` : sql``}
              ${
                searchPattern
                  ? sql`AND (
                      u.name ILIKE ${searchPattern}
                      OR u.email ILIKE ${searchPattern}
                      OR u.username ILIKE ${searchPattern}
                      OR s.roll_number ILIKE ${searchPattern}
                    )`
                  : sql``
              }
          ),
          scores AS (
            SELECT
              es.student_id,
              AVG(es.percentage::numeric) AS avg_pct,
              AVG(es.percentile_batch::numeric) AS avg_percentile,
              COUNT(*)::int AS exam_count
            FROM exam_submissions es
            WHERE es.student_id IN (SELECT student_id FROM roster)
              AND es.percentage IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM exam_result_holds erh
                WHERE erh.exam_id = es.exam_id
                  AND erh.student_id = es.student_id
                  AND erh.released_at IS NULL
              )
            GROUP BY es.student_id
          ),
          recent AS (
            SELECT
              es.student_id,
              ARRAY_AGG(es.percentile_batch::numeric ORDER BY es.submitted_at DESC)
                FILTER (WHERE es.percentile_batch IS NOT NULL) AS recent_percentiles
            FROM exam_submissions es
            WHERE es.student_id IN (SELECT student_id FROM roster)
              AND NOT EXISTS (
                SELECT 1 FROM exam_result_holds erh
                WHERE erh.exam_id = es.exam_id
                  AND erh.student_id = es.student_id
                  AND erh.released_at IS NULL
              )
            GROUP BY es.student_id
          ),
          ranked AS (
            SELECT
              r.*,
              COALESCE(sc.avg_pct, 0)::numeric AS avg_pct,
              COALESCE(sc.avg_percentile, 0)::numeric AS avg_percentile,
              COALESCE(sc.exam_count, 0)::int AS exam_count,
              RANK() OVER (
                ORDER BY COALESCE(sc.avg_pct, 0) DESC, r.student_name ASC
              )::int AS rank,
              COALESCE(rec.recent_percentiles[1:3], ARRAY[]::numeric[]) AS recent_percentiles
            FROM roster r
            LEFT JOIN scores sc ON sc.student_id = r.student_id
            LEFT JOIN recent rec ON rec.student_id = r.student_id
          )
          SELECT *
          FROM ranked
          ORDER BY rank ASC, student_name ASC
          LIMIT ${limit} OFFSET ${offset}
        `),
      );

      const items = rows.map((r: Record<string, unknown>) => {
        const recentRaw = r.recent_percentiles;
        const recentPercentiles = Array.isArray(recentRaw)
          ? recentRaw.map((n) => Number(n)).filter((n) => Number.isFinite(n))
          : [];
        return {
          studentId: String(r.student_id),
          name: String(r.student_name ?? "Unknown"),
          rollNumber: r.roll_number != null ? String(r.roll_number) : "",
          batchId: r.batch_id != null ? String(r.batch_id) : "",
          batchName: r.batch_name != null ? String(r.batch_name) : "Not assigned",
          branchId: r.branch_id != null ? String(r.branch_id) : "",
          branchName: r.branch_name != null ? String(r.branch_name) : "",
          averagePercentage: Math.round(Number(r.avg_pct ?? 0) * 100) / 100,
          percentile: Math.round(Number(r.avg_percentile ?? 0) * 100) / 100,
          rank: Number(r.rank ?? 0),
          examCount: Number(r.exam_count ?? 0),
          recentPercentiles,
          trend: deriveStudentTrend(recentPercentiles),
        };
      });

      return c.json(paginated(items, page, limit, total));
    } catch (err) {
      console.error("[Analytics V3] institution students error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to load student rankings", 500), 500);
    }
  },
);

function deriveStudentTrend(
  recentPercentiles: number[],
): "improving" | "declining" | "plateau" | "volatile" | "unknown" {
  // Match web analytics/students deriveTrend: compare last two points.
  if (recentPercentiles.length < 2) return "unknown";
  // recentPercentiles is newest-first from ARRAY_AGG ... ORDER BY submitted_at DESC
  const newest = recentPercentiles[0]!;
  const prev = recentPercentiles[1]!;
  const diff = newest - prev;
  if (diff > 5) return "improving";
  if (diff < -5) return "declining";
  if (recentPercentiles.length >= 3) {
    const older = recentPercentiles[2]!;
    const d1 = newest - prev;
    const d2 = prev - older;
    if ((d1 > 5 && d2 < -5) || (d1 < -5 && d2 > 5)) return "volatile";
  }
  return "plateau";
}

analyticsV3.get("/batch/:id/toppers", requirePermission("analytics:batch"), async (c) => {
  const user = c.get("user") as SessionUser & { institutionId?: string };
  const institutionId = (user as any)?.institutionId as string | undefined;
  if (!institutionId) {
    return c.json({ success: false, error: "Institution context required" }, 403);
  }
  const batchId = c.req.param("id");
  const limit = Math.min(20, parseInt(c.req.query("limit") ?? "5", 10) || 5);
  const recentN = Math.min(20, parseInt(c.req.query("recentN") ?? "5", 10) || 5);
  try {
    // Verify the batch belongs to the requester's institution. batches has
    // no direct institution_id column; the chain is batches → branches →
    // institution_id. 404 (not 403) on mismatch to avoid leaking which
    // batch IDs exist in other tenants.
    const batchRow = toRows(
      await db.execute(sql`
        SELECT b.name, br.institution_id
        FROM batches b
        JOIN branches br ON br.id = b.branch_id
        WHERE b.id = ${batchId}
      `),
    );
    if (
      batchRow.length === 0 ||
      batchRow[0].institution_id !== institutionId
    ) {
      return c.json({ success: false, error: "Batch not found" }, 404);
    }
    const batchName = batchRow[0]?.name ?? "Unknown Batch";

    const rows = toRows(
      await db.execute(sql`
        WITH ranked AS (
          SELECT
            es.student_id,
            es.percentage::numeric AS pct,
            ROW_NUMBER() OVER (PARTITION BY es.student_id ORDER BY es.submitted_at DESC) AS rn
          FROM exam_submissions es
          JOIN students s ON s.user_id = es.student_id
          WHERE s.batch_id = ${batchId}
            AND es.submitted_at IS NOT NULL
            AND es.percentage IS NOT NULL
            -- active result holds are excluded from cohort math
            AND NOT EXISTS (
              SELECT 1 FROM exam_result_holds erh
              WHERE erh.exam_id = es.exam_id
                AND erh.student_id = es.student_id
                AND erh.released_at IS NULL
            )
        ),
        recent_avg AS (
          SELECT student_id,
                 AVG(pct)::numeric AS avg_pct,
                 COUNT(*)::int AS exam_count
          FROM ranked
          WHERE rn <= ${recentN}
          GROUP BY student_id
          HAVING COUNT(*) >= 2
        )
        SELECT
          ra.student_id,
          u.name AS student_name,
          ra.avg_pct,
          ra.exam_count
        FROM recent_avg ra
        JOIN users u ON u.id = ra.student_id
        ORDER BY ra.avg_pct DESC
        LIMIT ${limit}
      `),
    );
    const toppers = rows.map((r: any, i: number) => ({
      rank: i + 1,
      studentId: r.student_id,
      studentName: r.student_name,
      avgPercentage: Math.round(Number(r.avg_pct) * 10) / 10,
      examCount: Number(r.exam_count),
    }));
    return c.json({ success: true, data: { batchId, batchName, toppers, recentN } });
  } catch (err) {
    console.error("[Analytics V3] batch toppers error:", err);
    return c.json({ success: false, error: "Failed to compute toppers" }, 500);
  }
});

// ── /batch/:id/summary — live KPIs for the batch overview header ─

analyticsV3.get(
  "/batch/:id/summary",
  requirePermission("analytics:batch"),
  async (c) => {
    const user = c.get("user") as SessionUser & { institutionId?: string };
    const institutionId = (user as any)?.institutionId as string | undefined;
    if (!institutionId) {
      return c.json({ success: false, error: "Institution context required" }, 403);
    }
    const batchId = c.req.param("id");
    try {
      // Cross-tenant guard via batches → branches.institution_id chain.
      const batchRow = toRows(
        await db.execute(sql`
          SELECT b.name, b.target_exam, b.academic_year, br.institution_id
          FROM batches b
          JOIN branches br ON br.id = b.branch_id
          WHERE b.id = ${batchId}
        `),
      );
      if (
        batchRow.length === 0 ||
        (batchRow[0] as any).institution_id !== institutionId
      ) {
        return c.json({ success: false, error: "Batch not found" }, 404);
      }
      const meta = batchRow[0] as any;

      // Run live KPI queries in parallel — same join chain reused.
      const [sizeRow, last30Row, prior30Row, topRow, atRiskRow] =
        await Promise.all([
          db.execute(sql`
            SELECT COUNT(DISTINCT s.user_id)::int AS n
            FROM students s
            WHERE s.batch_id = ${batchId}
          `),
          db.execute(sql`
            SELECT AVG(es.percentage::numeric)::numeric AS pct,
                   COUNT(*)::int AS n
            FROM exam_submissions es
            JOIN students s ON s.user_id = es.student_id
            WHERE s.batch_id = ${batchId}
              AND es.submitted_at >= NOW() - INTERVAL '30 days'
              AND es.percentage IS NOT NULL
              -- active result holds are excluded from cohort math
              AND NOT EXISTS (
                SELECT 1 FROM exam_result_holds erh
                WHERE erh.exam_id = es.exam_id
                  AND erh.student_id = es.student_id
                  AND erh.released_at IS NULL
              )
          `),
          db.execute(sql`
            SELECT AVG(es.percentage::numeric)::numeric AS pct,
                   COUNT(*)::int AS n
            FROM exam_submissions es
            JOIN students s ON s.user_id = es.student_id
            WHERE s.batch_id = ${batchId}
              AND es.submitted_at < NOW() - INTERVAL '30 days'
              AND es.submitted_at >= NOW() - INTERVAL '60 days'
              AND es.percentage IS NOT NULL
              -- active result holds are excluded from cohort math
              AND NOT EXISTS (
                SELECT 1 FROM exam_result_holds erh
                WHERE erh.exam_id = es.exam_id
                  AND erh.student_id = es.student_id
                  AND erh.released_at IS NULL
              )
          `),
          db.execute(sql`
            WITH ranked AS (
              SELECT es.student_id, es.percentage::numeric AS pct,
                     ROW_NUMBER() OVER (PARTITION BY es.student_id ORDER BY es.submitted_at DESC) AS rn
              FROM exam_submissions es
              JOIN students s ON s.user_id = es.student_id
              WHERE s.batch_id = ${batchId}
                AND es.submitted_at IS NOT NULL
                AND es.percentage IS NOT NULL
                -- active result holds are excluded from cohort math
                AND NOT EXISTS (
                  SELECT 1 FROM exam_result_holds erh
                  WHERE erh.exam_id = es.exam_id
                    AND erh.student_id = es.student_id
                    AND erh.released_at IS NULL
                )
            )
            SELECT u.id, u.name, AVG(pct)::numeric AS avg_pct
            FROM ranked r
            JOIN users u ON u.id = r.student_id
            WHERE r.rn <= 5
            GROUP BY u.id, u.name
            HAVING COUNT(*) >= 2
            ORDER BY AVG(pct) DESC
            LIMIT 1
          `),
          db.execute(sql`
            WITH recent AS (
              SELECT es.student_id, es.percentage::numeric AS pct,
                     ROW_NUMBER() OVER (PARTITION BY es.student_id ORDER BY es.submitted_at DESC) AS rn
              FROM exam_submissions es
              JOIN students s ON s.user_id = es.student_id
              WHERE s.batch_id = ${batchId}
                AND es.percentage IS NOT NULL
                -- active result holds are excluded from cohort math
                AND NOT EXISTS (
                  SELECT 1 FROM exam_result_holds erh
                  WHERE erh.exam_id = es.exam_id
                    AND erh.student_id = es.student_id
                    AND erh.released_at IS NULL
                )
            ),
            t AS (
              SELECT student_id,
                     MAX(CASE WHEN rn = 1 THEN pct END) AS p1,
                     MAX(CASE WHEN rn = 2 THEN pct END) AS p2
              FROM recent WHERE rn <= 3 GROUP BY student_id
              HAVING COUNT(*) >= 2
            )
            SELECT COUNT(*)::int AS n FROM t WHERE p1 < p2
          `),
        ]);

      const currentSize = Number((toRows(sizeRow)[0] as any)?.n ?? 0);
      const last30 = (toRows(last30Row)[0] as any) ?? {};
      const prior30 = (toRows(prior30Row)[0] as any) ?? {};
      const last30Pct =
        last30.pct != null ? Math.round(Number(last30.pct) * 10) / 10 : null;
      const prior30Pct =
        prior30.pct != null ? Math.round(Number(prior30.pct) * 10) / 10 : null;
      const velocity =
        last30Pct !== null && prior30Pct !== null
          ? Math.round((last30Pct - prior30Pct) * 10) / 10
          : null;

      const top = toRows(topRow)[0] as any;
      const atRiskCount = Number((toRows(atRiskRow)[0] as any)?.n ?? 0);

      return c.json({
        success: true,
        data: {
          batchId,
          batchName: meta.name,
          targetExam: meta.target_exam,
          academicYear: meta.academic_year,
          currentSize,
          latestAvgPct: last30Pct,
          priorAvgPct: prior30Pct,
          velocity,
          last30SampleSize: Number(last30.n ?? 0),
          topScorer: top
            ? {
                studentId: top.id as string,
                name: top.name as string,
                avgPct: Math.round(Number(top.avg_pct) * 10) / 10,
              }
            : null,
          atRiskCount,
        },
      });
    } catch (err) {
      console.error("[Analytics V3] batch summary error:", err);
      return c.json({ success: false, error: "Failed to compute batch summary" }, 500);
    }
  },
);

// ── /batch/:id/student-rank — where one student stands in the batch ─

analyticsV3.get(
  "/batch/:id/student-rank",
  requirePermission("analytics:batch"),
  async (c) => {
    const user = c.get("user") as SessionUser & { institutionId?: string };
    const institutionId = (user as any)?.institutionId as string | undefined;
    if (!institutionId) {
      return c.json({ success: false, error: "Institution context required" }, 403);
    }
    const batchId = c.req.param("id");
    const studentId = c.req.query("studentId");
    if (!studentId) {
      return c.json({ success: false, error: "studentId query param required" }, 400);
    }
    try {
      // Cross-tenant guard
      const batchRow = toRows(
        await db.execute(sql`
          SELECT b.name, br.institution_id
          FROM batches b
          JOIN branches br ON br.id = b.branch_id
          WHERE b.id = ${batchId}
        `),
      );
      if (
        batchRow.length === 0 ||
        (batchRow[0] as any).institution_id !== institutionId
      ) {
        return c.json({ success: false, error: "Batch not found" }, 404);
      }
      const batchName = (batchRow[0] as any).name as string;

      // Verify student is in the batch.
      const stRows = toRows(
        await db.execute(sql`
          SELECT u.id, u.name
          FROM users u
          JOIN students s ON s.user_id = u.id
          WHERE u.id = ${studentId}
            AND s.batch_id = ${batchId}
          LIMIT 1
        `),
      );
      if (stRows.length === 0) {
        return c.json(
          { success: false, error: "Student not in this batch" },
          404,
        );
      }
      const student = stRows[0] as { id: string; name: string };

      // Per-student avg over last 5 exams for the whole batch, ranked.
      const batchRows = toRows(
        await db.execute(sql`
          WITH ranked AS (
            SELECT es.student_id, es.percentage::numeric AS pct,
                   ROW_NUMBER() OVER (PARTITION BY es.student_id ORDER BY es.submitted_at DESC) AS rn
            FROM exam_submissions es
            JOIN students s ON s.user_id = es.student_id
            WHERE s.batch_id = ${batchId}
              AND es.submitted_at IS NOT NULL
              AND es.percentage IS NOT NULL
              -- active result holds are excluded from cohort math
              AND NOT EXISTS (
                SELECT 1 FROM exam_result_holds erh
                WHERE erh.exam_id = es.exam_id
                  AND erh.student_id = es.student_id
                  AND erh.released_at IS NULL
              )
          )
          SELECT student_id, AVG(pct)::numeric AS avg_pct, COUNT(*)::int AS n
          FROM ranked
          WHERE rn <= 5
          GROUP BY student_id
          HAVING COUNT(*) >= 1
          ORDER BY AVG(pct) DESC
        `),
      ) as Array<{ student_id: string; avg_pct: string; n: number }>;

      const batchSize = batchRows.length;
      if (batchSize === 0) {
        return c.json({
          success: true,
          data: {
            studentId: student.id,
            studentName: student.name,
            batchId,
            batchName,
            batchSize: 0,
            batchMedianPct: null,
            studentAvgPct: null,
            percentile: null,
            rankInBatch: null,
            deltaVsMedian: null,
            topScorer: null,
            gapToTop: null,
            subjectDeltas: [],
          },
        });
      }
      const studentIdx = batchRows.findIndex(
        (r) => r.student_id === student.id,
      );
      const studentRow = studentIdx >= 0 ? batchRows[studentIdx] : null;
      const studentAvgPct = studentRow ? Number(studentRow.avg_pct) : null;
      const rank = studentIdx >= 0 ? studentIdx + 1 : null;
      const percentile =
        rank !== null
          ? Math.round(((batchSize - rank) / Math.max(batchSize - 1, 1)) * 1000) / 10
          : null;
      const medianIdx = Math.floor(batchSize / 2);
      const batchMedianPct = Number(batchRows[medianIdx]?.avg_pct ?? 0);
      const top = batchRows[0];
      const topScorerName = top
        ? (
            toRows(
              await db.execute(sql`SELECT name FROM users WHERE id = ${top.student_id}`),
            )[0] as { name: string } | undefined
          )?.name ?? "Unknown"
        : null;
      const gapToTop =
        studentAvgPct !== null && top
          ? Math.round((Number(top.avg_pct) - studentAvgPct) * 10) / 10
          : null;

      // Per-subject delta vs batch
      const subjectRows = toRows(
        await db.execute(sql`
          WITH per_student_subject AS (
            SELECT
              es.student_id,
              s.name AS subject_name,
              AVG(CASE WHEN er.is_correct THEN 1.0 ELSE 0.0 END)::numeric AS accuracy
            FROM exam_responses er
            JOIN exam_submissions es ON es.id = er.submission_id
            JOIN questions q ON q.id = er.question_id
            JOIN syllabus_tree st ON st.id = q.syllabus_node_id
            JOIN subjects s ON s.id = st.subject_id
            JOIN students stu ON stu.user_id = es.student_id
            WHERE stu.batch_id = ${batchId}
              -- active result holds are excluded from cohort math
              AND NOT EXISTS (
                SELECT 1 FROM exam_result_holds erh
                WHERE erh.exam_id = es.exam_id
                  AND erh.student_id = es.student_id
                  AND erh.released_at IS NULL
              )
            GROUP BY es.student_id, s.name
          )
          SELECT
            subject_name,
            AVG(accuracy) FILTER (WHERE student_id = ${student.id})::numeric AS student_acc,
            AVG(accuracy)::numeric AS batch_acc
          FROM per_student_subject
          GROUP BY subject_name
        `),
      ) as Array<{ subject_name: string; student_acc: string | null; batch_acc: string }>;

      const subjectDeltas = subjectRows
        .filter((r) => r.student_acc !== null)
        .map((r) => {
          const studentPct = Math.round(Number(r.student_acc) * 1000) / 10;
          const batchPct = Math.round(Number(r.batch_acc) * 1000) / 10;
          return {
            subjectName: r.subject_name,
            studentPct,
            batchAvgPct: batchPct,
            delta: Math.round((studentPct - batchPct) * 10) / 10,
          };
        })
        .sort((a, b) => b.delta - a.delta);

      return c.json({
        success: true,
        data: {
          studentId: student.id,
          studentName: student.name,
          batchId,
          batchName,
          batchSize,
          batchMedianPct: Math.round(batchMedianPct * 10) / 10,
          studentAvgPct: studentAvgPct !== null ? Math.round(studentAvgPct * 10) / 10 : null,
          percentile,
          rankInBatch: rank,
          deltaVsMedian:
            studentAvgPct !== null
              ? Math.round((studentAvgPct - batchMedianPct) * 10) / 10
              : null,
          topScorer: top
            ? {
                studentId: top.student_id,
                name: topScorerName,
                avgPct: Math.round(Number(top.avg_pct) * 10) / 10,
              }
            : null,
          gapToTop,
          subjectDeltas,
        },
      });
    } catch (err) {
      console.error("[Analytics V3] batch student-rank error:", err);
      return c.json({ success: false, error: "Failed to compute student rank" }, 500);
    }
  },
);

// ── 4. GET /batch/:id/syllabus-cumulative-flow ────────────────
analyticsV3.get("/batch/:id/syllabus-cumulative-flow", async (c) => {
  const batchId = c.req.param("id");
  try {
    const rows = toRows(
      await db.execute(sql`
        SELECT
          DATE_TRUNC('week', tdp.date::timestamp)::date AS week,
          COALESCE(SUM(COALESCE(array_length(tdp.topics_planned, 1), 0)), 0)::int AS planned,
          COALESCE(SUM(COALESCE(array_length(tdp.topics_covered, 1), 0)), 0)::int AS covered
        FROM teaching_day_plan tdp
        JOIN teaching_calendar tc ON tc.id = tdp.calendar_entry_id
        WHERE tc.batch_id = ${batchId}
        GROUP BY DATE_TRUNC('week', tdp.date::timestamp)
        ORDER BY week
      `)
    );

    let cumulativePlanned = 0;
    let cumulativeCovered = 0;
    const weeks = rows.map((r: any) => {
      cumulativePlanned += Number(r.planned ?? 0);
      cumulativeCovered += Number(r.covered ?? 0);
      return {
        week: r.week,
        planned: cumulativePlanned,
        covered: cumulativeCovered,
      };
    });

    const totalPlanned = cumulativePlanned;
    const totalCovered = cumulativeCovered;
    const coveragePercent = totalPlanned > 0
      ? Math.round((totalCovered / totalPlanned) * 10000) / 100
      : 0;

    return c.json({
      success: true,
      data: { weeks, totalPlanned, totalCovered, coveragePercent },
    });
  } catch (err) {
    console.error("[Analytics V3] syllabus-cumulative-flow error:", err);
    return c.json({ success: false, error: "Failed to compute syllabus flow" }, 500);
  }
});

// ── 5. GET /batch/:id/attendance-histogram ────────────────────
analyticsV3.get("/batch/:id/attendance-histogram", async (c) => {
  const batchId = c.req.param("id");
  try {
    const rows = toRows(
      await db.execute(sql`
        WITH student_rates AS (
          SELECT
            a.student_id,
            COUNT(*) FILTER (WHERE a.status = 'present')::numeric / NULLIF(COUNT(*), 0) * 100 AS rate
          FROM attendance a
          JOIN students st ON st.user_id = a.student_id
          WHERE st.batch_id = ${batchId}
          GROUP BY a.student_id
        )
        SELECT
          COUNT(*)::int AS total_students,
          COALESCE(AVG(rate), 0) AS avg_attendance,
          COUNT(*) FILTER (WHERE rate < 75)::int AS below_threshold,
          COUNT(*) FILTER (WHERE rate < 20)::int AS b0,
          COUNT(*) FILTER (WHERE rate >= 20 AND rate < 40)::int AS b1,
          COUNT(*) FILTER (WHERE rate >= 40 AND rate < 60)::int AS b2,
          COUNT(*) FILTER (WHERE rate >= 60 AND rate < 80)::int AS b3,
          COUNT(*) FILTER (WHERE rate >= 80)::int AS b4
        FROM student_rates
      `)
    );

    const s = rows[0] ?? {};
    const buckets = [
      { range: "0-20%", count: Number(s.b0 ?? 0) },
      { range: "20-40%", count: Number(s.b1 ?? 0) },
      { range: "40-60%", count: Number(s.b2 ?? 0) },
      { range: "60-80%", count: Number(s.b3 ?? 0) },
      { range: "80-100%", count: Number(s.b4 ?? 0) },
    ];

    return c.json({
      success: true,
      data: {
        avgAttendance: Math.round(Number(s.avg_attendance ?? 0) * 100) / 100,
        belowThreshold: Number(s.below_threshold ?? 0),
        totalStudents: Number(s.total_students ?? 0),
        buckets,
      },
    });
  } catch (err) {
    console.error("[Analytics V3] attendance-histogram error:", err);
    return c.json({ success: false, error: "Failed to compute attendance histogram" }, 500);
  }
});

// ── 6. GET /batch/:id/discrimination/:examId ──────────────────
analyticsV3.get("/batch/:id/discrimination/:examId", async (c) => {
  const batchId = c.req.param("id");
  const examId = c.req.param("examId");
  try {
    const examRow = toRows(
      await db.execute(sql`SELECT title FROM exams WHERE id = ${examId}`)
    );
    const examName = examRow[0]?.title ?? "Unknown Exam";

    const studentIds = await getBatchStudentIds(batchId);

    if (studentIds.length === 0) {
      return c.json({
        success: true,
        data: { examName, questions: [], averageDiscrimination: 0, flaggedCount: 0 },
      });
    }

    const rows = toRows(
      await db.execute(sql`
        WITH ranked AS (
          SELECT
            es.student_id,
            es.percentage::numeric AS pct,
            NTILE(4) OVER (ORDER BY es.percentage::numeric DESC) AS quartile
          FROM exam_submissions es
          WHERE es.exam_id = ${examId}
            AND es.student_id IN (${sql.join(studentIds.map(id => sql`${id}`), sql`, `)})
        ),
        per_q AS (
          SELECT
            er.question_id,
            AVG(CASE WHEN r.quartile = 1 AND er.is_correct THEN 1.0
                     WHEN r.quartile = 1 THEN 0.0 END) AS top_pct,
            AVG(CASE WHEN r.quartile = 4 AND er.is_correct THEN 1.0
                     WHEN r.quartile = 4 THEN 0.0 END) AS bottom_pct
          FROM exam_responses er
          JOIN exam_submissions es ON es.id = er.submission_id
          JOIN ranked r ON r.student_id = es.student_id
          WHERE es.exam_id = ${examId}
          GROUP BY er.question_id
        )
        SELECT
          pq.question_id,
          ROW_NUMBER() OVER (ORDER BY pq.question_id) AS question_number,
          COALESCE(pq.top_pct, 0) AS top_quartile_percent,
          COALESCE(pq.bottom_pct, 0) AS bottom_quartile_percent,
          COALESCE(pq.top_pct, 0) - COALESCE(pq.bottom_pct, 0) AS discrimination_index
        FROM per_q pq
        ORDER BY pq.question_id
      `)
    );

    const questions = rows.map((r: any) => {
      const di = Number(r.discrimination_index ?? 0);
      const flagged = di < 0.2;
      let flagReason: string | null = null;
      if (di < 0) flagReason = "Negative discrimination — bottom quartile outperforms top";
      else if (di < 0.1) flagReason = "Very low discrimination — question does not differentiate";
      else if (di < 0.2) flagReason = "Low discrimination — consider revising";

      return {
        questionNumber: Number(r.question_number),
        discriminationIndex: Math.round(di * 1000) / 1000,
        topQuartilePercent: Math.round(Number(r.top_quartile_percent ?? 0) * 10000) / 100,
        bottomQuartilePercent: Math.round(Number(r.bottom_quartile_percent ?? 0) * 10000) / 100,
        flagged,
        flagReason,
      };
    });

    const avgDisc = questions.length > 0
      ? Math.round(questions.reduce((s, q) => s + q.discriminationIndex, 0) / questions.length * 1000) / 1000
      : 0;

    return c.json({
      success: true,
      data: {
        examName,
        questions,
        averageDiscrimination: avgDisc,
        flaggedCount: questions.filter((q) => q.flagged).length,
      },
    });
  } catch (err) {
    console.error("[Analytics V3] discrimination error:", err);
    return c.json({ success: false, error: "Failed to compute discrimination" }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// STUDENT ENDPOINTS — /student/me/...
// ════════════════════════════════════════════════════════════════

// ── 7. GET /student/me/heatmap ────────────────────────────────
// Reads the pre-aggregated `student_cell_mastery` table (ERI engine —
// maintained incrementally on every submission, indexed by student_id)
// rather than re-scanning the `exam_responses` fact table on each load.
// Rolls cells up to subject → chapter → difficulty; the frontend pivots
// that into a Subject×Difficulty overview + Chapter×Difficulty drill-down.
async function getStudentHeatmap(studentId: string) {
  const rows = toRows(
    await db.execute(sql`
      SELECT
        subj.name AS subject_name,
        COALESCE(ch.name, 'General') AS chapter_name,
        scm.difficulty AS difficulty,
        SUM(scm.total_attempts)::int AS attempted,
        SUM(scm.correct_count)::int AS correct
      FROM student_cell_mastery scm
      JOIN syllabus_tree t ON t.id = scm.topic_id
      LEFT JOIN syllabus_tree ch ON ch.id = t.parent_id
      JOIN subjects subj ON subj.id = t.subject_id
      WHERE scm.student_id = ${studentId}
      GROUP BY subj.name, COALESCE(ch.name, 'General'), scm.difficulty
      ORDER BY subj.name, COALESCE(ch.name, 'General'), scm.difficulty
    `)
  );

  type Cell = { level: string; attempted: number; correct: number };
  const subjectMap = new Map<string, Map<string, Cell[]>>();
  for (const r of rows) {
    const subj = (r.subject_name as string) ?? "Unknown";
    const chapter = (r.chapter_name as string) ?? "General";
    if (!subjectMap.has(subj)) subjectMap.set(subj, new Map());
    const chapterMap = subjectMap.get(subj)!;
    if (!chapterMap.has(chapter)) chapterMap.set(chapter, []);
    chapterMap.get(chapter)!.push({
      level: r.difficulty,
      attempted: Number(r.attempted) || 0,
      correct: Number(r.correct) || 0,
    });
  }

  return Array.from(subjectMap.entries()).map(([name, chapterMap]) => ({
    name,
    chapters: Array.from(chapterMap.entries()).map(([cName, difficulties]) => ({
      name: cName,
      difficulties,
    })),
  }));
}

analyticsV3.get("/student/me/heatmap", async (c) => {
  const studentId = (c.get("user") as any).sub;
  try {
    return c.json({ success: true, data: { subjects: await getStudentHeatmap(studentId) } });
  } catch (err) {
    console.error("[Analytics V3] heatmap error:", err);
    return c.json({ success: false, error: "Failed to compute heatmap" }, 500);
  }
});

analyticsV3.get("/student/:studentId/heatmap", ...staffStudentGates, async (c) => {
  try {
    return c.json({ success: true, data: { subjects: await getStudentHeatmap(c.req.param("studentId")) } });
  } catch (err) {
    console.error("[Analytics V3] heatmap error:", err);
    return c.json({ success: false, error: "Failed to compute heatmap" }, 500);
  }
});

// ── 8. GET /student/me/predictive-path ────────────────────────
// Linear regression over last 10 exam percentages, then project 3
// exams ahead. Response shape matches the dashboard page which
// expects a mixed points[] (past + forecast) with a `predicted`
// boolean flag, a scalar `predictedNext`, and a short trend label.
async function getStudentPredictivePath(studentId: string) {
  const rows = toRows(
    await db.execute(sql`
      SELECT
        e.title AS exam,
        es.percentage::numeric AS score,
        es.submitted_at
      FROM exam_submissions es
      JOIN exams e ON e.id = es.exam_id
      WHERE es.student_id = ${studentId}
        AND es.percentage IS NOT NULL
      ORDER BY es.submitted_at ASC
      LIMIT 10
    `)
  );

  if (rows.length < 2) {
    return {
      points: rows.map((r: any) => ({
        label: r.exam ?? "Exam",
        score: Number(r.score ?? 0),
        predicted: false,
      })),
      predictedNext: 0,
      trend: "flat" as const,
      confidence: 0,
      trendDelta: 0,
    };
  }

  const n = rows.length;
  const xs = rows.map((_: any, i: number) => i + 1);
  const ys = rows.map((r: any) => Number(r.score));
  const sumX = xs.reduce((a: number, b: number) => a + b, 0);
  const sumY = ys.reduce((a: number, b: number) => a + b, 0);
  const sumXY = xs.reduce(
    (a: number, x: number, i: number) => a + x * ys[i],
    0,
  );
  const sumX2 = xs.reduce((a: number, x: number) => a + x * x, 0);

  const denom = n * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssRes = ys.reduce((a: number, y: number, i: number) => {
    const pred = slope * (i + 1) + intercept;
    return a + (y - pred) ** 2;
  }, 0);
  const ssTot = ys.reduce((a: number, y: number) => a + (y - meanY) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const confidence = Math.max(0, Math.min(1, r2));

  // Residual standard deviation feeds a simple confidence band on the
  // forecast points (score ± 1σ, clamped 0–100).
  const sigma = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;

  const pastPoints = rows.map((r: any, i: number) => ({
    label: r.exam ?? `Exam ${i + 1}`,
    score: Math.round(Number(r.score) * 100) / 100,
    predicted: false,
  }));

  const forecastPoints = [1, 2, 3].map((offset) => {
    const pred = slope * (n + offset) + intercept;
    const score = Math.max(0, Math.min(100, pred));
    return {
      label: `Next ${offset}`,
      score: Math.round(score * 100) / 100,
      predicted: true,
      upper: Math.round(Math.max(0, Math.min(100, pred + sigma)) * 100) / 100,
      lower: Math.round(Math.max(0, Math.min(100, pred - sigma)) * 100) / 100,
    };
  });

  const trend: "up" | "down" | "flat" =
    slope > 0.5 ? "up" : slope < -0.5 ? "down" : "flat";

  return {
    points: [...pastPoints, ...forecastPoints],
    predictedNext: forecastPoints[0]?.score ?? 0,
    trend,
    confidence: Math.round(confidence * 100) / 100,
    trendDelta: Math.round(slope * 100) / 100,
  };
}

analyticsV3.get("/student/me/predictive-path", async (c) => {
  try {
    return c.json({ success: true, data: await getStudentPredictivePath((c.get("user") as any).sub) });
  } catch (err) {
    console.error("[Analytics V3] predictive-path error:", err);
    return c.json({ success: false, error: "Failed to compute predictive path" }, 500);
  }
});

analyticsV3.get("/student/:studentId/predictive-path", ...staffStudentGates, async (c) => {
  try {
    return c.json({ success: true, data: await getStudentPredictivePath(c.req.param("studentId")) });
  } catch (err) {
    console.error("[Analytics V3] predictive-path error:", err);
    return c.json({ success: false, error: "Failed to compute predictive path" }, 500);
  }
});

// ── 9. GET /student/me/time-vs-performance ────────────────────
// Scatter of per-exam subject performance: X = avg time per question
// on that subject (minutes), Y = subject accuracy (%). Falls back to
// an even split of the submission's total time across its answered
// questions when per-response time wasn't tracked (historical exams
// pre-dating the clean-mode timer fix) so the page still shows data.
async function getStudentTimeVsPerformance(studentId: string) {
  const rows = toRows(
    await db.execute(sql`
      SELECT
        e.id AS exam_id,
        e.title AS exam_title,
        subj.name AS subject_name,
        COUNT(*)::int AS question_count,
        SUM(CASE WHEN er.is_correct THEN 1 ELSE 0 END)::int AS correct_count,
        -- Prefer the per-response timer; if every response is null
        -- on this subject, fall back to the submission's total time
        -- evenly split across the questions answered in this subject.
        COALESCE(
          SUM(er.time_spent_seconds)::numeric,
          -- submission.time_taken_seconds / total_submission_q * subject_q
          (
            MAX(es.time_taken_seconds)::numeric
            * COUNT(*)::numeric
            / NULLIF(
              (SELECT COUNT(*)::numeric FROM exam_responses er2
                WHERE er2.submission_id = es.id),
              0
            )
          )
        ) AS subject_seconds
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      JOIN exams e ON e.id = es.exam_id
      JOIN questions q ON q.id = er.question_id
      JOIN subjects subj ON subj.id = q.subject_id
      WHERE es.student_id = ${studentId}
      GROUP BY e.id, e.title, subj.name, es.id
      HAVING COUNT(*) > 0
      ORDER BY subj.name
    `),
  );

  const subjectsSet = new Set<string>();
  const points: Array<{
    subject: string;
    timeMinutes: number;
    accuracy: number;
    label: string;
  }> = [];

  for (const r of rows) {
    const questionCount = Number(r.question_count || 0);
    const seconds = Number(r.subject_seconds || 0);
    if (questionCount === 0 || seconds <= 0) continue;
    const timeMinutes =
      Math.round((seconds / 60 / questionCount) * 100) / 100;
    const accuracy = Math.round(
      (Number(r.correct_count || 0) / questionCount) * 100,
    );
    subjectsSet.add(r.subject_name);
    points.push({
      subject: r.subject_name,
      timeMinutes,
      accuracy,
      label: r.exam_title || "Exam",
    });
  }

  return {
    points,
    subjects: Array.from(subjectsSet).sort(),
  };
}

analyticsV3.get("/student/me/time-vs-performance", async (c) => {
  try {
    return c.json({
      success: true,
      data: await getStudentTimeVsPerformance((c.get("user") as any).sub),
    });
  } catch (err) {
    console.error("[Analytics V3] time-vs-performance error:", err);
    return c.json({ success: false, error: "Failed to compute time vs performance" }, 500);
  }
});

analyticsV3.get("/student/:studentId/time-vs-performance", ...staffStudentGates, async (c) => {
  try {
    return c.json({
      success: true,
      data: await getStudentTimeVsPerformance(c.req.param("studentId")),
    });
  } catch (err) {
    console.error("[Analytics V3] time-vs-performance error:", err);
    return c.json({ success: false, error: "Failed to compute time vs performance" }, 500);
  }
});

// ── 10. GET /student/me/weakness-improvement ──────────────────
// For each topic the student has attempted twice or more, split their
// responses in half by submission time — first half = "before", second
// half = "after". This works for sparse histories where rigid 30d/60d
// windows return nothing (realistic students don't retry the same topic
// on both sides of an arbitrary cutoff).
function masteryLevel(acc: number): "weak" | "developing" | "proficient" | "mastered" {
  if (acc >= 85) return "mastered";
  if (acc >= 70) return "proficient";
  if (acc >= 50) return "developing";
  return "weak";
}

async function getStudentWeaknessImprovement(studentId: string) {
  const rows = toRows(
    await db.execute(sql`
      WITH ranked AS (
        SELECT
          COALESCE(st.id::text, 'subj-' || subj.id::text) AS topic_key,
          COALESCE(st.name, subj.name) AS topic_name,
          subj.name AS subject_name,
          er.is_correct,
          es.submitted_at,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(st.id::text, 'subj-' || subj.id::text)
            ORDER BY es.submitted_at ASC NULLS LAST, er.id
          ) AS rn,
          COUNT(*) OVER (
            PARTITION BY COALESCE(st.id::text, 'subj-' || subj.id::text)
          ) AS total
        FROM exam_responses er
        JOIN exam_submissions es ON es.id = er.submission_id
        JOIN questions q ON q.id = er.question_id
        JOIN subjects subj ON subj.id = q.subject_id
        LEFT JOIN syllabus_tree st ON st.id = q.syllabus_node_id
        WHERE es.student_id = ${studentId}
          AND er.is_correct IS NOT NULL
      )
      SELECT
        topic_key,
        MAX(topic_name) AS topic_name,
        MAX(subject_name) AS subject_name,
        MAX(total)::int AS total_attempts,
        COUNT(DISTINCT DATE(submitted_at))::int AS days_active,
        AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END)
          FILTER (WHERE rn <= FLOOR(total / 2.0)) AS before_acc,
        AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END)
          FILTER (WHERE rn > FLOOR(total / 2.0)) AS after_acc,
        MIN(submitted_at) AS first_at,
        MAX(submitted_at) AS last_at
      FROM ranked
      WHERE total >= 2
      GROUP BY topic_key
      HAVING
        AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) FILTER (WHERE rn <= FLOOR(total / 2.0)) IS NOT NULL
        AND AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) FILTER (WHERE rn > FLOOR(total / 2.0)) IS NOT NULL
      ORDER BY (
        AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) FILTER (WHERE rn > FLOOR(total / 2.0))
        - AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) FILTER (WHERE rn <= FLOOR(total / 2.0))
      ) DESC
      LIMIT 25
    `)
  );

  return rows.map((r: any) => {
    const before = Math.round(Number(r.before_acc ?? 0) * 10000) / 100;
    const after = Math.round(Number(r.after_acc ?? 0) * 10000) / 100;
    const first = r.first_at ? new Date(r.first_at) : null;
    const last = r.last_at ? new Date(r.last_at) : null;
    const spanDays =
      first && last
        ? Math.max(
            1,
            Math.round((last.getTime() - first.getTime()) / 86400000),
          )
        : 1;
    return {
      topic: r.topic_name,
      subject: r.subject_name,
      before: { level: masteryLevel(before), accuracy: before },
      after: { level: masteryLevel(after), accuracy: after },
      questionsAttempted: Number(r.total_attempts ?? 0),
      daysActive: Number(r.days_active ?? 0) || spanDays,
      improved: after > before,
    };
  });
}

analyticsV3.get("/student/me/weakness-improvement", async (c) => {
  try {
    return c.json({ success: true, data: { topics: await getStudentWeaknessImprovement((c.get("user") as any).sub) } });
  } catch (err) {
    console.error("[Analytics V3] weakness-improvement error:", err);
    return c.json({ success: false, error: "Failed to compute weakness improvement" }, 500);
  }
});

analyticsV3.get(
  "/student/:studentId/weakness-improvement",
  requirePermission("analytics:batch"),
  async (c) => {
    const studentId = c.req.param("studentId");
    if (!(await verifyUserOwnership(studentId, c))) {
      return c.json({ success: false, error: "Student not found" }, 404);
    }
    try {
      return c.json({
        success: true,
        data: { topics: await getStudentWeaknessImprovement(studentId) },
      });
    } catch (err) {
      console.error("[Analytics V3] weakness-improvement error:", err);
      return c.json(
        { success: false, error: "Failed to compute weakness improvement" },
        500,
      );
    }
  },
);

// ── 11. GET /student/me/success-gap ───────────────────────────
async function getStudentSuccessGap(studentId: string) {
  const rows = toRows(
    await db.execute(sql`
      SELECT
        COALESCE(st.name, subj.name) AS topic,
        AVG(CASE WHEN er.is_correct THEN 1.0 ELSE 0.0 END) AS mastery,
        COUNT(er.id)::int AS attempted
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      JOIN questions q ON q.id = er.question_id
      JOIN subjects subj ON subj.id = q.subject_id
      LEFT JOIN syllabus_tree st ON st.id = q.syllabus_node_id
      WHERE es.student_id = ${studentId}
      GROUP BY COALESCE(st.name, subj.name)
      HAVING COUNT(er.id) >= 3
      ORDER BY mastery DESC
    `)
  );

  const toItem = (r: any) => ({
    topic: r.topic,
    mastery: Math.round(Number(r.mastery) * 10000) / 100,
    delta: Math.round((Number(r.mastery) - 0.5) * 10000) / 100,
  });

  return {
    strengths: rows.slice(0, 5).map(toItem),
    weaknesses: rows.slice(-5).reverse().map(toItem),
  };
}

analyticsV3.get("/student/me/success-gap", async (c) => {
  try {
    return c.json({ success: true, data: await getStudentSuccessGap((c.get("user") as any).sub) });
  } catch (err) {
    console.error("[Analytics V3] success-gap error:", err);
    return c.json({ success: false, error: "Failed to compute success gap" }, 500);
  }
});

analyticsV3.get("/student/:studentId/success-gap", ...staffStudentGates, async (c) => {
  try {
    return c.json({ success: true, data: await getStudentSuccessGap(c.req.param("studentId")) });
  } catch (err) {
    console.error("[Analytics V3] success-gap error:", err);
    return c.json({ success: false, error: "Failed to compute success gap" }, 500);
  }
});

// ── 12. GET /student/me/relative-diff ─────────────────────────
async function getStudentRelativeDiff(studentId: string) {
  const studentRow = toRows(
    await db.execute(sql`SELECT batch_id FROM students WHERE user_id = ${studentId}`)
  );
  const batchId = studentRow[0]?.batch_id;

  if (!batchId) {
    return { subjects: [], aboveAvgCount: 0, overallDelta: 0 };
  }

  const rows = toRows(
    await db.execute(sql`
      WITH my_scores AS (
        SELECT
          q.subject_id,
          AVG(CASE WHEN er.is_correct THEN 1.0 ELSE 0.0 END) * 100 AS my_avg
        FROM exam_responses er
        JOIN exam_submissions es ON es.id = er.submission_id
        JOIN questions q ON q.id = er.question_id
        WHERE es.student_id = ${studentId}
        GROUP BY q.subject_id
      ),
      batch_scores AS (
        SELECT
          q.subject_id,
          AVG(CASE WHEN er.is_correct THEN 1.0 ELSE 0.0 END) * 100 AS batch_avg
        FROM exam_responses er
        JOIN exam_submissions es ON es.id = er.submission_id
        JOIN questions q ON q.id = er.question_id
        JOIN students st ON st.user_id = es.student_id
        WHERE st.batch_id = ${batchId}
        GROUP BY q.subject_id
      )
      SELECT
        subj.name,
        COALESCE(ms.my_avg, 0) AS your_score,
        COALESCE(bs.batch_avg, 0) AS batch_avg,
        COALESCE(ms.my_avg, 0) - COALESCE(bs.batch_avg, 0) AS delta
      FROM my_scores ms
      FULL JOIN batch_scores bs ON bs.subject_id = ms.subject_id
      JOIN subjects subj ON subj.id = COALESCE(ms.subject_id, bs.subject_id)
      ORDER BY subj.name
    `)
  );

  const subjects = rows.map((r: any) => ({
    name: r.name,
    yourScore: Math.round(Number(r.your_score) * 100) / 100,
    batchAvg: Math.round(Number(r.batch_avg) * 100) / 100,
    delta: Math.round(Number(r.delta) * 100) / 100,
  }));

  const aboveAvgCount = subjects.filter((s) => s.delta > 0).length;
  const overallDelta = subjects.length > 0
    ? Math.round(subjects.reduce((s, sub) => s + sub.delta, 0) / subjects.length * 100) / 100
    : 0;

  return { subjects, aboveAvgCount, overallDelta };
}

analyticsV3.get("/student/me/relative-diff", async (c) => {
  try {
    return c.json({ success: true, data: await getStudentRelativeDiff((c.get("user") as any).sub) });
  } catch (err) {
    console.error("[Analytics V3] relative-diff error:", err);
    return c.json({ success: false, error: "Failed to compute relative diff" }, 500);
  }
});

analyticsV3.get("/student/:studentId/relative-diff", ...staffStudentGates, async (c) => {
  try {
    return c.json({ success: true, data: await getStudentRelativeDiff(c.req.param("studentId")) });
  } catch (err) {
    console.error("[Analytics V3] relative-diff error:", err);
    return c.json({ success: false, error: "Failed to compute relative diff" }, 500);
  }
});

// ── 13. GET /student/me/test-analysis/:examId ─────────────────
async function getStudentTestAnalysis(studentId: string, examId: string) {
  const subRow = toRows(
    await db.execute(sql`
      SELECT es.id AS submission_id, es.total_score, es.total_max, es.percentage,
             es.time_taken_seconds, e.title AS exam_title
      FROM exam_submissions es
      JOIN exams e ON e.id = es.exam_id
      WHERE es.exam_id = ${examId} AND es.student_id = ${studentId}
      LIMIT 1
    `)
  );

  if (subRow.length === 0) return null;

  const sub = subRow[0];
  const submissionId = sub.submission_id;

  // Enumerate the FULL paper (exam_questions), LEFT JOIN the student's
  // responses. Starting from exam_responses would drop questions the student
  // never answered — for autosave/release-recovery submissions no blank row
  // exists, so those skipped questions would silently vanish from the list and
  // the client's "Skipped" count. Numbered by paper position (order_index).
  const rows = toRows(
    await db.execute(sql`
      SELECT
        ROW_NUMBER() OVER (ORDER BY eq.order_index) AS number,
        COALESCE(st.name, subj.name) AS topic,
        CASE
          WHEN er.is_correct THEN 'correct'
          WHEN er.id IS NULL OR er.selected_answer IS NULL THEN 'skipped'
          ELSE 'incorrect'
        END AS status,
        COALESCE(er.time_spent_seconds, 0) AS time_spent,
        q.difficulty,
        q.blooms_level,
        COALESCE(er.marks_awarded, '0')::numeric AS marks_awarded
      FROM exam_questions eq
      JOIN questions q ON q.id = eq.question_id
      JOIN subjects subj ON subj.id = q.subject_id
      LEFT JOIN syllabus_tree st ON st.id = q.syllabus_node_id
      LEFT JOIN exam_responses er
        ON er.question_id = eq.question_id AND er.submission_id = ${submissionId}
      WHERE eq.exam_id = ${examId}
      ORDER BY eq.order_index
    `)
  );

  const questions = rows.map((r: any) => ({
    number: Number(r.number),
    topic: r.topic,
    status: r.status,
    timeSpent: Number(r.time_spent),
    difficulty: r.difficulty,
    bloomsLevel: r.blooms_level,
    marksAwarded: Number(r.marks_awarded),
  }));

  const totalScore = Number(sub.total_score ?? 0);
  const maxScore = Number(sub.total_max ?? 0);

  return {
    examTitle: sub.exam_title,
    score: totalScore,
    maxScore,
    accuracy: maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0,
    timeUsed: Number(sub.time_taken_seconds ?? 0),
    questions,
  };
}

analyticsV3.get("/student/me/test-analysis/:examId", async (c) => {
  try {
    const data = await getStudentTestAnalysis((c.get("user") as any).sub, c.req.param("examId"));
    if (!data) return c.json({ success: false, error: "Submission not found" }, 404);
    return c.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics V3] test-analysis error:", err);
    return c.json({ success: false, error: "Failed to compute test analysis" }, 500);
  }
});

analyticsV3.get("/student/:studentId/test-analysis/:examId", ...staffStudentGates, async (c) => {
  try {
    const data = await getStudentTestAnalysis(c.req.param("studentId"), c.req.param("examId"));
    if (!data) return c.json({ success: false, error: "Submission not found" }, 404);
    return c.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics V3] test-analysis error:", err);
    return c.json({ success: false, error: "Failed to compute test analysis" }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// PARENT ENDPOINTS — /parent/me/...
// ════════════════════════════════════════════════════════════════

/** Resolve parent's linked child ID */
async function resolveChildId(parentId: string): Promise<{ childId: string | null; childName: string | null }> {
  const rows = toRows(
    await db.execute(sql`
      SELECT psl.student_id, u.name
      FROM parent_student_links psl
      JOIN users u ON u.id = psl.student_id
      WHERE psl.parent_id = ${parentId}
      LIMIT 1
    `)
  );
  if (rows.length === 0) return { childId: null, childName: null };
  return { childId: rows[0].student_id, childName: rows[0].name };
}

// ── 14. GET /parent/me/growth-velocity ────────────────────────
analyticsV3.get("/parent/me/growth-velocity", async (c) => {
  const user = c.get("user");
  const { childId, childName } = await resolveChildId(user.sub);
  if (!childId) {
    return c.json({ success: false, error: "No linked child found" }, 404);
  }

  try {
    const rows = toRows(
      await db.execute(sql`
        WITH subject_scores AS (
          SELECT
            q.subject_id,
            subj.name,
            es.submitted_at,
            AVG(CASE WHEN er.is_correct THEN 1.0 ELSE 0.0 END) * 100 AS score,
            ROW_NUMBER() OVER (PARTITION BY q.subject_id ORDER BY es.submitted_at ASC) AS rn_asc,
            ROW_NUMBER() OVER (PARTITION BY q.subject_id ORDER BY es.submitted_at DESC) AS rn_desc
          FROM exam_responses er
          JOIN exam_submissions es ON es.id = er.submission_id
          JOIN questions q ON q.id = er.question_id
          JOIN subjects subj ON subj.id = q.subject_id
          WHERE es.student_id = ${childId}
          GROUP BY q.subject_id, subj.name, es.submitted_at
        )
        SELECT
          name,
          MAX(CASE WHEN rn_asc = 1 THEN score END) AS baseline,
          MAX(CASE WHEN rn_desc = 1 THEN score END) AS current_score
        FROM subject_scores
        GROUP BY name
        HAVING COUNT(*) >= 2
        ORDER BY name
      `)
    );

    const subjects = rows.map((r: any) => {
      const baseline = Math.round(Number(r.baseline ?? 0) * 100) / 100;
      const current = Math.round(Number(r.current_score ?? 0) * 100) / 100;
      const delta = Math.round((current - baseline) * 100) / 100;
      return {
        name: r.name,
        baseline,
        current,
        delta,
        trend: delta > 2 ? "improving" : delta < -2 ? "declining" : "stable",
      };
    });

    const overallGrowth = subjects.length > 0
      ? Math.round(subjects.reduce((s, sub) => s + sub.delta, 0) / subjects.length * 100) / 100
      : 0;

    return c.json({
      success: true,
      data: { childName, overallGrowth, subjects },
    });
  } catch (err) {
    console.error("[Analytics V3] growth-velocity error:", err);
    return c.json({ success: false, error: "Failed to compute growth velocity" }, 500);
  }
});

// ── 15. GET /parent/me/sentiment-radar ────────────────────────
analyticsV3.get("/parent/me/sentiment-radar", async (c) => {
  const user = c.get("user");
  const { childId } = await resolveChildId(user.sub);
  if (!childId) {
    return c.json({ success: false, error: "No linked child found" }, 404);
  }

  try {
    // Run all 5 axis queries in parallel
    const [acadRows, attRows, engRows, consRows, punctRows] = await Promise.all([
      db.execute(sql`
        SELECT COALESCE(AVG(percentage::numeric), 0) AS avg_pct
        FROM exam_submissions
        WHERE student_id = ${childId}
          AND submitted_at >= NOW() - INTERVAL '30 days'
      `).then(toRows),
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'present')::numeric / NULLIF(COUNT(*), 0) * 100 AS rate
        FROM attendance
        WHERE student_id = ${childId}
          AND date::timestamp >= NOW() - INTERVAL '30 days'
      `).then(toRows),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM exam_submissions
        WHERE student_id = ${childId}
          AND submitted_at >= NOW() - INTERVAL '30 days'
      `).then(toRows),
      db.execute(sql`
        SELECT COALESCE(STDDEV_POP(percentage::numeric), 0) AS sd
        FROM exam_submissions
        WHERE student_id = ${childId}
          AND submitted_at >= NOW() - INTERVAL '60 days'
      `).then(toRows),
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE is_late = true)::numeric AS late_cnt,
          COUNT(*)::numeric AS total
        FROM exam_submissions
        WHERE student_id = ${childId}
          AND submitted_at >= NOW() - INTERVAL '30 days'
      `).then(toRows),
    ]);

    const academics = Math.min(100, Number(acadRows[0]?.avg_pct ?? 0));
    const attendanceScore = Math.min(100, Number(attRows[0]?.rate ?? 0));
    const engagement = Math.min(100, Number(engRows[0]?.cnt ?? 0) * 10);
    const sd = Number(consRows[0]?.sd ?? 0);
    const consistency = Math.max(0, Math.min(100, 100 - sd * 2));
    const latePct = Number(punctRows[0]?.total ?? 0) > 0
      ? (Number(punctRows[0]?.late_cnt ?? 0) / Number(punctRows[0]?.total)) * 100
      : 0;
    const punctuality = Math.max(0, Math.min(100, 100 - latePct));

    const axes = [
      { name: "Academics", score: Math.round(academics * 100) / 100 },
      { name: "Attendance", score: Math.round(attendanceScore * 100) / 100 },
      { name: "Engagement", score: Math.round(engagement * 100) / 100 },
      { name: "Consistency", score: Math.round(consistency * 100) / 100 },
      { name: "Punctuality", score: Math.round(punctuality * 100) / 100 },
    ];

    const avgScore = axes.reduce((s, a) => s + a.score, 0) / axes.length;
    let summary: string;
    if (avgScore >= 80) summary = "Excellent overall engagement and performance";
    else if (avgScore >= 60) summary = "Good progress with room for improvement in some areas";
    else if (avgScore >= 40) summary = "Moderate engagement — needs attention in key areas";
    else summary = "Needs significant improvement — recommend parent-teacher discussion";

    return c.json({ success: true, data: { axes, summary } });
  } catch (err) {
    console.error("[Analytics V3] sentiment-radar error:", err);
    return c.json({ success: false, error: "Failed to compute sentiment radar" }, 500);
  }
});

// ── 16. GET /parent/me/benchmark ──────────────────────────────
analyticsV3.get("/parent/me/benchmark", async (c) => {
  const user = c.get("user");
  const { childId, childName } = await resolveChildId(user.sub);
  if (!childId) {
    return c.json({ success: false, error: "No linked child found" }, 404);
  }

  try {
    const childRow = toRows(
      await db.execute(sql`
        SELECT s.batch_id, b.branch_id
        FROM students s
        JOIN batches b ON b.id = s.batch_id
        WHERE s.user_id = ${childId}
      `)
    );

    if (childRow.length === 0) {
      return c.json({
        success: true,
        data: { childName, scopes: [], subjects: [] },
      });
    }

    const batchId = childRow[0].batch_id;
    const branchId = childRow[0].branch_id;

    // Child's avg score (needed for rank queries)
    const myAvg = toRows(
      await db.execute(sql`
        SELECT COALESCE(AVG(percentage::numeric), 0) AS avg_pct
        FROM exam_submissions WHERE student_id = ${childId}
      `)
    )[0]?.avg_pct ?? 0;

    // Run all rank queries in parallel
    const [batchRank, branchRank, instRank, subjectRanks] = await Promise.all([
      db.execute(sql`
        WITH batch_avgs AS (
          SELECT es.student_id, AVG(es.percentage::numeric) AS avg_pct
          FROM exam_submissions es
          JOIN students st ON st.user_id = es.student_id
          WHERE st.batch_id = ${batchId}
          GROUP BY es.student_id
        )
        SELECT
          (SELECT COUNT(*) + 1 FROM batch_avgs WHERE avg_pct > ${myAvg})::int AS rank,
          (SELECT COUNT(*) FROM batch_avgs)::int AS total
      `).then(toRows),
      db.execute(sql`
        WITH branch_avgs AS (
          SELECT es.student_id, AVG(es.percentage::numeric) AS avg_pct
          FROM exam_submissions es
          JOIN students st ON st.user_id = es.student_id
          JOIN batches bat ON bat.id = st.batch_id
          WHERE bat.branch_id = ${branchId}
          GROUP BY es.student_id
        )
        SELECT
          (SELECT COUNT(*) + 1 FROM branch_avgs WHERE avg_pct > ${myAvg})::int AS rank,
          (SELECT COUNT(*) FROM branch_avgs)::int AS total
      `).then(toRows),
      db.execute(sql`
        WITH inst_avgs AS (
          SELECT es.student_id, AVG(es.percentage::numeric) AS avg_pct
          FROM exam_submissions es
          GROUP BY es.student_id
        )
        SELECT
          (SELECT COUNT(*) + 1 FROM inst_avgs WHERE avg_pct > ${myAvg})::int AS rank,
          (SELECT COUNT(*) FROM inst_avgs)::int AS total
      `).then(toRows),
      db.execute(sql`
        WITH subject_avgs AS (
          SELECT
            es.student_id,
            q.subject_id,
            subj.name,
            AVG(CASE WHEN er.is_correct THEN 1.0 ELSE 0.0 END) * 100 AS avg_pct
          FROM exam_responses er
          JOIN exam_submissions es ON es.id = er.submission_id
          JOIN questions q ON q.id = er.question_id
          JOIN subjects subj ON subj.id = q.subject_id
          JOIN students st ON st.user_id = es.student_id
          WHERE st.batch_id = ${batchId}
          GROUP BY es.student_id, q.subject_id, subj.name
        ),
        my_subject AS (
          SELECT subject_id, name, avg_pct
          FROM subject_avgs
          WHERE student_id = ${childId}
        )
        SELECT
          ms.name,
          (SELECT COUNT(*) + 1 FROM subject_avgs sa
           WHERE sa.subject_id = ms.subject_id AND sa.avg_pct > ms.avg_pct)::int AS rank,
          (SELECT COUNT(*) FROM subject_avgs sa
           WHERE sa.subject_id = ms.subject_id)::int AS total
        FROM my_subject ms
        ORDER BY ms.name
      `).then(toRows),
    ]);

    const scopes = [
      { scope: "batch", rank: Number(batchRank[0]?.rank ?? 0), total: Number(batchRank[0]?.total ?? 0) },
      { scope: "branch", rank: Number(branchRank[0]?.rank ?? 0), total: Number(branchRank[0]?.total ?? 0) },
      { scope: "institution", rank: Number(instRank[0]?.rank ?? 0), total: Number(instRank[0]?.total ?? 0) },
    ];

    const subjects = subjectRanks.map((r: any) => ({
      name: r.name,
      rank: Number(r.rank),
      total: Number(r.total),
    }));

    return c.json({
      success: true,
      data: { childName, scopes, subjects },
    });
  } catch (err) {
    console.error("[Analytics V3] benchmark error:", err);
    return c.json({ success: false, error: "Failed to compute benchmark" }, 500);
  }
});

// ── 17. GET /parent/me/attendance ─────────────────────────────
analyticsV3.get("/parent/me/attendance", async (c) => {
  const user = c.get("user");
  const { childId } = await resolveChildId(user.sub);
  if (!childId) {
    return c.json({ success: false, error: "No linked child found" }, 404);
  }

  try {
    const studentRow = toRows(
      await db.execute(sql`SELECT batch_id FROM students WHERE user_id = ${childId}`)
    );
    const batchId = studentRow[0]?.batch_id;

    if (!batchId) {
      return c.json({
        success: true,
        data: { months: [], currentMonthPercent: 0, status: "no_data" },
      });
    }

    const rows = toRows(
      await db.execute(sql`
        WITH child_monthly AS (
          SELECT
            TO_CHAR(date::timestamp, 'YYYY-MM') AS month,
            COUNT(*) FILTER (WHERE status = 'present')::numeric / NULLIF(COUNT(*), 0) * 100 AS child_pct
          FROM attendance
          WHERE student_id = ${childId}
          GROUP BY TO_CHAR(date::timestamp, 'YYYY-MM')
        ),
        batch_monthly AS (
          SELECT
            TO_CHAR(a.date::timestamp, 'YYYY-MM') AS month,
            COUNT(*) FILTER (WHERE a.status = 'present')::numeric / NULLIF(COUNT(*), 0) * 100 AS batch_pct
          FROM attendance a
          JOIN students st ON st.user_id = a.student_id
          WHERE st.batch_id = ${batchId}
          GROUP BY TO_CHAR(a.date::timestamp, 'YYYY-MM')
        )
        SELECT
          COALESCE(cm.month, bm.month) AS month,
          COALESCE(cm.child_pct, 0) AS child_percent,
          COALESCE(bm.batch_pct, 0) AS batch_percent
        FROM child_monthly cm
        FULL JOIN batch_monthly bm ON bm.month = cm.month
        ORDER BY month
      `)
    );

    const months = rows.map((r: any) => ({
      month: r.month,
      childPercent: Math.round(Number(r.child_percent) * 100) / 100,
      batchPercent: Math.round(Number(r.batch_percent) * 100) / 100,
    }));

    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentEntry = months.find((m) => m.month === currentMonth);
    const currentMonthPercent = currentEntry?.childPercent ?? 0;

    let status: string;
    if (currentMonthPercent >= 90) status = "excellent";
    else if (currentMonthPercent >= 75) status = "good";
    else if (currentMonthPercent >= 50) status = "needs_improvement";
    else status = "critical";

    return c.json({
      success: true,
      data: { months, currentMonthPercent, status },
    });
  } catch (err) {
    console.error("[Analytics V3] parent attendance error:", err);
    return c.json({ success: false, error: "Failed to compute attendance" }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// STUDENT TIME-BASED ENDPOINTS — /student/me/today|weekly|monthly|countdown
// ════════════════════════════════════════════════════════════════

// ── 18. GET /student/me/today ────────────────────────────────────

async function getStudentToday(studentId: string) {
  const [
    examStatsRows,
    practiceStatsRows,
    attendanceRows,
    eriRows,
    streakRows,
    topicRows,
  ] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(er.id)::int AS questions,
        COALESCE(SUM(CASE WHEN er.is_correct THEN 1 ELSE 0 END), 0)::int AS correct,
        COALESCE(SUM(COALESCE(er.time_spent_seconds, 0)), 0)::int AS time_seconds
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      WHERE es.student_id = ${studentId}
        AND es.submitted_at::date = CURRENT_DATE
    `).then(toRows),

    db.execute(sql`
      SELECT
        COUNT(pr.id)::int AS questions,
        COALESCE(SUM(CASE WHEN pr.is_correct THEN 1 ELSE 0 END), 0)::int AS correct,
        COALESCE(SUM(COALESCE(pr.time_taken_seconds, 0)), 0)::int AS time_seconds
      FROM practice_responses pr
      JOIN practice_submissions ps ON ps.id = pr.submission_id
      WHERE ps.student_id = ${studentId}
        AND ps.submitted_at::date = CURRENT_DATE
    `).then(toRows),

    db.execute(sql`
      SELECT status FROM attendance
      WHERE student_id = ${studentId} AND date = CURRENT_DATE
      LIMIT 1
    `).then(toRows),

    db.execute(sql`
      SELECT eri_value, snapshot_date
      FROM student_eri_snapshots
      WHERE student_id = ${studentId}
      ORDER BY snapshot_date DESC
      LIMIT 2
    `).then(toRows),

    db.execute(sql`
      WITH activity_days AS (
        SELECT DISTINCT es.submitted_at::date AS day
        FROM exam_submissions es
        WHERE es.student_id = ${studentId}
          AND es.submitted_at IS NOT NULL
        UNION
        SELECT DISTINCT ps.submitted_at::date AS day
        FROM practice_submissions ps
        WHERE ps.student_id = ${studentId}
          AND ps.submitted_at IS NOT NULL
      ),
      numbered AS (
        SELECT day, day - (ROW_NUMBER() OVER (ORDER BY day))::int AS grp
        FROM activity_days
      ),
      streaks AS (
        SELECT grp, MIN(day) AS streak_start, MAX(day) AS streak_end, COUNT(*)::int AS len
        FROM numbered
        GROUP BY grp
      )
      SELECT COALESCE(len, 0)::int AS streak
      FROM streaks
      WHERE streak_end >= CURRENT_DATE - 1
      ORDER BY streak_end DESC
      LIMIT 1
    `).then(toRows),

    db.execute(sql`
      SELECT
        COALESCE(st.name, subj.name) AS topic_name,
        COUNT(er.id)::int AS questions,
        COALESCE(AVG(CASE WHEN er.is_correct THEN 100.0 ELSE 0 END), 0) AS accuracy
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      JOIN questions q ON q.id = er.question_id
      JOIN subjects subj ON subj.id = q.subject_id
      LEFT JOIN syllabus_tree st ON st.id = q.syllabus_node_id
      WHERE es.student_id = ${studentId}
        AND es.submitted_at::date = CURRENT_DATE
      GROUP BY COALESCE(st.name, subj.name)
      ORDER BY COUNT(er.id) DESC
    `).then(toRows),
  ]);

  const examStats = examStatsRows[0] ?? {};
  const practiceStats = practiceStatsRows[0] ?? {};

  const questionsToday = Number(examStats.questions ?? 0) + Number(practiceStats.questions ?? 0);
  const correctToday = Number(examStats.correct ?? 0) + Number(practiceStats.correct ?? 0);
  const totalTimeSeconds = Number(examStats.time_seconds ?? 0) + Number(practiceStats.time_seconds ?? 0);
  const studyTimeMinutes = Math.round(totalTimeSeconds / 60);
  const accuracyToday = questionsToday > 0
    ? Math.round((correctToday / questionsToday) * 10000) / 100
    : 0;

  let eriChange = 0;
  if (eriRows.length >= 2) {
    eriChange = Math.round((Number(eriRows[0].eri_value) - Number(eriRows[1].eri_value)) * 100) / 100;
  }

  const streak = Number(streakRows[0]?.streak ?? 0);

  const topicsCovered = topicRows.map((r: any) => ({
    name: r.topic_name,
    questions: Number(r.questions),
    accuracy: Math.round(Number(r.accuracy) * 100) / 100,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const attendanceStatus = attendanceRows[0]?.status ?? null;

  return {
    date: today,
    questionsToday,
    correctToday,
    accuracyToday,
    studyTimeMinutes,
    eriChange,
    streak,
    attendanceStatus,
    topicsCovered,
    dailyGoals: {
      questions: { current: questionsToday, target: 30 },
      studyTime: { current: studyTimeMinutes, target: 120 },
    },
  };
}

analyticsV3.get("/student/me/today", async (c) => {
  try {
    return c.json({ success: true, data: await getStudentToday((c.get("user") as any).sub) });
  } catch (err) {
    console.error("[Analytics V3] today error:", err);
    return c.json({ success: false, error: "Failed to compute today analytics" }, 500);
  }
});

analyticsV3.get("/student/:studentId/today", ...staffStudentGates, async (c) => {
  try {
    return c.json({ success: true, data: await getStudentToday(c.req.param("studentId")) });
  } catch (err) {
    console.error("[Analytics V3] today error:", err);
    return c.json({ success: false, error: "Failed to compute today analytics" }, 500);
  }
});

// ── 19. GET /student/me/weekly ───────────────────────────────────

async function getStudentWeekly(studentId: string) {
  const [
    dailyRows,
    prevWeekRows,
    eriRows,
    studyTimeRows,
    prevStudyTimeRows,
    cellRows,
  ] = await Promise.all([
    db.execute(sql`
      SELECT
        DATE(es.submitted_at) AS day,
        COUNT(er.id)::int AS questions,
        COALESCE(AVG(CASE WHEN er.is_correct THEN 100.0 ELSE 0 END), 0) AS accuracy
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      WHERE es.student_id = ${studentId}
        AND es.submitted_at >= date_trunc('week', CURRENT_DATE)
        AND es.submitted_at < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
      GROUP BY DATE(es.submitted_at)
      ORDER BY day
    `).then(toRows),

    db.execute(sql`
      SELECT
        COUNT(er.id)::int AS questions,
        COALESCE(AVG(CASE WHEN er.is_correct THEN 100.0 ELSE 0 END), 0) AS accuracy,
        COALESCE(SUM(COALESCE(er.time_spent_seconds, 0)), 0)::int AS time_seconds
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      WHERE es.student_id = ${studentId}
        AND es.submitted_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
        AND es.submitted_at < date_trunc('week', CURRENT_DATE)
    `).then(toRows),

    db.execute(sql`
      SELECT eri_value, snapshot_date
      FROM student_eri_snapshots
      WHERE student_id = ${studentId}
        AND snapshot_date >= date_trunc('week', CURRENT_DATE)::date - 1
      ORDER BY snapshot_date ASC
    `).then(toRows),

    db.execute(sql`
      SELECT COALESCE(SUM(COALESCE(er.time_spent_seconds, 0)), 0)::int AS time_seconds
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      WHERE es.student_id = ${studentId}
        AND es.submitted_at >= date_trunc('week', CURRENT_DATE)
        AND es.submitted_at < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
    `).then(toRows),

    db.execute(sql`
      SELECT COALESCE(SUM(COALESCE(er.time_spent_seconds, 0)), 0)::int AS time_seconds
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      WHERE es.student_id = ${studentId}
        AND es.submitted_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
        AND es.submitted_at < date_trunc('week', CURRENT_DATE)
    `).then(toRows),

    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE mastery_state = 'mastered' AND mastered_at >= date_trunc('week', CURRENT_DATE))::int AS mastered,
        COUNT(*) FILTER (WHERE mastery_state = 'stale' AND updated_at >= date_trunc('week', CURRENT_DATE))::int AS decayed
      FROM student_cell_mastery
      WHERE student_id = ${studentId}
    `).then(toRows),
  ]);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fullDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const dailyBreakdown = dailyRows.map((r: any) => {
    const d = new Date(r.day);
    return {
      day: dayNames[d.getDay()],
      fullDay: fullDayNames[d.getDay()],
      date: r.day,
      questions: Number(r.questions),
      accuracy: Math.round(Number(r.accuracy) * 100) / 100,
    };
  });

  const totalQuestions = dailyBreakdown.reduce((s, d) => s + d.questions, 0);
  const avgAccuracy = dailyBreakdown.length > 0
    ? Math.round(dailyBreakdown.reduce((s, d) => s + d.accuracy, 0) / dailyBreakdown.length * 100) / 100
    : 0;
  const activeDays = dailyBreakdown.filter((d) => d.questions > 0).length;

  const totalStudySeconds = Number(studyTimeRows[0]?.time_seconds ?? 0);
  const totalStudyHours = Math.round((totalStudySeconds / 3600) * 10) / 10;

  const prevWeek = prevWeekRows[0] ?? {};
  const prevStudySeconds = Number(prevStudyTimeRows[0]?.time_seconds ?? 0);

  const sorted = [...dailyBreakdown].sort((a, b) => b.questions - a.questions);
  const bestDay = sorted[0]
    ? { day: sorted[0].fullDay, questions: sorted[0].questions, accuracy: sorted[0].accuracy }
    : null;
  const worstDay = sorted.length > 0
    ? { day: sorted[sorted.length - 1].fullDay, questions: sorted[sorted.length - 1].questions }
    : null;

  const eriStart = eriRows.length > 0 ? Number(eriRows[0].eri_value) : 0;
  const eriEnd = eriRows.length > 0 ? Number(eriRows[eriRows.length - 1].eri_value) : 0;

  const cellStats = cellRows[0] ?? {};

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    totalStudyHours,
    totalQuestions,
    avgAccuracy,
    activeDays,
    vsLastWeek: {
      studyHours: Math.round((prevStudySeconds / 3600) * 10) / 10,
      questions: Number(prevWeek.questions ?? 0),
      accuracy: Math.round(Number(prevWeek.accuracy ?? 0) * 100) / 100,
    },
    eriStart: Math.round(eriStart * 100) / 100,
    eriEnd: Math.round(eriEnd * 100) / 100,
    cellsMastered: Number(cellStats.mastered ?? 0),
    cellsDecayed: Number(cellStats.decayed ?? 0),
    dailyBreakdown: dailyBreakdown.map(({ day, questions, accuracy }) => ({ day, questions, accuracy })),
    bestDay,
    worstDay,
  };
}

analyticsV3.get("/student/me/weekly", async (c) => {
  try {
    return c.json({ success: true, data: await getStudentWeekly((c.get("user") as any).sub) });
  } catch (err) {
    console.error("[Analytics V3] weekly error:", err);
    return c.json({ success: false, error: "Failed to compute weekly analytics" }, 500);
  }
});

analyticsV3.get("/student/:studentId/weekly", ...staffStudentGates, async (c) => {
  try {
    return c.json({ success: true, data: await getStudentWeekly(c.req.param("studentId")) });
  } catch (err) {
    console.error("[Analytics V3] weekly error:", err);
    return c.json({ success: false, error: "Failed to compute weekly analytics" }, 500);
  }
});

// ── 20. GET /student/me/monthly ──────────────────────────────────

async function getStudentMonthly(studentId: string) {
  const [
    examRows,
    subjectRows,
    practiceVolumeRows,
    attendanceRows,
    eriRows,
    cellRows,
    errorRows,
  ] = await Promise.all([
    db.execute(sql`
      SELECT es.id, e.title, es.percentage, es.submitted_at
      FROM exam_submissions es
      JOIN exams e ON e.id = es.exam_id
      WHERE es.student_id = ${studentId}
        AND es.submitted_at >= date_trunc('month', CURRENT_DATE)
      ORDER BY es.submitted_at
    `).then(toRows),

    db.execute(sql`
      WITH subject_exams AS (
        SELECT
          subj.name AS subject_name,
          es.submitted_at,
          AVG(CASE WHEN er.is_correct THEN 100.0 ELSE 0 END) AS accuracy,
          ROW_NUMBER() OVER (PARTITION BY subj.id ORDER BY es.submitted_at ASC) AS rn_first,
          ROW_NUMBER() OVER (PARTITION BY subj.id ORDER BY es.submitted_at DESC) AS rn_last
        FROM exam_responses er
        JOIN exam_submissions es ON es.id = er.submission_id
        JOIN questions q ON q.id = er.question_id
        JOIN subjects subj ON subj.id = q.subject_id
        WHERE es.student_id = ${studentId}
          AND es.submitted_at >= date_trunc('month', CURRENT_DATE)
        GROUP BY subj.id, subj.name, es.submitted_at
      )
      SELECT
        subject_name,
        MAX(CASE WHEN rn_first = 1 THEN accuracy END) AS start_accuracy,
        MAX(CASE WHEN rn_last = 1 THEN accuracy END) AS end_accuracy
      FROM subject_exams
      GROUP BY subject_name
      HAVING COUNT(*) >= 2
      ORDER BY subject_name
    `).then(toRows),

    db.execute(sql`
      SELECT
        COALESCE(SUM(COALESCE(er.time_spent_seconds, 0)), 0)::int AS exam_time_seconds,
        COUNT(DISTINCT es.id)::int AS exam_sessions,
        COUNT(er.id)::int AS exam_questions
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      WHERE es.student_id = ${studentId}
        AND es.submitted_at >= date_trunc('month', CURRENT_DATE)
    `).then(toRows),

    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'present')::numeric / NULLIF(COUNT(*), 0) * 100 AS percent
      FROM attendance
      WHERE student_id = ${studentId}
        AND date >= date_trunc('month', CURRENT_DATE)::date
    `).then(toRows),

    db.execute(sql`
      SELECT eri_value FROM student_eri_state
      WHERE student_id = ${studentId}
      LIMIT 1
    `).then(toRows),

    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE mastery_state = 'mastered' AND mastered_at >= date_trunc('month', CURRENT_DATE))::int AS mastered,
        COUNT(*) FILTER (WHERE mastery_state = 'stale' AND updated_at >= date_trunc('month', CURRENT_DATE))::int AS decayed
      FROM student_cell_mastery
      WHERE student_id = ${studentId}
    `).then(toRows),

    db.execute(sql`
      SELECT
        error_type,
        COUNT(*) FILTER (WHERE created_at < date_trunc('month', CURRENT_DATE) + INTERVAL '15 days')::int AS first_half,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE) + INTERVAL '15 days')::int AS second_half
      FROM error_log
      WHERE student_id = ${studentId}
        AND created_at >= date_trunc('month', CURRENT_DATE)
      GROUP BY error_type
      ORDER BY error_type
    `).then(toRows),
  ]);

  const now = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  const examPercentages = examRows.map((r: any) => Number(r.percentage ?? 0));
  const avgScore = examPercentages.length > 0
    ? Math.round(examPercentages.reduce((s, p) => s + p, 0) / examPercentages.length * 100) / 100
    : 0;

  const lastMonthAvgRows = toRows(
    await db.execute(sql`
      SELECT COALESCE(AVG(percentage::numeric), 0) AS avg_pct
      FROM exam_submissions
      WHERE student_id = ${studentId}
        AND submitted_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
        AND submitted_at < date_trunc('month', CURRENT_DATE)
    `)
  );
  const lastMonthAvg = Number(lastMonthAvgRows[0]?.avg_pct ?? 0);
  const vsLastMonth = Math.round((avgScore - lastMonthAvg) * 100) / 100;

  const exams = examRows.map((r: any) => ({
    title: r.title,
    percentage: Math.round(Number(r.percentage ?? 0) * 100) / 100,
    date: r.submitted_at ? new Date(r.submitted_at).toISOString().slice(0, 10) : null,
  }));

  const subjectChange = subjectRows.map((r: any) => {
    const start = Math.round(Number(r.start_accuracy ?? 0) * 100) / 100;
    const end = Math.round(Number(r.end_accuracy ?? 0) * 100) / 100;
    return {
      subject: r.subject_name,
      start,
      end,
      delta: Math.round((end - start) * 100) / 100,
    };
  });

  const pv = practiceVolumeRows[0] ?? {};
  const practiceTimeSeconds = Number(pv.exam_time_seconds ?? 0);
  const practiceVolume = {
    hours: Math.round((practiceTimeSeconds / 3600) * 10) / 10,
    questions: Number(pv.exam_questions ?? 0),
    sessions: Number(pv.exam_sessions ?? 0),
  };

  const eriScore = eriRows.length > 0 ? Math.round(Number(eriRows[0].eri_value) * 100) / 100 : 0;
  const attendancePercent = Math.round(Number(attendanceRows[0]?.percent ?? 0) * 100) / 100;

  const cellStats = cellRows[0] ?? {};
  const mastered = Number(cellStats.mastered ?? 0);
  const decayed = Number(cellStats.decayed ?? 0);

  const errorShift: Record<string, { before: number; after: number }> = {};
  for (const r of errorRows) {
    errorShift[r.error_type] = {
      before: Number(r.first_half ?? 0),
      after: Number(r.second_half ?? 0),
    };
  }

  return {
    month: monthLabel,
    avgScore,
    vsLastMonth,
    eriScore,
    attendancePercent,
    exams,
    subjectChange,
    practiceVolume,
    masteryCells: { mastered, decayed, net: mastered - decayed },
    errorShift,
  };
}

analyticsV3.get("/student/me/monthly", async (c) => {
  try {
    return c.json({ success: true, data: await getStudentMonthly((c.get("user") as any).sub) });
  } catch (err) {
    console.error("[Analytics V3] monthly error:", err);
    return c.json({ success: false, error: "Failed to compute monthly analytics" }, 500);
  }
});

analyticsV3.get("/student/:studentId/monthly", ...staffStudentGates, async (c) => {
  try {
    return c.json({ success: true, data: await getStudentMonthly(c.req.param("studentId")) });
  } catch (err) {
    console.error("[Analytics V3] monthly error:", err);
    return c.json({ success: false, error: "Failed to compute monthly analytics" }, 500);
  }
});

// ── 21. GET /student/me/countdown ────────────────────────────────

async function getStudentCountdown(studentId: string, examTypeParam: string | null) {
  let examType = examTypeParam;

  if (!examType) {
    const studentRows = toRows(
      await db.execute(sql`SELECT target_exam FROM students WHERE user_id = ${studentId}`)
    );
    examType = studentRows[0]?.target_exam ?? "jee_mains";
  }

  const examDates: Record<string, { name: string; date: string }> = {
    jee_mains: { name: "JEE Main 2026", date: "2026-06-01" },
    jee_advanced: { name: "JEE Advanced 2026", date: "2026-06-22" },
    neet: { name: "NEET 2026", date: "2026-05-04" },
    clat: { name: "CLAT 2026", date: "2026-12-01" },
    ipmat_indore: { name: "IPMAT Indore 2026", date: "2026-05-20" },
    ipmat_rohtak: { name: "IPMAT Rohtak 2026", date: "2026-06-10" },
    bitsat: { name: "BITSAT 2026", date: "2026-05-25" },
  };

  const examInfo = examDates[examType] ?? {
    name: `${examType.replace(/_/g, " ").toUpperCase()} 2026`,
    date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  };

  const today = new Date();
  const examDate = new Date(examInfo.date);
  const daysRemaining = Math.max(0, Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  const [eriStateRows, eriSnapshotRows, weakCellRows, subjectRows] = await Promise.all([
    db.execute(sql`
      SELECT eri_value, mastered_cells, total_cells
      FROM student_eri_state
      WHERE student_id = ${studentId}
        AND exam_type = ${examType}
      LIMIT 1
    `).then(toRows),

    db.execute(sql`
      SELECT eri_value::numeric AS eri, snapshot_date
      FROM student_eri_snapshots
      WHERE student_id = ${studentId}
        AND exam_type = ${examType}
        AND snapshot_date >= CURRENT_DATE - 14
      ORDER BY snapshot_date ASC
    `).then(toRows),

    db.execute(sql`
      SELECT COUNT(*)::int AS weak_cells
      FROM student_cell_mastery
      WHERE student_id = ${studentId}
        AND mastery_state IN ('weak', 'untested', 'stale')
    `).then(toRows),

    db.execute(sql`
      SELECT
        subj.name AS subject_name,
        CASE WHEN COUNT(*) = 0 THEN 0
             ELSE (SUM(CASE WHEN scm.mastery_state IN ('mastered', 'reinforced', 'proficient') THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100
        END AS readiness_percent
      FROM student_cell_mastery scm
      JOIN syllabus_tree st ON st.id = scm.topic_id
      JOIN subjects subj ON subj.id = st.subject_id
      WHERE scm.student_id = ${studentId}
      GROUP BY subj.name
      ORDER BY subj.name
    `).then(toRows),
  ]);

  const currentEri = eriStateRows.length > 0 ? Number(eriStateRows[0].eri_value) : 0;
  const targetEri = 80;

  let eriVelocityPerDay = 0;
  if (eriSnapshotRows.length >= 2) {
    const n = eriSnapshotRows.length;
    const baseDate = new Date(eriSnapshotRows[0].snapshot_date).getTime();
    const xs = eriSnapshotRows.map((r: any) =>
      (new Date(r.snapshot_date).getTime() - baseDate) / (1000 * 60 * 60 * 24)
    );
    const ys = eriSnapshotRows.map((r: any) => Number(r.eri));

    const sumX = xs.reduce((a: number, b: number) => a + b, 0);
    const sumY = ys.reduce((a: number, b: number) => a + b, 0);
    const sumXY = xs.reduce((a: number, x: number, i: number) => a + x * ys[i], 0);
    const sumX2 = xs.reduce((a: number, x: number) => a + x * x, 0);

    const denom = n * sumX2 - sumX * sumX;
    if (denom !== 0) {
      eriVelocityPerDay = Math.round(((n * sumXY - sumX * sumY) / denom) * 1000) / 1000;
    }
  }

  const requiredVelocity = daysRemaining > 0
    ? Math.round(((targetEri - currentEri) / daysRemaining) * 1000) / 1000
    : 0;

  const onTrack = eriVelocityPerDay >= requiredVelocity;
  const weakCellsRemaining = Number(weakCellRows[0]?.weak_cells ?? 0);

  const subjectReadiness = subjectRows.map((r: any) => ({
    subject: r.subject_name,
    readinessPercent: Math.round(Number(r.readiness_percent) * 100) / 100,
  }));

  return {
    examName: examInfo.name,
    examType,
    daysRemaining,
    currentEri: Math.round(currentEri * 100) / 100,
    targetEri,
    eriVelocityPerDay,
    requiredVelocity,
    onTrack,
    weakCellsRemaining,
    subjectReadiness,
  };
}

analyticsV3.get("/student/me/countdown", async (c) => {
  try {
    return c.json({ success: true, data: await getStudentCountdown((c.get("user") as any).sub, c.req.query("examType") ?? null) });
  } catch (err) {
    console.error("[Analytics V3] countdown error:", err);
    return c.json({ success: false, error: "Failed to compute countdown analytics" }, 500);
  }
});

analyticsV3.get("/student/:studentId/countdown", ...staffStudentGates, async (c) => {
  try {
    return c.json({ success: true, data: await getStudentCountdown(c.req.param("studentId"), c.req.query("examType") ?? null) });
  } catch (err) {
    console.error("[Analytics V3] countdown error:", err);
    return c.json({ success: false, error: "Failed to compute countdown analytics" }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// Real implementations: attendance-impact, practice, answer-behavior,
// question-type-performance. Each helper takes a studentId and is
// reused by both the /me and /:studentId variants.
// ════════════════════════════════════════════════════════════════

async function getStudentAttendanceImpact(studentId: string) {
  const attRows = toRows(
    await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'present')::int AS present,
        COUNT(*)::int AS total
      FROM attendance
      WHERE student_id = ${studentId}
    `),
  );
  const attTotal = Number(attRows[0]?.total ?? 0);
  const attPresent = Number(attRows[0]?.present ?? 0);
  const attendancePercent = attTotal > 0 ? (attPresent / attTotal) * 100 : null;

  // For each submitted exam, compute the student's attendance % over
  // the 30 days prior. Bucket and correlate with exam score.
  const submissionRows = toRows(
    await db.execute(sql`
      WITH exam_data AS (
        SELECT
          es.id,
          es.percentage::numeric AS percentage,
          es.submitted_at::date AS exam_date
        FROM exam_submissions es
        WHERE es.student_id = ${studentId}
          AND es.submitted_at IS NOT NULL
          AND es.percentage IS NOT NULL
      )
      SELECT
        ed.percentage,
        COALESCE(
          (
            SELECT (COUNT(*) FILTER (WHERE a.status = 'present')::numeric
                    / NULLIF(COUNT(*), 0)) * 100
            FROM attendance a
            WHERE a.student_id = ${studentId}
              AND a.date BETWEEN ed.exam_date - INTERVAL '30 days' AND ed.exam_date
          ),
          0
        )::numeric AS prior_attendance_pct
      FROM exam_data ed
    `),
  );

  const samples = submissionRows.map((r: any) => ({
    score: Number(r.percentage) || 0,
    attendance: Number(r.prior_attendance_pct) || 0,
  }));

  if (samples.length === 0) {
    return {
      studentId,
      attendancePercent:
        attendancePercent !== null ? Math.round(attendancePercent * 10) / 10 : null,
      avgScoreHighAttendance: null,
      avgScoreLowAttendance: null,
      correlation: null,
      sampleSize: 0,
      insight:
        attendancePercent === null
          ? "No attendance records yet."
          : `Attendance is ${attendancePercent.toFixed(0)}% but no exams have been submitted yet.`,
    };
  }

  const high = samples.filter((s) => s.attendance >= 80);
  const low = samples.filter((s) => s.attendance < 80);
  const avgHigh =
    high.length > 0 ? high.reduce((a, s) => a + s.score, 0) / high.length : null;
  const avgLow =
    low.length > 0 ? low.reduce((a, s) => a + s.score, 0) / low.length : null;

  const n = samples.length;
  const meanX = samples.reduce((a, s) => a + s.attendance, 0) / n;
  const meanY = samples.reduce((a, s) => a + s.score, 0) / n;
  let num = 0;
  let denomX = 0;
  let denomY = 0;
  for (const s of samples) {
    const dx = s.attendance - meanX;
    const dy = s.score - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const correlation =
    denomX > 0 && denomY > 0 ? num / Math.sqrt(denomX * denomY) : null;

  let insight: string;
  if (avgHigh !== null && avgLow !== null) {
    const delta = avgHigh - avgLow;
    insight = `When prior 30-day attendance was ≥80%, average exam score was ${avgHigh.toFixed(0)}% vs ${avgLow.toFixed(0)}% otherwise — a ${delta >= 0 ? "+" : ""}${delta.toFixed(0)}pt swing.`;
  } else if (avgHigh !== null) {
    insight = `All ${high.length} exam${high.length === 1 ? "" : "s"} taken with high attendance — averaging ${avgHigh.toFixed(0)}%.`;
  } else if (avgLow !== null) {
    insight = `All exam periods had attendance below 80% — average score ${avgLow.toFixed(0)}%. Improving attendance may help.`;
  } else {
    insight = "Insufficient data to compute attendance impact.";
  }

  return {
    studentId,
    attendancePercent:
      attendancePercent !== null ? Math.round(attendancePercent * 10) / 10 : null,
    avgScoreHighAttendance: avgHigh !== null ? Math.round(avgHigh * 10) / 10 : null,
    avgScoreLowAttendance: avgLow !== null ? Math.round(avgLow * 10) / 10 : null,
    correlation: correlation !== null ? Math.round(correlation * 100) / 100 : null,
    sampleSize: n,
    insight,
  };
}

async function getStudentPracticeSummary(studentId: string) {
  const sessionRows = toRows(
    await db.execute(sql`
      SELECT
        COUNT(DISTINCT ps.id)::int AS total_sessions,
        COALESCE(AVG(psub.percentage::numeric), 0)::numeric AS avg_accuracy
      FROM practice_sessions ps
      LEFT JOIN practice_submissions psub ON psub.session_id = ps.id
      WHERE ps.student_id = ${studentId}
    `),
  );

  const totalSessions = Number(sessionRows[0]?.total_sessions ?? 0);
  const avgAccuracy = Number(sessionRows[0]?.avg_accuracy ?? 0);

  const qRows = toRows(
    await db.execute(sql`
      SELECT COUNT(*)::int AS total_questions
      FROM practice_responses pr
      JOIN practice_submissions psub ON psub.id = pr.submission_id
      WHERE psub.student_id = ${studentId}
    `),
  );
  const totalQuestions = Number(qRows[0]?.total_questions ?? 0);

  const recentRows = toRows(
    await db.execute(sql`
      SELECT
        ps.id AS session_id,
        ps.title,
        ps.practice_type,
        ps.created_at,
        ps.completed_at,
        psub.percentage::numeric AS percentage,
        psub.submitted_at
      FROM practice_sessions ps
      LEFT JOIN LATERAL (
        SELECT percentage, submitted_at
        FROM practice_submissions
        WHERE session_id = ps.id
        ORDER BY submitted_at DESC
        LIMIT 1
      ) psub ON TRUE
      WHERE ps.student_id = ${studentId}
      ORDER BY ps.created_at DESC
      LIMIT 10
    `),
  );

  const recentSessions = recentRows.map((r: any) => ({
    sessionId: r.session_id,
    title: r.title,
    practiceType: r.practice_type,
    percentage: r.percentage !== null ? Number(r.percentage) : null,
    submittedAt: r.submitted_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  }));

  // practice_sessions carries the PRACTICE taxonomy — mock / topic / chapter
  // exist only there, and exams(category='practice') is polluted with 541
  // exam_type='assignment' rows that are assigned work, not practice. It is a
  // best-effort dual-write, so a dropped insert can under-report; that is the
  // lesser evil versus labelling assignments as practice.
  const breakdownRows = toRows(
    await db.execute(sql`
      SELECT
        ps.practice_type AS type,
        COUNT(DISTINCT ps.id)::int AS sessions,
        COALESCE(AVG(psub.percentage::numeric), 0)::numeric AS avg_score
      FROM practice_sessions ps
      LEFT JOIN practice_submissions psub ON psub.session_id = ps.id
      WHERE ps.student_id = ${studentId}
      GROUP BY ps.practice_type
      ORDER BY sessions DESC
    `),
  );

  // `percentage` is what the practice page renders (share of all sessions);
  // sessions/avgScore stay for the staff-mobile table that reads them.
  const breakdownTotal = breakdownRows.reduce(
    (sum: number, r: any) => sum + Number(r.sessions),
    0,
  );
  const typeBreakdown = breakdownRows.map((r: any) => ({
    type: r.type,
    sessions: Number(r.sessions),
    avgScore: Math.round(Number(r.avg_score) * 10) / 10,
    percentage:
      breakdownTotal > 0
        ? Math.round((Number(r.sessions) / breakdownTotal) * 1000) / 10
        : 0,
  }));

  // ── The four KPIs the practice page has always rendered as 0 ──
  //
  // dppStreak / mockFrequency / selfAssignedRatio / cadence / errorCorrection
  // were read by the page (and its staff-mobile twin) but never returned here,
  // so every student showed "0 days" and "0/wk" regardless of what they did.

  // Streak counts consecutive IST days with a SUBMITTED dpp exam — the same
  // definition and the same source table as the student's own streak
  // (/api/v1/dpp/student/:id/streak). Reading practice_submissions instead
  // would drift from the number the student sees.
  const dppDayRows = toRows(
    await db.execute(sql`
      SELECT DISTINCT
        DATE(es.submitted_at AT TIME ZONE 'Asia/Kolkata')::text AS day
      FROM exam_submissions es
      JOIN exams e ON e.id = es.exam_id
      WHERE es.student_id = ${studentId}
        AND e.exam_type = 'dpp'
        AND es.submitted_at IS NOT NULL
      ORDER BY day DESC
    `),
  );
  const dppDays = dppDayRows.map((r: any) => String(r.day));
  let dppStreak = 0;
  if (dppDays.length > 0) {
    const istToday = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );
    const dayStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const shift = (s: string, n: number) => {
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(y!, m! - 1, d! + n);
      return dayStr(dt);
    };
    const today = dayStr(istToday);
    const yesterday = shift(today, -1);
    // A streak only survives if the last completion is today or yesterday.
    if (dppDays[0] === today || dppDays[0] === yesterday) {
      let cursor = dppDays[0]!;
      for (const d of dppDays) {
        if (d === cursor) {
          dppStreak++;
          cursor = shift(cursor, -1);
        } else if (d < cursor) {
          break;
        }
      }
    }
  }

  // Weekly cadence — last 8 ISO weeks of practice sessions.
  const cadenceRows = toRows(
    await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('week', ps.created_at), 'DD Mon') AS week,
        COUNT(DISTINCT ps.id)::int AS sessions
      FROM practice_sessions ps
      WHERE ps.student_id = ${studentId}
        AND ps.created_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', ps.created_at)
      ORDER BY DATE_TRUNC('week', ps.created_at) ASC
    `),
  );
  const cadence = cadenceRows.map((r: any) => ({
    week: String(r.week),
    sessions: Number(r.sessions),
  }));

  // Mocks per week — over the SAME 8 weeks the cadence chart covers.
  // breakdownRows is all-time, so dividing it by 8 reported a second-year
  // student's lifetime mocks as a weekly rate (120 mocks → "15/wk"), with the
  // error growing the longer the account has existed.
  const mockRows = toRows(
    await db.execute(sql`
      SELECT COUNT(DISTINCT ps.id)::int AS n
      FROM practice_sessions ps
      WHERE ps.student_id = ${studentId}
        AND ps.practice_type = 'mock'
        AND ps.created_at >= NOW() - INTERVAL '8 weeks'
    `),
  );
  const mockFrequency = Math.round((Number(mockRows[0]?.n ?? 0) / 8) * 10) / 10;

  // Self-started vs assigned. This CANNOT come from practice_sessions: that
  // table is student-owned by definition and its practice_type values
  // ("mock" | "dpp" | "daily5" | "revision" | "custom") never contain
  // "assignment", so filtering on that substring matched every row and pinned
  // the ratio at 100 for every student. Assigned work lives in
  // exam_submissions on non-practice exams.
  // Both halves come from exam_submissions, which is the truthful source —
  // practice_submissions is a best-effort dual-write and can be short.
  const originRows = toRows(
    await db.execute(sql`
      SELECT
        -- 'assignment' exams are filed under category='practice' (541 of them
        -- on dev), so category alone would count assigned work as self-started.
        COUNT(*) FILTER (
          WHERE e.category = 'practice' AND e.exam_type <> 'assignment'
        )::int AS self_started,
        COUNT(*) FILTER (
          WHERE COALESCE(e.category, 'exam') <> 'practice'
             OR e.exam_type = 'assignment'
        )::int AS assigned
      FROM exam_submissions es
      JOIN exams e ON e.id = es.exam_id
      WHERE es.student_id = ${studentId}
        AND es.submitted_at IS NOT NULL
    `),
  );
  const selfStarted = Number(originRows[0]?.self_started ?? 0);
  const assignedCount = Number(originRows[0]?.assigned ?? 0);
  const originTotal = selfStarted + assignedCount;
  const selfAssignedRatio =
    originTotal > 0 ? Math.round((selfStarted / originTotal) * 100) : 0;

  // Error-correction loop — how the spaced-repetition bank is actually going.
  const errRows = toRows(
    await db.execute(sql`
      SELECT
        COALESCE(AVG(repeat_count) FILTER (WHERE mastery_status = 'mastered'), 0)::numeric AS avg_revisions,
        COUNT(*) FILTER (WHERE mastery_status = 'mastered')::int AS mastered,
        COUNT(*) FILTER (WHERE mastery_status <> 'mastered')::int AS open,
        COUNT(*) FILTER (
          WHERE mastery_status <> 'mastered'
            AND next_review_date IS NOT NULL
            -- IST, not the session TZ: on a UTC server CURRENT_DATE flips at
            -- 05:30 IST, so between midnight and then everything due "today"
            -- counted as overdue.
            AND next_review_date < (NOW() AT TIME ZONE 'Asia/Kolkata')::date
        )::int AS overdue
      FROM error_log
      WHERE student_id = ${studentId}
    `),
  );
  const mastered = Number(errRows[0]?.mastered ?? 0);
  const openErrors = Number(errRows[0]?.open ?? 0);
  const overdueReviews = Number(errRows[0]?.overdue ?? 0);
  const errorCorrection = {
    // Revisits it took to move a mistake to "mastered" — 1 means first retry.
    avgRevisionsToMaster:
      Math.round(Number(errRows[0]?.avg_revisions ?? 0) * 10) / 10,
    // Share of the bank that is NOT sitting overdue for review.
    complianceRate:
      openErrors > 0
        ? Math.round(((openErrors - overdueReviews) / openErrors) * 100)
        : 100,
    overdueReviews,
  };

  return {
    studentId,
    totalSessions,
    totalQuestions,
    avgAccuracy: Math.round(avgAccuracy * 10) / 10,
    recentSessions,
    typeBreakdown,
    dppStreak,
    mockFrequency,
    selfAssignedRatio,
    masteredErrors: mastered,
    cadence,
    errorCorrection,
  };
}

async function getStudentAnswerBehavior(studentId: string, examId: string) {
  const submissionRows = toRows(
    await db.execute(sql`
      SELECT id FROM exam_submissions
      WHERE student_id = ${studentId} AND exam_id = ${examId}
      LIMIT 1
    `),
  );

  if (submissionRows.length === 0) {
    return {
      studentId,
      examId,
      revisitCount: 0,
      avgTimePerQuestion: 0,
      skippedCount: 0,
      changedAnswerCount: 0,
      timeDistribution: [],
      sampleSize: 0,
    };
  }

  const submissionId = submissionRows[0].id;

  const behaviorRows = toRows(
    await db.execute(sql`
      SELECT
        COALESCE(SUM(GREATEST(COALESCE(visit_count, 1) - 1, 0)), 0)::int AS revisit_count,
        COALESCE(AVG(NULLIF(time_spent_seconds, 0)), 0)::numeric AS avg_time,
        COUNT(*) FILTER (WHERE selected_answer IS NOT NULL AND selected_answer <> '')::int AS answered_count,
        COUNT(*) FILTER (
          WHERE answer_change_history IS NOT NULL
            AND jsonb_typeof(answer_change_history) = 'array'
            AND jsonb_array_length(answer_change_history) > 0
        )::int AS changed_count,
        COUNT(*)::int AS total
      FROM exam_responses
      WHERE submission_id = ${submissionId}
    `),
  );
  const b = (behaviorRows[0] ?? {}) as Record<string, unknown>;

  // Skipped = full paper size − answered, so questions with no response row
  // (autosave/release-recovery submissions) still count as skipped.
  const qCountRows = toRows(
    await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM exam_questions WHERE exam_id = ${examId}
    `),
  );
  const fullQuestionCount = Number((qCountRows[0] as any)?.total ?? 0);
  const answeredCount = Number(b.answered_count ?? 0);

  const distRows = toRows(
    await db.execute(sql`
      SELECT
        CASE
          WHEN time_spent_seconds IS NULL OR time_spent_seconds = 0 THEN 'no_data'
          WHEN time_spent_seconds < 30 THEN '0-30s'
          WHEN time_spent_seconds < 60 THEN '30-60s'
          WHEN time_spent_seconds < 120 THEN '60-120s'
          WHEN time_spent_seconds < 300 THEN '120-300s'
          ELSE '300s+'
        END AS bucket,
        COUNT(*)::int AS count
      FROM exam_responses
      WHERE submission_id = ${submissionId}
      GROUP BY bucket
      ORDER BY bucket
    `),
  );

  return {
    studentId,
    examId,
    revisitCount: Number(b.revisit_count ?? 0),
    avgTimePerQuestion: Math.round(Number(b.avg_time ?? 0) * 10) / 10,
    skippedCount: Math.max(0, fullQuestionCount - answeredCount),
    changedAnswerCount: Number(b.changed_count ?? 0),
    timeDistribution: distRows.map((r: any) => ({
      bucket: r.bucket,
      count: Number(r.count),
    })),
    sampleSize: fullQuestionCount || Number(b.total ?? 0),
  };
}

async function getStudentQuestionTypePerformance(studentId: string) {
  const rows = toRows(
    await db.execute(sql`
      SELECT
        q.question_type AS type,
        COUNT(er.id)::int AS attempts,
        COUNT(*) FILTER (WHERE er.is_correct = true)::int AS correct,
        COALESCE(AVG(NULLIF(er.time_spent_seconds, 0)), 0)::numeric AS avg_time
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      JOIN questions q ON q.id = er.question_id
      WHERE es.student_id = ${studentId}
      GROUP BY q.question_type
      ORDER BY attempts DESC
    `),
  );

  const types = rows.map((r: any) => {
    const attempts = Number(r.attempts);
    const correct = Number(r.correct);
    return {
      type: r.type ?? "unknown",
      attempts,
      correct,
      accuracy: attempts > 0 ? Math.round((correct / attempts) * 1000) / 10 : 0,
      avgTimeSeconds: Math.round(Number(r.avg_time) * 10) / 10,
    };
  });

  return { studentId, types };
}

analyticsV3.get("/student/me/attendance-impact", async (c) => {
  try {
    const data = await getStudentAttendanceImpact((c.get("user") as any).sub);
    return c.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics V3] attendance-impact error:", err);
    return c.json({ success: false, error: "Failed to compute attendance impact" }, 500);
  }
});

analyticsV3.get("/student/:studentId/attendance-impact", ...staffStudentGates, async (c) => {
  try {
    const data = await getStudentAttendanceImpact(c.req.param("studentId"));
    return c.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics V3] attendance-impact error:", err);
    return c.json({ success: false, error: "Failed to compute attendance impact" }, 500);
  }
});

analyticsV3.get("/student/me/practice", async (c) => {
  try {
    const data = await getStudentPracticeSummary((c.get("user") as any).sub);
    return c.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics V3] practice summary error:", err);
    return c.json({ success: false, error: "Failed to compute practice summary" }, 500);
  }
});

analyticsV3.get("/student/:studentId/practice", ...staffStudentGates, async (c) => {
  try {
    const data = await getStudentPracticeSummary(c.req.param("studentId"));
    return c.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics V3] practice summary error:", err);
    return c.json({ success: false, error: "Failed to compute practice summary" }, 500);
  }
});

// ── Per-question practice history ───────────────────────────
//
// Every question this student answered in PRACTICE (dpp / daily 5 / self
// practice — `exams.category = 'practice'`, which is what excludes real
// exams), shaped as the QuestionStat contract the shared palette already
// renders. For one student `answered`/`eligible` are 1 and `correct` is 0
// or 1, so the palette's accuracy tint becomes a right/wrong grid.
//
// `sectionName` carries the IST practice DAY, so the palette groups the
// grid by day — "what did they answer, and when".
async function getStudentPracticeQuestions(
  studentId: string,
  fromDay: string,
  toDay: string,
  /** When set, ONLY this IST day's questions are returned. Without it the
   *  caller gets day summaries and no question rows — a student can answer
   *  18 a day, so shipping a month in one payload is a lot of nothing for
   *  a page that shows one day at a time. */
  day?: string,
  /** Narrow to one practice type (dpp / daily5 / mock / …). Arriving from the
   *  DPP report should show DPP, not every practice surface mixed together. */
  practiceType?: string,
) {
  // Day index first — cheap, and it drives both the chart and the day list.
  const dayRows = toRows(
    await db.execute(sql`
      SELECT
        DATE(es.submitted_at AT TIME ZONE 'Asia/Kolkata')::text AS day,
        MIN(e.title) AS title,
        -- Must match the per-question definition below (selected_answer set),
        -- or a day header reading "18 answered" sits above tiles where some
        -- are greyed as unanswered and the facet counts sum to fewer than 18.
        COUNT(*) FILTER (WHERE er.selected_answer IS NOT NULL)::int AS answered,
        COUNT(*)::int AS presented,
        COUNT(*) FILTER (WHERE er.is_correct IS TRUE)::int AS correct,
        COALESCE(SUM(er.time_spent_seconds), 0)::int AS seconds,
        MIN(e.exam_type) AS practice_type
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      JOIN exams e ON e.id = es.exam_id
      WHERE es.student_id = ${studentId}
        AND e.category = 'practice'
        AND ${selfDirectedPracticeSql()}
        AND es.submitted_at IS NOT NULL
        AND DATE(es.submitted_at AT TIME ZONE 'Asia/Kolkata')::text >= ${fromDay}
        AND DATE(es.submitted_at AT TIME ZONE 'Asia/Kolkata')::text <= ${toDay}
        ${practiceType ? sql`AND e.exam_type = ${practiceType}` : sql``}
      GROUP BY DATE(es.submitted_at AT TIME ZONE 'Asia/Kolkata')
      ORDER BY day DESC
    `),
  );
  // Deliberately NOT filtered by practiceType: these are the options the UI
  // offers, so narrowing to dpp must not erase "you also have daily5".
  const availableTypes = toRows(
    await db.execute(sql`
      SELECT
        e.exam_type AS type,
        COUNT(DISTINCT DATE(es.submitted_at AT TIME ZONE 'Asia/Kolkata'))::int AS days
      FROM exam_submissions es
      JOIN exams e ON e.id = es.exam_id
      WHERE es.student_id = ${studentId}
        AND e.category = 'practice'
        AND ${selfDirectedPracticeSql()}
        AND es.submitted_at IS NOT NULL
        AND DATE(es.submitted_at AT TIME ZONE 'Asia/Kolkata')::text >= ${fromDay}
        AND DATE(es.submitted_at AT TIME ZONE 'Asia/Kolkata')::text <= ${toDay}
      GROUP BY e.exam_type
      ORDER BY days DESC
    `),
  );

  const byDay = dayRows.map((r: any) => ({
    date: String(r.day),
    title: r.title ?? null,
    practiceType: r.practice_type ?? null,
    answered: Number(r.answered),
    presented: Number(r.presented),
    correct: Number(r.correct),
    seconds: Number(r.seconds),
    accuracy: Number(r.answered) > 0 ? Number(r.correct) / Number(r.answered) : null,
  }));

  // No day requested → index only.
  if (!day) {
    return {
      questionCount: byDay.reduce((s, d) => s + d.answered, 0),
      submissionCount: byDay.length,
      questions: [] as unknown[],
      byDay,
      day: null,
      practiceType: practiceType ?? null,
      // Returned on the INDEX call too. It used to appear only once a day was
      // opened, so a surface that renders its type filter from the index (the
      // student practice page does) had nothing to build the control from.
      availableTypes: availableTypes.map((t: any) => ({
        type: String(t.type),
        days: Number(t.days),
      })),
      window: { from: fromDay, to: toDay },
    };
  }

  const rows = toRows(
    await db.execute(sql`
      SELECT
        DATE(es.submitted_at AT TIME ZONE 'Asia/Kolkata')::text AS day,
        es.submitted_at,
        e.exam_type,
        -- Session identity. One IST day can hold a Daily Practice set, a
        -- Daily 5 and a topic drill; the student review palette renders one
        -- palette PER session, and the inline error-classifier posts to
        -- /exams/:examId/classify-errors — so both are per-row, not per-day.
        e.id AS exam_id,
        e.title AS exam_title,
        q.id AS question_id,
        q.question_text_md,
        q.question_images,
        q.question_type,
        q.options_json,
        q.option_images,
        q.correct_answer,
        q.solution_md,
        q.solution_images,
        q.difficulty,
        st.name AS topic_name,
        er.selected_answer,
        er.is_correct,
        er.time_spent_seconds,
        er.visit_count,
        -- Already-tagged questions must pre-paint as classified instead of
        -- re-prompting the student on every visit.
        er.error_classification
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      JOIN exams e ON e.id = es.exam_id
      JOIN questions q ON q.id = er.question_id
      LEFT JOIN syllabus_tree st ON st.id = q.syllabus_node_id
      WHERE es.student_id = ${studentId}
        AND e.category = 'practice'
        AND ${selfDirectedPracticeSql()}
        AND es.submitted_at IS NOT NULL
        AND DATE(es.submitted_at AT TIME ZONE 'Asia/Kolkata')::text = ${day}
        ${practiceType ? sql`AND e.exam_type = ${practiceType}` : sql``}
      ORDER BY es.submitted_at DESC, er.question_id
      LIMIT 500
    `),
  );

  // db.execute() hands jsonb back as a STRING. The palette types these as
  // objects and will happily iterate a string's characters if given one —
  // which renders each option as a separate row of single letters.
  const asJson = (v: unknown) => {
    if (v == null) return null;
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  };

  const questions = rows.map((r: any, i: number) => {
    const isCorrect = r.is_correct === true;
    const answered = r.selected_answer != null ? 1 : 0;
    return {
      index: i + 1,
      // Grouping key for the palette — the day they practised.
      sectionName: String(r.day),
      questionId: String(r.question_id),
      // Which attempt this question belongs to. The student palette groups
      // on it; the staff palette ignores it.
      examId: String(r.exam_id),
      examTitle: r.exam_title ?? null,
      questionTextMd: r.question_text_md ?? null,
      questionImages: asJson(r.question_images),
      questionType: r.question_type ?? null,
      optionsJson: asJson(r.options_json),
      optionImages: asJson(r.option_images),
      correctAnswer: r.correct_answer ?? null,
      solutionMd: r.solution_md ?? null,
      // Image-only solutions are common (photographed worked steps) — the
      // palette opens its solution box on these even with no markdown.
      solutionImages: asJson(r.solution_images),
      difficulty: r.difficulty ?? null,
      topicName: r.topic_name ?? null,
      practiceType: r.exam_type ?? null,
      selectedAnswer: r.selected_answer ?? null,
      errorClassification: r.error_classification ?? null,
      answered,
      eligible: 1,
      correct: isCorrect ? 1 : 0,
      correctRate: answered > 0 ? (isCorrect ? 1 : 0) : null,
      avgTimeSeconds:
        r.time_spent_seconds != null ? Number(r.time_spent_seconds) : null,
      visitCount: r.visit_count != null ? Number(r.visit_count) : null,
      // One student, one pick — the palette's option bars become "what they chose".
      optionDistribution:
        r.selected_answer != null ? { [String(r.selected_answer)]: 1 } : {},
    };
  });

  return {
    questionCount: byDay.reduce((s, d) => s + d.answered, 0),
    submissionCount: byDay.length,
    questions,
    byDay,
    day,
    practiceType: practiceType ?? null,
    availableTypes: availableTypes.map((t: any) => ({
      type: String(t.type),
      days: Number(t.days),
    })),
    window: { from: fromDay, to: toDay },
  };
}

/** yyyy-mm-dd or null. Defaults to the trailing 30 IST days. */
function practiceRange(c: {
  req: { query: (k: string) => string | undefined };
}): { from: string; to: string } {
  // Shape AND reality — "2026-13-45" matches the pattern but is not a date.
  const isYmd = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const t = Date.parse(`${s}T00:00:00Z`);
    return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
  };
  const qFrom = (c.req.query("from") ?? "").slice(0, 10);
  const qTo = (c.req.query("to") ?? "").slice(0, 10);
  const istNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const day = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let to = isYmd(qTo) ? qTo : day(istNow);
  let from = isYmd(qFrom)
    ? qFrom
    : day(new Date(istNow.getTime() - 29 * 86_400_000));
  if (to < from) [from, to] = [to, from];
  return { from, to };
}

// Registered BEFORE its /:studentId sibling. Hono resolves overlapping
// routes in REGISTRATION order, not static-over-param — with the staff route
// first, a student asking for "me" fell into it, passed requirePermission
// ("analytics:batch", which students hold) and then failed ownership with a
// silent 404. Every other /student/me/* pair in this file is ordered the
// same way; this one had been inverted.
analyticsV3.get("/student/me/practice/questions", async (c) => {
  try {
    const { from, to } = practiceRange(c);
    const dayParam = (c.req.query("day") ?? "").slice(0, 10);
    const typeParam = (c.req.query("type") ?? "").slice(0, 40);
    const data = await getStudentPracticeQuestions(
      (c.get("user") as any).sub,
      from,
      to,
      /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : undefined,
      /^[a-z0-9_]+$/.test(typeParam) ? typeParam : undefined,
    );
    return c.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics V3] practice questions error:", err);
    return c.json(
      { success: false, error: "Failed to load practice questions" },
      500,
    );
  }
});

analyticsV3.get(
  "/student/:studentId/practice/questions",
  ...staffStudentGates,
  async (c) => {
    try {
      const { from, to } = practiceRange(c);
      const dayParam = (c.req.query("day") ?? "").slice(0, 10);
      const typeParam = (c.req.query("type") ?? "").slice(0, 40);
      const data = await getStudentPracticeQuestions(
        c.req.param("studentId"),
        from,
        to,
        /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : undefined,
        /^[a-z0-9_]+$/.test(typeParam) ? typeParam : undefined,
      );
      return c.json({ success: true, data });
    } catch (err) {
      console.error("[Analytics V3] practice questions error:", err);
      return c.json(
        { success: false, error: "Failed to load practice questions" },
        500,
      );
    }
  },
);

analyticsV3.get("/student/me/answer-behavior/:examId", async (c) => {
  try {
    const data = await getStudentAnswerBehavior(
      (c.get("user") as any).sub,
      c.req.param("examId"),
    );
    return c.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics V3] answer-behavior error:", err);
    return c.json({ success: false, error: "Failed to compute answer behavior" }, 500);
  }
});

analyticsV3.get("/student/:studentId/answer-behavior/:examId", ...staffStudentGates, async (c) => {
  try {
    const data = await getStudentAnswerBehavior(
      c.req.param("studentId"),
      c.req.param("examId"),
    );
    return c.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics V3] answer-behavior error:", err);
    return c.json({ success: false, error: "Failed to compute answer behavior" }, 500);
  }
});

analyticsV3.get("/student/me/question-type-performance", async (c) => {
  try {
    const data = await getStudentQuestionTypePerformance((c.get("user") as any).sub);
    return c.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics V3] question-type-performance error:", err);
    return c.json({ success: false, error: "Failed to compute question-type performance" }, 500);
  }
});

analyticsV3.get("/student/:studentId/question-type-performance", ...staffStudentGates, async (c) => {
  try {
    const data = await getStudentQuestionTypePerformance(c.req.param("studentId"));
    return c.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics V3] question-type-performance error:", err);
    return c.json({ success: false, error: "Failed to compute question-type performance" }, 500);
  }
});

// ── Skill profile — accuracy by question type and by difficulty
// band. Feeds the student analytics "Skill Profile" card. ─────────
async function getStudentDifficultyPerformance(studentId: string) {
  const rows = toRows(
    await db.execute(sql`
      SELECT
        q.difficulty AS level,
        COUNT(er.id)::int AS attempts,
        COUNT(*) FILTER (WHERE er.is_correct = true)::int AS correct,
        COALESCE(AVG(NULLIF(er.time_spent_seconds, 0)), 0)::numeric AS avg_time
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      JOIN questions q ON q.id = er.question_id
      WHERE es.student_id = ${studentId}
      GROUP BY q.difficulty
    `),
  );

  return rows.map((r: any) => {
    const attempts = Number(r.attempts);
    const correct = Number(r.correct);
    return {
      level: r.level ?? "unknown",
      attempts,
      correct,
      accuracy: attempts > 0 ? Math.round((correct / attempts) * 1000) / 10 : 0,
      avgTimeSeconds: Math.round(Number(r.avg_time) * 10) / 10,
    };
  });
}

async function getStudentSkillProfile(studentId: string) {
  const [typePerf, difficulties] = await Promise.all([
    getStudentQuestionTypePerformance(studentId),
    getStudentDifficultyPerformance(studentId),
  ]);
  return { studentId, types: typePerf.types, difficulties };
}

analyticsV3.get("/student/me/skill-profile", async (c) => {
  try {
    const data = await getStudentSkillProfile((c.get("user") as any).sub);
    return c.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics V3] skill-profile error:", err);
    return c.json({ success: false, error: "Failed to compute skill profile" }, 500);
  }
});

analyticsV3.get("/student/:studentId/skill-profile", ...staffStudentGates, async (c) => {
  try {
    const data = await getStudentSkillProfile(c.req.param("studentId"));
    return c.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics V3] skill-profile error:", err);
    return c.json({ success: false, error: "Failed to compute skill profile" }, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// At-risk weakness diagnosis (per-student deep-dive)
// ════════════════════════════════════════════════════════════════

/** Map raw error_log.error_type strings into the 4 narrative buckets. */
function mapErrorClass(raw: string): ErrorClass {
  switch (raw) {
    case "conceptual":
      return "conceptual";
    case "calculation":
    case "procedural":
      return "procedural";
    case "careless":
    case "silly":
      return "careless";
    default:
      // time_pressure, unclassified, anything else
      return "other";
  }
}

async function getStudentDiagnosis(studentId: string, batchId?: string) {
  // Run the heavy queries in parallel — same DB cost, single round-trip
  // for the client.
  const [
    studentRow,
    errorDnaRows,
    errorChapterRows,
    insightRows,
    predictionRow,
    attendanceRow,
    cohortAttendanceRow,
    behaviorRow,
    cohortBehaviorRow,
    recentExamsRows,
    practiceRow,
    subjectAccuracyRows,
  ] = await Promise.all([
    db.execute(sql`
      SELECT u.id, u.name, u.institution_id
      FROM users u
      WHERE u.id = ${studentId}
      LIMIT 1
    `),
    // Error DNA — counts grouped by error_type, last 90 days
    db.execute(sql`
      SELECT error_type, COUNT(*)::int AS n,
             COUNT(*) FILTER (WHERE mastery_status = 'unresolved')::int AS unresolved
      FROM error_log
      WHERE student_id = ${studentId}
        AND created_at >= NOW() - INTERVAL '90 days'
      GROUP BY error_type
    `),
    // Top 3 chapters by unresolved error count (rolled up via the same
    // recursive walk used in the at-risk list endpoint).
    db.execute(sql`
      WITH RECURSIVE walk AS (
        SELECT id AS leaf_id, id AS curr_id, parent_id, level::text AS lvl, name, 0 AS depth
        FROM syllabus_tree
        WHERE id IN (
          SELECT DISTINCT topic_id FROM error_log
          WHERE student_id = ${studentId}
        )
        UNION ALL
        SELECT w.leaf_id, p.id, p.parent_id, p.level::text, p.name, w.depth + 1
        FROM walk w
        JOIN syllabus_tree p ON p.id = w.parent_id
        WHERE w.lvl <> 'chapter' AND w.depth < 5
      ),
      chapter_for_node AS (
        SELECT DISTINCT ON (leaf_id)
          leaf_id, curr_id AS chapter_id, name AS chapter_name
        FROM walk
        ORDER BY leaf_id, (lvl = 'chapter')::int DESC, depth DESC
      )
      SELECT
        cfn.chapter_id,
        cfn.chapter_name,
        COUNT(el.id) FILTER (WHERE el.mastery_status = 'unresolved')::int AS unresolved,
        COUNT(el.id)::int AS total,
        MAX(el.created_at) AS last_seen_at
      FROM error_log el
      JOIN chapter_for_node cfn ON cfn.leaf_id = el.topic_id
      WHERE el.student_id = ${studentId}
      GROUP BY cfn.chapter_id, cfn.chapter_name
      ORDER BY unresolved DESC NULLS LAST, total DESC
      LIMIT 5
    `),
    db
      .select({
        id: studentInsights.id,
        kind: studentInsights.kind,
        severity: studentInsights.severity,
        title: studentInsights.title,
        body: studentInsights.body,
        generatedAt: studentInsights.generatedAt,
      })
      .from(studentInsights)
      .where(
        and(
          eq(studentInsights.studentId, studentId),
          isNull(studentInsights.dismissedAt),
        ),
      )
      .orderBy(desc(studentInsights.generatedAt))
      .limit(5),
    db
      .select()
      .from(studentPredictionsV3)
      .where(eq(studentPredictionsV3.studentId, studentId))
      .limit(1),
    // Attendance last 30 days
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'present')::int AS present_days,
        COUNT(*) FILTER (WHERE status = 'absent')::int AS absent_days,
        COUNT(*) FILTER (WHERE status = 'late')::int AS late_days,
        COUNT(*)::int AS total
      FROM attendance
      WHERE student_id = ${studentId}
        AND date >= CURRENT_DATE - INTERVAL '30 days'
    `),
    // Cohort attendance baseline (same batch, same window)
    batchId
      ? db.execute(sql`
          SELECT
            (COUNT(*) FILTER (WHERE a.status = 'present')::numeric
             / NULLIF(COUNT(*), 0)) * 100 AS pct
          FROM attendance a
          JOIN students s ON s.user_id = a.student_id
          WHERE s.batch_id = ${batchId}
            AND a.date >= CURRENT_DATE - INTERVAL '30 days'
        `)
      : Promise.resolve([] as any),
    // Behavior signals from exam responses (last 90 days)
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE er.visit_count > 1)::int AS revisits,
        COUNT(*) FILTER (
          WHERE er.time_spent_seconds IS NOT NULL AND er.time_spent_seconds < 30
        )::int AS rushed,
        AVG(NULLIF(er.time_spent_seconds, 0))::numeric AS avg_time
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      WHERE es.student_id = ${studentId}
        AND es.submitted_at >= NOW() - INTERVAL '90 days'
    `),
    // Cohort behavior baseline (same batch, same window) — just avg time
    batchId
      ? db.execute(sql`
          SELECT AVG(NULLIF(er.time_spent_seconds, 0))::numeric AS avg_time
          FROM exam_responses er
          JOIN exam_submissions es ON es.id = er.submission_id
          JOIN students s ON s.user_id = es.student_id
          WHERE s.batch_id = ${batchId}
            AND es.submitted_at >= NOW() - INTERVAL '90 days'
        `)
      : Promise.resolve([] as any),
    // Recent exams for sparkline
    db.execute(sql`
      SELECT es.id, e.title, es.percentage::numeric AS percentage, es.submitted_at
      FROM exam_submissions es
      JOIN exams e ON e.id = es.exam_id
      WHERE es.student_id = ${studentId}
        AND es.submitted_at IS NOT NULL
        AND es.percentage IS NOT NULL
      ORDER BY es.submitted_at DESC
      LIMIT 10
    `),
    // Days since last practice session
    db.execute(sql`
      SELECT MAX(submitted_at) AS last
      FROM practice_submissions
      WHERE student_id = ${studentId}
    `),
    // Per-subject accuracy (radar)
    db.execute(sql`
      SELECT s.id AS subject_id, s.name AS subject_name,
             COUNT(er.id)::int AS attempts,
             AVG(CASE WHEN er.is_correct THEN 1.0 ELSE 0.0 END)::numeric AS accuracy
      FROM exam_responses er
      JOIN exam_submissions es ON es.id = er.submission_id
      JOIN questions q ON q.id = er.question_id
      JOIN syllabus_tree st ON st.id = q.syllabus_node_id
      JOIN subjects s ON s.id = st.subject_id
      WHERE es.student_id = ${studentId}
      GROUP BY s.id, s.name
      ORDER BY accuracy ASC
    `),
  ]);

  const student = (toRows(studentRow)[0] as any) || null;
  if (!student) return null;

  // Error DNA → narrative buckets
  const counts: Record<ErrorClass, number> = {
    conceptual: 0,
    procedural: 0,
    careless: 0,
    other: 0,
  };
  let totalErrors = 0;
  for (const row of toRows(errorDnaRows) as any[]) {
    const bucket = mapErrorClass(row.error_type);
    counts[bucket] += Number(row.n);
    totalErrors += Number(row.n);
  }

  const topChapters = (toRows(errorChapterRows) as any[]).map((r) => ({
    chapterId: r.chapter_id as string,
    chapterName: r.chapter_name as string,
    unresolved: Number(r.unresolved ?? 0),
    total: Number(r.total ?? 0),
    lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null,
  }));

  const topErrorChapter = topChapters[0]
    ? {
        name: topChapters[0].chapterName,
        unresolved: topChapters[0].unresolved,
        lastSeenAt: topChapters[0].lastSeenAt,
      }
    : null;

  const att = (toRows(attendanceRow)[0] as any) || {};
  const presentDays = Number(att.present_days ?? 0);
  const absentDays = Number(att.absent_days ?? 0);
  const lateDays = Number(att.late_days ?? 0);
  const attTotal = Number(att.total ?? 0);
  const studentAttPercent =
    attTotal > 0 ? ((presentDays + lateDays) / attTotal) * 100 : 0;
  const cohortAttPercent =
    Number((toRows(cohortAttendanceRow)[0] as any)?.pct ?? 0);

  const beh = (toRows(behaviorRow)[0] as any) || {};
  const behTotal = Number(beh.total ?? 0);
  const revisitRate = behTotal > 0 ? Number(beh.revisits) / behTotal : 0;
  const rushedRate = behTotal > 0 ? Number(beh.rushed) / behTotal : 0;
  const avgTime = beh.avg_time !== null ? Number(beh.avg_time) : null;
  const cohortAvgTime =
    (toRows(cohortBehaviorRow)[0] as any)?.avg_time !== undefined
      ? Number((toRows(cohortBehaviorRow)[0] as any).avg_time)
      : null;

  const recentExams = (toRows(recentExamsRows) as any[])
    .map((r) => ({
      id: r.id as string,
      title: r.title as string,
      percentage: Number(r.percentage),
      submittedAt: new Date(r.submitted_at).toISOString(),
    }))
    .reverse(); // chronological for the chart

  const avgPercent =
    recentExams.length > 0
      ? recentExams.reduce((a, e) => a + e.percentage, 0) / recentExams.length
      : 0;

  const lastPractice = (toRows(practiceRow)[0] as any)?.last ?? null;
  const daysSincePractice = lastPractice
    ? Math.floor(
        (Date.now() - new Date(lastPractice).getTime()) / (1000 * 60 * 60 * 24),
      )
    : null;

  const subjectAccuracy = (toRows(subjectAccuracyRows) as any[]).map((r) => ({
    subjectId: r.subject_id as string,
    subjectName: r.subject_name as string,
    attempts: Number(r.attempts),
    accuracyPct: Math.round(Number(r.accuracy) * 1000) / 10,
  }));

  const prediction = predictionRow[0];
  const trend = (prediction?.trend as string | undefined) ?? "stagnant";

  // Hand the signals to the helper for narrative + recommended action
  const signals: AtRiskSignals = {
    studentName: student.name,
    avgPercent,
    trend,
    errorClassCounts: counts,
    topErrorChapter,
    attendance:
      attTotal > 0
        ? {
            presentDays,
            absentDays,
            cohortAvgPercent: cohortAttPercent,
            studentPercent: studentAttPercent,
          }
        : null,
    behavior:
      behTotal > 0
        ? {
            revisitRate,
            rushedRate,
            avgTimeSeconds: avgTime,
            cohortAvgTimeSeconds: cohortAvgTime,
          }
        : null,
    daysSincePractice,
  };

  const narrative = buildWhyNarrative(signals);
  const recommendedAction = buildRecommendedAction(signals);

  return {
    studentId,
    studentName: student.name,
    institutionId: student.institution_id as string,
    avgPercent: Math.round(avgPercent * 10) / 10,
    trend,
    trendNarrative: prediction?.trendNarrative ?? null,
    slopePerExam: prediction?.slopePerExam ? Number(prediction.slopePerExam) : null,
    confidence: prediction?.confidence ? Number(prediction.confidence) : null,
    narrative,
    recommendedAction,
    errorDna: {
      total: totalErrors,
      counts,
      topChapters,
    },
    behavior: {
      sampleSize: behTotal,
      revisitRate: Math.round(revisitRate * 1000) / 10,
      rushedRate: Math.round(rushedRate * 1000) / 10,
      avgTimeSeconds: avgTime,
      cohortAvgTimeSeconds: cohortAvgTime,
    },
    attendance: {
      windowDays: 30,
      presentDays,
      absentDays,
      lateDays,
      studentPercent: Math.round(studentAttPercent * 10) / 10,
      cohortPercent: Math.round(cohortAttPercent * 10) / 10,
    },
    practice: {
      daysSincePractice,
      lastPracticeAt: lastPractice ? new Date(lastPractice).toISOString() : null,
    },
    subjectAccuracy,
    recentExams,
    insights: insightRows.map((r) => ({
      id: r.id,
      kind: r.kind,
      severity: r.severity,
      title: r.title,
      body: r.body,
      generatedAt: r.generatedAt,
    })),
  };
}

analyticsV3.get(
  "/student/:studentId/diagnosis",
  requirePermission("analytics:batch"),
  async (c) => {
    const studentId = c.req.param("studentId");
    const batchId = c.req.query("batchId") || undefined;
    const user = c.get("user") as SessionUser & { institutionId?: string };
    const institutionId = (user as any)?.institutionId as string | undefined;
    if (!institutionId) {
      return c.json({ success: false, error: "Institution context required" }, 403);
    }
    try {
      const diagnosis = await getStudentDiagnosis(studentId, batchId);
      if (!diagnosis) {
        return c.json({ success: false, error: "Student not found" }, 404);
      }
      // Cross-tenant guard: 404 (not 403) so we don't leak whether the
      // studentId exists in another tenant.
      if (diagnosis.institutionId !== institutionId) {
        return c.json({ success: false, error: "Student not found" }, 404);
      }
      return c.json({ success: true, data: diagnosis });
    } catch (err) {
      console.error("[Analytics V3] diagnosis error:", err);
      return c.json({ success: false, error: "Failed to compute diagnosis" }, 500);
    }
  },
);

// ── AI explanation (on-demand, cached for 24h via studentInsights) ───

let anthClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    anthClient = new Anthropic({ apiKey });
  }
  return anthClient;
}

// We piggy-back the existing `comeback_plan` enum value to cache AI
// explanations (no migration needed). Disambiguated by `title = "AI
// explanation"`. If a real `ai_explanation` enum value gets added later,
// flip this constant.
const EXPLAIN_INSIGHT_KIND = "comeback_plan" as const;
const EXPLAIN_INSIGHT_TITLE = "AI explanation";

analyticsV3.post(
  "/student/:studentId/diagnosis/explain",
  requirePermission("analytics:batch"),
  async (c) => {
    const studentId = c.req.param("studentId");
    const batchId = c.req.query("batchId") || undefined;
    const user = c.get("user") as SessionUser & { institutionId?: string };
    const institutionId = (user as any)?.institutionId as string | undefined;
    if (!institutionId) {
      return c.json({ success: false, error: "Institution context required" }, 403);
    }

    try {
      // 1. Check 24h cache. We piggyback on student_insights with a custom
      //    title so we don't need a new table. The insightKindEnum doesn't
      //    include "ai_explanation"; we cast the string at insert time.
      const [cached] = await db
        .select()
        .from(studentInsights)
        .where(
          and(
            eq(studentInsights.studentId, studentId),
            eq(studentInsights.title, EXPLAIN_INSIGHT_TITLE),
            sql`${studentInsights.expiresAt} > NOW()`,
          ),
        )
        .orderBy(desc(studentInsights.generatedAt))
        .limit(1);

      if (cached) {
        return c.json({
          success: true,
          data: {
            paragraph: cached.body,
            cached: true,
            generatedAt: cached.generatedAt,
          },
        });
      }

      // 2. Re-run the diagnosis (cheap; same parallel queries) for the input.
      const diagnosis = await getStudentDiagnosis(studentId, batchId);
      if (!diagnosis) {
        return c.json({ success: false, error: "Student not found" }, 404);
      }
      if (diagnosis.institutionId !== institutionId) {
        return c.json({ success: false, error: "Student not found" }, 404);
      }

      // 3. Ask Claude Haiku for a richer paragraph.
      const anth = getAnthropic();
      const model = process.env.AT_RISK_EXPLAIN_MODEL || "claude-haiku-4-5";
      const systemPrompt = `You are an expert academic counselor at a competitive-exam coaching institute (JEE/NEET prep). Given a student's at-risk diagnosis as JSON, write ONE short paragraph (3-5 sentences, ≤120 words) explaining:
1. Why the student is struggling — name the dominant signals concretely
2. What single intervention would have the highest leverage
3. Use the student's name once, no more
Tone: precise, factual, no padding, no greeting, no bullet points. Plain prose.`;

      const resp = await anth.messages.create({
        model,
        max_tokens: 400,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Student diagnosis:\n${JSON.stringify(diagnosis, null, 2)}`,
          },
        ],
      });

      const paragraph = resp.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n")
        .trim();

      // 4. Persist to studentInsights with 24h TTL.
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.insert(studentInsights).values({
        studentId,
        kind: EXPLAIN_INSIGHT_KIND,
        severity: "info",
        title: EXPLAIN_INSIGHT_TITLE,
        body: paragraph,
        expiresAt,
      } as never);

      return c.json({
        success: true,
        data: {
          paragraph,
          cached: false,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error("[Analytics V3] explain error:", err);
      return c.json(
        { success: false, error: "Failed to generate AI explanation" },
        500,
      );
    }
  },
);

export default analyticsV3;
