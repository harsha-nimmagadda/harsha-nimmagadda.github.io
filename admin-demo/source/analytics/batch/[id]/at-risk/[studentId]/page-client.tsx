"use client";

// ============================================================
// At-Risk Student Diagnosis — per-student deep-dive
// ============================================================
// Routes: /analytics/batch/[id]/at-risk/[studentId]
//
// One backend call (`GET /api/v1/analytics/v3/student/:id/diagnosis`)
// fills 8 sections: header, sparkline, why-narrative + AI button,
// subject radar, error DNA, behavior tiles, recommended action,
// go-deeper grid. The AI button hits the explain endpoint and
// renders the response below the templated paragraph.
// ============================================================

import { useState } from "react";
import Link from "next/link";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Warning,
  Sparkle,
  ChartLineUp,
  TrendDown,
  TrendUp,
  Minus,
  Clock,
  Calendar,
  BookOpen,
  Target,
  ArrowRight,
} from "@phosphor-icons/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Skeleton,
  motionVariants,
  analyticsTokens,
} from "@brilliance/ui";
import {
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";

const { type: typeTokens, chartColors } = analyticsTokens;

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── types matching backend payload ──────────────────────────

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
}

interface DiagnosisData {
  studentId: string;
  studentName: string;
  avgPercent: number;
  trend: "declining" | "improving" | "stagnant" | "volatile" | string;
  trendNarrative: string | null;
  slopePerExam: number | null;
  confidence: number | null;
  narrative: string;
  recommendedAction: RecommendedAction;
  errorDna: {
    total: number;
    counts: { conceptual: number; procedural: number; careless: number; other: number };
    topChapters: Array<{
      chapterId: string;
      chapterName: string;
      unresolved: number;
      total: number;
      lastSeenAt: string | null;
    }>;
  };
  behavior: {
    sampleSize: number;
    revisitRate: number;
    rushedRate: number;
    avgTimeSeconds: number | null;
    cohortAvgTimeSeconds: number | null;
  };
  attendance: {
    windowDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    studentPercent: number;
    cohortPercent: number;
  };
  practice: {
    daysSincePractice: number | null;
    lastPracticeAt: string | null;
  };
  subjectAccuracy: Array<{
    subjectId: string;
    subjectName: string;
    attempts: number;
    accuracyPct: number;
  }>;
  recentExams: Array<{
    id: string;
    title: string;
    percentage: number;
    submittedAt: string;
  }>;
  insights: Array<{
    id: string;
    kind: string;
    severity: string;
    title: string;
    body: string;
    generatedAt: string;
  }>;
}

interface ExplainResult {
  paragraph: string;
  cached: boolean;
  generatedAt: string;
}

// ── helpers ─────────────────────────────────────────────────

function relativeDay(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 90) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function trendIcon(trend: string) {
  switch (trend) {
    case "improving":
      return { Icon: TrendUp, variant: "success" as const, label: "Improving" };
    case "declining":
      return { Icon: TrendDown, variant: "danger" as const, label: "Declining" };
    case "volatile":
      return { Icon: ChartLineUp, variant: "info" as const, label: "Volatile" };
    default:
      return { Icon: Minus, variant: "warning" as const, label: "Stagnant" };
  }
}

const ACTION_KIND_STYLE: Record<ActionKind, { bg: string; text: string; ring: string }> = {
  one_on_one: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    ring: "ring-red-200 dark:ring-red-500/30",
  },
  schedule_meeting: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    ring: "ring-amber-200 dark:ring-amber-500/30",
  },
  assign_dpp: {
    bg: "bg-sky-50 dark:bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-400",
    ring: "ring-sky-200 dark:ring-sky-500/30",
  },
  timed_practice: {
    bg: "bg-violet-50 dark:bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-400",
    ring: "ring-violet-200 dark:ring-violet-500/30",
  },
  diagnostic_practice: {
    bg: "bg-zinc-100 dark:bg-zinc-500/10",
    text: "text-zinc-700 dark:text-zinc-300",
    ring: "ring-zinc-200 dark:ring-zinc-500/30",
  },
};

const ERROR_BUCKET_COLORS = {
  conceptual: "#ef4444",
  procedural: "#f59e0b",
  careless: "#3b82f6",
  other: "#a3a3a3",
} as const;

// ── Page ────────────────────────────────────────────────────

