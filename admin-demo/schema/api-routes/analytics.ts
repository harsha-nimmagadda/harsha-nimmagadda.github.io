// ============================================================
// BRILLIANCE API — Analytics Routes (Intelligence Layer)
// Reads from pre-computed student_analytics_cache for student
// endpoints. Batch/branch/institution remain live-computed.
// ============================================================

import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { checkPermission, type Permission } from "@brilliance/auth";
import { authMiddleware, requireRole } from "../middleware/auth";
import { tenantScope } from "../middleware/tenant-scope";
import { requirePermission, requireAnyPermission } from "../middleware/rbac";
import { verifyBatchOwnership, verifyBranchOwnership, isBatchInScope } from "../lib/tenant-guard";
import { authorizeStudentAccess } from "../lib/student-access";
import { success, error } from "../lib/response";
import {
  db,
  users,
  students,
  branches,
  batches,
  exams,
  examSubmissions,
  examSessions,
  examResponses,
  questions,
  subjects,
  syllabusTree,
  errorLog,
  studentAnalyticsCache,
  batchAnalyticsCache,
  institutionAnalyticsCache,
  facultyBatchAssignments,
  devicePresence,
  presenceSessions,
  doubts,
} from "@brilliance/db";
import { resolveExamAudience } from "@brilliance/exam-schedule/server";
import { loadExamSlots, loadStudentProfiles, pickBestSlot } from "../lib/exam-schedule";
import { generateDownloadUrl } from "../lib/s3";
import { eq, and, or, sql, desc, count, inArray, gte, lte, ne, isNotNull, isNull } from "drizzle-orm";
import { sqlIn } from "../lib/sql-helpers";
import { rebuildAllAnalytics, refreshBatchCache, refreshInstitutionCache } from "../lib/analytics-handlers";
import { presenceRedisPhase, countStudentsOnline } from "../lib/presence-redis";
import { examOnly } from "../lib/error-log-source";
import { examCategoryIs, examCategoryGuardSql } from "../lib/exam-category";
import { deriveClassLevels } from "../lib/class-levels";

const analytics = new Hono();

// Roles that get the dashboard's live-ops board. Vice Principal is RBAC
// v2's designated executor for live monitoring and EDP runs the exam
// hall, but neither holds any `analytics:*` permission — so the live-ops
// routes gate on role, and the handlers branch-lock everyone outside
// CROSS_BRANCH_ROLES themselves.
const LIVE_OPS_ROLES = [
  "super_admin",
  "branch_admin",
  "academic_head",
  "vice_principal",
  "edp",
] as const;

// Same cross-branch exemption list as exam-insights / live-exams /
// tenantScope. Academic Head stays institution-wide deliberately.
const CROSS_BRANCH_ROLES = new Set(["super_admin", "academic_head", "neet_coordinator"]);

// analytics:institution / analytics:branch OR a live-ops role. Used by
// the endpoints the dashboard's ops view needs but VP/EDP can't reach on
// permissions alone — they hold the underlying duty (user:read,
// attendance:analytics, report:batch) without the analytics grant.
//
// The role path additionally REQUIRES a branch for branch-scoped roles.
// Downstream handlers read `user.branchId` to lock the query, so a
// branch-scoped account with a null branchId would silently widen to the
// whole institution. Callers who already held analytics:* are unaffected —
// their behaviour is byte-identical to before this guard existed.
function requireAnalyticsOrOpsRole() {
  return createMiddleware(async (c, next) => {
    const user = c.get("user");
    const hasAnalytics =
      !!user &&
      (["analytics:institution", "analytics:branch"] as Permission[]).some((p) =>
        checkPermission(
          {
            userId: user.sub,
            role: user.role,
            institutionId: user.institutionId,
            branchId: user.branchId,
            batchIds: user.batchIds,
          },
          p,
        ),
      );
    const opsRole =
      !!user &&
      (LIVE_OPS_ROLES as readonly string[]).includes(user.role) &&
      (CROSS_BRANCH_ROLES.has(user.role) || !!user.branchId);

    if (!hasAnalytics && !opsRole) {
      return c.json(
        {
          success: false,
          error: {
            code: user ? "FORBIDDEN" : "UNAUTHORIZED",
            message: !user
              ? "Authentication required"
              : (LIVE_OPS_ROLES as readonly string[]).includes(user.role)
                ? "No branch is assigned to your account"
                : "Insufficient permissions",
          },
        },
        user ? 403 : 401,
      );
    }
    await next();
  });
}

function parseOptionalISODate(s: string | undefined): Date | undefined {
  if (!s?.trim()) return undefined;
  const d = new Date(s.trim());
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseStudentIdsSubset(
  raw: string | undefined,
  allowed: Set<string>,
): { ok: true; ids: string[] } | { ok: false; message: string } {
  if (raw == null || raw.trim() === "") return { ok: true, ids: [] };
  const parts = raw
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const id of parts) {
    if (!uuidRe.test(id)) return { ok: false, message: `Invalid student id: ${id}` };
    if (!allowed.has(id)) {
      return { ok: false, message: "One or more students are not in this batch" };
    }
  }
  return { ok: true, ids: parts };
}

function submissionTimeConditions(from?: Date, to?: Date, examType?: string) {
  const parts = [];
  if (from) parts.push(gte(examSubmissions.submittedAt, from));
  if (to) parts.push(lte(examSubmissions.submittedAt, to));
  if (examType) {
    parts.push(eq(exams.examType, examType));
  } else {
    // Default analytics slice = real exams. Practice/mock submissions
    // vastly outnumber exam ones and used to skew every aggregate that
    // didn't pass an explicit type. An explicit examType filter (the
    // dashboard dropdown) still sees exactly that type. EXISTS form —
    // several call sites have no exams join. Revert to
    // examCategoryGuardSql(["exam","mock"]) if blooms/mastery views
    // turn out too sparse without practice data.
    parts.push(examCategoryGuardSql("exam"));
  }
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0]! : and(...parts);
}

// A student whose result for an exam is on hold (an `exam_result_holds`
// row with released_at IS NULL) must not reach ANY analytics aggregate —
// averages, distributions, ranks, at-risk lists, trend lines — nor their
// own per-exam rows: a held exam reads as "not released yet" here.
// Correlated per submission row, so a hold on one exam leaves that
// student's other exams untouched. Attendance/participation counts
// (live-ops, blocked lists) deliberately do NOT use this — holding a
// result doesn't mean the student didn't sit the paper.
const notResultHeld = sql`not exists (
  select 1 from exam_result_holds erh
   where erh.exam_id = ${examSubmissions.examId}
     and erh.student_id = ${examSubmissions.studentId}
     and erh.released_at is null)`;

async function assertFacultyAssignedToBatch(
  c: { json: (b: unknown, s?: number) => Response },
  user: { role: string; sub: string },
  batchId: string,
): Promise<Response | null> {
  if (user.role !== "faculty") return null;
  const [row] = await db
    .select({ id: facultyBatchAssignments.id })
    .from(facultyBatchAssignments)
    .where(
      and(
        eq(facultyBatchAssignments.facultyId, user.sub),
        eq(facultyBatchAssignments.batchId, batchId),
        isNull(facultyBatchAssignments.removedAt),
      ),
    )
    .limit(1);
  if (!row) {
    return c.json(error("FORBIDDEN", "You are not assigned to this batch", 403), 403);
  }
  return null;
}

// All analytics routes require authentication + tenant scoping
analytics.use("*", authMiddleware);
analytics.use("*", tenantScope);

// RBAC v2: batch-scope-restricted roles (currently neet_coordinator →
// NEET-tagged batches only) may not read other batches' analytics.
// Every batch-addressed analytics route lives under /batch/:id, so the
// guard sits on that family centrally instead of inside each handler.
const batchScopeGuard = async (c: any, next: () => Promise<void>) => {
  const batchId = c.req.param("id");
  if (batchId && !isBatchInScope(c, batchId)) {
    return c.json(error("FORBIDDEN", "This batch is outside your data scope", 403), 403);
  }
  await next();
};
analytics.use("/batch/:id", batchScopeGuard);
analytics.use("/batch/:id/*", batchScopeGuard);

// ── GET /assigned-batches — Faculty's assigned batches (for analytics UI) ─
analytics.get("/assigned-batches", requirePermission("analytics:batch"), async (c) => {
  const user = c.get("user") as { sub: string; role: string };

  if (user.role !== "faculty") {
    return c.json(success([]));
  }

  const rows = await db
    .select({
      batchId: batches.id,
      batchName: batches.name,
      branchId: batches.branchId,
      targetExam: batches.targetExam,
    })
    .from(facultyBatchAssignments)
    .innerJoin(batches, eq(batches.id, facultyBatchAssignments.batchId))
    .where(
      and(
        eq(facultyBatchAssignments.facultyId, user.sub),
        isNull(facultyBatchAssignments.removedAt),
      ),
    )
    .groupBy(batches.id, batches.name, batches.branchId, batches.targetExam);

  return c.json(success(rows));
});

// ── GET /student/:id — Full Student Analytics (from cache) ──
analytics.get(
  "/student/:id",
  requireAnyPermission(
    "analytics:self",
    "analytics:child",
    "analytics:institution",
    "analytics:batch",
  ),
  async (c) => {
    const user = c.get("user");
    const studentId = c.req.param("id");
    // ?refresh=1 — force a synchronous rebuild before reading. Useful
    // after rescores / answer-key edits where the bus-driven invalidation
    // hasn't caught up yet, or when the cache was built with an older
    // (buggy) computation. Without this, callers had to either dump the
    // cache row by hand or wait for the next exam submission.
    const forceRefresh = c.req.query("refresh") === "1";

    const authzReason = await authorizeStudentAccess(user, studentId, c);
    if (authzReason) return c.json(error("FORBIDDEN", authzReason, 403), 403);

    try {
      // Profile always fetched live (lightweight, 1 JOIN)
      const [profile] = await db
        .select({
          name: users.name,
          email: users.email,
          batchId: students.batchId,
          targetExam: students.targetExam,
          rollNumber: students.rollNumber,
          enrollmentDate: students.enrollmentDate,
        })
        .from(students)
        .innerJoin(users, eq(users.id, students.userId))
        .where(eq(students.userId, studentId))
        .limit(1);

      if (!profile) {
        return c.json(error("NOT_FOUND", "Student not found", 404), 404);
      }

      if (forceRefresh) {
        await rebuildAllAnalytics(studentId);
      }

      // Read from cache
      const [cached] = await db
        .select({
          overview: studentAnalyticsCache.overview,
          scoreTrajectory: studentAnalyticsCache.scoreTrajectory,
          subjectWise: studentAnalyticsCache.subjectWise,
        })
        .from(studentAnalyticsCache)
        .where(eq(studentAnalyticsCache.studentId, studentId))
        .limit(1);

      // If no cache, trigger async rebuild and return empty
      if (!cached || !cached.overview) {
        rebuildAllAnalytics(studentId).catch((err) =>
          console.error("[Analytics] Background rebuild failed:", err),
        );
        return c.json(
          success({
            studentId,
            profile: {
              name: profile.name, email: profile.email,
              batchId: profile.batchId, targetExam: profile.targetExam,
              rollNumber: profile.rollNumber, enrollmentDate: profile.enrollmentDate,
            },
            overview: { totalExams: 0, averageScore: 0, averagePercentile: 0, rawAverageScore: 0, rawAveragePercentile: 0, highestScore: 0, lowestScore: 0, consistencyScore: 0 },
            scoreTrajectory: [],
            subjectWise: [],
            recentExams: [],
            _cacheStatus: "rebuilding",
          }),
        );
      }

      const overview = cached.overview as any;
      const scoreTrajectory = (cached.scoreTrajectory as any[]) || [];
      const subjectWise = (cached.subjectWise as any[]) || [];
      const recentExams = scoreTrajectory.slice(-5).reverse();

      return c.json(
        success({
          studentId,
          profile: {
            name: profile.name, email: profile.email,
            batchId: profile.batchId, targetExam: profile.targetExam,
            rollNumber: profile.rollNumber, enrollmentDate: profile.enrollmentDate,
          },
          overview,
          scoreTrajectory,
          subjectWise,
          recentExams,
        }),
      );
    } catch (err) {
      console.error("[Analytics] Student analytics error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute student analytics", 500), 500);
    }
  },
);

// ── GET /student/:id/skill-map — Skill Polygon Data (from cache) ──
analytics.get(
  "/student/:id/skill-map",
  requireAnyPermission("analytics:self", "analytics:institution", "analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");
    try {
      const [cached] = await db
        .select({ skillMap: studentAnalyticsCache.skillMap })
        .from(studentAnalyticsCache)
        .where(eq(studentAnalyticsCache.studentId, studentId))
        .limit(1);

      if (!cached?.skillMap) {
        rebuildAllAnalytics(studentId).catch((err) =>
          console.error("[Analytics] Background rebuild failed:", err),
        );
        return c.json(success({ studentId, current: [], historical: [], coverageBySubject: [], snapshotDate: null, lastUpdated: null, _cacheStatus: "rebuilding" }));
      }

      return c.json(success(cached.skillMap));
    } catch (err) {
      console.error("[Analytics] Skill map error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute skill map", 500), 500);
    }
  },
);

// ── GET /student/:id/error-patterns — Error Pattern Analysis (from cache) ─
analytics.get(
  "/student/:id/error-patterns",
  requireAnyPermission("analytics:self", "analytics:institution", "analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");
    try {
      const [cached] = await db
        .select({ errorPatterns: studentAnalyticsCache.errorPatterns })
        .from(studentAnalyticsCache)
        .where(eq(studentAnalyticsCache.studentId, studentId))
        .limit(1);

      if (!cached?.errorPatterns) {
        rebuildAllAnalytics(studentId).catch((err) =>
          console.error("[Analytics] Background rebuild failed:", err),
        );
        return c.json(success({ studentId, totalErrors: 0, byType: [], summaryCategories: {}, byTopic: [], matrix: {}, repeatErrors: [], trend: { last30Days: 0, previous30Days: 0, direction: "stable", changePercent: 0 }, _cacheStatus: "rebuilding" }));
      }

      return c.json(success(cached.errorPatterns));
    } catch (err) {
      console.error("[Analytics] Error patterns error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute error patterns", 500), 500);
    }
  },
);

// ── GET /student/:id/error-nature — Theory vs Problem Error Split ──
// Joins error_log with questions.nature so faculty/student can see how
// many errors are conceptual theory questions vs applied problem-solving.
analytics.get(
  "/student/:id/error-nature",
  requireAnyPermission("analytics:self", "analytics:institution", "analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");

    try {
      const rows = await db
        .select({
          nature: questions.nature,
          subjectName: subjects.name,
          total: sql<number>`count(*)::int`,
        })
        .from(errorLog)
        .innerJoin(questions, eq(questions.id, errorLog.questionId))
        .innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .where(
          and(
            eq(errorLog.studentId, studentId),
            examOnly(),
            // Held-exam errors are withheld along with the result.
            sql`not exists (select 1 from exam_result_holds erh
                             where erh.exam_id = ${errorLog.examId}
                               and erh.student_id = ${errorLog.studentId}
                               and erh.released_at is null)`,
          ),
        )
        .groupBy(questions.nature, subjects.name);

      let theory = 0;
      let problem = 0;
      let untagged = 0;
      const bySubject: Record<string, { theory: number; problem: number; untagged: number }> = {};

      for (const r of rows) {
        const count = Number(r.total);
        const key = r.nature ?? "untagged";
        if (key === "theory") theory += count;
        else if (key === "problem") problem += count;
        else untagged += count;

        if (!bySubject[r.subjectName]) {
          bySubject[r.subjectName] = { theory: 0, problem: 0, untagged: 0 };
        }
        if (key === "theory") bySubject[r.subjectName]!.theory += count;
        else if (key === "problem") bySubject[r.subjectName]!.problem += count;
        else bySubject[r.subjectName]!.untagged += count;
      }

      return c.json(
        success({
          studentId,
          totals: { theory, problem, untagged, all: theory + problem + untagged },
          bySubject: Object.entries(bySubject).map(([name, counts]) => ({
            subjectName: name,
            ...counts,
          })),
        }),
      );
    } catch (err) {
      console.error("[Analytics] Error nature error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute error nature split", 500), 500);
    }
  },
);

// ── GET /student/:id/weak-areas ─────────────────────────────
// Ranked weak areas from `error_log`, grouped by subject → topic.
// Reads the source of truth directly so the list is always fresh
// (the cache's byTopic block is a subset of this query). Scoped
// by caller: students see their own; faculty / parents use the
// verifyUserOwnership check.
analytics.get(
  "/student/:id/weak-areas",
  requirePermission("analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");
    const user = c.get("user");
    if (user.role === "student" && user.sub !== studentId) {
      return c.json(error("FORBIDDEN", "Not allowed", 403), 403);
    }

    try {
      // Fetch error_log rows with topic + subject names in one round trip
      const rows = await db.execute(sql`
        SELECT
          el.error_type,
          el.repeat_count,
          q.subject_id,
          s.name AS subject_name,
          el.topic_id,
          t.name AS topic_name,
          COUNT(*) FILTER (WHERE el.mastery_status <> 'mastered')::int AS unresolved_count,
          SUM(el.repeat_count)::int AS weighted_count,
          MAX(el.created_at) AS last_error_at
        FROM error_log el
        JOIN questions q ON q.id = el.question_id
        LEFT JOIN subjects s ON s.id = q.subject_id
        LEFT JOIN syllabus_tree t ON t.id = el.topic_id
        WHERE el.student_id = ${studentId}
          -- Errors sourced from a held exam stay out of the ranking.
          -- Homework rows carry a NULL exam_id and never match.
          AND NOT EXISTS (
            SELECT 1 FROM exam_result_holds erh
            WHERE erh.exam_id = el.exam_id
              AND erh.student_id = el.student_id
              AND erh.released_at IS NULL
          )
        GROUP BY el.error_type, el.repeat_count, q.subject_id, s.name, el.topic_id, t.name
      `);

      // Reshape into subject -> topic -> {count, types}
      type TopicAgg = {
        topicId: string;
        topicName: string;
        errorCount: number;
        unresolvedCount: number;
        lastErrorAt: string | null;
        topErrorTypes: string[];
      };
      type SubjectAgg = {
        subjectId: string;
        subjectName: string;
        errorCount: number;
        unresolvedCount: number;
        topics: Map<string, TopicAgg>;
      };

      const subjectMap = new Map<string, SubjectAgg>();
      for (const r of (rows as any).rows ?? (rows as any[])) {
        const subjectId = (r.subject_id as string) ?? "unknown";
        const subjectName = (r.subject_name as string) ?? "Unknown";
        const topicId = (r.topic_id as string) ?? "unknown";
        const topicName = (r.topic_name as string) ?? "Unknown";
        const weighted = Number(r.weighted_count || 0);
        const unresolved = Number(r.unresolved_count || 0);
        const lastErrorAt = r.last_error_at ? new Date(r.last_error_at).toISOString() : null;
        const errorType = r.error_type as string;

        let subj = subjectMap.get(subjectId);
        if (!subj) {
          subj = {
            subjectId,
            subjectName,
            errorCount: 0,
            unresolvedCount: 0,
            topics: new Map(),
          };
          subjectMap.set(subjectId, subj);
        }
        subj.errorCount += weighted;
        subj.unresolvedCount += unresolved;

        let topic = subj.topics.get(topicId);
        if (!topic) {
          topic = {
            topicId,
            topicName,
            errorCount: 0,
            unresolvedCount: 0,
            lastErrorAt,
            topErrorTypes: [],
          };
          subj.topics.set(topicId, topic);
        }
        topic.errorCount += weighted;
        topic.unresolvedCount += unresolved;
        if (!topic.topErrorTypes.includes(errorType)) topic.topErrorTypes.push(errorType);
        if (lastErrorAt && (!topic.lastErrorAt || lastErrorAt > topic.lastErrorAt)) {
          topic.lastErrorAt = lastErrorAt;
        }
      }

      const subjects = Array.from(subjectMap.values())
        .map((s) => ({
          subjectId: s.subjectId,
          subjectName: s.subjectName,
          errorCount: s.errorCount,
          unresolvedCount: s.unresolvedCount,
          topics: Array.from(s.topics.values())
            .sort((a, b) => b.errorCount - a.errorCount)
            .slice(0, 10),
        }))
        .sort((a, b) => b.errorCount - a.errorCount);

      return c.json(
        success({
          studentId,
          totalSubjectsWithErrors: subjects.length,
          totalErrors: subjects.reduce((s, x) => s + x.errorCount, 0),
          totalUnresolved: subjects.reduce((s, x) => s + x.unresolvedCount, 0),
          subjects,
          generatedAt: new Date().toISOString(),
        }),
      );
    } catch (err) {
      console.error("[Analytics] weak-areas error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute weak areas", 500), 500);
    }
  },
);

