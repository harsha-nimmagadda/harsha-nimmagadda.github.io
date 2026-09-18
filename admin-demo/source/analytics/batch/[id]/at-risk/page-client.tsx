"use client";

import { useState, useEffect, useMemo } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Warning,
  TrendUp,
  TrendDown,
  Minus,
  CaretLeft,
  CaretRight,
  Question,
  CaretRight as ChevronRight,
} from "@phosphor-icons/react";
import {
  Card,
  Badge,
  Skeleton,
  motionVariants,
  analyticsTokens,
} from "@brilliance/ui";
const { type: typeTokens } = analyticsTokens;
import { apiClient } from "@/lib/api-client";
import { AnalyticsExportButtons } from "@/components/analytics/export-buttons";
import { BackLink } from "@/components/back-link";
import { InfoTip } from "@/components/info-tip";

/* eslint-disable @typescript-eslint/no-explicit-any */

// --------------- types ---------------

type Trend = "declining" | "improving" | "stagnant" | "volatile";

type ActionKind =
  | "assign_dpp"
  | "schedule_meeting"
  | "timed_practice"
  | "one_on_one"
  | "diagnostic_practice";

interface RecommendedAction {
  kind: ActionKind;
  label: string;
  href: string | null;
  reason: string;
  /** Chapter name — populated on `assign_dpp` so we can pre-scope the creator. */
  topic?: string;
}

interface WeakChapter {
  name: string;
  attempts: number;
  accuracyPct: number;
  confidence: "high" | "medium" | "low" | null;
}

interface AtRiskStudent {
  studentId: string;
  name: string;
  riskScore: number;
  trend: Trend;
  /** Legacy field — kept for back-compat with older API responses. */
  topWeakTopic: string;
  /** New richer field returned by the updated endpoint. */
  topWeakChapter: WeakChapter | null;
  /** Either a string (old API) or the typed object (new API). */
  recommendedAction: string | RecommendedAction;
  recentAvgPercent: number;
}

interface AtRiskData {
  batchName: string;
  students: AtRiskStudent[];
}

// --------------- demo data ---------------

const FIRST_NAMES = [
  "Aarav", "Priya", "Rohan", "Ananya", "Vihaan", "Diya", "Arjun", "Ishita",
  "Aditya", "Kavya", "Sai", "Meera", "Reyansh", "Tanvi", "Kabir", "Shreya",
  "Dev", "Pooja", "Aryan", "Nisha",
];

const LAST_NAMES = [
  "Sharma", "Patel", "Kumar", "Singh", "Reddy", "Nair", "Gupta", "Joshi",
  "Mishra", "Iyer", "Desai", "Rao", "Menon", "Verma", "Bhat", "Chatterjee",
  "Das", "Pillai", "Thakur", "Chopra",
];

const TOPICS = [
  "Kinematics", "Thermodynamics", "Electrostatics", "Organic Chemistry",
  "Calculus — Integration", "Optics", "Probability", "Coordination Compounds",
  "Electromagnetic Induction", "Matrices & Determinants",
];

const ACTIONS = [
  "Schedule one-on-one with faculty",
  "Assign remedial DPP set",
  "Recommend video lectures on weak topic",
  "Pair with peer mentor",
  "Increase practice test frequency",
  "Review fundamentals worksheet",
  "Parent-teacher meeting suggested",
];

function generateDemoStudents(): AtRiskData {
  const students: AtRiskStudent[] = FIRST_NAMES.map((first, i) => {
    const riskScore = Math.round(30 + Math.random() * 65);
    const trends: Trend[] = ["declining", "improving", "stagnant", "volatile"];
    const trend = riskScore > 70
      ? "declining"
      : riskScore > 50
        ? trends[Math.floor(Math.random() * 3)]
        : trends[Math.floor(Math.random() * trends.length)];

    return {
      studentId: `stu-${String(i + 1).padStart(3, "0")}`,
      name: `${first} ${LAST_NAMES[i]}`,
      riskScore,
      trend,
      topWeakTopic: TOPICS[Math.floor(Math.random() * TOPICS.length)],
      topWeakChapter: {
        name: TOPICS[Math.floor(Math.random() * TOPICS.length)]!,
        attempts: Math.floor(2 + Math.random() * 8),
        accuracyPct: Math.floor(Math.random() * 50),
        confidence: (["high", "medium", "low"] as const)[Math.floor(Math.random() * 3)]!,
      },
      recommendedAction: ACTIONS[Math.floor(Math.random() * ACTIONS.length)]!,
      recentAvgPercent: Math.round(20 + Math.random() * 45),
    };
  });

  // Sort by risk score descending
  students.sort((a, b) => b.riskScore - a.riskScore);

  return {
    batchName: "JEE Advanced 2026 — Batch A",
    students,
  };
}