export default function AtRiskStudentDiagnosisPage() {
  const batchId = useUrlSegment(-3);
  const studentId = useUrlSegment(-1);

  const diagnosisQuery = useQuery({
    queryKey: ["student-diagnosis", studentId, batchId],
    queryFn: async () => {
      const res = await apiClient.get<DiagnosisData>(
        `/api/v1/analytics/v3/student/${studentId}/diagnosis?batchId=${batchId}`,
      );
      if (!res.success) throw new Error(res.error || "Failed to load diagnosis");
      return res.data as DiagnosisData;
    },
  });

  const [aiExplain, setAiExplain] = useState<ExplainResult | null>(null);
  const explainMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ExplainResult>(
        `/api/v1/analytics/v3/student/${studentId}/diagnosis/explain?batchId=${batchId}`,
        {},
      );
      if (!res.success) throw new Error(res.error || "Failed to explain");
      return res.data as ExplainResult;
    },
    onSuccess: (data) => setAiExplain(data),
  });

  const data = diagnosisQuery.data;
  const loading = diagnosisQuery.isLoading;
  const error = diagnosisQuery.error;

  if (loading) {
    return (
      <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-72" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg dark:bg-bg-dark">
        <div className="text-center">
          <p className="text-sm text-danger">
            {(error as Error)?.message ?? "No diagnosis available"}
          </p>
          <BackLink
            href={`/analytics/batch/${batchId}/at-risk`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ArrowLeft size={14} /> Back
          </BackLink>
        </div>
      </div>
    );
  }

  const trendInfo = trendIcon(data.trend);
  const TrendI = trendInfo.Icon;
  const actionStyle =
    ACTION_KIND_STYLE[data.recommendedAction.kind] ?? ACTION_KIND_STYLE.diagnostic_practice;

  // Sparkline data
  const sparkData = data.recentExams.map((e, i) => ({
    label: `#${i + 1}`,
    pct: e.percentage,
    title: e.title,
  }));

  // Error DNA stacked-bar segments
  const total = data.errorDna.total || 1; // avoid /0
  const dna = (
    [
      ["conceptual", data.errorDna.counts.conceptual],
      ["procedural", data.errorDna.counts.procedural],
      ["careless", data.errorDna.counts.careless],
      ["other", data.errorDna.counts.other],
    ] as const
  )
    .filter(([, n]) => n > 0)
    .map(([k, n]) => ({
      key: k,
      n,
      pct: Math.round((n / total) * 1000) / 10,
      color: ERROR_BUCKET_COLORS[k],
    }));

  const radarData = data.subjectAccuracy.map((s) => ({
    subject: s.subjectName,
    accuracy: s.accuracyPct,
  }));

  return (
    <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
      <motion.div
        className="mx-auto max-w-5xl space-y-6"
        variants={motionVariants.staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Back */}
        <motion.div variants={motionVariants.fadeUp}>
          <BackLink
            href={`/analytics/batch/${batchId}/at-risk`}
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} /> Back
          </BackLink>
        </motion.div>

        {/* Header */}
        <motion.div variants={motionVariants.fadeUp}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-danger/10">
                <Warning weight="duotone" className="h-6 w-6 text-danger" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {data.studentName}
                </h1>
                <p className="mt-0.5 text-sm text-muted">
                  At-risk diagnosis &middot; avg{" "}
                  <span style={{ fontFamily: typeTokens.number }}>
                    {data.avgPercent}%
                  </span>{" "}
                  &middot; {data.recentExams.length} recent exams
                </p>
              </div>
            </div>
            <Badge variant={trendInfo.variant} size="sm">
              <TrendI size={12} weight="bold" />
              {trendInfo.label}
            </Badge>
          </div>
        </motion.div>

        {/* Sparkline */}
        {sparkData.length >= 2 && (
          <motion.div variants={motionVariants.fadeUp}>
            <Card hoverable={false} padding="md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent Exam Trajectory</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={sparkData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      className="fill-muted"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      className="fill-muted"
                    />
                    <ChartTooltip
                      contentStyle={{
                        borderRadius: 12,
                        fontSize: 13,
                        border: "1px solid var(--border)",
                        background: "var(--popover)",
                        color: "var(--popover-foreground)",
                      }}
                      formatter={(v: any) => [`${v}%`, "Score"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="pct"
                      stroke={chartColors[0]}
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Why narrative + AI explain */}
        <motion.div variants={motionVariants.fadeUp}>
          <Card hoverable={false} padding="md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkle weight="duotone" className="h-4 w-4 text-amber-500" />
                Why this student is at risk
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-4">
              <p className="text-sm leading-relaxed text-foreground">
                {data.narrative}
              </p>
              <div className="border-t border-border pt-4 dark:border-border-dark">
                <button
                  onClick={() => explainMutation.mutate()}
                  disabled={explainMutation.isPending || !!aiExplain}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                >
                  <Sparkle weight="duotone" size={14} />
                  {explainMutation.isPending
                    ? "Generating…"
                    : aiExplain
                      ? "AI explanation generated"
                      : "Generate AI explanation"}
                </button>
                {aiExplain && (
                  <div className="mt-3 rounded-xl border border-amber-200/60 bg-amber-50/60 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        AI explanation
                      </span>
                      {aiExplain.cached && (
                        <span className="text-[10px] text-muted">
                          cached
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                      {aiExplain.paragraph}
                    </p>
                  </div>
                )}
                {explainMutation.error && !aiExplain && (
                  <p className="mt-2 text-xs text-danger">
                    {(explainMutation.error as Error).message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Subject radar + Error DNA side by side */}
        <motion.div
          variants={motionVariants.fadeUp}
          className="grid gap-4 lg:grid-cols-2"
        >
          <Card hoverable={false} padding="md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Accuracy by Subject</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {radarData.length >= 3 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData} margin={{ top: 12, right: 24, left: 24, bottom: 12 }}>
                    <PolarGrid className="stroke-border" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} className="fill-muted" />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted" />
                    <Radar
                      dataKey="accuracy"
                      stroke={chartColors[0]}
                      fill={chartColors[0]}
                      fillOpacity={0.25}
                    />
                    <ChartTooltip
                      contentStyle={{
                        borderRadius: 12,
                        fontSize: 13,
                        border: "1px solid var(--border)",
                        background: "var(--popover)",
                        color: "var(--popover-foreground)",
                      }}
                      formatter={(v: any) => [`${v}%`, "Accuracy"]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="space-y-2 py-4">
                  {radarData.map((s) => (
                    <div key={s.subject} className="flex items-center gap-3">
                      <span className="w-24 truncate text-sm">{s.subject}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-50/70 dark:bg-surface-elevated-dark">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${s.accuracy}%` }}
                        />
                      </div>
                      <span
                        className="font-mono text-sm tabular-nums"
                        style={{ fontFamily: typeTokens.number }}
                      >
                        {s.accuracy}%
                      </span>
                    </div>
                  ))}
                  {radarData.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted">
                      No subject data yet.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card hoverable={false} padding="md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Error DNA</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-4">
              {data.errorDna.total === 0 ? (
                <p className="py-6 text-center text-sm text-muted">
                  No classified errors yet.
                </p>
              ) : (
                <>
                  <div className="flex h-6 w-full overflow-hidden rounded-md">
                    {dna.map((seg) => (
                      <div
                        key={seg.key}
                        title={`${seg.key}: ${seg.n} (${seg.pct}%)`}
                        className="flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
                      >
                        {seg.pct >= 12 && `${seg.pct}%`}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px]">
                    {dna.map((seg) => (
                      <div key={seg.key} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-sm"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="capitalize">{seg.key}</span>
                        <span className="text-muted">({seg.n})</span>
                      </div>
                    ))}
                  </div>
                  {data.errorDna.topChapters.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                        Top chapters with unresolved errors
                      </p>
                      <div className="space-y-1.5">
                        {data.errorDna.topChapters.slice(0, 3).map((c) => (
                          <div
                            key={c.chapterId}
                            className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark"
                          >
                            <span className="truncate">{c.chapterName}</span>
                            <div className="ml-3 flex items-center gap-2 shrink-0 text-xs text-muted">
                              <span>
                                {c.unresolved} unresolved
                              </span>
                              <span>·</span>
                              <span>{relativeDay(c.lastSeenAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Behavior signals — 4 tiles */}
        <motion.div
          variants={motionVariants.fadeUp}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <BehaviorTile
            icon={Calendar}
            label="Attendance (30d)"
            value={`${data.attendance.studentPercent}%`}
            sub={`${data.attendance.absentDays} absent / ${data.attendance.windowDays}d`}
            tone={
              data.attendance.studentPercent < 75
                ? "danger"
                : data.attendance.studentPercent < 85
                  ? "warning"
                  : "ok"
            }
          />
          <BehaviorTile
            icon={Clock}
            label="Time pressure"
            value={`${data.behavior.rushedRate}%`}
            sub={
              data.behavior.avgTimeSeconds !== null
                ? `${Math.round(data.behavior.avgTimeSeconds)}s avg`
                : "—"
            }
            tone={
              data.behavior.rushedRate >= 30
                ? "danger"
                : data.behavior.rushedRate >= 15
                  ? "warning"
                  : "ok"
            }
          />
          <BehaviorTile
            icon={ChartLineUp}
            label="Mid-exam revisits"
            value={`${data.behavior.revisitRate}%`}
            sub={
              data.behavior.sampleSize > 0
                ? `${data.behavior.sampleSize} responses`
                : "—"
            }
            tone={
              data.behavior.revisitRate >= 50
                ? "warning"
                : data.behavior.revisitRate >= 30
                  ? "warning"
                  : "ok"
            }
          />
          <BehaviorTile
            icon={BookOpen}
            label="Last practice"
            value={
              data.practice.daysSincePractice === null
                ? "Never"
                : data.practice.daysSincePractice === 0
                  ? "Today"
                  : `${data.practice.daysSincePractice}d ago`
            }
            sub={
              data.practice.daysSincePractice !== null &&
              data.practice.daysSincePractice >= 7
                ? "Stale"
                : "Recent"
            }
            tone={
              data.practice.daysSincePractice === null ||
              data.practice.daysSincePractice >= 7
                ? "warning"
                : "ok"
            }
          />
        </motion.div>

        {/* Recommended next step */}
        <motion.div variants={motionVariants.fadeUp}>
          <Card
            hoverable={false}
            padding="md"
            className={`ring-1 ${actionStyle.ring}`}
          >
            <CardContent className="flex items-center justify-between gap-4 pt-4">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${actionStyle.bg}`}
                >
                  <Target weight="duotone" className={`h-6 w-6 ${actionStyle.text}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Recommended next step
                  </p>
                  <p className={`mt-0.5 text-base font-semibold ${actionStyle.text}`}>
                    {data.recommendedAction.label}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {data.recommendedAction.reason}
                  </p>
                </div>
              </div>
              {data.recommendedAction.href && (
                <Link
                  href={data.recommendedAction.href}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium ${actionStyle.bg} ${actionStyle.text}`}
                >
                  Take action <ArrowRight size={14} />
                </Link>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Active insights (if any) */}
        {data.insights.length > 0 && (
          <motion.div variants={motionVariants.fadeUp}>
            <Card hoverable={false} padding="md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Active Insights</CardTitle>
              </CardHeader>
              <CardContent className="pt-2 space-y-2">
                {data.insights.map((i) => (
                  <div
                    key={i.id}
                    className="rounded-lg border border-border bg-white p-3 dark:border-border-dark dark:bg-surface-dark"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{i.title}</p>
                      <Badge
                        variant={
                          i.severity === "critical"
                            ? "danger"
                            : i.severity === "warning"
                              ? "warning"
                              : "info"
                        }
                        size="sm"
                      >
                        {i.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted">{i.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Go deeper — 4 most relevant existing sub-pages */}
        <motion.div variants={motionVariants.fadeUp}>
          <Card hoverable={false} padding="md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Go Deeper</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <DeepLink
                  href={`/analytics/student/${studentId}/heatmap`}
                  label="Knowledge Heatmap"
                />
                <DeepLink
                  href={`/analytics/student/${studentId}/weakness-improvement`}
                  label="Weakness Recovery"
                />
                <DeepLink
                  href={`/analytics/student/${studentId}/attendance-impact`}
                  label="Attendance Impact"
                />
                <DeepLink
                  href={`/analytics/student/${studentId}/pta-report`}
                  label="PTA Report"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ── tile component ──────────────────────────────────────────

function BehaviorTile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  tone: "ok" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";
  return (
    <Card hoverable={false} padding="md">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
            {label}
          </p>
          <Icon weight="duotone" className={`h-4 w-4 ${toneClass}`} />
        </div>
        <p
          className={`mt-2 text-2xl font-bold ${toneClass}`}
          style={{ fontFamily: typeTokens.number }}
        >
          {value}
        </p>
        <p className="mt-0.5 text-xs text-muted">{sub}</p>
      </CardContent>
    </Card>
  );
}

function DeepLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-border-dark dark:bg-surface-dark"
    >
      <span>{label}</span>
      <ArrowRight
        size={12}
        className="text-muted transition-colors group-hover:text-primary"
      />
    </Link>
  );
}