// ── GET /student/:id/rwl — Recurring wrong list ─────────────
// Per-question list of questions the student has repeatedly
// missed, ordered by repeat count. Joined to `questions` for a
// text preview so the UI can render without a second round trip.
analytics.get(
  "/student/:id/rwl",
  requirePermission("analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");
    const user = c.get("user");
    if (user.role === "student" && user.sub !== studentId) {
      return c.json(error("FORBIDDEN", "Not allowed", 403), 403);
    }
    const limit = Math.min(Number(c.req.query("limit") || 50) || 50, 200);
    const onlyUnresolved = c.req.query("unresolved") !== "false";

    try {
      const rows = await db.execute(sql`
        SELECT
          el.question_id,
          LEFT(q.question_text_md, 220) AS text_preview,
          s.name AS subject_name,
          t.name AS topic_name,
          el.error_type,
          el.difficulty,
          el.repeat_count,
          el.mastery_status::text AS mastery_status,
          el.next_review_date,
          el.created_at,
          el.last_reviewed_at
        FROM error_log el
        JOIN questions q ON q.id = el.question_id
        LEFT JOIN subjects s ON s.id = q.subject_id
        LEFT JOIN syllabus_tree t ON t.id = el.topic_id
        WHERE el.student_id = ${studentId}
          -- Held-exam errors are withheld along with the result.
          AND NOT EXISTS (
            SELECT 1 FROM exam_result_holds erh
            WHERE erh.exam_id = el.exam_id
              AND erh.student_id = el.student_id
              AND erh.released_at IS NULL
          )
          ${onlyUnresolved ? sql`AND el.mastery_status <> 'mastered'` : sql``}
        ORDER BY el.repeat_count DESC, el.created_at DESC
        LIMIT ${limit}
      `);

      const questions = ((rows as any).rows ?? (rows as any[])).map((r: any) => ({
        questionId: r.question_id as string,
        questionTextMd: r.text_preview as string | null,
        subjectName: (r.subject_name as string) ?? null,
        topicName: (r.topic_name as string) ?? null,
        errorType: r.error_type as string,
        difficulty: r.difficulty as string,
        repeatCount: Number(r.repeat_count || 1),
        masteryStatus: r.mastery_status as string,
        nextReviewDate: r.next_review_date,
        firstErrorAt: r.created_at,
        lastReviewedAt: r.last_reviewed_at,
      }));

      return c.json(
        success({
          studentId,
          total: questions.length,
          unresolvedOnly: onlyUnresolved,
          questions,
          generatedAt: new Date().toISOString(),
        }),
      );
    } catch (err) {
      console.error("[Analytics] rwl error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute RWL", 500), 500);
    }
  },
);

// ── POST /analytics/custom-comparison ────────────────────────
// Faculty/admin-facing multi-test comparison: given a studentId
// and a list of exam IDs (or a rolling window), return the
// per-exam scores, the batch average for each, and running
// cumulative averages. Powers the "test 1 vs average", "test 1+2
// vs average", and rolling 3-month views on the reports page.
analytics.post(
  "/custom-comparison",
  requirePermission("analytics:batch"),
  async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{
      studentId: string;
      examIds?: string[];
      windowDays?: number;
    }>();

    if (!body?.studentId) {
      return c.json(
        error("VALIDATION_ERROR", "studentId is required", 400),
        400,
      );
    }
    if (user.role === "student" && user.sub !== body.studentId) {
      return c.json(error("FORBIDDEN", "Not allowed", 403), 403);
    }

    try {
      const [studentRow] = await db
        .select({
          name: users.name,
          batchId: students.batchId,
        })
        .from(users)
        .innerJoin(students, eq(students.userId, users.id))
        .where(eq(users.id, body.studentId))
        .limit(1);

      if (!studentRow) {
        return c.json(error("NOT_FOUND", "Student not found", 404), 404);
      }

      const batchId = studentRow.batchId;
      const explicitIds = Array.isArray(body.examIds)
        ? body.examIds.filter((x): x is string => typeof x === "string" && x.length > 0)
        : [];

      // Resolve the exam set. Explicit IDs win; otherwise window-based.
      let examFilter = sql`1 = 0`;
      if (explicitIds.length > 0) {
        examFilter = sql`e.id IN ${sqlIn(explicitIds)}`;
      } else if (body.windowDays && body.windowDays > 0) {
        examFilter = sql`e.scheduled_start IS NOT NULL AND e.scheduled_start >= now() - (${body.windowDays}::int || ' days')::interval`;
      } else {
        return c.json(
          error(
            "VALIDATION_ERROR",
            "Pass examIds[] or windowDays",
            400,
          ),
          400,
        );
      }

      // Pull student scores + batch averages in one query
      const rows = await db.execute(sql`
        SELECT
          e.id AS exam_id,
          e.title,
          e.exam_type,
          e.purpose::text AS purpose,
          e.scheduled_start,
          es.total_score,
          es.total_max,
          es.percentage,
          es.percentile_batch,
          (
            SELECT ROUND(AVG(es2.percentage)::numeric, 2)
            FROM exam_submissions es2
            WHERE es2.exam_id = e.id
              AND NOT EXISTS (
                SELECT 1 FROM exam_result_holds erh
                WHERE erh.exam_id = es2.exam_id
                  AND erh.student_id = es2.student_id
                  AND erh.released_at IS NULL
              )
              ${batchId ? sql`AND es2.student_id IN (SELECT user_id FROM students WHERE batch_id = ${batchId})` : sql``}
          ) AS batch_avg,
          (
            SELECT COUNT(*)::int
            FROM exam_submissions es2
            WHERE es2.exam_id = e.id
              AND NOT EXISTS (
                SELECT 1 FROM exam_result_holds erh
                WHERE erh.exam_id = es2.exam_id
                  AND erh.student_id = es2.student_id
                  AND erh.released_at IS NULL
              )
              ${batchId ? sql`AND es2.student_id IN (SELECT user_id FROM students WHERE batch_id = ${batchId})` : sql``}
          ) AS batch_count
        FROM exams e
        LEFT JOIN exam_submissions es
          ON es.exam_id = e.id AND es.student_id = ${body.studentId}
        WHERE ${examFilter}
          AND e.institution_id = ${user.institutionId}
          AND e.deleted_at IS NULL
          -- An exam this student's result is held on drops out of their
          -- comparison entirely, rather than surfacing as a false "absent".
          AND NOT EXISTS (
            SELECT 1 FROM exam_result_holds erh
            WHERE erh.exam_id = e.id
              AND erh.student_id = ${body.studentId}
              AND erh.released_at IS NULL
          )
        ORDER BY e.scheduled_start ASC NULLS LAST, e.created_at ASC
      `);

      const rawRows = ((rows as any).rows ?? rows) as any[];

      // Running cumulative averages (student + batch)
      let studentSum = 0;
      let studentCount = 0;
      let batchSum = 0;
      let batchCount = 0;

      const points = rawRows.map((r) => {
        const pct = r.percentage != null ? Number(r.percentage) : null;
        const batchPct = r.batch_avg != null ? Number(r.batch_avg) : null;
        if (pct != null) {
          studentSum += pct;
          studentCount++;
        }
        if (batchPct != null) {
          batchSum += batchPct;
          batchCount++;
        }
        return {
          examId: r.exam_id as string,
          title: r.title as string,
          examType: r.exam_type as string,
          purpose: (r.purpose as string) ?? null,
          scheduledStart: r.scheduled_start,
          student:
            pct != null
              ? {
                  percentage: pct,
                  percentileBatch: r.percentile_batch != null ? Number(r.percentile_batch) : null,
                  totalScore: r.total_score != null ? Number(r.total_score) : null,
                  totalMax: r.total_max != null ? Number(r.total_max) : null,
                }
              : null,
          batch: {
            avgPercentage: batchPct,
            studentCount: Number(r.batch_count || 0),
          },
          cumulative: {
            studentAvg: studentCount > 0 ? Math.round((studentSum / studentCount) * 100) / 100 : null,
            batchAvg: batchCount > 0 ? Math.round((batchSum / batchCount) * 100) / 100 : null,
          },
        };
      });

      const attempted = points.filter((p) => p.student != null);

      return c.json(
        success({
          studentId: body.studentId,
          studentName: studentRow.name,
          batchId,
          points,
          summary: {
            totalExams: points.length,
            attempted: attempted.length,
            absent: points.length - attempted.length,
            studentCumulativeAvg:
              studentCount > 0 ? Math.round((studentSum / studentCount) * 100) / 100 : null,
            batchCumulativeAvg:
              batchCount > 0 ? Math.round((batchSum / batchCount) * 100) / 100 : null,
            delta:
              studentCount > 0 && batchCount > 0
                ? Math.round(((studentSum / studentCount) - (batchSum / batchCount)) * 100) / 100
                : null,
          },
          generatedAt: new Date().toISOString(),
        }),
      );
    } catch (err) {
      console.error("[Analytics] custom-comparison error:", err);
      return c.json(
        error("INTERNAL_ERROR", "Failed to compute custom comparison", 500),
        500,
      );
    }
  },
);

// ── GET /student/:id/exam-type-report — Report Card by Exam Type ──
// Per-exam-type rollup of attempts, absences, and averages — the format
// used on the student report card. Students reach this via analytics:self.
analytics.get(
  "/student/:id/exam-type-report",
  requireAnyPermission("analytics:self", "analytics:institution", "analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");

    try {
      const [studentRow] = await db
        .select({ batchId: students.batchId, name: users.name })
        .from(students)
        .innerJoin(users, eq(users.id, students.userId))
        .where(eq(students.userId, studentId))
        .limit(1);

      if (!studentRow) {
        return c.json(error("NOT_FOUND", "Student not found", 404), 404);
      }

      const batchExams = studentRow.batchId
        ? await db
            .select({
              id: exams.id,
              title: exams.title,
              examType: exams.examType,
              scheduledStart: exams.scheduledStart,
            })
            .from(exams)
            .where(
              and(
                // Absent counts only make sense for real exams — batch-
                // assigned practice (daily5/dpp) is not "absent" work.
                examCategoryIs("exam"),
                inArray(
                  exams.status,
                  ["published", "evaluated", "results_released", "completed"] as any,
                ),
                // A held exam leaves the report altogether — without this
                // it would flip from a (hidden) attempt into a false absence.
                sql`not exists (select 1 from exam_result_holds erh
                                 where erh.exam_id = ${exams.id}
                                   and erh.student_id = ${studentId}
                                   and erh.released_at is null)`,
                sql`${studentRow.batchId}::text = ANY(${exams.assignedBatches})`,
              ),
            )
        : [];

      const submissions = await db
        .select({
          examId: examSubmissions.examId,
          percentage: examSubmissions.percentage,
          totalScore: examSubmissions.totalScore,
          totalMax: examSubmissions.totalMax,
          examType: exams.examType,
          examTitle: exams.title,
          submittedAt: examSubmissions.submittedAt,
        })
        .from(examSubmissions)
        .innerJoin(exams, eq(exams.id, examSubmissions.examId))
        // Per-type buckets and the overall weighted average cover real
        // exams only — practice/self-mock buckets used to dominate both.
        .where(and(eq(examSubmissions.studentId, studentId), examCategoryIs("exam"), notResultHeld))
        .orderBy(desc(examSubmissions.submittedAt));

      interface TypeBucket {
        examType: string;
        attempted: number;
        absent: number;
        averagePercentage: number;
        averageScore: number;
        exams: Array<{
          examId: string;
          examTitle: string;
          submittedAt: string | null;
          percentage: number;
          status: "attempted" | "absent";
        }>;
      }

      const byType = new Map<string, TypeBucket>();
      const attemptedExamIds = new Set(submissions.map((s) => s.examId));

      for (const s of submissions) {
        const key = s.examType ?? "other";
        if (!byType.has(key)) {
          byType.set(key, {
            examType: key,
            attempted: 0,
            absent: 0,
            averagePercentage: 0,
            averageScore: 0,
            exams: [],
          });
        }
        const b = byType.get(key)!;
        const pct = Number(s.percentage ?? 0);
        b.attempted += 1;
        b.averagePercentage += pct;
        b.averageScore += Number(s.totalScore ?? 0);
        b.exams.push({
          examId: s.examId,
          examTitle: s.examTitle,
          submittedAt: s.submittedAt ? new Date(s.submittedAt).toISOString() : null,
          percentage: Math.round(pct * 100) / 100,
          status: "attempted",
        });
      }

      const now = Date.now();
      for (const ex of batchExams) {
        if (attemptedExamIds.has(ex.id)) continue;
        const scheduled = ex.scheduledStart ? new Date(ex.scheduledStart).getTime() : 0;
        if (scheduled === 0 || scheduled > now) continue;
        const key = ex.examType ?? "other";
        if (!byType.has(key)) {
          byType.set(key, {
            examType: key,
            attempted: 0,
            absent: 0,
            averagePercentage: 0,
            averageScore: 0,
            exams: [],
          });
        }
        const b = byType.get(key)!;
        b.absent += 1;
        b.exams.push({
          examId: ex.id,
          examTitle: ex.title,
          submittedAt: new Date(ex.scheduledStart!).toISOString(),
          percentage: 0,
          status: "absent",
        });
      }

      const buckets = [...byType.values()]
        .map((b) => ({
          ...b,
          averagePercentage:
            b.attempted > 0 ? Math.round((b.averagePercentage / b.attempted) * 100) / 100 : 0,
          averageScore:
            b.attempted > 0 ? Math.round((b.averageScore / b.attempted) * 100) / 100 : 0,
          exams: b.exams.sort((a, b2) => {
            const at = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
            const bt = b2.submittedAt ? new Date(b2.submittedAt).getTime() : 0;
            return bt - at;
          }),
        }))
        .sort((a, b) => a.examType.localeCompare(b.examType));

      const overall = buckets.reduce(
        (acc, b) => {
          acc.attempted += b.attempted;
          acc.absent += b.absent;
          acc.totalPercentage += b.averagePercentage * Math.max(b.attempted, 1);
          acc.weight += Math.max(b.attempted, 1);
          return acc;
        },
        { attempted: 0, absent: 0, totalPercentage: 0, weight: 0 },
      );

      return c.json(
        success({
          studentId,
          studentName: studentRow.name,
          generatedAt: new Date().toISOString(),
          overall: {
            attempted: overall.attempted,
            absent: overall.absent,
            averagePercentage:
              overall.weight > 0
                ? Math.round((overall.totalPercentage / overall.weight) * 100) / 100
                : 0,
          },
          examTypes: buckets,
        }),
      );
    } catch (err) {
      console.error("[Analytics] Exam type report error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute exam type report", 500), 500);
    }
  },
);

// ── GET /student/:id/comparison — Student vs Batch Comparison ────
analytics.get(
  "/student/:id/comparison",
  requireAnyPermission("analytics:self", "analytics:institution", "analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");
    const examIdsParam = c.req.query("examIds");
    const limitParam = c.req.query("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "10", 10), 1), 50);

    try {
      const [studentRow] = await db
        .select({ batchId: students.batchId })
        .from(students)
        .where(eq(students.userId, studentId))
        .limit(1);

      if (!studentRow || !studentRow.batchId) {
        return c.json(
          success({
            studentId,
            comparisons: [],
            overall: { studentAvg: 0, batchAvg: 0 },
          }),
        );
      }

      let targetExamIds: string[] = [];
      if (examIdsParam) {
        targetExamIds = examIdsParam.split(",").filter(Boolean);
      } else {
        const recent = await db
          .select({ examId: examSubmissions.examId })
          .from(examSubmissions)
          .where(and(eq(examSubmissions.studentId, studentId), notResultHeld))
          .orderBy(desc(examSubmissions.submittedAt))
          .limit(limit);
        targetExamIds = recent.map((r) => r.examId).reverse();
      }

      if (targetExamIds.length === 0) {
        return c.json(
          success({
            studentId,
            comparisons: [],
            overall: { studentAvg: 0, batchAvg: 0 },
          }),
        );
      }

      const studentSubs = await db
        .select({
          examId: examSubmissions.examId,
          percentage: examSubmissions.percentage,
          submittedAt: examSubmissions.submittedAt,
          examTitle: exams.title,
          examType: exams.examType,
        })
        .from(examSubmissions)
        .innerJoin(exams, eq(exams.id, examSubmissions.examId))
        .where(
          and(
            eq(examSubmissions.studentId, studentId),
            inArray(examSubmissions.examId, targetExamIds),
            notResultHeld,
          ),
        );

      const batchStudents = await db
        .select({ userId: students.userId })
        .from(students)
        .where(eq(students.batchId, studentRow.batchId));
      const batchStudentIds = batchStudents.map((s) => s.userId);

      const batchAvgs =
        batchStudentIds.length > 0
          ? await db
              .select({
                examId: examSubmissions.examId,
                avgPct: sql<number>`avg(${examSubmissions.percentage}::numeric)`,
              })
              .from(examSubmissions)
              .where(
                and(
                  inArray(examSubmissions.examId, targetExamIds),
                  inArray(examSubmissions.studentId, batchStudentIds),
                  notResultHeld,
                ),
              )
              .groupBy(examSubmissions.examId)
          : [];

      const batchAvgMap = new Map(
        batchAvgs.map((r) => [r.examId, Number(r.avgPct ?? 0)]),
      );

      const sortedSubs = [...studentSubs].sort((a, b) => {
        const ax = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bx = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return ax - bx;
      });

      let cumStudent = 0;
      let cumBatch = 0;
      let n = 0;

      const comparisons = sortedSubs.map((s) => {
        n += 1;
        const studentPct = Number(s.percentage ?? 0);
        const batchPct = batchAvgMap.get(s.examId) ?? 0;
        cumStudent += studentPct;
        cumBatch += batchPct;
        return {
          examId: s.examId,
          examTitle: s.examTitle,
          examType: s.examType,
          submittedAt: s.submittedAt ? new Date(s.submittedAt).toISOString() : null,
          studentPercentage: Math.round(studentPct * 100) / 100,
          batchAverage: Math.round(batchPct * 100) / 100,
          delta: Math.round((studentPct - batchPct) * 100) / 100,
          cumulativeStudent: Math.round((cumStudent / n) * 100) / 100,
          cumulativeBatch: Math.round((cumBatch / n) * 100) / 100,
        };
      });

      return c.json(
        success({
          studentId,
          comparisons,
          overall: {
            studentAvg:
              comparisons.length > 0
                ? comparisons[comparisons.length - 1]!.cumulativeStudent
                : 0,
            batchAvg:
              comparisons.length > 0
                ? comparisons[comparisons.length - 1]!.cumulativeBatch
                : 0,
          },
        }),
      );
    } catch (err) {
      console.error("[Analytics] Comparison error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute comparison", 500), 500);
    }
  },
);

// ── GET /student/:id/exams — Exams available for comparison ────
analytics.get(
  "/student/:id/exams",
  requireAnyPermission("analytics:self", "analytics:institution", "analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");
    try {
      const rows = await db
        .select({
          examId: examSubmissions.examId,
          examTitle: exams.title,
          examType: exams.examType,
          submittedAt: examSubmissions.submittedAt,
          percentage: examSubmissions.percentage,
        })
        .from(examSubmissions)
        .innerJoin(exams, eq(exams.id, examSubmissions.examId))
        .where(and(eq(examSubmissions.studentId, studentId), notResultHeld))
        .orderBy(desc(examSubmissions.submittedAt))
        .limit(100);
      return c.json(success(rows));
    } catch (err) {
      console.error("[Analytics] Exams list error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to list exams", 500), 500);
    }
  },
);

// ── GET /student/:id/error-timeline — Per-Exam Error Trend ────
// Returns one point per exam attempt in chronological order with
// cumulative error counts bucketed by nature category. Lets the UI
// draw a stacked line chart of how each error category evolves.
analytics.get(
  "/student/:id/error-timeline",
  requireAnyPermission("analytics:self", "analytics:child"),
  async (c) => {
    const studentId = c.req.param("id");
    // Same class of hole as the ones fixed in #2151: analytics:self alone let
    // any student read any classmate's timeline, since nothing tied the :id to
    // the caller.
    const denied = await authorizeStudentAccess(c.get("user"), studentId, c);
    if (denied) {
      return c.json(error("FORBIDDEN", denied, 403), 403);
    }

    try {
      const rows = await db
        .select({
          examId: errorLog.examId,
          examTitle: exams.title,
          submittedAt: examSubmissions.submittedAt,
          errorType: errorLog.errorType,
          errorCount: sql<number>`count(*)::int`,
        })
        .from(errorLog)
        .innerJoin(exams, eq(exams.id, errorLog.examId))
        .innerJoin(
          examSubmissions,
          and(
            eq(examSubmissions.examId, errorLog.examId),
            eq(examSubmissions.studentId, errorLog.studentId),
          ),
        )
        .where(and(eq(errorLog.studentId, studentId), examOnly(), notResultHeld))
        .groupBy(errorLog.examId, exams.title, examSubmissions.submittedAt, errorLog.errorType)
        .orderBy(examSubmissions.submittedAt);

      const categoryOf = (t: string): string => {
        if (["no_concept_knowledge", "no_idea_of_concept", "applied_wrong_concept", "did_not_understand"].includes(t)) return "Conceptual";
        if (["cannot_derive_formula", "used_wrong_formula", "incomplete_solution"].includes(t)) return "Formula";
        if (["calculation_mistake", "incorrect_units", "misread_question"].includes(t)) return "Calculation";
        if (["unmarked_correct", "wrong_option_despite_solving", "premature_conclusion"].includes(t)) return "Careless";
        if (["time_management", "lengthy_calculation", "confused_multiple_options", "did_not_check_all_options"].includes(t)) return "Time";
        return "Other";
      };

      const byExam = new Map<
        string,
        { examId: string; examTitle: string; submittedAt: string | null; perCategory: Record<string, number> }
      >();
      for (const r of rows) {
        const key = r.examId;
        const entry = byExam.get(key) ?? {
          examId: r.examId,
          examTitle: r.examTitle,
          submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
          perCategory: {},
        };
        const cat = categoryOf(r.errorType);
        entry.perCategory[cat] = (entry.perCategory[cat] ?? 0) + Number(r.errorCount);
        byExam.set(key, entry);
      }

      const ordered = [...byExam.values()].sort((a, b) => {
        const aTs = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bTs = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return aTs - bTs;
      });

      const categories = ["Conceptual", "Formula", "Calculation", "Careless", "Time"];
      const cumulative: Record<string, number> = Object.fromEntries(
        categories.map((cat) => [cat, 0]),
      );
      let examIndex = 0;

      const series = ordered.map((exam) => {
        examIndex += 1;
        const incremental: Record<string, number> = {};
        for (const cat of categories) {
          const inc = exam.perCategory[cat] ?? 0;
          incremental[cat] = inc;
          cumulative[cat] += inc;
        }
        return {
          examIndex,
          examId: exam.examId,
          examTitle: exam.examTitle,
          submittedAt: exam.submittedAt,
          incremental,
          cumulative: { ...cumulative },
        };
      });

      return c.json(
        success({
          studentId,
          categories,
          totals: { ...cumulative },
          series,
        }),
      );
    } catch (err) {
      console.error("[Analytics] Error timeline error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute error timeline", 500), 500);
    }
  },
);