// --------------- helpers ---------------

function riskLevel(score: number): { label: string; variant: "danger" | "warning" | "success" } {
  if (score > 70) return { label: "Critical", variant: "danger" };
  if (score >= 50) return { label: "Warning", variant: "warning" };
  return { label: "Low", variant: "success" };
}

function trendMeta(trend: Trend) {
  switch (trend) {
    case "declining":
      return { label: "Declining", variant: "danger" as const, icon: TrendDown };
    case "improving":
      return { label: "Improving", variant: "success" as const, icon: TrendUp };
    case "stagnant":
      return { label: "Stagnant", variant: "warning" as const, icon: Minus };
    case "volatile":
      return { label: "Volatile", variant: "info" as const, icon: TrendDown };
  }
}

const CONFIDENCE_DOT: Record<NonNullable<WeakChapter["confidence"]>, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-500",
  low: "bg-zinc-400",
};

const ACTION_KIND_STYLE: Record<ActionKind, string> = {
  one_on_one: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  schedule_meeting: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  assign_dpp: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  timed_practice: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  diagnostic_practice: "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300",
};

/**
 * Map a typed action to the dashboard route that actually performs it.
 * Query params are passed best-effort — receiving pages may ignore any
 * they don't understand yet (pre-fill support is a queued follow-up).
 */
function buildActionHref(
  action: RecommendedAction,
  studentId: string,
): string {
  const qs = (params: Record<string, string>) =>
    "?" + new URLSearchParams(params).toString();
  switch (action.kind) {
    case "assign_dpp":
      return (
        "/assignments/create-v2" +
        qs({
          students: studentId,
          type: "dpp",
          ...(action.topic ? { topic: action.topic } : {}),
        })
      );
    case "timed_practice":
      return (
        "/assignments/create-v2" +
        qs({ students: studentId, type: "standard", timed: "true" })
      );
    case "diagnostic_practice":
      return (
        "/assignments/create-v2" +
        qs({ students: studentId, type: "standard", diagnostic: "true" })
      );
    case "schedule_meeting":
      return "/meetings" + qs({ studentId, purpose: "parent" });
    case "one_on_one":
      return "/meetings" + qs({ studentId, purpose: "one_on_one" });
    default:
      return `/analytics/student/${studentId}`;
  }
}

/**
 * The endpoint returns either a string (legacy clients in the wild) or
 * the new typed object. The typed object renders as a clickable pill
 * that deep-links to the feature that performs the action; the legacy
 * string renders as a plain non-clickable chip (no route to link to).
 */