// ── GET /student/:id/predictions — Rank/College Predictions (from cache) ─
analytics.get(
  "/student/:id/predictions",
  requireAnyPermission("analytics:self", "analytics:institution", "analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");
    try {
      const [cached] = await db
        .select({ predictions: studentAnalyticsCache.predictions })
        .from(studentAnalyticsCache)
        .where(eq(studentAnalyticsCache.studentId, studentId))
        .limit(1);

      if (!cached?.predictions) {
        rebuildAllAnalytics(studentId).catch((err) =>
          console.error("[Analytics] Background rebuild failed:", err),
        );
        return c.json(success({ studentId, predictedScore: null, predictedPercentile: null, predictedRank: null, confidence: 0, trend: "insufficient_data", _cacheStatus: "rebuilding" }));
      }

      return c.json(success(cached.predictions));
    } catch (err) {
      console.error("[Analytics] Predictions error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute predictions", 500), 500);
    }
  },
);

// ── GET /batch/:id/blooms-topics — Bloom × syllabus topic (date + cohort) ─
analytics.get(
  "/batch/:id/blooms-topics",
  requirePermission("analytics:batch"),
  async (c) => {
    const batchId = c.req.param("id");
    const user = c.get("user") as { role: string; sub: string };

    if (!(await verifyBatchOwnership(batchId, c))) {
      return c.json(error("NOT_FOUND", "Batch not found", 404), 404);
    }

    try {
      const [batch] = await db
        .select({
          id: batches.id,
          name: batches.name,
        })
        .from(batches)
        .where(eq(batches.id, batchId))
        .limit(1);

      if (!batch) {
        return c.json(error("NOT_FOUND", "Batch not found", 404), 404);
      }

      const denied = await assertFacultyAssignedToBatch(c, user, batchId);
      if (denied) return denied;

      const batchStudents = await db
        .select({ userId: students.userId })
        .from(students)
        .where(eq(students.batchId, batchId));

      const rosterIds = batchStudents.map((s) => s.userId);
      const allowed = new Set(rosterIds);
      const subset = parseStudentIdsSubset(c.req.query("studentIds"), allowed);
      if (!subset.ok) {
        return c.json(error("VALIDATION_ERROR", subset.message, 400), 400);
      }
      const targetIds = subset.ids.length > 0 ? subset.ids : rosterIds;

      if (targetIds.length === 0) {
        return c.json(
          success({
            batchId,
            batchName: batch.name,
            rows: [],
            dateFrom: c.req.query("from") ?? null,
            dateTo: c.req.query("to") ?? null,
            cohortSize: 0,
          }),
        );
      }

      const fromDate = parseOptionalISODate(c.req.query("from"));
      const toDate = parseOptionalISODate(c.req.query("to"));
      const timeWhere = submissionTimeConditions(fromDate, toDate);
      // Held results are out of every cohort aggregate below.
      const cohortWhere = timeWhere
        ? and(inArray(examSubmissions.studentId, targetIds), timeWhere, notResultHeld)
        : and(inArray(examSubmissions.studentId, targetIds), notResultHeld);

      const rows = await db
        .select({
          bloomsLevel: sql<string>`coalesce(${questions.bloomsLevel}::text, 'unknown')`,
          topicId: syllabusTree.id,
          topicName: sql<string>`coalesce(${syllabusTree.name}, 'Uncategorized')`,
          subjectName: subjects.name,
          total: count(),
          correct: sql<number>`count(*) filter (where ${examResponses.isCorrect} = true)`,
        })
        .from(examResponses)
        .innerJoin(examSubmissions, eq(examSubmissions.id, examResponses.submissionId))
        .innerJoin(questions, eq(questions.id, examResponses.questionId))
        .leftJoin(syllabusTree, eq(syllabusTree.id, questions.syllabusNodeId))
        .innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .where(cohortWhere)
        .groupBy(
          questions.bloomsLevel,
          syllabusTree.id,
          syllabusTree.name,
          subjects.name,
        )
        .orderBy(desc(count()));

      return c.json(
        success({
          batchId,
          batchName: batch.name,
          cohortSize: targetIds.length,
          dateFrom: fromDate?.toISOString() ?? null,
          dateTo: toDate?.toISOString() ?? null,
          rows: rows.map((r) => ({
            bloomsLevel: r.bloomsLevel,
            topicId: r.topicId,
            topicName: r.topicName,
            subjectName: r.subjectName,
            totalQuestions: Number(r.total),
            correctAnswers: Number(r.correct),
            accuracy:
              Number(r.total) > 0
                ? Math.round((Number(r.correct) / Number(r.total)) * 10000) / 100
                : 0,
          })),
        }),
      );
    } catch (err) {
      console.error("[Analytics] Blooms-topics error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute blooms breakdown", 500), 500);
    }
  },
);

// ── GET /batch/:id — Batch Analytics ────────────────────────
analytics.get(
  "/batch/:id",
  requirePermission("analytics:batch"),
  async (c) => {
    const batchId = c.req.param("id");
    const user = c.get("user") as { role: string; sub: string };

    // Verify batch belongs to institution
    if (!(await verifyBatchOwnership(batchId, c))) {
      return c.json(error("NOT_FOUND", "Batch not found", 404), 404);
    }

    try {
      const [batch] = await db
        .select({
          id: batches.id,
          name: batches.name,
          targetExam: batches.targetExam,
          branchId: batches.branchId,
          academicYear: batches.academicYear,
        })
        .from(batches)
        .where(eq(batches.id, batchId))
        .limit(1);

      if (!batch) {
        return c.json(error("NOT_FOUND", "Batch not found", 404), 404);
      }

      const denied = await assertFacultyAssignedToBatch(c, user, batchId);
      if (denied) return denied;

      const fromDate = parseOptionalISODate(c.req.query("from"));
      const toDate = parseOptionalISODate(c.req.query("to"));
      const section = c.req.query("section");
      const examTypeFilter = c.req.query("examType");

      // Cache-first: if no date/examType/section filters, try reading from batch_analytics_cache
      if (!fromDate && !toDate && !section && !examTypeFilter) {
        const [cached] = await db
          .select()
          .from(batchAnalyticsCache)
          .where(eq(batchAnalyticsCache.batchId, batchId))
          .limit(1);

        if (cached && cached.updatedAt) {
          const ageMs = Date.now() - new Date(cached.updatedAt).getTime();
          if (ageMs < 5 * 60 * 1000) {
            return c.json(
              success({
                batchId,
                batchName: batch.name,
                targetExam: batch.targetExam,
                academicYear: batch.academicYear,
                avgScore: cached.avgScore,
                scoreDistribution: cached.scoreDistribution,
                topicPerformance: cached.topicPerformance,
                studentRanking: cached.studentRanking,
                atRiskStudents: cached.atRiskStudents,
                bloomsHeatmap: cached.bloomsHeatmap,
                _cacheStatus: "hit",
                _cachedAt: cached.updatedAt.toISOString(),
              }),
            );
          }
        }

        // Cache miss or stale — trigger async refresh and fall through to live compute
        refreshBatchCache(batchId).catch((err) =>
          console.error("[Analytics] Background batch cache refresh failed:", err),
        );
      }

      const batchStudentConditions = [eq(students.batchId, batchId)];
      if (section) batchStudentConditions.push(eq(students.section, section));

      const batchStudents = await db
        .select({
          userId: students.userId,
          name: users.name,
        })
        .from(students)
        .innerJoin(users, eq(users.id, students.userId))
        .where(and(...batchStudentConditions));

      const rosterIds = batchStudents.map((s) => s.userId);
      const allowed = new Set(rosterIds);
      const subset = parseStudentIdsSubset(c.req.query("studentIds"), allowed);
      if (!subset.ok) {
        return c.json(error("VALIDATION_ERROR", subset.message, 400), 400);
      }
      const targetIds = subset.ids.length > 0 ? subset.ids : rosterIds;

      const timeWhere = submissionTimeConditions(fromDate, toDate, examTypeFilter);
      // Held results drop out of the average, distribution, topic
      // performance, ranking and at-risk scan alike.
      const cohortWhere = timeWhere
        ? and(inArray(examSubmissions.studentId, targetIds), timeWhere, notResultHeld)
        : and(inArray(examSubmissions.studentId, targetIds), notResultHeld);

      if (targetIds.length === 0) {
        return c.json(
          success({
            batchId,
            batchName: batch.name,
            targetExam: batch.targetExam,
            academicYear: batch.academicYear,
            studentCount: batchStudents.length,
            cohortSize: 0,
            dateFrom: fromDate?.toISOString() ?? null,
            dateTo: toDate?.toISOString() ?? null,
            averageScore: 0,
            scoreDistribution: {},
            topicPerformance: [],
            studentRanking: [],
            atRiskStudents: [],
          }),
        );
      }

      const batchScores = await db
        .select({
          studentId: examSubmissions.studentId,
          avgPercentage: sql<number>`avg(${examSubmissions.percentage}::numeric)`,
          avgPercentile: sql<number>`avg(${examSubmissions.percentileBatch}::numeric)`,
          examCount: count(),
        })
        .from(examSubmissions)
        .where(cohortWhere)
        .groupBy(examSubmissions.studentId);

      const overallAvg =
        batchScores.length > 0
          ? batchScores.reduce((sum, s) => sum + Number(s.avgPercentage ?? 0), 0) /
            batchScores.length
          : 0;

      const distribution = await db
        .select({
          bucket: sql<string>`
            case
              when ${examSubmissions.percentage}::numeric >= 90 then '90-100'
              when ${examSubmissions.percentage}::numeric >= 80 then '80-90'
              when ${examSubmissions.percentage}::numeric >= 70 then '70-80'
              when ${examSubmissions.percentage}::numeric >= 60 then '60-70'
              when ${examSubmissions.percentage}::numeric >= 50 then '50-60'
              when ${examSubmissions.percentage}::numeric >= 40 then '40-50'
              when ${examSubmissions.percentage}::numeric >= 30 then '30-40'
              when ${examSubmissions.percentage}::numeric >= 20 then '20-30'
              when ${examSubmissions.percentage}::numeric >= 10 then '10-20'
              else '0-10'
            end`,
          count: count(),
        })
        .from(examSubmissions)
        .where(cohortWhere)
        .groupBy(
          sql`case
            when ${examSubmissions.percentage}::numeric >= 90 then '90-100'
            when ${examSubmissions.percentage}::numeric >= 80 then '80-90'
            when ${examSubmissions.percentage}::numeric >= 70 then '70-80'
            when ${examSubmissions.percentage}::numeric >= 60 then '60-70'
            when ${examSubmissions.percentage}::numeric >= 50 then '50-60'
            when ${examSubmissions.percentage}::numeric >= 40 then '40-50'
            when ${examSubmissions.percentage}::numeric >= 30 then '30-40'
            when ${examSubmissions.percentage}::numeric >= 20 then '20-30'
            when ${examSubmissions.percentage}::numeric >= 10 then '10-20'
            else '0-10'
          end`,
        );

      const scoreDistribution: Record<string, number> = {};
      for (const d of distribution) {
        scoreDistribution[d.bucket] = Number(d.count);
      }

      // LEFT JOIN syllabus_tree so questions without a syllabus_node_id
      // still show up (grouped at subject level with a generic topic
      // label). Previously an INNER JOIN silently dropped those rows —
      // on exams where the extraction pipeline populated subjects but
      // not topics, the Topic Performance table looked empty even
      // though the rest of the page had real data. We key the group
      // by `COALESCE(st.id, 'subject:'||subj.id)` so the UI still
      // dedupes by topic/subject bucket correctly.
      const topicPerformance = await db
        .select({
          topicId: sql<string>`COALESCE(${syllabusTree.id}::text, 'subject:' || ${subjects.id}::text)`,
          topicName: sql<string>`COALESCE(${syllabusTree.name}, ${subjects.name} || ' (general)')`,
          subjectName: subjects.name,
          total: count(),
          correct: sql<number>`count(*) filter (where ${examResponses.isCorrect} = true)`,
        })
        .from(examResponses)
        .innerJoin(examSubmissions, eq(examSubmissions.id, examResponses.submissionId))
        .innerJoin(questions, eq(questions.id, examResponses.questionId))
        .leftJoin(syllabusTree, eq(syllabusTree.id, questions.syllabusNodeId))
        .innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .where(cohortWhere)
        .groupBy(
          sql`COALESCE(${syllabusTree.id}::text, 'subject:' || ${subjects.id}::text)`,
          sql`COALESCE(${syllabusTree.name}, ${subjects.name} || ' (general)')`,
          subjects.name,
        )
        .orderBy(sql`count(*) filter (where ${examResponses.isCorrect} = true)::float / nullif(count(*), 0) asc`)
        .limit(20);

      const studentRanking = batchScores
        .map((s) => {
          const studentInfo = batchStudents.find((b) => b.userId === s.studentId);
          return {
            studentId: s.studentId,
            name: studentInfo?.name ?? "Unknown",
            averagePercentage: Math.round(Number(s.avgPercentage ?? 0) * 100) / 100,
            averagePercentile: Math.round(Number(s.avgPercentile ?? 0) * 100) / 100,
            examsAttempted: Number(s.examCount),
          };
        })
        .sort((a, b) => b.averagePercentage - a.averagePercentage)
        .map((s, i) => ({ ...s, rank: i + 1 }));

      const atRiskStudents: Array<{
        studentId: string;
        name: string;
        recentPercentiles: number[];
        trend: string;
      }> = [];

      for (const sid of targetIds) {
        const riskWhere = timeWhere
          ? and(eq(examSubmissions.studentId, sid), timeWhere, notResultHeld)
          : and(eq(examSubmissions.studentId, sid), notResultHeld);
        const last3 = await db
          .select({
            percentileBatch: examSubmissions.percentileBatch,
          })
          .from(examSubmissions)
          .where(riskWhere)
          .orderBy(desc(examSubmissions.submittedAt))
          .limit(3);

        if (last3.length >= 3) {
          const pcts = last3.map((s) => parseFloat(s.percentileBatch || "0")).reverse();
          if (pcts[2]! < pcts[1]! && pcts[1]! < pcts[0]!) {
            const studentInfo = batchStudents.find((b) => b.userId === sid);
            atRiskStudents.push({
              studentId: sid,
              name: studentInfo?.name ?? "Unknown",
              recentPercentiles: pcts,
              trend: "declining",
            });
          }
        }
      }

      return c.json(
        success({
          batchId,
          batchName: batch.name,
          targetExam: batch.targetExam,
          academicYear: batch.academicYear,
          studentCount: batchStudents.length,
          cohortSize: targetIds.length,
          dateFrom: fromDate?.toISOString() ?? null,
          dateTo: toDate?.toISOString() ?? null,
          averageScore: Math.round(overallAvg * 100) / 100,
          scoreDistribution,
          topicPerformance: topicPerformance.map((t) => ({
            topicId: t.topicId,
            topicName: t.topicName,
            subjectName: t.subjectName,
            totalQuestions: Number(t.total),
            correctAnswers: Number(t.correct),
            accuracy:
              Number(t.total) > 0
                ? Math.round((Number(t.correct) / Number(t.total)) * 10000) / 100
                : 0,
          })),
          studentRanking,
          atRiskStudents,
        }),
      );
    } catch (err) {
      console.error("[Analytics] Batch analytics error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute batch analytics", 500), 500);
    }
  },
);

// ── GET /batch/:id/tiers — Top 10 / Middle / Bottom 10 Segmentation ──
// For each tier returns strong/weak subject + chapter rollups so faculty
// can see what the high / middle / low performers excel at and struggle with.
analytics.get(
  "/batch/:id/tiers",
  requirePermission("analytics:batch"),
  async (c) => {
    const batchId = c.req.param("id");

    try {
      const [batch] = await db
        .select({ id: batches.id, name: batches.name })
        .from(batches)
        .where(eq(batches.id, batchId))
        .limit(1);

      if (!batch) {
        return c.json(error("NOT_FOUND", "Batch not found", 404), 404);
      }

      const batchStudents = await db
        .select({ userId: students.userId, name: users.name })
        .from(students)
        .innerJoin(users, eq(users.id, students.userId))
        .where(eq(students.batchId, batchId));

      const studentIds = batchStudents.map((s) => s.userId);

      if (studentIds.length === 0) {
        return c.json(
          success({
            batchId,
            batchName: batch.name,
            studentCount: 0,
            tiers: { top: null, middle: null, bottom: null },
          }),
        );
      }

      // Average percentage per student across all attempts
      const scores = await db
        .select({
          studentId: examSubmissions.studentId,
          avgPct: sql<number>`avg(${examSubmissions.percentage}::numeric)`,
          examCount: count(),
        })
        .from(examSubmissions)
        // Held results can't move a student between tiers.
        .where(and(inArray(examSubmissions.studentId, studentIds), notResultHeld))
        .groupBy(examSubmissions.studentId);

      const ranked = scores
        .map((s) => ({
          studentId: s.studentId,
          name: batchStudents.find((b) => b.userId === s.studentId)?.name ?? "Unknown",
          averagePercentage: Math.round(Number(s.avgPct ?? 0) * 100) / 100,
          examCount: Number(s.examCount),
        }))
        .sort((a, b) => b.averagePercentage - a.averagePercentage);

      // Partition — Top 10, Bottom 10, Middle everything else.
      // Adjust dynamically if batch is small.
      const tierSize = Math.min(10, Math.floor(ranked.length / 3) || 1);
      const top = ranked.slice(0, tierSize);
      const bottom = ranked.slice(Math.max(ranked.length - tierSize, tierSize));
      const middle = ranked.slice(tierSize, Math.max(ranked.length - tierSize, tierSize));

      async function rollup(ids: string[]) {
        if (ids.length === 0) {
          return { subjects: [], chapters: [] };
        }

        const subjectRows = await db
          .select({
            subjectId: subjects.id,
            subjectName: subjects.name,
            total: count(),
            correct: sql<number>`count(*) filter (where ${examResponses.isCorrect} = true)`,
          })
          .from(examResponses)
          .innerJoin(examSubmissions, eq(examSubmissions.id, examResponses.submissionId))
          .innerJoin(questions, eq(questions.id, examResponses.questionId))
          .innerJoin(subjects, eq(subjects.id, questions.subjectId))
          .where(and(inArray(examSubmissions.studentId, ids), notResultHeld))
          .groupBy(subjects.id, subjects.name);

        const chapterRows = await db
          .select({
            topicId: syllabusTree.id,
            topicName: syllabusTree.name,
            subjectName: subjects.name,
            total: count(),
            correct: sql<number>`count(*) filter (where ${examResponses.isCorrect} = true)`,
          })
          .from(examResponses)
          .innerJoin(examSubmissions, eq(examSubmissions.id, examResponses.submissionId))
          .innerJoin(questions, eq(questions.id, examResponses.questionId))
          .innerJoin(syllabusTree, eq(syllabusTree.id, questions.syllabusNodeId))
          .innerJoin(subjects, eq(subjects.id, questions.subjectId))
          .where(and(inArray(examSubmissions.studentId, ids), notResultHeld))
          .groupBy(syllabusTree.id, syllabusTree.name, subjects.name);

        const subjectStats = subjectRows.map((r) => ({
          subjectId: r.subjectId,
          subjectName: r.subjectName,
          accuracy:
            Number(r.total) > 0
              ? Math.round((Number(r.correct) / Number(r.total)) * 10000) / 100
              : 0,
          total: Number(r.total),
        }));

        const chapterStats = chapterRows.map((r) => ({
          topicId: r.topicId,
          topicName: r.topicName,
          subjectName: r.subjectName,
          accuracy:
            Number(r.total) > 0
              ? Math.round((Number(r.correct) / Number(r.total)) * 10000) / 100
              : 0,
          total: Number(r.total),
        }));

        return { subjects: subjectStats, chapters: chapterStats };
      }

      function split<T extends { accuracy: number; total: number }>(items: T[]) {
        const relevant = items.filter((i) => i.total >= 5);
        const byAcc = [...relevant].sort((a, b) => b.accuracy - a.accuracy);
        return {
          strong: byAcc.slice(0, 3),
          weak: [...byAcc].reverse().slice(0, 3),
        };
      }

      async function tier(label: string, group: typeof ranked) {
        const ids = group.map((g) => g.studentId);
        const { subjects: subs, chapters } = await rollup(ids);
        const subjSplit = split(subs);
        const chapSplit = split(chapters);
        const tierAvg =
          group.length > 0
            ? Math.round(
                (group.reduce((sum, s) => sum + s.averagePercentage, 0) / group.length) * 100,
              ) / 100
            : 0;
        return {
          label,
          studentCount: group.length,
          averagePercentage: tierAvg,
          students: group,
          strongSubjects: subjSplit.strong,
          weakSubjects: subjSplit.weak,
          strongChapters: chapSplit.strong,
          weakChapters: chapSplit.weak,
        };
      }

      const [topTier, middleTier, bottomTier] = await Promise.all([
        tier("Top 10", top),
        tier("Middle", middle),
        tier("Bottom 10", bottom),
      ]);

      return c.json(
        success({
          batchId,
          batchName: batch.name,
          studentCount: batchStudents.length,
          tierSize,
          tiers: {
            top: topTier,
            middle: middleTier,
            bottom: bottomTier,
          },
        }),
      );
    } catch (err) {
      console.error("[Analytics] Batch tiers error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute batch tiers", 500), 500);
    }
  },
);

// ── GET /branch/:id — Branch Analytics ──────────────────────
analytics.get(
  "/branch/:id",
  requirePermission("analytics:branch"),
  async (c) => {
    const branchId = c.req.param("id");

    try {
      // Branch info
      const user = c.get("user");
      const [branch] = await db
        .select({
          id: branches.id,
          name: branches.name,
          institutionId: branches.institutionId,
        })
        .from(branches)
        .where(eq(branches.id, branchId))
        .limit(1);

      if (!branch || branch.institutionId !== user.institutionId) {
        return c.json(error("NOT_FOUND", "Branch not found", 404), 404);
      }

      // All batches in this branch
      const branchBatches = await db
        .select({
          id: batches.id,
          name: batches.name,
          targetExam: batches.targetExam,
        })
        .from(batches)
        .where(eq(batches.branchId, branchId));

      const batchIds = branchBatches.map((b) => b.id);

      // Total students in branch (students in batches belonging to this branch)
      const branchStudents = await db
        .select({ userId: students.userId })
        .from(students)
        .where(
          batchIds.length > 0
            ? inArray(students.batchId, batchIds)
            : sql`false`,
        );

      const studentIds = branchStudents.map((s) => s.userId);

      // Total faculty in branch
      const branchFaculty = await db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.branchId, branchId), eq(users.role, "faculty")));

      // Aggregate stats across all students
      let overallAvgPercentile = 0;
      if (studentIds.length > 0) {
        const [aggResult] = await db
          .select({
            avgPercentile: sql<number>`avg(${examSubmissions.percentileBatch}::numeric)`,
          })
          .from(examSubmissions)
          // Held results are outside every branch rollup below.
          .where(and(inArray(examSubmissions.studentId, studentIds), notResultHeld));

        overallAvgPercentile = Number(aggResult?.avgPercentile ?? 0);
      }

      // Batch comparison: average percentile per batch
      const batchComparison: Array<{
        batchId: string;
        batchName: string;
        targetExam: string;
        avgPercentile: number;
        studentCount: number;
      }> = [];

      for (const b of branchBatches) {
        const batchStudentIds = await db
          .select({ userId: students.userId })
          .from(students)
          .where(eq(students.batchId, b.id));

        const ids = batchStudentIds.map((s) => s.userId);
        if (ids.length === 0) {
          batchComparison.push({
            batchId: b.id,
            batchName: b.name,
            targetExam: b.targetExam,
            avgPercentile: 0,
            studentCount: 0,
          });
          continue;
        }

        const [batchAvg] = await db
          .select({
            avgPercentile: sql<number>`avg(${examSubmissions.percentileBatch}::numeric)`,
          })
          .from(examSubmissions)
          .where(and(inArray(examSubmissions.studentId, ids), notResultHeld));

        batchComparison.push({
          batchId: b.id,
          batchName: b.name,
          targetExam: b.targetExam,
          avgPercentile: Math.round(Number(batchAvg?.avgPercentile ?? 0) * 100) / 100,
          studentCount: ids.length,
        });
      }

      batchComparison.sort((a, b) => b.avgPercentile - a.avgPercentile);

      // Faculty effectiveness: for each faculty user in this branch,
      // find batches they created exams for, compute average student improvement
      const branchFacultyUsers = await db
        .select({
          userId: users.id,
          name: users.name,
        })
        .from(users)
        .where(and(eq(users.branchId, branchId), eq(users.role, "faculty")));

      const facultyEffectiveness: Array<{
        facultyId: string;
        facultyName: string;
        examsCreated: number;
        avgStudentPercentile: number;
      }> = [];

      for (const f of branchFacultyUsers) {
        // Count exams created by this faculty
        const facultyExams = await db
          .select({ id: exams.id })
          .from(exams)
          .where(and(eq(exams.createdBy, f.userId), eq(exams.branchId, branchId)));

        if (facultyExams.length === 0) {
          facultyEffectiveness.push({
            facultyId: f.userId,
            facultyName: f.name,
            examsCreated: 0,
            avgStudentPercentile: 0,
          });
          continue;
        }

        const examIds = facultyExams.map((e) => e.id);
        const [avgResult] = await db
          .select({
            avgPercentile: sql<number>`avg(${examSubmissions.percentileBatch}::numeric)`,
          })
          .from(examSubmissions)
          .where(and(inArray(examSubmissions.examId, examIds), notResultHeld));

        facultyEffectiveness.push({
          facultyId: f.userId,
          facultyName: f.name,
          examsCreated: facultyExams.length,
          avgStudentPercentile: Math.round(Number(avgResult?.avgPercentile ?? 0) * 100) / 100,
        });
      }

      // Total exams conducted in branch
      const [examCount] = await db
        .select({ count: count() })
        .from(exams)
        .where(eq(exams.branchId, branchId));

      return c.json(
        success({
          branchId,
          branchName: branch.name,
          totalStudents: studentIds.length,
          totalFaculty: Number(branchFaculty[0]?.count ?? 0),
          totalBatches: branchBatches.length,
          totalExams: Number(examCount?.count ?? 0),
          overallAvgPercentile: Math.round(overallAvgPercentile * 100) / 100,
          batchComparison,
          facultyEffectiveness,
        }),
      );
    } catch (err) {
      console.error("[Analytics] Branch analytics error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute branch analytics", 500), 500);
    }
  },
);

// ── GET /institution/trends — Monthly performance trends ─────
analytics.get(
  "/institution/trends",
  requirePermission("analytics:institution"),
  async (c) => {
    const user = c.get("user");
    try {
      const institutionId = user.institutionId;
      const months = Math.min(Math.max(parseInt(c.req.query("months") ?? "12", 10) || 12, 1), 24);

      // Date range filtering (consistent with /institution endpoint)
      const fromDate = parseOptionalISODate(c.req.query("from"));
      const toDate = parseOptionalISODate(c.req.query("to"));

      // Support filtering by a single branch via query param or X-Branch-Id header
      const filterBranchId = c.req.query("branchId") || c.req.header("X-Branch-Id") || null;

      // Always fetch institution branches so we can validate ownership
      const institutionBranches = await db
        .select({ id: branches.id })
        .from(branches)
        .where(eq(branches.institutionId, institutionId));
      const institutionBranchIds = new Set(institutionBranches.map((b) => b.id));

      let branchIds: string[];
      if (filterBranchId) {
        // Validate that the requested branch belongs to this institution
        if (!institutionBranchIds.has(filterBranchId)) {
          return c.json(error("FORBIDDEN", "Branch does not belong to your institution", 403), 403);
        }
        branchIds = [filterBranchId];
      } else {
        branchIds = [...institutionBranchIds];
      }

      if (branchIds.length === 0) {
        return c.json(success({ trends: [] }));
      }

      // Build time condition: prefer explicit from/to, fall back to months window
      const timeCondition = fromDate || toDate
        ? submissionTimeConditions(fromDate, toDate)
        : gte(examSubmissions.submittedAt, sql`now() - make_interval(months => ${months})`);

      const trends = await db
        .select({
          month: sql<string>`to_char(${examSubmissions.submittedAt}, 'YYYY-MM')`,
          avgScore: sql<number>`round(avg(${examSubmissions.percentage}::numeric), 1)`,
          totalSubmissions: count(),
          totalExams: sql<number>`count(distinct ${examSubmissions.examId})`,
        })
        .from(examSubmissions)
        .innerJoin(exams, eq(exams.id, examSubmissions.examId))
        .where(
          and(
            inArray(exams.branchId, branchIds),
            timeCondition,
            // Held results never reach the monthly trend line.
            notResultHeld,
          ),
        )
        .groupBy(sql`to_char(${examSubmissions.submittedAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${examSubmissions.submittedAt}, 'YYYY-MM')`);

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const formatted = trends.map((t) => {
        const [year, mon] = t.month.split("-");
        return {
          month: `${monthNames[parseInt(mon!, 10) - 1]} ${year}`,
          avgScore: Number(t.avgScore),
          totalSubmissions: Number(t.totalSubmissions),
          totalExams: Number(t.totalExams),
        };
      });

      return c.json(success({ trends: formatted }));
    } catch (err) {
      console.error("[Analytics] Institution trends error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute institution trends", 500), 500);
    }
  },
);

// ── GET /institution — Institution-wide Analytics ───────────
analytics.get(
  "/institution",
  requirePermission("analytics:institution"),
  async (c) => {
    const user = c.get("user");

    try {
      const institutionId = user.institutionId;
      const fromDate = parseOptionalISODate(c.req.query("from"));
      const toDate = parseOptionalISODate(c.req.query("to"));
      const examTypeFilter = c.req.query("examType");
      const instSubTime = submissionTimeConditions(fromDate, toDate, examTypeFilter);

      // Cache-first: if no date/examType filters, try reading from institution_analytics_cache
      if (!fromDate && !toDate && !examTypeFilter) {
        const [cached] = await db
          .select()
          .from(institutionAnalyticsCache)
          .where(eq(institutionAnalyticsCache.institutionId, institutionId))
          .limit(1);

        if (cached && cached.updatedAt) {
          const ageMs = Date.now() - new Date(cached.updatedAt).getTime();
          if (ageMs < 5 * 60 * 1000) {
            return c.json(
              success({
                institutionId,
                ...(cached.totals as any),
                dateFrom: null,
                dateTo: null,
                avgPercentile: (cached.totals as any)?.avgScore ?? 0,
                branchComparison: ((cached.branchComparison as any[]) ?? []).map((b: any) => ({
                  ...b,
                  name: b.branchName,
                  percentile: b.avgScore,
                  students: b.studentCount,
                })),
                topBatches: ((cached.topBatches as any[]) ?? []).map((b: any) => ({
                  ...b,
                  name: b.batchName,
                  branch: "--",
                  students: 0,
                })),
                _cacheStatus: "hit",
                _cachedAt: cached.updatedAt.toISOString(),
              }),
            );
          }
        }

        // Cache miss or stale — trigger async refresh and fall through to live compute
        refreshInstitutionCache(institutionId).catch((err) =>
          console.error("[Analytics] Background institution cache refresh failed:", err),
        );
      }

      // Total students
      const [studentCount] = await db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.institutionId, institutionId), eq(users.role, "student")));

      // Total faculty
      const [facultyCount] = await db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.institutionId, institutionId), eq(users.role, "faculty")));

      // Total branches
      const institutionBranches = await db
        .select({
          id: branches.id,
          name: branches.name,
        })
        .from(branches)
        .where(eq(branches.institutionId, institutionId));

      // Total exams conducted
      const [examCount] = await db
        .select({ count: count() })
        .from(exams)
        .where(eq(exams.institutionId, institutionId));

      // Average percentile across all submissions in this institution
      const branchIds = institutionBranches.map((b) => b.id);
      let overallAvgPercentile = 0;

      if (branchIds.length > 0) {
        const [avgResult] = await db
          .select({
            avgPercentile: sql<number>`avg(${examSubmissions.percentileBatch}::numeric)`,
          })
          .from(examSubmissions)
          .innerJoin(exams, eq(exams.id, examSubmissions.examId))
          .where(
            // Held results are outside every institution rollup below.
            instSubTime
              ? and(inArray(exams.branchId, branchIds), instSubTime, notResultHeld)
              : and(inArray(exams.branchId, branchIds), notResultHeld),
          );

        overallAvgPercentile = Number(avgResult?.avgPercentile ?? 0);
      }

      // Cross-branch comparison (single grouped queries instead of N+1)
      const [branchStudentCounts, branchExamCounts, branchPercentiles] = await Promise.all([
        branchIds.length > 0
          ? db
              .select({ branchId: users.branchId, cnt: count() })
              .from(users)
              .where(and(inArray(users.branchId, branchIds), eq(users.role, "student")))
              .groupBy(users.branchId)
          : [],
        branchIds.length > 0
          ? db
              .select({ branchId: exams.branchId, cnt: count() })
              .from(exams)
              .where(inArray(exams.branchId, branchIds))
              .groupBy(exams.branchId)
          : [],
        branchIds.length > 0
          ? db
              .select({
                branchId: exams.branchId,
                avgPercentile: sql<number>`avg(${examSubmissions.percentileBatch}::numeric)`,
              })
              .from(examSubmissions)
              .innerJoin(exams, eq(exams.id, examSubmissions.examId))
              .where(
                instSubTime
                  ? and(inArray(exams.branchId, branchIds), instSubTime, notResultHeld)
                  : and(inArray(exams.branchId, branchIds), notResultHeld),
              )
              .groupBy(exams.branchId)
          : [],
      ]);

      const bStudentMap = new Map(branchStudentCounts.map((r) => [r.branchId, Number(r.cnt)]));
      const bExamMap = new Map(branchExamCounts.map((r) => [r.branchId, Number(r.cnt)]));
      const bPercMap = new Map(branchPercentiles.map((r) => [r.branchId, Number(r.avgPercentile ?? 0)]));

      const branchComparison = institutionBranches
        .map((b) => ({
          branchId: b.id,
          branchName: b.name,
          studentCount: bStudentMap.get(b.id) ?? 0,
          avgPercentile: Math.round((bPercMap.get(b.id) ?? 0) * 100) / 100,
          examsConducted: bExamMap.get(b.id) ?? 0,
        }))
        .sort((a, b) => b.avgPercentile - a.avgPercentile);

      // Top performing batches (single grouped queries instead of N+1)
      const allBatches = branchIds.length > 0
        ? await db
            .select({
              id: batches.id,
              name: batches.name,
              branchId: batches.branchId,
              targetExam: batches.targetExam,
            })
            .from(batches)
            .where(inArray(batches.branchId, branchIds))
        : [];

      const allBatchIds = allBatches.map((b) => b.id);
      const [batchPercentiles, batchStudentRows] = await Promise.all([
        allBatchIds.length > 0
          ? db
              .select({
                batchId: students.batchId,
                avgPercentile: sql<number>`avg(${examSubmissions.percentileBatch}::numeric)`,
              })
              .from(students)
              .innerJoin(examSubmissions, eq(examSubmissions.studentId, students.userId))
              .where(
                instSubTime
                  ? and(inArray(students.batchId, allBatchIds), instSubTime, notResultHeld)
                  : and(inArray(students.batchId, allBatchIds), notResultHeld),
              )
              .groupBy(students.batchId)
          : [],
        allBatchIds.length > 0
          ? db
              .select({ batchId: students.batchId, cnt: count() })
              .from(students)
              .where(inArray(students.batchId, allBatchIds))
              .groupBy(students.batchId)
          : [],
      ]);

      const batchPercMap = new Map(batchPercentiles.map((r) => [r.batchId, Number(r.avgPercentile ?? 0)]));
      const batchStudentCountMap = new Map(batchStudentRows.map((r) => [r.batchId, Number(r.cnt)]));

      const branchNameMap: Record<string, string> = {};
      for (const b of institutionBranches) branchNameMap[b.id] = b.name;

      const topBatches = allBatches
        .map((batch) => ({
          batchId: batch.id,
          batchName: batch.name,
          branchId: batch.branchId,
          avgPercentile: Math.round((batchPercMap.get(batch.id) ?? 0) * 100) / 100,
        }))
        .sort((a, b) => b.avgPercentile - a.avgPercentile);

      return c.json(
        success({
          institutionId,
          totalStudents: Number(studentCount?.count ?? 0),
          totalFaculty: Number(facultyCount?.count ?? 0),
          totalBranches: institutionBranches.length,
          totalExams: Number(examCount?.count ?? 0),
          dateFrom: fromDate?.toISOString() ?? null,
          dateTo: toDate?.toISOString() ?? null,
          avgPercentile: Math.round(overallAvgPercentile * 100) / 100,
          branchComparison: branchComparison.map((b) => ({
            ...b,
            name: b.branchName,
            percentile: b.avgPercentile,
            students: b.studentCount,
          })),
          topBatches: topBatches.slice(0, 10).map((b) => ({
            ...b,
            name: b.batchName,
            branch: branchNameMap[b.branchId] ?? "--",
            students: batchStudentCountMap.get(b.batchId) ?? 0,
          })),
        }),
      );
    } catch (err) {
      console.error("[Analytics] Institution analytics error:", err);
      return c.json(
        error("INTERNAL_ERROR", "Failed to compute institution analytics", 500),
        500,
      );
    }
  },
);

// ── GET /institution/strength — Student strength split by year group → batch → section ─
// branch_admin (and every other branch-scoped role) holds analytics:branch,
// not analytics:institution, and is hard-locked to their own branch's
// breakdown; cross-branch roles (super_admin, academic_head,
// neet_coordinator) see every branch — same tenancy split as tenantScope.
//
// Also open to the live-ops roles (Vice Principal, EDP): the dashboard
// shows branch headcount beside the live board, and both hold the
// underlying roster duty (user:read, attendance:analytics) without any
// analytics:* grant. They are branch-locked below like every other
// non-cross-branch caller.
analytics.get(
  "/institution/strength",
  requireAnalyticsOrOpsRole(),
  async (c) => {
    const user = c.get("user");
    try {
      const institutionId = user.institutionId;
      const crossBranch = ["super_admin", "academic_head", "neet_coordinator"].includes(user.role);
      const lockedBranchId = !crossBranch && user.branchId ? user.branchId : null;
      // Optional scope filters (admin home filter bar). Omitting all of
      // them keeps the original institution-wide behaviour. Branch-locked
      // callers only ever see their own branch — the lock overrides any
      // explicit branchId param.
      const filterBranchId = lockedBranchId ?? (c.req.query("branchId") || null);
      const filterBatchId = c.req.query("batchId") || null;
      const filterSection = c.req.query("section")?.trim() || null;

      // All batches for this institution's branches, with their branch name.
      const batchConds = [eq(branches.institutionId, institutionId)];
      if (filterBranchId) batchConds.push(eq(branches.id, filterBranchId));
      if (filterBatchId) batchConds.push(eq(batches.id, filterBatchId));
      const institutionBatches = await db
        .select({
          batchId: batches.id,
          batchName: batches.name,
          branchId: branches.id,
          branchName: branches.name,
          yearGroup: batches.yearGroup,
          classLevels: batches.classLevels,
        })
        .from(batches)
        .innerJoin(branches, eq(branches.id, batches.branchId))
        .where(and(...batchConds));

      // Student counts grouped by (batch, section), scoped to this institution's
      // students. batchId can be null (unassigned students) — kept so totals reconcile.
      const countConds = [eq(users.institutionId, institutionId), eq(users.role, "student")];
      if (filterBranchId) countConds.push(eq(users.branchId, filterBranchId));
      if (filterBatchId) countConds.push(eq(students.batchId, filterBatchId));
      if (filterSection) countConds.push(eq(students.section, filterSection));
      const counts = await db
        .select({
          batchId: students.batchId,
          section: students.section,
          cnt: count(),
        })
        .from(students)
        .innerJoin(users, eq(users.id, students.userId))
        .where(and(...countConds))
        .groupBy(students.batchId, students.section);

      // Classify a batch into a year group: prefer the free-form yearGroup label,
      // falling back to the derived class levels (11 → junior, 12 → senior).
      const classify = (
        yearGroup: string | null,
        classLevels: string | null,
      ): "junior" | "senior" | "other" => {
        const level = classLevels || deriveClassLevels(yearGroup);
        if (level === "11") return "junior";
        if (level === "12") return "senior";
        return "other";
      };

      // section counts keyed by batchId
      const sectionsByBatch = new Map<
        string,
        { section: string; count: number }[]
      >();
      let unassignedTotal = 0;
      const unassignedSections: { section: string; count: number }[] = [];

      for (const row of counts) {
        const n = Number(row.cnt);
        const sectionLabel = row.section?.trim() || "Unassigned";
        if (!row.batchId) {
          unassignedTotal += n;
          unassignedSections.push({ section: sectionLabel, count: n });
          continue;
        }
        const list = sectionsByBatch.get(row.batchId) ?? [];
        list.push({ section: sectionLabel, count: n });
        sectionsByBatch.set(row.batchId, list);
      }

      const groupMeta = {
        senior: { key: "senior", label: "Seniors", count: 0, batches: [] as any[] },
        junior: { key: "junior", label: "Juniors", count: 0, batches: [] as any[] },
        other: { key: "other", label: "Other", count: 0, batches: [] as any[] },
      };

      for (const b of institutionBatches) {
        const sections = (sectionsByBatch.get(b.batchId) ?? []).sort((a, x) =>
          a.section.localeCompare(x.section),
        );
        const batchCount = sections.reduce((s, x) => s + x.count, 0);
        if (batchCount === 0) continue; // hide empty batches from the breakdown
        const g = classify(b.yearGroup, b.classLevels);
        groupMeta[g].count += batchCount;
        groupMeta[g].batches.push({
          batchId: b.batchId,
          batchName: b.batchName,
          branchName: b.branchName,
          yearGroup: b.yearGroup,
          count: batchCount,
          sections,
        });
      }

      // Unassigned students (no batch) surface as their own group.
      if (unassignedTotal > 0) {
        groupMeta.other.count += unassignedTotal;
        groupMeta.other.batches.push({
          batchId: null,
          batchName: "Unassigned",
          branchName: "—",
          yearGroup: null,
          count: unassignedTotal,
          sections: unassignedSections.sort((a, x) => a.section.localeCompare(x.section)),
        });
      }

      const order: Array<keyof typeof groupMeta> = ["senior", "junior", "other"];
      const groups = order
        .map((k) => groupMeta[k])
        .filter((g) => g.count > 0)
        .map((g) => ({
          ...g,
          batches: g.batches.sort((a, b) => b.count - a.count),
        }));

      const total = groups.reduce((s, g) => s + g.count, 0);

      return c.json(success({ institutionId, total, groups }));
    } catch (err) {
      console.error("[Analytics] Institution strength error:", err);
      return c.json(
        error("INTERNAL_ERROR", "Failed to compute student strength breakdown", 500),
        500,
      );
    }
  },
);