function ActionPill({
  action,
  studentId,
}: {
  action: string | RecommendedAction;
  studentId: string;
}) {
  if (typeof action === "string") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300">
        {action}
      </span>
    );
  }
  const style =
    ACTION_KIND_STYLE[action.kind] ?? ACTION_KIND_STYLE.diagnostic_practice;
  return (
    <Link
      href={buildActionHref(action, studentId)}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-shadow hover:ring-2 hover:ring-offset-1 hover:ring-offset-transparent hover:ring-current/30 ${style}`}
      title={action.reason}
    >
      {action.label}
    </Link>
  );
}

/**
 * Unambiguous info-tooltip trigger. Renders a literal "i" inside a
 * bordered circle so there's no confusion with a "?" glyph, and
 * shows the content on hover, focus, OR click — the last so it
 * works on touch devices and when the hover tooltip feels flaky.
 */

const PAGE_SIZE = 8;

// ============================================================
// Overview widgets
// ============================================================

function SeveritySplit({
  critical,
  warning,
  low,
}: {
  critical: number;
  warning: number;
  low: number;
}) {
  const total = critical + warning + low;
  if (total === 0) return null;
  const pc = {
    critical: (critical / total) * 100,
    warning: (warning / total) * 100,
    low: (low / total) * 100,
  };
  return (
    <div className="rounded-2xl border border-border bg-white p-5 dark:border-border-dark dark:bg-surface-dark">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Severity split
          </p>
          <p className="mt-1 text-sm text-muted">
            {total} flagged across {critical + warning + low} students · hover a
            band for share
          </p>
        </div>
        <span
          className="font-bold text-danger"
          style={{ fontFamily: typeTokens.number, fontSize: "2rem" }}
        >
          {critical}
        </span>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-50/60 dark:bg-surface-elevated-dark/60">
        {critical > 0 && (
          <div
            title={`Critical · ${critical} students · ${pc.critical.toFixed(0)}%`}
            style={{ width: `${pc.critical}%` }}
            className="bg-danger/90 transition-all"
          />
        )}
        {warning > 0 && (
          <div
            title={`Warning · ${warning} students · ${pc.warning.toFixed(0)}%`}
            style={{ width: `${pc.warning}%` }}
            className="bg-warning/90 transition-all"
          />
        )}
        {low > 0 && (
          <div
            title={`Low · ${low} students · ${pc.low.toFixed(0)}%`}
            style={{ width: `${pc.low}%` }}
            className="bg-success/90 transition-all"
          />
        )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <SeverityLegend
          label="Critical"
          n={critical}
          share={pc.critical}
          dot="bg-danger"
          info="Students with risk score above 70. Severe decline or rolling avg below 30%. Immediate 1-on-1 intervention."
        />
        <SeverityLegend
          label="Warning"
          n={warning}
          share={pc.warning}
          dot="bg-warning"
          info="Risk score 50–70. Moderate decline or rolling avg 30–50%. Assign targeted remedial practice."
        />
        <SeverityLegend
          label="Low"
          n={low}
          share={pc.low}
          dot="bg-success"
          info="Risk score below 50. Flagged but not urgent — single dip or slight shortfall."
        />
      </div>
    </div>
  );
}

function SeverityLegend({
  label,
  n,
  share,
  dot,
  info,
}: {
  label: string;
  n: number;
  share: number;
  dot: string;
  info: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-slate-50/70/30 px-3 py-2.5 dark:border-border-dark/60 dark:bg-surface-elevated-dark/30">
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <InfoTip content={info} />
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className="font-bold"
          style={{ fontFamily: typeTokens.number, fontSize: "1.4rem" }}
        >
          {n}
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">
          {share.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function ActionPlanPanel({
  plan,
}: {
  plan: Record<ActionKind, number>;
}) {
  const items: Array<{
    kind: ActionKind;
    title: string;
    when: string;
    tint: string;
    count: number;
  }> = [
    {
      kind: "one_on_one",
      title: "Schedule 1-on-1",
      when: "avg < 40% critical cases",
      tint: "bg-rose-500/10 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-900/40",
      count: plan.one_on_one ?? 0,
    },
    {
      kind: "assign_dpp",
      title: "Assign DPP",
      when: "weak chapter with 3+ attempts",
      tint: "bg-sky-500/10 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-900/40",
      count: plan.assign_dpp ?? 0,
    },
    {
      kind: "diagnostic_practice",
      title: "Diagnostic practice",
      when: "fallback when chapter data is thin",
      tint: "bg-zinc-500/10 text-zinc-700 border-zinc-200 dark:bg-zinc-500/20 dark:text-zinc-300 dark:border-zinc-800",
      count: plan.diagnostic_practice ?? 0,
    },
  ];
  const extras: Array<{ kind: ActionKind; title: string; count: number }> = [];
  if ((plan.schedule_meeting ?? 0) > 0)
    extras.push({
      kind: "schedule_meeting",
      title: "Parent meeting",
      count: plan.schedule_meeting,
    });
  if ((plan.timed_practice ?? 0) > 0)
    extras.push({
      kind: "timed_practice",
      title: "Timed practice",
      count: plan.timed_practice,
    });

  return (
    <div className="h-full rounded-2xl border border-border bg-white p-5 dark:border-border-dark dark:bg-surface-dark">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            This week's action plan
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            Distribution of recommended actions
          </p>
        </div>
        <InfoTip content="Counts of each action the classifier has suggested. Actions are picked per student by the first matching rule — 1-on-1 for critical, DPP for weak-chapter cases, diagnostic otherwise." />
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((it) => (
          <li
            key={it.kind}
            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${it.tint}`}
          >
            <div>
              <p className="text-sm font-semibold">{it.title}</p>
              <p className="mt-0.5 text-[11px] font-medium opacity-75">
                {it.when}
              </p>
            </div>
            <span
              className="font-bold"
              style={{ fontFamily: typeTokens.number, fontSize: "1.4rem" }}
            >
              {it.count}
            </span>
          </li>
        ))}
      </ul>
      {extras.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
          {extras.map((e) => (
            <span
              key={e.kind}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-slate-50/40 px-2 py-0.5 dark:border-border-dark dark:bg-surface-elevated-dark/40"
            >
              {e.title} · <strong className="font-semibold">{e.count}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CohortWeakChaptersPanel({
  chapters,
  totalStudents,
}: {
  chapters: Array<{ name: string; count: number }>;
  totalStudents: number;
}) {
  const max = Math.max(1, ...chapters.map((c) => c.count));
  return (
    <div className="h-full rounded-2xl border border-border bg-white p-5 dark:border-border-dark dark:bg-surface-dark">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Cohort weak spots
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            Most common weak chapters
          </p>
        </div>
        <InfoTip content="Chapters that show up as the top weak chapter for the most flagged students. Good candidates for a batch-wide remedial session rather than one-on-one DPPs." />
      </div>
      {chapters.length === 0 ? (
        <p className="mt-4 py-6 text-center text-xs text-muted">
          Not enough chapter data yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {chapters.map((c) => {
            const share = Math.round((c.count / Math.max(totalStudents, 1)) * 100);
            const barWidth = (c.count / max) * 100;
            return (
              <li key={c.name}>
                <div className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="truncate font-medium text-foreground">
                    {c.name}
                  </span>
                  <span
                    className="shrink-0 font-mono text-muted-foreground"
                    style={{ fontFamily: typeTokens.number }}
                  >
                    {c.count} / {share}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-50/60 dark:bg-surface-elevated-dark/60">
                  <div
                    className="h-full rounded-full bg-rose-500/70"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// Student row
// ============================================================

function StudentRow({
  student,
  batchId,
}: {
  student: AtRiskStudent;
  batchId: string;
}) {
  const risk = riskLevel(student.riskScore);
  const trend = trendMeta(student.trend);
  const TrendIcon = trend.icon;
  const detailHref = `/analytics/batch/${batchId}/at-risk/${student.studentId}`;
  const chapter = student.topWeakChapter;
  const chapterLabel = chapter?.name ?? student.topWeakTopic;
  const barColor =
    risk.variant === "danger"
      ? "bg-danger"
      : risk.variant === "warning"
        ? "bg-warning"
        : "bg-success";
  const textColor =
    risk.variant === "danger"
      ? "text-danger"
      : risk.variant === "warning"
        ? "text-warning"
        : "text-success";

  return (
    <li>
      <Link
        href={detailHref}
        className="group grid grid-cols-12 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark/40"
      >
        {/* Name + avg */}
        <div className="col-span-12 md:col-span-3">
          <p className="truncate text-[14px] font-semibold text-foreground group-hover:text-primary">
            {student.name}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            Avg{" "}
            <span
              className="font-semibold text-muted-foreground"
              style={{ fontFamily: typeTokens.number }}
            >
              {student.recentAvgPercent}%
            </span>
          </p>
        </div>

        {/* Risk bar — visual band so the worst students pop */}
        <div className="col-span-7 md:col-span-3">
          <div className="flex items-center gap-2">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-50/70 dark:bg-surface-elevated-dark/60">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${Math.min(100, student.riskScore)}%` }}
              />
            </div>
            <span
              className={`shrink-0 text-[13px] font-bold ${textColor}`}
              style={{ fontFamily: typeTokens.number, minWidth: "2rem", textAlign: "right" }}
            >
              {student.riskScore}
            </span>
          </div>
        </div>

        {/* Trend chip */}
        <div className="col-span-5 md:col-span-2">
          <Badge variant={trend.variant} size="sm">
            <TrendIcon size={12} weight="bold" />
            {trend.label}
          </Badge>
        </div>

        {/* Weak chapter */}
        <div className="hidden min-w-0 md:col-span-3 md:block">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            {chapter?.confidence && (
              <span
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${CONFIDENCE_DOT[chapter.confidence]}`}
                title={`Confidence: ${chapter.confidence} (${chapter.attempts} attempts, ${chapter.accuracyPct}% accuracy)`}
              />
            )}
            <span className="truncate">{chapterLabel || "Not enough data"}</span>
          </div>
        </div>

        {/* Go-to indicator */}
        <div className="hidden text-right md:col-span-1 md:block">
          <ChevronRight
            size={16}
            weight="bold"
            className="inline-block text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </div>
      </Link>
    </li>
  );
}

// --------------- component ---------------

export default function AtRiskPage() {
  const batchId = useUrlSegment(-2);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AtRiskData | null>(null);
  const [page, setPage] = useState(1);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/batch/${batchId}/at-risk`,
        );
        if (!cancelled && res.success && res.data) {
          setIsDemo(false);
          setData(res.data as AtRiskData);
        } else if (!cancelled) {
          setIsDemo(true);
          setData(generateDemoStudents());
        }
      } catch {
        if (!cancelled) { setIsDemo(true); setData(generateDemoStudents()); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [batchId]);

  // Severity filter — "all" shows everyone
  const [severityFilter, setSeverityFilter] = useState<
    "all" | "critical" | "warning" | "low"
  >("all");

  // Reset to first page whenever severity filter changes
  useEffect(() => setPage(1), [severityFilter]);

  // Summary counts
  const summary = useMemo(() => {
    if (!data) return { critical: 0, warning: 0, low: 0 };
    return data.students.reduce(
      (acc, s) => {
        if (s.riskScore > 70) acc.critical++;
        else if (s.riskScore >= 50) acc.warning++;
        else acc.low++;
        return acc;
      },
      { critical: 0, warning: 0, low: 0 },
    );
  }, [data]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    if (severityFilter === "all") return data.students;
    return data.students.filter((s) => {
      if (severityFilter === "critical") return s.riskScore > 70;
      if (severityFilter === "warning")
        return s.riskScore >= 50 && s.riskScore <= 70;
      return s.riskScore < 50;
    });
  }, [data, severityFilter]);

  const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE);
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, page]);

  // Distribution of recommended actions across the cohort — drives
  // the "what to do this week" callout.
  const actionPlan = useMemo(() => {
    const counts: Record<ActionKind, number> = {
      assign_dpp: 0,
      schedule_meeting: 0,
      timed_practice: 0,
      one_on_one: 0,
      diagnostic_practice: 0,
    };
    if (!data) return counts;
    for (const s of data.students) {
      const kind =
        typeof s.recommendedAction === "string"
          ? "diagnostic_practice"
          : s.recommendedAction.kind;
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
    return counts;
  }, [data]);

  // Top 3 weak chapters across the whole cohort — useful for planning
  // batch-wide remediation rather than one-student-at-a-time work.
  const cohortWeakChapters = useMemo(() => {
    if (!data) return [] as Array<{ name: string; count: number }>;
    const freq = new Map<string, number>();
    for (const s of data.students) {
      const name = s.topWeakChapter?.name ?? null;
      if (!name) continue;
      freq.set(name, (freq.get(name) ?? 0) + 1);
    }
    return Array.from(freq.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [data]);

  // --------------- skeletons ---------------

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Skeleton variant="text" className="h-4 w-40" />
          <Skeleton variant="rectangular" className="h-8 w-72" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" className="h-20 w-full rounded-xl" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
      <motion.div
        className="mx-auto max-w-5xl"
        variants={motionVariants.staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Back link */}
        <motion.div variants={motionVariants.fadeUp}>
          <BackLink
            href={`/analytics/batch/${batchId}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} /> Back
          </BackLink>
        </motion.div>

        {/* Title */}
        <motion.div
          variants={motionVariants.fadeUp}
          className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10">
              <Warning weight="duotone" className="h-5 w-5 text-danger" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                At-Risk Students
              </h1>
              <p className="mt-0.5 text-sm text-muted">
                {data.batchName} &middot; {data.students.length} students flagged
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/analytics/at-risk-explainer"
              className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary dark:border-border-dark dark:bg-surface-dark"
            >
              <Question size={14} weight="duotone" /> How this works
            </Link>
            <AnalyticsExportButtons
              endpoint={`/api/v1/analytics/v3/batch/${batchId}/at-risk/export`}
              filename={`at-risk-${data.batchName.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 60)}`}
              formats={["xlsx"]}
              disabled={!data || data.students.length === 0}
            />
          </div>
        </motion.div>

        {isDemo && (
          <motion.div variants={motionVariants.fadeUp} className="mt-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              Showing preview data — live data will appear when the API is connected.
            </div>
          </motion.div>
        )}

        {/* Severity split — single horizontal bar with the 3 bands
            proportioned to the cohort. Replaces the donut + bar charts
            which were just repeating the same numbers. */}
        <motion.div variants={motionVariants.fadeUp} className="mt-8">
          <SeveritySplit
            critical={summary.critical}
            warning={summary.warning}
            low={summary.low}
          />
        </motion.div>

        {/* Two actionable insight panels: what to do this week +
            which chapters to teach batch-wide */}
        <motion.div
          variants={motionVariants.fadeUp}
          className="mt-6 grid gap-4 lg:grid-cols-5"
        >
          <div className="lg:col-span-3">
            <ActionPlanPanel plan={actionPlan} />
          </div>
          <div className="lg:col-span-2">
            <CohortWeakChaptersPanel
              chapters={cohortWeakChapters}
              totalStudents={data.students.length}
            />
          </div>
        </motion.div>

        {/* Filter bar above the student list */}
        <motion.div
          variants={motionVariants.fadeUp}
          className="mt-10 flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Flagged students
            </h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Click a row to open the diagnosis.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-1 text-xs font-medium dark:border-border-dark dark:bg-surface-dark">
            {(
              [
                { id: "all", label: `All (${data.students.length})` },
                { id: "critical", label: `Critical (${summary.critical})`, tint: "danger" as const },
                { id: "warning", label: `Warning (${summary.warning})`, tint: "warning" as const },
                { id: "low", label: `Low (${summary.low})`, tint: "success" as const },
              ] as const
            ).map((opt) => {
              const active = severityFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSeverityFilter(opt.id)}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:bg-primary/5 hover:text-foreground dark:hover:bg-surface-elevated-dark"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Student list — card rows with visual risk bar + sparkline-like cues */}
        <motion.div variants={motionVariants.fadeUp} className="mt-4">
          <Card hoverable={false} padding="none">
            <ul className="divide-y divide-border dark:divide-border-dark">
              {paged.length === 0 && (
                <li className="px-6 py-12 text-center text-sm text-muted">
                  No students match this severity.
                </li>
              )}
              {paged.map((student) => (
                <StudentRow
                  key={student.studentId}
                  student={student}
                  batchId={batchId}
                />
              ))}
            </ul>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-6 py-3 dark:border-border-dark">
                <p className="text-xs text-muted">
                  Page{" "}
                  <span style={{ fontFamily: typeTokens.number }}>{page}</span> of{" "}
                  <span style={{ fontFamily: typeTokens.number }}>{totalPages}</span>
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-sm transition-colors hover:bg-primary/5 disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                  >
                    <CaretLeft size={14} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-sm transition-colors hover:bg-primary/5 disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                  >
                    <CaretRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Spacer */}
        <div className="h-8" />
      </motion.div>
    </div>
  );
}