// ── GET /institution/exam-insights — Scoped exam KPIs for the admin home ─
// Powers the admin dashboard filter bar: every aggregate honours the
// optional from/to/branchId/batchId/section scope. Batch/section scoping
// goes through the student roster (students.userId = submissions.studentId)
// rather than the exam's assigned batches, so a batch filter counts what
// that batch's students actually submitted regardless of roster shape.
analytics.get(
  "/institution/exam-insights",
  requireAnyPermission("analytics:institution", "analytics:branch"),
  async (c) => {
    const user = c.get("user");
    try {
      const institutionId = user.institutionId;
      const fromDate = parseOptionalISODate(c.req.query("from"));
      const toDate = parseOptionalISODate(c.req.query("to"));
      // Branch-locked callers (branch_admin & co) only ever see their own
      // branch — the lock overrides any explicit branchId param. Same
      // cross-branch exemptions as tenantScope / the strength endpoint.
      const crossBranch = ["super_admin", "academic_head", "neet_coordinator"].includes(user.role);
      const lockedBranchId = !crossBranch && user.branchId ? user.branchId : null;
      const filterBranchId = lockedBranchId ?? (c.req.query("branchId") || null);
      const filterBatchId = c.req.query("batchId") || null;
      const filterSection = c.req.query("section")?.trim() || null;

      const institutionBranches = await db
        .select({ id: branches.id })
        .from(branches)
        .where(eq(branches.institutionId, institutionId));
      const institutionBranchIds = new Set(institutionBranches.map((b) => b.id));

      let branchIds: string[];
      if (filterBranchId) {
        if (!institutionBranchIds.has(filterBranchId)) {
          return c.json(error("FORBIDDEN", "Branch does not belong to your institution", 403), 403);
        }
        branchIds = [filterBranchId];
      } else {
        branchIds = [...institutionBranchIds];
      }

      const emptyPayload = {
        totals: { students: 0, faculty: 0, exams: 0, avgScore: 0 },
        modeSplit: { onlineStudents: 0, offlineStudents: 0, onlineSubmissions: 0, offlineSubmissions: 0 },
        modeBreakdown: [] as unknown[],
        exams: [] as unknown[],
      };
      if (branchIds.length === 0) {
        return c.json(success(emptyPayload));
      }

      // Roster scope (batch/section) applies to submissions + student count.
      const rosterConds = [];
      if (filterBatchId) rosterConds.push(eq(students.batchId, filterBatchId));
      if (filterSection) rosterConds.push(eq(students.section, filterSection));

      // Submission scope: real submissions only (absent-marker rows have a
      // NULL submittedAt) within the exam-category guard + optional range.
      // Tenant guard is the exam's institution, NOT its branch — multi-branch
      // exams (most OMR weeklies) have branch_id NULL and would vanish from
      // every aggregate behind an exams.branchId IN (...) filter. A branch
      // filter therefore scopes by the SUBMITTING STUDENT's branch, same as
      // the roster philosophy above and the modeBreakdown grouping below.
      const timeCondition = submissionTimeConditions(fromDate, toDate);
      const subWhere = and(
        eq(exams.institutionId, institutionId),
        eq(exams.category, "exam" as const),
        isNotNull(examSubmissions.submittedAt),
        // Held results are excluded from the KPI scans that share this
        // predicate (avg score, per-exam rows, mode breakdown).
        notResultHeld,
        ...(timeCondition ? [timeCondition] : []),
        ...(filterBranchId ? [eq(users.branchId, filterBranchId)] : []),
        ...rosterConds,
      );

      // Scoped student headcount
      const studentConds = [eq(users.institutionId, institutionId), eq(users.role, "student")];
      if (filterBranchId) studentConds.push(eq(users.branchId, filterBranchId));

      // Faculty are branch-scoped only — batch/section/date don't apply.
      const facultyConds = [eq(users.institutionId, institutionId), eq(users.role, "faculty")];
      if (filterBranchId) facultyConds.push(eq(users.branchId, filterBranchId));

      // Formal exams conducted in scope. Batch scope uses the exam's
      // assigned batches (an exam count can't go through submissions —
      // an exam with zero submissions still happened). A branch-scoped
      // count includes multi-branch exams (branch_id NULL) whose assigned
      // batches contain at least one batch of that branch.
      const examConds = [
        eq(exams.institutionId, institutionId),
        eq(exams.category, "exam" as const),
        isNull(exams.deletedAt),
      ];
      if (fromDate) examConds.push(gte(exams.scheduledStart, fromDate));
      if (toDate) examConds.push(lte(exams.scheduledStart, toDate));
      if (filterBranchId) {
        examConds.push(
          or(
            eq(exams.branchId, filterBranchId),
            and(
              isNull(exams.branchId),
              sql`exists (select 1 from ${batches} where ${batches.id}::text = any(${exams.assignedBatches}) and ${batches.branchId} = ${filterBranchId})`,
            ),
          )!,
        );
      }
      if (filterBatchId) examConds.push(sql`${filterBatchId} = any(${exams.assignedBatches})`);

      const [[agg], [studentAgg], [facultyAgg], [examAgg], perExam, modeBreakdown] = await Promise.all([
        db
          .select({
            avgScore: sql<number>`round(avg(${examSubmissions.percentage}::numeric), 1)`,
            onlineStudents: sql<number>`count(distinct ${examSubmissions.studentId}) filter (where ${examSubmissions.examMode} = 'online')`,
            offlineStudents: sql<number>`count(distinct ${examSubmissions.studentId}) filter (where ${examSubmissions.examMode} = 'offline')`,
            onlineSubmissions: sql<number>`count(*) filter (where ${examSubmissions.examMode} = 'online')`,
            offlineSubmissions: sql<number>`count(*) filter (where ${examSubmissions.examMode} = 'offline')`,
          })
          .from(examSubmissions)
          .innerJoin(exams, eq(exams.id, examSubmissions.examId))
          .innerJoin(students, eq(students.userId, examSubmissions.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .where(subWhere),
        db
          .select({ cnt: count() })
          .from(students)
          .innerJoin(users, eq(users.id, students.userId))
          .where(and(...studentConds, ...rosterConds)),
        db.select({ cnt: count() }).from(users).where(and(...facultyConds)),
        db.select({ cnt: count() }).from(exams).where(and(...examConds)),
        db
          .select({
            examId: exams.id,
            title: exams.title,
            examType: exams.examType,
            // Branches/batches of the students who actually submitted
            // (within the caller's scope) — not the exam's own branch,
            // which is NULL for multi-branch exams, nor its assigned
            // list, so a branch-locked caller only ever sees their own.
            branchNames: sql<
              string[] | null
            >`array_agg(distinct ${branches.name}) filter (where ${branches.name} is not null)`,
            batchNames: sql<
              string[] | null
            >`array_agg(distinct ${batches.name}) filter (where ${batches.name} is not null)`,
            date: sql<string>`coalesce(${exams.scheduledStart}, min(${examSubmissions.submittedAt}))`,
            avgScore: sql<number>`round(avg(${examSubmissions.percentage}::numeric), 1)`,
            submissions: count(),
            online: sql<number>`count(*) filter (where ${examSubmissions.examMode} = 'online')`,
            offline: sql<number>`count(*) filter (where ${examSubmissions.examMode} = 'offline')`,
          })
          .from(examSubmissions)
          .innerJoin(exams, eq(exams.id, examSubmissions.examId))
          .innerJoin(students, eq(students.userId, examSubmissions.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .leftJoin(branches, eq(branches.id, users.branchId))
          .leftJoin(batches, eq(batches.id, students.batchId))
          .where(subWhere)
          .groupBy(exams.id, exams.title, exams.examType, exams.scheduledStart)
          .orderBy(sql`coalesce(${exams.scheduledStart}, min(${examSubmissions.submittedAt})) desc`)
          .limit(20),
        // Where the online/offline takers sit: distinct students per mode,
        // grouped by the student's own branch → batch → section (not the
        // exam's), ordered hierarchically to mirror the filter pattern.
        db
          .select({
            branchId: users.branchId,
            branchName: branches.name,
            batchId: students.batchId,
            batchName: batches.name,
            section: students.section,
            online: sql<number>`count(distinct ${examSubmissions.studentId}) filter (where ${examSubmissions.examMode} = 'online')`,
            offline: sql<number>`count(distinct ${examSubmissions.studentId}) filter (where ${examSubmissions.examMode} = 'offline')`,
          })
          .from(examSubmissions)
          .innerJoin(exams, eq(exams.id, examSubmissions.examId))
          .innerJoin(students, eq(students.userId, examSubmissions.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .leftJoin(batches, eq(batches.id, students.batchId))
          .leftJoin(branches, eq(branches.id, users.branchId))
          .where(subWhere)
          .groupBy(users.branchId, branches.name, students.batchId, batches.name, students.section)
          .orderBy(branches.name, batches.name, students.section)
          .limit(100),
      ]);

      return c.json(
        success({
          totals: {
            students: Number(studentAgg?.cnt ?? 0),
            faculty: Number(facultyAgg?.cnt ?? 0),
            exams: Number(examAgg?.cnt ?? 0),
            avgScore: Number(agg?.avgScore ?? 0),
          },
          modeSplit: {
            onlineStudents: Number(agg?.onlineStudents ?? 0),
            offlineStudents: Number(agg?.offlineStudents ?? 0),
            onlineSubmissions: Number(agg?.onlineSubmissions ?? 0),
            offlineSubmissions: Number(agg?.offlineSubmissions ?? 0),
          },
          // Rows where neither mode is recorded (legacy submissions) are
          // dropped — they'd render as a confusing 0/0 line.
          modeBreakdown: modeBreakdown
            .map((r) => ({
              branchId: r.branchId,
              branchName: r.branchName ?? "—",
              batchId: r.batchId,
              batchName: r.batchName ?? "Unassigned",
              section: r.section?.trim() || "Unassigned",
              online: Number(r.online),
              offline: Number(r.offline),
            }))
            .filter((r) => r.online > 0 || r.offline > 0),
          // Latest 20 exams in scope, returned oldest → newest for charting.
          exams: perExam
            .map((e) => ({
              id: e.examId,
              title: e.title,
              examType: e.examType,
              branch: (e.branchNames ?? []).join(", ") || "—",
              batches: e.batchNames ?? [],
              date: e.date,
              avgScore: Number(e.avgScore ?? 0),
              submissions: Number(e.submissions),
              online: Number(e.online),
              offline: Number(e.offline),
            }))
            .reverse(),
        }),
      );
    } catch (err) {
      console.error("[Analytics] Institution exam-insights error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute exam insights", 500), 500);
    }
  },
);

// ── GET /institution/live-exams — exams with students taking them RIGHT NOW ─
// exam-insights above is built from COMPLETED submissions (submittedAt not null),
// so an in-progress exam — where students have an exam_sessions row but haven't
// submitted yet — is invisible to it. This endpoint reads live presence straight
// from exam_sessions (the same table the /exams/:id/monitor page uses) so today's
// ongoing exam shows immediately with a real "students online now" count. Kept as
// its own lightweight route (one table, no heavy aggregates) so the dashboard can
// poll it every ~20s without re-running the 6-scan exam-insights payload.
analytics.get(
  "/institution/live-exams",
  requireAnyPermission("analytics:institution", "analytics:branch"),
  async (c) => {
    const user = c.get("user");
    try {
      const institutionId = user.institutionId;
      // Same branch-lock / cross-branch exemptions as exam-insights & tenantScope.
      const crossBranch = ["super_admin", "academic_head", "neet_coordinator"].includes(user.role);
      const lockedBranchId = !crossBranch && user.branchId ? user.branchId : null;
      const filterBranchId = lockedBranchId ?? (c.req.query("branchId") || null);
      const filterBatchId = c.req.query("batchId") || null;
      const filterSection = c.req.query("section")?.trim() || null;

      if (filterBranchId) {
        const [branchRow] = await db
          .select({ id: branches.id })
          .from(branches)
          .where(and(eq(branches.id, filterBranchId), eq(branches.institutionId, institutionId)))
          .limit(1);
        if (!branchRow) {
          return c.json(error("FORBIDDEN", "Branch does not belong to your institution", 403), 403);
        }
      }

      // "Live" = a started, not-yet-submitted session whose client is still
      // connected. Heartbeats land ~every 30s; a 5-minute freshness window
      // matches the monitor page's "dead" threshold. COALESCE with startedAt
      // catches sessions that just opened and haven't heartbeat-ed yet.
      const liveCond = and(
        eq(exams.institutionId, institutionId),
        isNull(exams.deletedAt),
        eq(exams.category, "exam" as const),
        isNull(examSessions.submittedAt),
        sql`coalesce(${examSessions.lastHeartbeat}, ${examSessions.startedAt}) > now() - interval '5 minutes'`,
        // Branch scope follows the STUDENT's branch (same as exam-insights) so
        // multi-branch exams (exams.branchId NULL) still surface for the caller.
        ...(filterBranchId ? [eq(users.branchId, filterBranchId)] : []),
        ...(filterBatchId ? [eq(students.batchId, filterBatchId)] : []),
        ...(filterSection ? [eq(students.section, filterSection)] : []),
      );

      const [perExam, [totalAgg]] = await Promise.all([
        db
          .select({
            examId: exams.id,
            title: exams.title,
            examType: exams.examType,
            branchNames: sql<
              string[] | null
            >`array_agg(distinct ${branches.name}) filter (where ${branches.name} is not null)`,
            batchNames: sql<
              string[] | null
            >`array_agg(distinct ${batches.name}) filter (where ${batches.name} is not null)`,
            date: sql<string>`coalesce(${exams.scheduledStart}, min(${examSessions.startedAt}))`,
            online: sql<number>`count(distinct ${examSessions.studentId})`,
          })
          .from(examSessions)
          .innerJoin(exams, eq(exams.id, examSessions.examId))
          .innerJoin(students, eq(students.userId, examSessions.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .leftJoin(branches, eq(branches.id, users.branchId))
          .leftJoin(batches, eq(batches.id, students.batchId))
          .where(liveCond)
          .groupBy(exams.id, exams.title, exams.examType, exams.scheduledStart)
          .orderBy(sql`coalesce(${exams.scheduledStart}, min(${examSessions.startedAt})) desc`)
          .limit(20),
        db
          .select({
            students: sql<number>`count(distinct ${examSessions.studentId})`,
          })
          .from(examSessions)
          .innerJoin(exams, eq(exams.id, examSessions.examId))
          .innerJoin(students, eq(students.userId, examSessions.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .where(liveCond),
      ]);

      return c.json(
        success({
          liveStudents: Number(totalAgg?.students ?? 0),
          exams: perExam.map((e) => ({
            id: e.examId,
            title: e.title,
            examType: e.examType,
            branch: (e.branchNames ?? []).join(", ") || "—",
            batches: e.batchNames ?? [],
            date: e.date,
            online: Number(e.online),
          })),
        }),
      );
    } catch (err) {
      console.error("[Analytics] Institution live-exams error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to load live exams", 500), 500);
    }
  },
);

// ══════════════════════════════════════════════════════════════════
// LIVE OPS — the dashboard's "what is happening right now" board
// ══════════════════════════════════════════════════════════════════
//
// One endpoint, one payload. The board needs exam sessions, submissions,
// OMR, block state, app presence, doubts and error-analysis completion —
// each of which lives behind a DIFFERENT permission today
// (analytics:*, presence:read, doubt:read). Vice Principal holds none of
// them but is the RBAC-designated live-invigilation executor, and EDP runs
// the exam hall; fanning the board out to five endpoints would 403 both.
// So: a single role-gated route that owns the whole board.
//
// Visibility (product decision, 2026-07-27) — see LIVE_OPS_ROLES above:
//   super_admin, academic_head          → every branch
//   branch_admin, vice_principal, edp   → own branch only
//   everyone else                       → no live-ops board at all
//
// A student is "writing now" when their session is unsubmitted and the
// client has beaten within 5 minutes — the same freshness threshold the
// Live Monitor calls "dead" and /institution/live-exams already uses.
const LIVE_SESSION_SQL = sql`${examSessions.submittedAt} is null
  and coalesce(${examSessions.lastHeartbeat}, ${examSessions.startedAt}) > now() - interval '5 minutes'`;

// Which exam_sessions rows belong to the selected window: started inside
// it, or still live right now. The second clause keeps an exam that ran
// past midnight on today's board. Shared by the board and the blocked
// list — they must agree, and a divergence here is invisible until a
// count stops matching the list it opens.
// Dedupe a facet list by id, dropping nulls.
function uniqById<T extends { id: string | null }>(list: T[]): T[] {
  const m = new Map<string, T>();
  for (const it of list) if (it.id) m.set(it.id, it);
  return [...m.values()];
}

function sessionInWindow(from: Date, to: Date) {
  return or(
    and(gte(examSessions.startedAt, from), lte(examSessions.startedAt, to)),
    LIVE_SESSION_SQL,
  )!;
}

interface LiveOpsScope {
  institutionId: string;
  branchId: string | null;
  /** One or more batch ids. The dashboard groups same-named batches
   *  across branches into a single option ("SR MPC"), so a batch filter
   *  is naturally a SET, not one id. */
  batchIds: string[];
  section: string | null;
  from: Date;
  to: Date;
}

// Shared scope resolution for both live-ops routes. Returns a 403-shaped
// string when the requested branch isn't in the caller's institution, or
// when a branch-scoped caller has no branch at all.
async function resolveLiveOpsScope(c: any): Promise<LiveOpsScope | { forbidden: string }> {
  const user = c.get("user");
  const crossBranch = CROSS_BRANCH_ROLES.has(user.role);

  // Fail closed. `lockedBranchId ?? query.branchId` would otherwise let a
  // branch-scoped account with a null branch_id read — and unblock —
  // every branch in the institution.
  if (!crossBranch && !user.branchId) {
    return { forbidden: "No branch is assigned to your account" };
  }

  const lockedBranchId = crossBranch ? null : user.branchId;
  const branchId = lockedBranchId ?? (c.req.query("branchId") || null);

  if (branchId) {
    const [row] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.institutionId, user.institutionId)))
      .limit(1);
    if (!row) return { forbidden: "Branch does not belong to your institution" };
  }

  // Default window = today so far. The board is an operations view; "all
  // time" is meaningless for "who is writing right now".
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return {
    institutionId: user.institutionId,
    branchId,
    batchIds: (c.req.query("batchId") || "")
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean),
    section: c.req.query("section")?.trim() || null,
    from: parseOptionalISODate(c.req.query("from")) ?? startOfToday,
    to: parseOptionalISODate(c.req.query("to")) ?? new Date(),
  };
}

// Roster predicates shared by the session / submission scans. Branch scope
// follows the STUDENT's branch, never exams.branch_id — multi-branch exams
// (most OMR weeklies) carry NULL there and would vanish from every count.
function rosterConds(scope: LiveOpsScope) {
  return [
    ...(scope.branchId ? [eq(users.branchId, scope.branchId)] : []),
    ...(scope.batchIds.length ? [inArray(students.batchId, scope.batchIds)] : []),
    ...(scope.section ? [eq(students.section, scope.section)] : []),
  ];
}

// ── GET /institution/live-ops ─────────────────────────────────────
analytics.get(
  "/institution/live-ops",
  requireRole(...LIVE_OPS_ROLES),
  async (c) => {
    try {
      const scope = await resolveLiveOpsScope(c);
      if ("forbidden" in scope) {
        return c.json(error("FORBIDDEN", scope.forbidden, 403), 403);
      }
      const { institutionId, from, to } = scope;
      const roster = rosterConds(scope);

      // Sparklines always span this many days ending at the window's end,
      // independent of the selected range — see the trend queries below.
      const TREND_DAYS = 14;
      const trendFrom = new Date(to.getTime() - (TREND_DAYS - 1) * 86_400_000);
      trendFrom.setHours(0, 0, 0, 0);

      const examGuard = and(
        eq(exams.institutionId, institutionId),
        isNull(exams.deletedAt),
        examCategoryIs("exam"),
      );

      // Sessions of exams in scope — live and blocked both read
      // this table, so they share one join shape.
      //
      // Sessions are windowed too, or "Flagged" on a Today view would
      // report every focus-loss the institution has ever recorded. A
      // session counts when it STARTED in the window, or when it is still
      // live right now — the second clause keeps an exam that ran past
      // midnight visible on today's board.
      const sessionScope = and(
        examGuard,
        ...roster,
        sessionInWindow(from, to),
      );
      // Submissions in the selected window. Absent markers carry a NULL
      // submittedAt and a marked_absent_at instead, so the two counts read
      // different columns over the same rows.
      const submissionScope = and(examGuard, ...roster);
      const inWindow = (col: any) => and(gte(col, from), lte(col, to));

      const [
        [liveAgg],
        [subAgg],
        [presenceAgg],
        [doubtAgg],
        scheduledExams,
        onlineTrendRaw,
        doubtTrendRaw,
        errorTrendRaw,
        [activeAgg],
        sessionRollup,
        submissionRollup,
      ] = await Promise.all([
        // Live / blocked — one scan of exam_sessions.
        db
          .select({
            liveStudents: sql<number>`count(distinct ${examSessions.studentId}) filter (where ${LIVE_SESSION_SQL})::int`,
            liveExams: sql<number>`count(distinct ${examSessions.examId}) filter (where ${LIVE_SESSION_SQL})::int`,
            blocked: sql<number>`count(distinct ${examSessions.studentId}) filter (where ${examSessions.blockedAt} is not null)::int`,
          })
          .from(examSessions)
          .innerJoin(exams, eq(exams.id, examSessions.examId))
          .innerJoin(students, eq(students.userId, examSessions.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .where(sessionScope),
        // Submitted / absent / OMR / error-analysis — one scan of
        // exam_submissions over the selected window.
        db
          .select({
            // PAPERS, not distinct students. Over a 30-day window a
            // distinct-student count is close to meaningless: a student who
            // sat four papers and missed one lands in BOTH submitted and
            // absent, the two overlap, they sum to nothing, and both drift
            // toward the whole roll as the window widens — which is why
            // "absent" could read higher than "submitted". Counting events
            // keeps the strip additive and in the same unit as the per-exam
            // rows below.
            submissions: sql<number>`count(*) filter (where ${inWindow(examSubmissions.submittedAt)})::int`,
            absent: sql<number>`count(*) filter (where ${inWindow(examSubmissions.markedAbsentAt)})::int`,
            omrSubmissions: sql<number>`count(*) filter (where ${inWindow(examSubmissions.submittedAt)} and ${examSubmissions.examMode} = 'offline')::int`,
            errorAnalysisStudents: sql<number>`count(distinct ${examSubmissions.studentId}) filter (where ${inWindow(examSubmissions.errorAnalysisCompletedAt)})::int`,
          })
          .from(examSubmissions)
          .innerJoin(exams, eq(exams.id, examSubmissions.examId))
          .innerJoin(students, eq(students.userId, examSubmissions.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .where(submissionScope),
        // App presence — device_presence carries its own tenant snapshot,
        // so it needs no users join. 75s ≈ 2.5 missed 30s beats, matching
        // GET /presence/summary. Counts BOTH the student PWA and the
        // mobile app: they share the heartbeat.
        // From PRESENCE_REDIS=read onward this counter comes from the Redis
        // online set the heartbeat maintains (device_presence.last_seen_at
        // goes up to 5 minutes stale in the write phase, far outside this
        // 75-second window). Same tenant/branch scoping, same shape.
        ["read", "write"].includes(presenceRedisPhase())
          ? countStudentsOnline(institutionId, scope.branchId ?? null)
              .then((n) => [{ studentsOnline: n }])
              .catch(() => [{ studentsOnline: 0 }])
          : db
              .select({
                studentsOnline: sql<number>`count(distinct ${devicePresence.userId}) filter (
                  where ${devicePresence.lastSeenAt} >= now() - interval '75 seconds'
                  and ${devicePresence.userId} is not null)::int`,
              })
              .from(devicePresence)
              .where(
                and(
                  eq(devicePresence.institutionId, institutionId),
                  ...(scope.branchId ? [eq(devicePresence.branchId, scope.branchId)] : []),
                ),
              ),
        // Doubts raised in the window. `abandoned` rows are dropped — the
        // doubt-analytics endpoints exclude them from every engagement KPI
        // and this number has to agree with that page.
        db
          .select({
            doubtCount: sql<number>`count(*)::int`,
            doubtStudents: sql<number>`count(distinct ${doubts.studentId})::int`,
          })
          .from(doubts)
          .innerJoin(students, eq(students.userId, doubts.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .where(
            and(
              eq(users.institutionId, institutionId),
              ne(doubts.status, "abandoned"),
              gte(doubts.createdAt, from),
              lte(doubts.createdAt, to),
              ...roster,
            ),
          ),
        // Exams SCHEDULED in the window, whatever their activity. Without
        // this the board only knows about exams somebody has already
        // opened or submitted — so at 8am, before the 1pm paper starts,
        // "today's exams" renders empty and the board looks broken. This
        // is the source that answers "what is running today"; the two
        // rollups below only add counts to it.
        //
        // Branch scope can't go through the student roster here (there
        // may be no submissions yet), so it uses the exam's own branch,
        // falling back to its assigned batches for multi-branch exams
        // where exams.branch_id is NULL — same shape as exam-insights.
        db
          .select({
            examId: exams.id,
            title: exams.title,
            examType: exams.examType,
            scheduledStart: exams.scheduledStart,
            scheduledEnd: exams.scheduledEnd,
            batchNames: sql<
              string[] | null
            >`(select array_agg(distinct b.name) from ${batches} b
                 where b.id::text = any(${exams.assignedBatches}))`,
            branchNames: sql<
              string[] | null
            >`(select array_agg(distinct br.name) from ${batches} b
                 join ${branches} br on br.id = b.branch_id
                where b.id::text = any(${exams.assignedBatches}))`,
          })
          .from(exams)
          .where(
            and(
              eq(exams.institutionId, institutionId),
              isNull(exams.deletedAt),
              examCategoryIs("exam"),
              // OVERLAP, not "starts today". Long windows are normal here —
              // a weekly test routinely opens 1pm one day and closes noon the
              // next, so filtering on scheduled_start alone drops every exam
              // that is still open today but began yesterday, which is
              // exactly the set an invigilator most needs to see.
              // COALESCE covers exams with no recorded end.
              lte(exams.scheduledStart, to),
              // ISO string + explicit cast: a raw `sql` fragment binds a JS
              // Date as text and postgres-js rejects it (the drizzle
              // gte/lte helpers above do the conversion themselves).
              sql`coalesce(${exams.scheduledEnd}, ${exams.scheduledStart}) >= ${from.toISOString()}::timestamptz`,
              ...(scope.branchId
                ? [
                    or(
                      eq(exams.branchId, scope.branchId),
                      and(
                        isNull(exams.branchId),
                        sql`exists (select 1 from ${batches} b
                                     where b.id::text = any(${exams.assignedBatches})
                                       and b.branch_id = ${scope.branchId})`,
                      ),
                    )!,
                  ]
                : []),
              ...(scope.batchIds.length
                ? [sql`${exams.assignedBatches} && ${sql.param(scope.batchIds)}::text[]`]
                : []),
            ),
          )
          .orderBy(desc(exams.scheduledStart))
          .limit(50),
        // ── Sparkline series for the engagement tiles ───────────
        // Always the last TREND_DAYS days ending at the window's end,
        // regardless of the selected range: a one-point line for "Today"
        // would be useless, and the point of these is trend, not the
        // window total (which the headline number already gives).
        // Bucketed in the DB's timezone; gaps are filled client-side.
        db.execute(sql`
          select date_trunc('day', ps.started_at)::date as d,
                 count(distinct ps.user_id)::int as n
            from ${presenceSessions} ps
            join ${students} st on st.user_id = ps.user_id
            ${scope.branchId ? sql`join ${users} pu on pu.id = st.user_id and pu.branch_id = ${scope.branchId}` : sql``}
           where ps.institution_id = ${institutionId}
             and ps.started_at >= ${trendFrom.toISOString()}::timestamptz
             and ps.started_at <= ${to.toISOString()}::timestamptz
             ${scope.batchIds.length ? sql`and st.batch_id = any(${sql.param(scope.batchIds)}::uuid[])` : sql``}
             ${scope.section ? sql`and st.section = ${scope.section}` : sql``}
           group by 1 order by 1
        `),
        db.execute(sql`
          select date_trunc('day', d.created_at)::date as d,
                 count(*)::int as n
            from ${doubts} d
            join ${students} st on st.user_id = d.student_id
            join ${users} u on u.id = st.user_id
           where u.institution_id = ${institutionId}
             and d.status <> 'abandoned'
             and d.created_at >= ${trendFrom.toISOString()}::timestamptz
             and d.created_at <= ${to.toISOString()}::timestamptz
             ${scope.branchId ? sql`and u.branch_id = ${scope.branchId}` : sql``}
             ${scope.batchIds.length ? sql`and st.batch_id = any(${sql.param(scope.batchIds)}::uuid[])` : sql``}
             ${scope.section ? sql`and st.section = ${scope.section}` : sql``}
           group by 1 order by 1
        `),
        db.execute(sql`
          select date_trunc('day', sub.error_analysis_completed_at)::date as d,
                 count(distinct sub.student_id)::int as n
            from ${examSubmissions} sub
            join ${exams} e on e.id = sub.exam_id
            join ${students} st on st.user_id = sub.student_id
            join ${users} u on u.id = st.user_id
           where e.institution_id = ${institutionId}
             and e.deleted_at is null
             and sub.error_analysis_completed_at >= ${trendFrom.toISOString()}::timestamptz
             and sub.error_analysis_completed_at <= ${to.toISOString()}::timestamptz
             ${scope.branchId ? sql`and u.branch_id = ${scope.branchId}` : sql``}
             ${scope.batchIds.length ? sql`and st.batch_id = any(${sql.param(scope.batchIds)}::uuid[])` : sql``}
             ${scope.section ? sql`and st.section = ${scope.section}` : sql``}
           group by 1 order by 1
        `),
        // Distinct students who signed in at any point during the window.
        // The live 75-second count is meaningless on a 30-day range — it
        // never moves, because it always means "right now".
        db
          .select({ n: sql<number>`count(distinct ${presenceSessions.userId})::int` })
          .from(presenceSessions)
          .innerJoin(students, eq(students.userId, presenceSessions.userId))
          .innerJoin(users, eq(users.id, students.userId))
          .where(
            and(
              eq(presenceSessions.institutionId, institutionId),
              gte(presenceSessions.startedAt, from),
              lte(presenceSessions.startedAt, to),
              ...roster,
            ),
          ),
        // Per-exam session rollup (live / blocked).
        db
          .select({
            examId: exams.id,
            title: exams.title,
            examType: exams.examType,
            scheduledStart: exams.scheduledStart,
            scheduledEnd: exams.scheduledEnd,
            branchNames: sql<
              string[] | null
            >`array_agg(distinct ${branches.name}) filter (where ${branches.name} is not null)`,
            batchNames: sql<
              string[] | null
            >`array_agg(distinct ${batches.name}) filter (where ${batches.name} is not null)`,
            live: sql<number>`count(distinct ${examSessions.studentId}) filter (where ${LIVE_SESSION_SQL})::int`,
            blocked: sql<number>`count(distinct ${examSessions.studentId}) filter (where ${examSessions.blockedAt} is not null)::int`,
          })
          .from(examSessions)
          .innerJoin(exams, eq(exams.id, examSessions.examId))
          .innerJoin(students, eq(students.userId, examSessions.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .leftJoin(branches, eq(branches.id, users.branchId))
          .leftJoin(batches, eq(batches.id, students.batchId))
          .where(sessionScope)
          .groupBy(exams.id, exams.title, exams.examType, exams.scheduledStart, exams.scheduledEnd)
          .limit(50),
        // Per-exam submission rollup (submitted / absent / OMR) over the
        // window. Kept separate from the session rollup rather than joined:
        // an exam can appear in one and not the other (a just-started exam
        // has no submissions; a fully-scanned OMR exam has no sessions), and
        // joining the two would multiply rows. Merged in JS below.
        db
          .select({
            examId: exams.id,
            title: exams.title,
            examType: exams.examType,
            scheduledStart: exams.scheduledStart,
            scheduledEnd: exams.scheduledEnd,
            branchNames: sql<
              string[] | null
            >`array_agg(distinct ${branches.name}) filter (where ${branches.name} is not null)`,
            batchNames: sql<
              string[] | null
            >`array_agg(distinct ${batches.name}) filter (where ${batches.name} is not null)`,
            submitted: sql<number>`count(distinct ${examSubmissions.studentId}) filter (where ${inWindow(examSubmissions.submittedAt)})::int`,
            absent: sql<number>`count(distinct ${examSubmissions.studentId}) filter (where ${inWindow(examSubmissions.markedAbsentAt)})::int`,
            omr: sql<number>`count(distinct ${examSubmissions.studentId}) filter (where ${inWindow(examSubmissions.submittedAt)} and ${examSubmissions.examMode} = 'offline')::int`,
          })
          .from(examSubmissions)
          .innerJoin(exams, eq(exams.id, examSubmissions.examId))
          .innerJoin(students, eq(students.userId, examSubmissions.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .leftJoin(branches, eq(branches.id, users.branchId))
          .leftJoin(batches, eq(batches.id, students.batchId))
          .where(
            and(
              submissionScope,
              // Only exams that actually saw activity in the window — the
              // aggregate below would otherwise return an all-zero row for
              // every exam the institution has ever run.
              or(
                inWindow(examSubmissions.submittedAt),
                inWindow(examSubmissions.markedAbsentAt),
              ),
            ),
          )
          .groupBy(exams.id, exams.title, exams.examType, exams.scheduledStart, exams.scheduledEnd)
          .limit(50),
      ]);

      // Merge the scheduled list and the two rollups by exam id. Any of
      // the three may be missing an exam: one scheduled for later today
      // has no rollups, and an OMR batch scanned today may belong to an
      // exam scheduled last week.
      const merged = new Map<string, any>();
      const seed = (r: any) => {
        const existing = merged.get(r.examId);
        if (existing) return existing;
        const row = {
          id: r.examId,
          title: r.title,
          examType: r.examType,
          scheduledStart: r.scheduledStart,
          scheduledEnd: r.scheduledEnd,
          branch: (r.branchNames ?? []).join(", ") || "—",
          batches: (r.batchNames ?? []) as string[],
          live: 0,
          submitted: 0,
          absent: 0,
          blocked: 0,
          omr: 0,
          expected: 0,
          pending: 0,
          inProgress: 0,
        };
        merged.set(r.examId, row);
        return row;
      };
      // Scheduled first, so an exam with no activity yet still gets a row.
      for (const r of scheduledExams as any[]) seed(r);
      for (const r of sessionRollup as any[]) {
        const row = seed(r);
        row.live = Number(r.live ?? 0);
        row.blocked = Number(r.blocked ?? 0);
      }
      for (const r of submissionRollup as any[]) {
        const row = seed(r);
        row.submitted = Number(r.submitted ?? 0);
        row.absent = Number(r.absent ?? 0);
        row.omr = Number(r.omr ?? 0);
        // The submission side knows about batches the session side didn't
        // (OMR-only takers), so union the label lists.
        row.batches = [...new Set([...row.batches, ...((r.batchNames ?? []) as string[])])];
        if (row.branch === "—" && (r.branchNames ?? []).length) {
          row.branch = (r.branchNames as string[]).join(", ");
        }
      }
      // Days with no rows simply don't come back from the GROUP BY, so fill
      // the gaps — a sparkline that skips empty days misreads a quiet
      // weekend as a flat line instead of a dip.
      const toSeries = (raw: unknown): Array<{ d: string; n: number }> => {
        const rows = (Array.isArray(raw) ? raw : (raw as { rows?: unknown[] })?.rows ?? []) as Array<{
          d: string | Date;
          n: number;
        }>;
        const byDay = new Map(
          rows.map((r) => [new Date(r.d).toISOString().slice(0, 10), Number(r.n)]),
        );
        const out: Array<{ d: string; n: number }> = [];
        for (let i = 0; i < TREND_DAYS; i++) {
          const day = new Date(trendFrom.getTime() + i * 86_400_000).toISOString().slice(0, 10);
          out.push({ d: day, n: byDay.get(day) ?? 0 });
        }
        return out;
      };

      // Status is derived server-side so the board, and anything else that
      // consumes this, agree on what "upcoming" means.
      const nowMs = Date.now();
      for (const row of merged.values()) {
        const startMs = row.scheduledStart ? new Date(row.scheduledStart).getTime() : null;
        const endMs = row.scheduledEnd ? new Date(row.scheduledEnd).getTime() : null;
        row.status =
          row.live > 0
            ? "live"
            : startMs !== null && startMs > nowMs
              ? "upcoming"
              : endMs !== null && endMs < nowMs
                ? "ended"
                : "open";
      }

      // Live first, then upcoming (soonest first), then everything else
      // newest-first — the order an invigilator reads the floor in.
      const STATUS_ORDER: Record<string, number> = { live: 0, upcoming: 1, open: 2, ended: 3 };
      const examList = [...merged.values()]
        .sort((a, b) => {
          const byStatus = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
          if (byStatus !== 0) return byStatus;
          const aStart = new Date(a.scheduledStart ?? 0).getTime();
          const bStart = new Date(b.scheduledStart ?? 0).getTime();
          // Upcoming reads soonest-first (what starts next); everything
          // else reads newest-first (what just happened).
          if (a.status === "upcoming") return aStart - bStart;
          return b.live - a.live || bStart - aStart;
        })
        .slice(0, 30);

      // Per-exam counts describe THE EXAM, not the calendar window.
      // The rollups above are time-filtered because they double as the
      // discovery queries, but that makes a midnight-spanning exam read
      // "0 submitted" on the day it closes — its submissions landed the
      // previous afternoon. So re-count the exams that made the list over
      // their own lifetime. The totals strip stays window-scoped: it
      // answers "what happened today", which is a different question.
      if (examList.length > 0) {
        const ids = examList.map((e) => e.id);
        const perExamTotals = await db
          .select({
            examId: examSubmissions.examId,
            submitted: sql<number>`count(distinct ${examSubmissions.studentId}) filter (where ${examSubmissions.submittedAt} is not null)::int`,
            absent: sql<number>`count(distinct ${examSubmissions.studentId}) filter (where ${examSubmissions.markedAbsentAt} is not null)::int`,
            omr: sql<number>`count(distinct ${examSubmissions.studentId}) filter (where ${examSubmissions.submittedAt} is not null and ${examSubmissions.examMode} = 'offline')::int`,
          })
          .from(examSubmissions)
          .innerJoin(students, eq(students.userId, examSubmissions.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .where(and(inArray(examSubmissions.examId, ids), ...roster))
          .groupBy(examSubmissions.examId);

        const byExam = new Map(perExamTotals.map((r) => [r.examId, r]));
        for (const row of examList) {
          const totals = byExam.get(row.id);
          row.submitted = Number(totals?.submitted ?? 0);
          row.absent = Number(totals?.absent ?? 0);
          row.omr = Number(totals?.omr ?? 0);
        }

        // ── Expected roster → pending ────────────────────────────
        // "Pending" = expected to sit this exam, but has neither submitted
        // nor been marked absent. The expected set comes from
        // resolveExamAudience (@brilliance/exam-schedule) — the same
        // canonical roster GET /exams/:id/roster serves, so the board and
        // the monitor can no longer disagree on the same exam. This used
        // to be a hand-copied twin of that endpoint's union, which is
        // exactly how the two drift apart. The resolver is a PRIORITY
        // cascade (a non-empty assignedStudents list means batches are
        // never consulted) ∪ slot-matched students, so an exam carrying
        // both a student list and batches no longer over-counts; slot exams
        // then get the same narrowing that endpoint applies (below). An
        // "open" exam (no list, no batches, no distributions) resolves to
        // null and stays un-enumerated — the old union yielded nothing for
        // it either. Anyone who actually started or submitted is still
        // unioned on top: the safety valve for a student who sat the paper
        // without being on the roster.
        const examRosters = await Promise.all(
          ids.map(async (examId) => {
            const [audience, slots] = await Promise.all([
              resolveExamAudience(examId),
              loadExamSlots(examId),
            ]);
            return { examId, slots, studentIds: audience.studentIds ?? [] };
          }),
        );

        // Slots supersede the legacy tier here, exactly as GET
        // /exams/:id/roster does — the two MUST agree. Reason:
        // syncExamAudienceFromSchedules materializes a slot audience into
        // assigned_batches as WHOLE batches, so on a section-level schedule
        // the resolver's batch tier drags in batch-mates who never got a
        // slot (and therefore never get an attempt window). Once ANY slot
        // exists the expected set narrows to slot-matched ∪ explicitly-named
        // students — what the old CTE's `NOT EXISTS (exam_schedules)` guards
        // did. The session/submission union below remains the safety valve
        // for anyone who actually attempted.
        const slotExamIds = examRosters.filter((r) => r.slots.length > 0).map((r) => r.examId);
        if (slotExamIds.length > 0) {
          const namedByExam = new Map(
            (
              await db
                .select({ id: exams.id, assignedStudents: exams.assignedStudents })
                .from(exams)
                .where(inArray(exams.id, slotExamIds))
            ).map((r) => [r.id, new Set(r.assignedStudents ?? [])] as const),
          );
          // One profile lookup for every candidate across every slot exam.
          const profiles = await loadStudentProfiles([
            ...new Set(
              examRosters.flatMap((r) => (r.slots.length > 0 ? r.studentIds : [])),
            ),
          ]);
          const noProfile = { branchId: null, batchId: null, section: null };
          for (const r of examRosters) {
            if (r.slots.length === 0) continue;
            const named = namedByExam.get(r.examId) ?? new Set<string>();
            r.studentIds = r.studentIds.filter(
              (sid) =>
                // `sid` is the student's user id — without it
                // student-targeted rows are invisible and a postponed
                // student would drop out of the expected set.
                named.has(sid) || !!pickBestSlot(r.slots, profiles.get(sid) ?? noProfile, sid),
            );
          }
        }

        // Flattened (exam_id, student_id) pairs — one unnest instead of a
        // per-exam array parameter.
        const rosterExamIds = examRosters.flatMap((r) => r.studentIds.map(() => r.examId));
        const rosterStudentIds = examRosters.flatMap((r) => r.studentIds);
        const expectedRows = (await db.execute(sql`
          select e.id as exam_id,
                 count(*)::int as expected,
                 -- Students who have OPENED the paper but not finished.
                 -- Matches the Live Monitor's "In Progress": any session
                 -- with no submitted_at, WITHOUT a heartbeat-freshness
                 -- filter. The board's "writing now" is heartbeat-based
                 -- and is deliberately a different, smaller number.
                 count(*) filter (
                   where exists (
                     select 1 from exam_sessions es2
                      where es2.exam_id = e.id
                        and es2.student_id = x.student_id
                        and es2.submitted_at is null
                   )
                   and not exists (
                     select 1 from exam_submissions sub
                      where sub.exam_id = e.id
                        and sub.student_id = x.student_id
                        and (sub.submitted_at is not null or sub.marked_absent_at is not null)
                   )
                 )::int as in_progress,
                 -- NOT STARTED: no submission, no absence marker, and no
                 -- session at all. Previously this omitted the session
                 -- check, so every student mid-exam was counted as pending
                 -- as well as writing — the bar segments summed past the
                 -- roster (786 writing + 1370 pending on a 1370 roster).
                 count(*) filter (
                   where not exists (
                     select 1 from exam_sessions es3
                      where es3.exam_id = e.id
                        and es3.student_id = x.student_id
                   )
                   and not exists (
                     select 1 from exam_submissions sub
                      where sub.exam_id = e.id
                        and sub.student_id = x.student_id
                        and (sub.submitted_at is not null or sub.marked_absent_at is not null)
                   )
                 )::int as pending
            from ${exams} e
            cross join lateral (
              select distinct student_id from (
                select r.student_id
                  from unnest(
                         ${sql.param(rosterExamIds)}::uuid[],
                         ${sql.param(rosterStudentIds)}::uuid[]
                       ) as r(exam_id, student_id)
                 where r.exam_id = e.id
                union
                select sess.student_id from exam_sessions sess where sess.exam_id = e.id
                union
                select sub.student_id from exam_submissions sub where sub.exam_id = e.id
              ) u
              where student_id is not null
            ) x
            join students rs on rs.user_id = x.student_id
            join users ru on ru.id = rs.user_id
           where e.id = any(${sql.param(ids)}::uuid[])
             ${scope.branchId ? sql`and ru.branch_id = ${scope.branchId}` : sql``}
             ${scope.batchIds.length ? sql`and rs.batch_id = any(${sql.param(scope.batchIds)}::uuid[])` : sql``}
             ${scope.section ? sql`and rs.section = ${scope.section}` : sql``}
           group by e.id
        `)) as any[];

        const expectedByExam = new Map(
          (Array.isArray(expectedRows) ? expectedRows : (expectedRows as any).rows ?? []).map(
            (r: any) => [r.exam_id, r],
          ),
        );
        for (const row of examList) {
          const exp = expectedByExam.get(row.id) as any;
          row.expected = Number(exp?.expected ?? 0);
          row.pending = Number(exp?.pending ?? 0);
          row.inProgress = Number(exp?.in_progress ?? 0);
        }
      }

      return c.json(
        success({
          window: { from: from.toISOString(), to: to.toISOString() },
          scope: { branchId: scope.branchId, batchIds: scope.batchIds, section: scope.section },
          totals: {
            liveExams: Number(liveAgg?.liveExams ?? 0),
            // Exams scheduled in the window regardless of activity — the
            // "how many papers today" number. liveExams is the subset
            // with someone actually writing right now.
            scheduledExams: (scheduledExams as any[]).length,
            liveStudents: Number(liveAgg?.liveStudents ?? 0),
            blocked: Number(liveAgg?.blocked ?? 0),
            submissions: Number(subAgg?.submissions ?? 0),
            absent: Number(subAgg?.absent ?? 0),
            omrSubmissions: Number(subAgg?.omrSubmissions ?? 0),
            errorAnalysisStudents: Number(subAgg?.errorAnalysisStudents ?? 0),
            studentsOnline: Number(presenceAgg?.studentsOnline ?? 0),
            doubtCount: Number(doubtAgg?.doubtCount ?? 0),
            doubtStudents: Number(doubtAgg?.doubtStudents ?? 0),
            // Distinct students who signed in during the window — the
            // range-aware counterpart to the live studentsOnline count.
            studentsActive: Number(activeAgg?.n ?? 0),
          },
          trend: {
            days: TREND_DAYS,
            studentsOnline: toSeries(onlineTrendRaw),
            doubts: toSeries(doubtTrendRaw),
            errorAnalysis: toSeries(errorTrendRaw),
          },
          exams: examList,
        }),
      );
    } catch (err) {
      console.error("[Analytics] Institution live-ops error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to load live ops board", 500), 500);
    }
  },
);

// ── GET /institution/blocked-students ─────────────────────────────
// Every currently-blocked student across every exam in scope, for the
// dashboard's "view all blocked students" modal. Per-exam block state is
// already visible on /exams/:id/monitor; this is the cross-exam view an
// invigilation lead needs when three exams run at once.
//
// Paginated server-side, and it returns its own filter vocabulary
// (branches / batches / sections present in the blocked set) so the modal
// needs exactly one request per view.
analytics.get(
  "/institution/blocked-students",
  requireRole(...LIVE_OPS_ROLES),
  async (c) => {
    try {
      const scope = await resolveLiveOpsScope(c);
      if ("forbidden" in scope) {
        return c.json(error("FORBIDDEN", scope.forbidden, 403), 403);
      }
      const roster = rosterConds(scope);
      const examIdFilter = c.req.query("examId") || null;
      const q = c.req.query("q")?.trim().toLowerCase() || null;
      const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "25", 10) || 25));

      // Must mirror the live-ops board's `blocked` count exactly — the
      // board's number is a button that opens this list, and a count that
      // doesn't match its own list destroys trust in both. Hence the same
      // category guard and the same session window.
      const blockedGuard = and(
        eq(exams.institutionId, scope.institutionId),
        isNull(exams.deletedAt),
        examCategoryIs("exam"),
        isNotNull(examSessions.blockedAt),
        sessionInWindow(scope.from, scope.to),
      );

      const where = and(
        blockedGuard,
        ...(examIdFilter ? [eq(examSessions.examId, examIdFilter)] : []),
        ...(q
          ? [sql`(lower(${users.name}) like ${`%${q}%`} or lower(coalesce(${students.rollNumber}, '')) like ${`%${q}%`})`]
          : []),
        ...roster,
      );

      const base = db
        .select({
          sessionId: examSessions.id,
          examId: exams.id,
          examTitle: exams.title,
          studentId: examSessions.studentId,
          studentName: users.name,
          rollNo: students.rollNumber,
          branchId: users.branchId,
          branchName: branches.name,
          batchId: students.batchId,
          batchName: batches.name,
          section: students.section,
          blockedAt: examSessions.blockedAt,
          blockedReason: examSessions.blockedReason,
          blockCount: examSessions.blockCount,
          tabSwitchCount: examSessions.tabSwitchCount,
          windowBlurCount: examSessions.windowBlurCount,
          fullscreenExitCount: examSessions.fullscreenExitCount,
          lastHeartbeat: examSessions.lastHeartbeat,
          submittedAt: examSessions.submittedAt,
          lastScreenshotKey: examSessions.lastScreenshotKey,
          lastScreenshotAt: examSessions.lastScreenshotAt,
        })
        .from(examSessions)
        .innerJoin(exams, eq(exams.id, examSessions.examId))
        .innerJoin(students, eq(students.userId, examSessions.studentId))
        .innerJoin(users, eq(users.id, students.userId))
        .leftJoin(branches, eq(branches.id, users.branchId))
        .leftJoin(batches, eq(batches.id, students.batchId));

      const [rows, [totalRow], facets] = await Promise.all([
        base
          .where(where)
          .orderBy(desc(examSessions.blockedAt))
          .limit(limit)
          .offset((page - 1) * limit),
        // Two totals, because they answer different questions. `n` is the
        // row/session count that drives pagination; `students` is the
        // distinct-student count the board's Blocked tile shows — one
        // student blocked in two exams is one blocked student but two
        // sessions to release.
        db
          .select({
            n: sql<number>`count(*)::int`,
            students: sql<number>`count(distinct ${examSessions.studentId})::int`,
          })
          .from(examSessions)
          .innerJoin(exams, eq(exams.id, examSessions.examId))
          .innerJoin(students, eq(students.userId, examSessions.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .where(where),
        // Filter vocabulary over the WHOLE blocked set (ignoring the
        // branch/batch/section/search the user has already picked), so
        // narrowing to one batch doesn't erase the other options.
        db
          .select({
            branchId: users.branchId,
            branchName: branches.name,
            batchId: students.batchId,
            batchName: batches.name,
            section: students.section,
            examId: exams.id,
            examTitle: exams.title,
          })
          .from(examSessions)
          .innerJoin(exams, eq(exams.id, examSessions.examId))
          .innerJoin(students, eq(students.userId, examSessions.studentId))
          .innerJoin(users, eq(users.id, students.userId))
          .leftJoin(branches, eq(branches.id, users.branchId))
          .leftJoin(batches, eq(batches.id, students.batchId))
          .where(
            and(
              blockedGuard,
              // Branch lock still applies to the facets — a branch-scoped
              // caller must never learn another branch's batch names.
              ...(scope.branchId ? [eq(users.branchId, scope.branchId)] : []),
            ),
          ),
      ]);

      // Sign the latest screenshot for THIS page only — a signed URL per
      // row of a 2,000-row blocked set would be pure waste.
      const signed = await Promise.all(
        rows.map(async (r) => {
          if (!r.lastScreenshotKey) return null;
          try {
            return await generateDownloadUrl(r.lastScreenshotKey);
          } catch {
            return null;
          }
        }),
      );

      return c.json(
        success({
          rows: rows.map((r, i) => ({
            sessionId: r.sessionId,
            examId: r.examId,
            examTitle: r.examTitle,
            studentId: r.studentId,
            studentName: r.studentName,
            rollNo: r.rollNo,
            branchId: r.branchId,
            branchName: r.branchName ?? "—",
            batchId: r.batchId,
            batchName: r.batchName ?? "Unassigned",
            section: r.section?.trim() || "Unassigned",
            blockedAt: r.blockedAt,
            blockedReason: r.blockedReason,
            blockCount: r.blockCount ?? 0,
            flags:
              (r.tabSwitchCount ?? 0) + (r.windowBlurCount ?? 0) + (r.fullscreenExitCount ?? 0),
            lastHeartbeat: r.lastHeartbeat,
            // A blocked student who already submitted can't be "released"
            // back into the exam — the UI greys the row's action.
            submitted: !!r.submittedAt,
            screenshotAt: r.lastScreenshotAt,
            screenshotUrl: signed[i] ?? null,
          })),
          total: Number(totalRow?.n ?? 0),
          totalStudents: Number(totalRow?.students ?? 0),
          page,
          limit,
          filters: {
            branches: uniqById(facets.map((f) => ({ id: f.branchId, name: f.branchName ?? "—" }))),
            batches: uniqById(
              facets.map((f) => ({
                id: f.batchId,
                name: f.batchName ?? "Unassigned",
                branchId: f.branchId,
              })),
            ),
            sections: [...new Set(facets.map((f) => f.section?.trim()).filter(Boolean))].sort(),
            exams: uniqById(facets.map((f) => ({ id: f.examId, name: f.examTitle }))),
          },
        }),
      );
    } catch (err) {
      console.error("[Analytics] Institution blocked-students error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to load blocked students", 500), 500);
    }
  },
);

// ── GET /student/:id/blooms-profile — Bloom's Taxonomy Profile (from cache) ─
analytics.get(
  "/student/:id/blooms-profile",
  requireAnyPermission("analytics:self", "analytics:institution", "analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");
    try {
      const [cached] = await db
        .select({ bloomsProfile: studentAnalyticsCache.bloomsProfile })
        .from(studentAnalyticsCache)
        .where(eq(studentAnalyticsCache.studentId, studentId))
        .limit(1);

      if (!cached?.bloomsProfile) {
        rebuildAllAnalytics(studentId).catch((err) =>
          console.error("[Analytics] Background rebuild failed:", err),
        );
        return c.json(success({ overall: {}, bySubject: {}, classAverage: { remember: 0, understand: 0, apply: 0, analyse: 0, evaluate: 0 }, totalQuestions: 0, questionsWithBlooms: 0, _cacheStatus: "rebuilding" }));
      }

      return c.json(success(cached.bloomsProfile));
    } catch (err) {
      console.error("[Analytics] Blooms profile error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute Bloom's profile", 500), 500);
    }
  },
);

// ── GET /student/:id/velocity — Learning Velocity & Coverage (from cache) ───
analytics.get(
  "/student/:id/velocity",
  requireAnyPermission("analytics:self", "analytics:institution", "analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");
    try {
      const [cached] = await db
        .select({ velocity: studentAnalyticsCache.velocity })
        .from(studentAnalyticsCache)
        .where(eq(studentAnalyticsCache.studentId, studentId))
        .limit(1);

      if (!cached?.velocity) {
        rebuildAllAnalytics(studentId).catch((err) =>
          console.error("[Analytics] Background rebuild failed:", err),
        );
        return c.json(success({ examDate: null, daysRemaining: 0, topicsCovered: 0, totalTopics: 0, coveragePercent: 0, currentVelocity: 0, requiredVelocity: 0, projectedCoverage: 0, bySubject: [], _cacheStatus: "rebuilding" }));
      }

      return c.json(success(cached.velocity));
    } catch (err) {
      console.error("[Analytics] Velocity error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute velocity", 500), 500);
    }
  },
);

// ── GET /student/:id/priority-queue — Smart Priority Actions (from cache) ───
analytics.get(
  "/student/:id/priority-queue",
  requireAnyPermission("analytics:self", "analytics:institution", "analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");
    try {
      const [cached] = await db
        .select({ priorityQueue: studentAnalyticsCache.priorityQueue })
        .from(studentAnalyticsCache)
        .where(eq(studentAnalyticsCache.studentId, studentId))
        .limit(1);

      if (!cached?.priorityQueue) {
        rebuildAllAnalytics(studentId).catch((err) =>
          console.error("[Analytics] Background rebuild failed:", err),
        );
        return c.json(success({ actions: [], totalPending: 0, _cacheStatus: "rebuilding" }));
      }

      return c.json(success(cached.priorityQueue));
    } catch (err) {
      console.error("[Analytics] Priority queue error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute priority queue", 500), 500);
    }
  },
);

// ── POST /student/:id/quick-practice — Generate Targeted Mini-test ─
analytics.post(
  "/student/:id/quick-practice",
  requireAnyPermission("analytics:self", "analytics:institution", "analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const questionCount = Math.min(20, Math.max(5, body.count ?? 10));

    try {
      const [student] = await db
        .select({
          batchId: students.batchId,
          targetExam: students.targetExam,
        })
        .from(students)
        .where(eq(students.userId, studentId))
        .limit(1);

      if (!student) {
        return c.json(error("NOT_FOUND", "Student not found", 404), 404);
      }

      const targetExam = student.targetExam ?? "jee_mains";

      // Recently answered question IDs (last 30 days) — to exclude
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentlyAnswered = await db
        .selectDistinct({ questionId: examResponses.questionId })
        .from(examResponses)
        .innerJoin(examSubmissions, eq(examSubmissions.id, examResponses.submissionId))
        .where(
          and(
            eq(examSubmissions.studentId, studentId),
            gte(examSubmissions.submittedAt, thirtyDaysAgo),
          ),
        );

      const recentQIds = new Set(recentlyAnswered.map((r) => r.questionId));

      // 1. Error revision topics (30% of questions)
      const errorTopics = await db
        .select({
          topicId: errorLog.topicId,
          topicName: syllabusTree.name,
        })
        .from(errorLog)
        .innerJoin(syllabusTree, eq(syllabusTree.id, errorLog.topicId))
        .where(
          and(
            eq(errorLog.studentId, studentId),
            ne(errorLog.masteryStatus, "mastered"),
            examOnly(),
          ),
        )
        .groupBy(errorLog.topicId, syllabusTree.name)
        .orderBy(desc(count()))
        .limit(5);

      const errorTopicIds = errorTopics.map((t) => t.topicId);
      const errorTopicNames = errorTopics.map((t) => t.topicName);

      // 2. Weak skill-map topics (40%)
      // Get per-topic accuracy, find the weakest
      const topicAccuracy = await db
        .select({
          syllabusNodeId: questions.syllabusNodeId,
          topicName: syllabusTree.name,
          total: count(),
          correct: sql<number>`count(*) filter (where ${examResponses.isCorrect} = true)`,
        })
        .from(examResponses)
        .innerJoin(examSubmissions, eq(examSubmissions.id, examResponses.submissionId))
        .innerJoin(questions, eq(questions.id, examResponses.questionId))
        .innerJoin(syllabusTree, eq(syllabusTree.id, questions.syllabusNodeId))
        .where(
          and(
            eq(examSubmissions.studentId, studentId),
            isNotNull(questions.syllabusNodeId),
          ),
        )
        .groupBy(questions.syllabusNodeId, syllabusTree.name);

      const weakTopics = topicAccuracy
        .map((t) => ({
          ...t,
          accuracy: Number(t.total) > 0 ? Number(t.correct) / Number(t.total) : 0,
        }))
        .filter((t) => t.accuracy < 0.6)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 5);

      const weakTopicIds = weakTopics.map((t) => t.syllabusNodeId).filter(Boolean) as string[];
      const weakTopicNames = weakTopics.map((t) => t.topicName);

      // Fetch questions from the bank
      const errorCount = Math.ceil(questionCount * 0.3);
      const weakCount = Math.ceil(questionCount * 0.4);
      const bloomsCount = questionCount - errorCount - weakCount;

      const allQuestionIds: string[] = [];

      // Error revision questions
      if (errorTopicIds.length > 0) {
        const errorQs = await db
          .select({ id: questions.id })
          .from(questions)
          .where(
            and(
              inArray(questions.syllabusNodeId, errorTopicIds),
              eq(questions.examType, targetExam),
              eq(questions.status, "published"),
            ),
          )
          .limit(errorCount * 3);
        const filtered = errorQs.filter((q) => !recentQIds.has(q.id));
        allQuestionIds.push(...filtered.slice(0, errorCount).map((q) => q.id));
      }

      // Weak topic questions
      if (weakTopicIds.length > 0) {
        const weakQs = await db
          .select({ id: questions.id })
          .from(questions)
          .where(
            and(
              inArray(questions.syllabusNodeId, weakTopicIds),
              eq(questions.examType, targetExam),
              eq(questions.status, "published"),
            ),
          )
          .limit(weakCount * 3);
        const filtered = weakQs.filter((q) => !recentQIds.has(q.id) && !allQuestionIds.includes(q.id));
        allQuestionIds.push(...filtered.slice(0, weakCount).map((q) => q.id));
      }

      // Bloom's gap questions (analyse/evaluate)
      const bloomsQs = await db
        .select({ id: questions.id })
        .from(questions)
        .where(
          and(
            eq(questions.examType, targetExam),
            eq(questions.status, "published"),
            inArray(questions.bloomsLevel, ["analyse", "evaluate"]),
          ),
        )
        .limit(bloomsCount * 3);
      const bloomsFiltered = bloomsQs.filter(
        (q) => !recentQIds.has(q.id) && !allQuestionIds.includes(q.id),
      );
      allQuestionIds.push(...bloomsFiltered.slice(0, bloomsCount).map((q) => q.id));

      // Fetch full question data
      let questionData: any[] = [];
      if (allQuestionIds.length > 0) {
        questionData = await db
          .select({
            id: questions.id,
            questionTextMd: questions.questionTextMd,
            optionsJson: questions.optionsJson,
            difficulty: questions.difficulty,
            bloomsLevel: questions.bloomsLevel,
            subjectName: subjects.name,
            topicName: syllabusTree.name,
          })
          .from(questions)
          .innerJoin(subjects, eq(subjects.id, questions.subjectId))
          .leftJoin(syllabusTree, eq(syllabusTree.id, questions.syllabusNodeId))
          .where(inArray(questions.id, allQuestionIds));
      }

      return c.json(
        success({
          questions: questionData,
          targeting: {
            weakTopics: [...new Set([...errorTopicNames, ...weakTopicNames])].slice(0, 5),
            bloomsGaps: ["analyse", "evaluate"],
            sources: {
              errorRevision: Math.min(errorCount, allQuestionIds.length),
              weakTopics: weakCount,
              bloomsBoost: bloomsCount,
            },
          },
        }),
      );
    } catch (err) {
      console.error("[Analytics] Quick practice error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to generate quick practice", 500), 500);
    }
  },
);

// ── GET /student/:id/improvement-projection — 2-week Forecast (from cache) ──
analytics.get(
  "/student/:id/improvement-projection",
  requireAnyPermission("analytics:self", "analytics:institution", "analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");
    try {
      const [cached] = await db
        .select({ improvementProjection: studentAnalyticsCache.improvementProjection })
        .from(studentAnalyticsCache)
        .where(eq(studentAnalyticsCache.studentId, studentId))
        .limit(1);

      if (!cached?.improvementProjection) {
        rebuildAllAnalytics(studentId).catch((err) =>
          console.error("[Analytics] Background rebuild failed:", err),
        );
        return c.json(success({ twoWeekProjection: {}, bloomsProjection: {}, projectedPercentile: { current: 0, projected: 0 }, assumptions: "", _cacheStatus: "rebuilding" }));
      }

      return c.json(success(cached.improvementProjection));
    } catch (err) {
      console.error("[Analytics] Improvement projection error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to compute improvement projection", 500), 500);
    }
  },
);

// ── POST /student/:id/rebuild — Force full cache rebuild ────
analytics.post(
  "/student/:id/rebuild",
  requireAnyPermission("analytics:self", "analytics:institution", "analytics:batch"),
  async (c) => {
    const studentId = c.req.param("id");
    try {
      // Verify student exists
      const [student] = await db
        .select({ userId: students.userId })
        .from(students)
        .where(eq(students.userId, studentId))
        .limit(1);

      if (!student) {
        return c.json(error("NOT_FOUND", "Student not found", 404), 404);
      }

      await rebuildAllAnalytics(studentId);

      return c.json(
        success({
          studentId,
          message: "Analytics cache rebuilt successfully",
          rebuiltAt: new Date().toISOString(),
        }),
      );
    } catch (err) {
      console.error("[Analytics] Rebuild error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to rebuild analytics cache", 500), 500);
    }
  },
);

// ── POST /batch/:id/rebuild — Force batch cache refresh ────
analytics.post(
  "/batch/:id/rebuild",
  requirePermission("analytics:batch"),
  async (c) => {
    const batchId = c.req.param("id");
    const user = c.get("user") as { role: string; sub: string };

    try {
      const [batch] = await db
        .select({ id: batches.id, name: batches.name })
        .from(batches)
        .where(eq(batches.id, batchId))
        .limit(1);

      if (!batch) {
        return c.json(error("NOT_FOUND", "Batch not found", 404), 404);
      }

      const denied = await assertFacultyAssignedToBatch(c, user, batchId);
      if (denied) return denied;

      await refreshBatchCache(batchId);

      return c.json(
        success({
          batchId,
          message: "Batch analytics cache rebuilt successfully",
          rebuiltAt: new Date().toISOString(),
        }),
      );
    } catch (err) {
      console.error("[Analytics] Batch rebuild error:", err);
      return c.json(error("INTERNAL_ERROR", "Failed to rebuild batch analytics cache", 500), 500);
    }
  },
);

// ── GET /batch/:id/roster ──────────────────────────────────────
// Lightweight roster list for the student multi-select UI. Returns
// every student assigned to the batch with their userId, name,
// and section. No attempt data — cheap call, cacheable client-side.
analytics.get(
  "/batch/:id/roster",
  requirePermission("analytics:batch"),
  async (c) => {
    const batchId = c.req.param("id");
    const user = c.get("user") as { role: string; sub: string };

    const [batch] = await db
      .select({ id: batches.id })
      .from(batches)
      .where(eq(batches.id, batchId))
      .limit(1);
    if (!batch) return c.json(error("NOT_FOUND", "Batch not found", 404), 404);

    const denied = await assertFacultyAssignedToBatch(c, user, batchId);
    if (denied) return denied;

    const roster = await db
      .select({
        userId: students.userId,
        name: users.name,
        section: students.section,
      })
      .from(students)
      .innerJoin(users, eq(users.id, students.userId))
      .where(eq(students.batchId, batchId))
      .orderBy(users.name);

    return c.json(success({ batchId, students: roster }));
  },
);

// ── GET /batch/:id/blooms-by-topic ─────────────────────────────
// Topic × Bloom's taxonomy matrix for an entire batch (or a
// subset of selected students) over a date range. Live-computed
// from examResponses to honor the date window exactly.
//
// Query params:
//   from, to           ISO timestamps (optional)
//   studentIds         comma/space-separated UUID subset (optional)
//   subjectId          filter to a single subject (optional)
//
// Response shape:
//   {
//     batchId, dateFrom, dateTo, cohortSize,
//     bloomsLevels: ["remember", ...],
//     topics: [{ topicId, topicName, subjectId, subjectName,
//                parentChapterId, parentChapterName,
//                totalAttempts, totalCorrect, accuracy,
//                blooms: { remember: { attempts, correct, accuracy, avgTimeSeconds }, ... } }],
//     bloomsTotals: { remember: { attempts, correct, accuracy }, ... },
//     totals: { attempts, correct, accuracy }
//   }
analytics.get(
  "/batch/:id/blooms-by-topic",
  requirePermission("analytics:batch"),
  async (c) => {
    const batchId = c.req.param("id");
    const user = c.get("user") as { role: string; sub: string };

    try {
      const [batch] = await db
        .select({ id: batches.id, name: batches.name })
        .from(batches)
        .where(eq(batches.id, batchId))
        .limit(1);

      if (!batch) {
        return c.json(error("NOT_FOUND", "Batch not found", 404), 404);
      }

      const denied = await assertFacultyAssignedToBatch(c, user, batchId);
      if (denied) return denied;

      const fromDate = parseOptionalISODate(c.req.query("from"));
      const toDate = parseOptionalISODate(c.req.query("to"));
      const subjectIdParam = c.req.query("subjectId");

      // Roster for this batch (used to validate studentIds subset)
      const roster = await db
        .select({ userId: students.userId })
        .from(students)
        .where(eq(students.batchId, batchId));
      const rosterIds = roster.map((r) => r.userId);
      const allowed = new Set(rosterIds);

      const subset = parseStudentIdsSubset(c.req.query("studentIds"), allowed);
      if (!subset.ok) {
        return c.json(error("VALIDATION_ERROR", subset.message, 400), 400);
      }
      const targetIds = subset.ids.length > 0 ? subset.ids : rosterIds;

      const BLOOMS: ReadonlyArray<
        "remember" | "understand" | "apply" | "analyse" | "evaluate" | "create"
      > = ["remember", "understand", "apply", "analyse", "evaluate", "create"];

      if (targetIds.length === 0) {
        return c.json(
          success({
            batchId,
            batchName: batch.name,
            dateFrom: fromDate?.toISOString() ?? null,
            dateTo: toDate?.toISOString() ?? null,
            cohortSize: 0,
            bloomsLevels: BLOOMS,
            topics: [],
            bloomsTotals: Object.fromEntries(
              BLOOMS.map((b) => [b, { attempts: 0, correct: 0, accuracy: 0 }]),
            ),
            totals: { attempts: 0, correct: 0, accuracy: 0 },
          }),
        );
      }

      const timeWhere = submissionTimeConditions(fromDate, toDate);
      const baseConds = [
        inArray(examSubmissions.studentId, targetIds),
        isNotNull(questions.bloomsLevel),
        isNotNull(questions.syllabusNodeId),
        // Held results stay out of the cohort's topic × Bloom's matrix.
        notResultHeld,
      ];
      if (timeWhere) baseConds.push(timeWhere);
      if (subjectIdParam) baseConds.push(eq(questions.subjectId, subjectIdParam));

      // Aggregate rows: (topicId, bloomsLevel) → attempts/correct/time
      const rows = await db
        .select({
          topicId: syllabusTree.id,
          topicName: syllabusTree.name,
          topicParentId: syllabusTree.parentId,
          subjectId: subjects.id,
          subjectName: subjects.name,
          bloomsLevel: questions.bloomsLevel,
          attempts: count(),
          correct: sql<number>`count(*) filter (where ${examResponses.isCorrect} = true)`,
          avgTime: sql<number>`coalesce(avg(${examResponses.timeSpentSeconds}), 0)`,
        })
        .from(examResponses)
        .innerJoin(examSubmissions, eq(examSubmissions.id, examResponses.submissionId))
        .innerJoin(questions, eq(questions.id, examResponses.questionId))
        .innerJoin(syllabusTree, eq(syllabusTree.id, questions.syllabusNodeId))
        .innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .where(and(...baseConds))
        .groupBy(
          syllabusTree.id,
          syllabusTree.name,
          syllabusTree.parentId,
          subjects.id,
          subjects.name,
          questions.bloomsLevel,
        );

      // Resolve parent chapter names (one extra lookup — syllabus_tree is small)
      const parentIds = Array.from(
        new Set(rows.map((r) => r.topicParentId).filter((x): x is string => !!x)),
      );
      const parentRows = parentIds.length
        ? await db
            .select({ id: syllabusTree.id, name: syllabusTree.name })
            .from(syllabusTree)
            .where(inArray(syllabusTree.id, parentIds))
        : [];
      const parentNameMap = new Map(parentRows.map((p) => [p.id, p.name]));

      // Pivot to topic-keyed structure
      type BloomCell = { attempts: number; correct: number; accuracy: number; avgTimeSeconds: number };
      const emptyBlooms = (): Record<string, BloomCell> =>
        Object.fromEntries(BLOOMS.map((b) => [b, { attempts: 0, correct: 0, accuracy: 0, avgTimeSeconds: 0 }]));

      type TopicAgg = {
        topicId: string;
        topicName: string;
        subjectId: string;
        subjectName: string;
        parentChapterId: string | null;
        parentChapterName: string | null;
        totalAttempts: number;
        totalCorrect: number;
        accuracy: number;
        blooms: Record<string, BloomCell>;
      };

      const topicMap = new Map<string, TopicAgg>();
      const bloomsTotals: Record<string, { attempts: number; correct: number; accuracy: number }> =
        Object.fromEntries(BLOOMS.map((b) => [b, { attempts: 0, correct: 0, accuracy: 0 }]));
      let grandAttempts = 0;
      let grandCorrect = 0;

      for (const r of rows) {
        const attempts = Number(r.attempts) || 0;
        const correct = Number(r.correct) || 0;
        const avgTime = Number(r.avgTime) || 0;
        const bl = r.bloomsLevel ?? "";
        if (!bl) continue;

        let topic = topicMap.get(r.topicId);
        if (!topic) {
          topic = {
            topicId: r.topicId,
            topicName: r.topicName,
            subjectId: r.subjectId,
            subjectName: r.subjectName,
            parentChapterId: r.topicParentId ?? null,
            parentChapterName: r.topicParentId ? parentNameMap.get(r.topicParentId) ?? null : null,
            totalAttempts: 0,
            totalCorrect: 0,
            accuracy: 0,
            blooms: emptyBlooms(),
          };
          topicMap.set(r.topicId, topic);
        }

        const cell = topic.blooms[bl] ?? { attempts: 0, correct: 0, accuracy: 0, avgTimeSeconds: 0 };
        cell.attempts += attempts;
        cell.correct += correct;
        cell.avgTimeSeconds = avgTime; // already averaged per bucket
        cell.accuracy =
          cell.attempts > 0 ? Math.round((cell.correct / cell.attempts) * 10000) / 100 : 0;
        topic.blooms[bl] = cell;

        topic.totalAttempts += attempts;
        topic.totalCorrect += correct;
        topic.accuracy =
          topic.totalAttempts > 0
            ? Math.round((topic.totalCorrect / topic.totalAttempts) * 10000) / 100
            : 0;

        const bt = bloomsTotals[bl]!;
        bt.attempts += attempts;
        bt.correct += correct;
        bt.accuracy = bt.attempts > 0 ? Math.round((bt.correct / bt.attempts) * 10000) / 100 : 0;

        grandAttempts += attempts;
        grandCorrect += correct;
      }

      const topicsOut = Array.from(topicMap.values()).sort((a, b) => {
        if (a.subjectName !== b.subjectName) return a.subjectName.localeCompare(b.subjectName);
        const ap = a.parentChapterName ?? "";
        const bp = b.parentChapterName ?? "";
        if (ap !== bp) return ap.localeCompare(bp);
        return a.topicName.localeCompare(b.topicName);
      });

      return c.json(
        success({
          batchId,
          batchName: batch.name,
          dateFrom: fromDate?.toISOString() ?? null,
          dateTo: toDate?.toISOString() ?? null,
          cohortSize: targetIds.length,
          rosterSize: rosterIds.length,
          bloomsLevels: BLOOMS,
          topics: topicsOut,
          bloomsTotals,
          totals: {
            attempts: grandAttempts,
            correct: grandCorrect,
            accuracy:
              grandAttempts > 0
                ? Math.round((grandCorrect / grandAttempts) * 10000) / 100
                : 0,
          },
        }),
      );
    } catch (err) {
      console.error("[Analytics] blooms-by-topic error:", err);
      return c.json(
        error("INTERNAL_ERROR", "Failed to compute topic × Bloom's matrix", 500),
        500,
      );
    }
  },
);

// ── GET /student/:id/blooms-by-topic ───────────────────────────
// Personal Topic × Bloom's matrix for a single student over a
// date range. Same shape as the batch endpoint so the UI
// components can render it with no changes.
//
// Auth: students may read their own row; faculty read when
// assigned to the student's batch; parents/admins allowed.
analytics.get(
  "/student/:id/blooms-by-topic",
  async (c) => {
    const studentId = c.req.param("id");
    const user = c.get("user") as { role: string; sub: string };

    if (user.role === "student" && user.sub !== studentId) {
      return c.json(error("FORBIDDEN", "You can only view your own data", 403), 403);
    }

    try {
      const [studentRow] = await db
        .select({ userId: students.userId, batchId: students.batchId })
        .from(students)
        .where(eq(students.userId, studentId))
        .limit(1);
      if (!studentRow) {
        return c.json(error("NOT_FOUND", "Student not found", 404), 404);
      }

      if (user.role === "faculty" && studentRow.batchId) {
        const denied = await assertFacultyAssignedToBatch(c, user, studentRow.batchId);
        if (denied) return denied;
      }

      const fromDate = parseOptionalISODate(c.req.query("from"));
      const toDate = parseOptionalISODate(c.req.query("to"));
      const subjectIdParam = c.req.query("subjectId");

      const BLOOMS: ReadonlyArray<
        "remember" | "understand" | "apply" | "analyse" | "evaluate" | "create"
      > = ["remember", "understand", "apply", "analyse", "evaluate", "create"];

      const timeWhere = submissionTimeConditions(fromDate, toDate);
      const baseConds = [
        eq(examSubmissions.studentId, studentId),
        isNotNull(questions.bloomsLevel),
        isNotNull(questions.syllabusNodeId),
        // A held exam reads as unreleased in the student's own matrix.
        notResultHeld,
      ];
      if (timeWhere) baseConds.push(timeWhere);
      if (subjectIdParam) baseConds.push(eq(questions.subjectId, subjectIdParam));

      const rows = await db
        .select({
          topicId: syllabusTree.id,
          topicName: syllabusTree.name,
          topicParentId: syllabusTree.parentId,
          subjectId: subjects.id,
          subjectName: subjects.name,
          bloomsLevel: questions.bloomsLevel,
          attempts: count(),
          correct: sql<number>`count(*) filter (where ${examResponses.isCorrect} = true)`,
          avgTime: sql<number>`coalesce(avg(${examResponses.timeSpentSeconds}), 0)`,
        })
        .from(examResponses)
        .innerJoin(examSubmissions, eq(examSubmissions.id, examResponses.submissionId))
        .innerJoin(questions, eq(questions.id, examResponses.questionId))
        .innerJoin(syllabusTree, eq(syllabusTree.id, questions.syllabusNodeId))
        .innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .where(and(...baseConds))
        .groupBy(
          syllabusTree.id,
          syllabusTree.name,
          syllabusTree.parentId,
          subjects.id,
          subjects.name,
          questions.bloomsLevel,
        );

      const parentIds = Array.from(
        new Set(rows.map((r) => r.topicParentId).filter((x): x is string => !!x)),
      );
      const parentRows = parentIds.length
        ? await db
            .select({ id: syllabusTree.id, name: syllabusTree.name })
            .from(syllabusTree)
            .where(inArray(syllabusTree.id, parentIds))
        : [];
      const parentNameMap = new Map(parentRows.map((p) => [p.id, p.name]));

      type BloomCell = { attempts: number; correct: number; accuracy: number; avgTimeSeconds: number };
      const emptyBlooms = (): Record<string, BloomCell> =>
        Object.fromEntries(BLOOMS.map((b) => [b, { attempts: 0, correct: 0, accuracy: 0, avgTimeSeconds: 0 }]));

      type TopicAgg = {
        topicId: string;
        topicName: string;
        subjectId: string;
        subjectName: string;
        parentChapterId: string | null;
        parentChapterName: string | null;
        totalAttempts: number;
        totalCorrect: number;
        accuracy: number;
        blooms: Record<string, BloomCell>;
      };

      const topicMap = new Map<string, TopicAgg>();
      const bloomsTotals: Record<string, { attempts: number; correct: number; accuracy: number }> =
        Object.fromEntries(BLOOMS.map((b) => [b, { attempts: 0, correct: 0, accuracy: 0 }]));
      let grandAttempts = 0;
      let grandCorrect = 0;

      for (const r of rows) {
        const attempts = Number(r.attempts) || 0;
        const correct = Number(r.correct) || 0;
        const avgTime = Number(r.avgTime) || 0;
        const bl = r.bloomsLevel ?? "";
        if (!bl) continue;

        let topic = topicMap.get(r.topicId);
        if (!topic) {
          topic = {
            topicId: r.topicId,
            topicName: r.topicName,
            subjectId: r.subjectId,
            subjectName: r.subjectName,
            parentChapterId: r.topicParentId ?? null,
            parentChapterName: r.topicParentId ? parentNameMap.get(r.topicParentId) ?? null : null,
            totalAttempts: 0,
            totalCorrect: 0,
            accuracy: 0,
            blooms: emptyBlooms(),
          };
          topicMap.set(r.topicId, topic);
        }

        const cell = topic.blooms[bl] ?? { attempts: 0, correct: 0, accuracy: 0, avgTimeSeconds: 0 };
        cell.attempts += attempts;
        cell.correct += correct;
        cell.avgTimeSeconds = avgTime;
        cell.accuracy =
          cell.attempts > 0 ? Math.round((cell.correct / cell.attempts) * 10000) / 100 : 0;
        topic.blooms[bl] = cell;

        topic.totalAttempts += attempts;
        topic.totalCorrect += correct;
        topic.accuracy =
          topic.totalAttempts > 0
            ? Math.round((topic.totalCorrect / topic.totalAttempts) * 10000) / 100
            : 0;

        const bt = bloomsTotals[bl]!;
        bt.attempts += attempts;
        bt.correct += correct;
        bt.accuracy = bt.attempts > 0 ? Math.round((bt.correct / bt.attempts) * 10000) / 100 : 0;

        grandAttempts += attempts;
        grandCorrect += correct;
      }

      const topicsOut = Array.from(topicMap.values()).sort((a, b) => {
        if (a.subjectName !== b.subjectName) return a.subjectName.localeCompare(b.subjectName);
        const ap = a.parentChapterName ?? "";
        const bp = b.parentChapterName ?? "";
        if (ap !== bp) return ap.localeCompare(bp);
        return a.topicName.localeCompare(b.topicName);
      });

      return c.json(
        success({
          studentId,
          dateFrom: fromDate?.toISOString() ?? null,
          dateTo: toDate?.toISOString() ?? null,
          cohortSize: 1,
          bloomsLevels: BLOOMS,
          topics: topicsOut,
          bloomsTotals,
          totals: {
            attempts: grandAttempts,
            correct: grandCorrect,
            accuracy:
              grandAttempts > 0
                ? Math.round((grandCorrect / grandAttempts) * 10000) / 100
                : 0,
          },
        }),
      );
    } catch (err) {
      console.error("[Analytics] student blooms-by-topic error:", err);
      return c.json(
        error("INTERNAL_ERROR", "Failed to compute topic × Bloom's matrix", 500),
        500,
      );
    }
  },
);

// ── GET /student/:id/batch-comparison ──────────────────────────
// How a student ranks within their own batch over a date range.
// Used by student + parent apps for the "batch-relative" card.
//
// Response:
//   {
//     studentId, batchId, dateFrom, dateTo,
//     student:  { avgPercentage, avgPercentile, attempts },
//     batch:    { avgPercentage, studentCount, cohortSize },
//     rank, percentileInBatch, topPercentBucket
//   }
analytics.get(
  "/student/:id/batch-comparison",
  async (c) => {
    const studentId = c.req.param("id");
    const user = c.get("user") as { role: string; sub: string };

    // Students can only see their own comparison; faculty/admin/parent pass through.
    if (user.role === "student" && user.sub !== studentId) {
      return c.json(error("FORBIDDEN", "You can only view your own comparison", 403), 403);
    }

    try {
      const [studentRow] = await db
        .select({ userId: students.userId, batchId: students.batchId })
        .from(students)
        .where(eq(students.userId, studentId))
        .limit(1);

      if (!studentRow || !studentRow.batchId) {
        return c.json(error("NOT_FOUND", "Student or batch not found", 404), 404);
      }
      const batchId = studentRow.batchId;

      if (user.role === "faculty") {
        const denied = await assertFacultyAssignedToBatch(c, user, batchId);
        if (denied) return denied;
      }

      const fromDate = parseOptionalISODate(c.req.query("from"));
      const toDate = parseOptionalISODate(c.req.query("to"));

      const roster = await db
        .select({ userId: students.userId })
        .from(students)
        .where(eq(students.batchId, batchId));
      const rosterIds = roster.map((r) => r.userId);

      const timeWhere = submissionTimeConditions(fromDate, toDate);
      // Held results affect neither the batch average nor the ranking.
      const cohortWhere = timeWhere
        ? and(inArray(examSubmissions.studentId, rosterIds), timeWhere, notResultHeld)
        : and(inArray(examSubmissions.studentId, rosterIds), notResultHeld);

      const perStudent = await db
        .select({
          studentId: examSubmissions.studentId,
          avgPercentage: sql<number>`avg(${examSubmissions.percentage}::numeric)`,
          avgPercentile: sql<number>`avg(${examSubmissions.percentileBatch}::numeric)`,
          attempts: count(),
        })
        .from(examSubmissions)
        .where(cohortWhere)
        .groupBy(examSubmissions.studentId);

      const ranked = perStudent
        .map((r) => ({
          studentId: r.studentId,
          avgPercentage: Number(r.avgPercentage ?? 0),
          avgPercentile: Number(r.avgPercentile ?? 0),
          attempts: Number(r.attempts),
        }))
        .sort((a, b) => b.avgPercentage - a.avgPercentage);

      const cohortSize = ranked.length;
      const meIdx = ranked.findIndex((r) => r.studentId === studentId);
      const me = meIdx >= 0 ? ranked[meIdx]! : null;
      const rank = meIdx >= 0 ? meIdx + 1 : null;

      const batchAvg =
        cohortSize > 0
          ? ranked.reduce((s, r) => s + r.avgPercentage, 0) / cohortSize
          : 0;

      const percentileInBatch =
        rank != null && cohortSize > 1
          ? Math.round(((cohortSize - rank) / (cohortSize - 1)) * 10000) / 100
          : cohortSize === 1 && rank === 1
            ? 100
            : null;

      const topBucket =
        percentileInBatch == null
          ? null
          : percentileInBatch >= 90
            ? "top-10"
            : percentileInBatch >= 75
              ? "top-25"
              : percentileInBatch >= 50
                ? "top-50"
                : "bottom-50";

      return c.json(
        success({
          studentId,
          batchId,
          dateFrom: fromDate?.toISOString() ?? null,
          dateTo: toDate?.toISOString() ?? null,
          student: me
            ? {
                avgPercentage: Math.round(me.avgPercentage * 100) / 100,
                avgPercentile: Math.round(me.avgPercentile * 100) / 100,
                attempts: me.attempts,
              }
            : { avgPercentage: 0, avgPercentile: 0, attempts: 0 },
          batch: {
            avgPercentage: Math.round(batchAvg * 100) / 100,
            studentCount: rosterIds.length,
            cohortSize,
          },
          rank,
          percentileInBatch,
          topPercentBucket: topBucket,
        }),
      );
    } catch (err) {
      console.error("[Analytics] batch-comparison error:", err);
      return c.json(
        error("INTERNAL_ERROR", "Failed to compute batch comparison", 500),
        500,
      );
    }
  },
);

export default analytics;
