"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendUp,
  TrendDown,
  Warning,
  Lightbulb,
  Sparkle,
  Users,
  ChartLineUp,
  Calendar,
  ClipboardText,
  PaperPlaneRight,
  CalendarDots,
  Fire,
  ShieldCheck,
  Lightning,
  Target,
  Eye,
  ArrowRight,
  CaretRight,
} from "@phosphor-icons/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  Skeleton,
  Badge,
  motionVariants,
} from "@brilliance/ui";
import { apiClient } from "../../../lib/api-client";

// The shared Skeleton uses `bg-muted-100` which is barely visible against the
// white card surfaces we use throughout this page. Stack this class on top of
// every Skeleton so the loading state is actually perceptible (twMerge wins).
const SK = "bg-zinc-200 dark:bg-zinc-800";

// ── Types ────────────────────────────────────────────────────

type Insight = {
  id: string;
  title: string;
  body: string;
  kind?: string;
  severity?: string;
  recommendedActions?: Array<{ label: string; href?: string }>;
};

type Mover = {
  studentId: string;
  name: string;
  avatarUrl: string | null;
  batchId: string | null;
  batchName: string | null;
  recent: number;
  prior: number;
  delta: number;
};

type BatchRow = {
  batchId: string;
  batchName: string;
  branchName: string | null;
  academicYear: string | null;
  yearGroup: string | null;
  stream: string | null;
  targetExam: string | null;
  size: number;
  avgPct: number | null;
  lastAttemptAt: string | null;
  health: "green" | "amber" | "red" | "muted";
};

type Countdown = {
  targetExam: string;
  examId: string;
  examTitle: string;
  scheduledStart: string;
  daysAway: number;
};

type HomeV2 = {
  scope: "institution" | "branch";
  headline: string;
  subHeadline: string;
  generatedAt: string;
  pulse: {
    activeStudents: number;
    avgScore7d: number | null;
    avgScoreDelta: number | null;
    attendance7d: number | null;
    attendanceDelta: number | null;
    atRiskCount: number;
    testsThisWeek: number;
    submissions24h: number;
  };
  trend30d: Array<{ day: string; avgPct: number; n: number }>;
  risers: Mover[];
  fallers: Mover[];
  batches: BatchRow[];
  countdowns: Countdown[];
  insights: Insight[];
};

// ── Page ─────────────────────────────────────────────────────

export default function AnalyticsHomePage() {
  const [data, setData] = useState<HomeV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Hold the skeleton state for at least 400ms so it's actually perceptible
    // — on a cache hit the response can come back in <50ms, which makes the
    // loading state flash too fast to register.
    const startedAt = Date.now();
    const MIN_LOADING_MS = 400;
    apiClient
      .get<HomeV2>("/api/v1/analytics/v3/home-v2")
      .then((r) => {
        if (!alive) return;
        if (r.success && r.data) setData(r.data);
        else setErr((r as any).error?.message ?? "Could not load home");
      })
      .catch((e) => alive && setErr(e?.message ?? "Network error"))
      .finally(() => {
        if (!alive) return;
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, MIN_LOADING_MS - elapsed);
        setTimeout(() => alive && setLoading(false), wait);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <motion.main
      initial="hidden"
      animate="visible"
      variants={motionVariants.staggerContainer}
      className="mx-auto max-w-7xl px-6 py-8"
    >
      <Header data={data} loading={loading} />

      {err && (
        <Card className="mt-4 border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-500/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-red-700 dark:text-red-400">
            <Warning size={18} weight="duotone" />
            {err}
          </CardContent>
        </Card>
      )}

      <motion.section
        variants={motionVariants.fadeUp}
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {loading && !data ? (
          [0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className={`${SK} h-[112px] rounded-2xl`} />
          ))
        ) : data ? (
          <>
            <PulseTile
              icon={<Users size={16} weight="duotone" />}
              label="Active students"
              value={fmtInt(data.pulse.activeStudents)}
              tint="blue"
              slot="active"
            />
            <PulseTile
              icon={<ChartLineUp size={16} weight="duotone" />}
              label="Avg score · 7d"
              value={data.pulse.avgScore7d != null ? `${data.pulse.avgScore7d}%` : "—"}
              delta={data.pulse.avgScoreDelta}
              tint="emerald"
              deltaSuffix=" pts"
              slot="avg"
            />
            <PulseTile
              icon={<Calendar size={16} weight="duotone" />}
              label="Attendance · 7d"
              value={data.pulse.attendance7d != null ? `${data.pulse.attendance7d}%` : "—"}
              delta={data.pulse.attendanceDelta}
              tint="violet"
              deltaSuffix=" pts"
              slot="att"
            />
            <PulseTile
              icon={<Warning size={16} weight="duotone" />}
              label="At-risk students"
              value={fmtInt(data.pulse.atRiskCount)}
              tint="red"
              href={data.pulse.atRiskCount > 0 ? "/analytics/students?filter=at-risk" : undefined}
              slot="risk"
            />
            <PulseTile
              icon={<ClipboardText size={16} weight="duotone" />}
              label="Tests · 7d window"
              value={fmtInt(data.pulse.testsThisWeek)}
              tint="amber"
              href="/analytics/exams"
              slot="tests"
            />
            <PulseTile
              icon={<PaperPlaneRight size={16} weight="duotone" />}
              label="Submissions · 24h"
              value={fmtInt(data.pulse.submissions24h)}
              tint="cyan"
              slot="subs"
            />
          </>
        ) : null}
      </motion.section>

      <motion.section variants={motionVariants.fadeUp} className="mt-6">
        <TrendCard data={data?.trend30d ?? []} loading={loading} />
      </motion.section>

      <motion.section
        variants={motionVariants.fadeUp}
        className="mt-6 grid gap-4 lg:grid-cols-2"
      >
        <MoversCard
          title="This week's risers"
          accent="emerald"
          icon={<TrendUp size={18} weight="duotone" className="text-emerald-600" />}
          rows={data?.risers ?? []}
          loading={loading}
          emptyHint="Not enough comparable attempts yet to flag risers."
          rowPrefix="analytics.home.risers"
        />
        <MoversCard
          title="This week's fallers"
          accent="red"
          icon={<TrendDown size={18} weight="duotone" className="text-red-600" />}
          rows={data?.fallers ?? []}
          loading={loading}
          emptyHint="No declining students in the comparison window. Nice."
          rowPrefix="analytics.home.fallers"
        />
      </motion.section>

      <motion.section variants={motionVariants.fadeUp} className="mt-6">
        <BatchGrid rows={data?.batches ?? []} loading={loading} />
      </motion.section>

      <motion.section variants={motionVariants.fadeUp} className="mt-6">
        <CountdownRibbon items={data?.countdowns ?? []} loading={loading} />
      </motion.section>

      <motion.section variants={motionVariants.fadeUp} className="mt-6">
        <InsightsRow items={data?.insights ?? []} loading={loading} />
      </motion.section>
    </motion.main>
  );
}

// ── Header ───────────────────────────────────────────────────

function Header({ data, loading }: { data: HomeV2 | null; loading: boolean }) {
  return (
    <motion.header variants={motionVariants.fadeUp} className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
          <Sparkle size={20} weight="fill" className="text-white" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
            Analytics Home
          </p>
          {loading ? (
            <Skeleton className={`${SK} mt-1 h-7 w-80 rounded`} />
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight">
              {data?.headline ?? "Your institution at a glance"}
            </h1>
          )}
          {loading ? (
            <Skeleton className={`${SK} mt-2 h-4 w-72 rounded`} />
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.subHeadline ?? "Live numbers refresh every minute."}
            </p>
          )}
        </div>
      </div>
      {data && (
        <div className="hidden text-right text-xs text-muted-foreground sm:block">
          <p className="font-mono">
            {new Date(data.generatedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="mt-0.5">cached · 60s</p>
        </div>
      )}
    </motion.header>
  );
}

// ── Pulse tile ───────────────────────────────────────────────

const TINT: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600" },
  violet: { bg: "bg-violet-50 dark:bg-violet-500/10", text: "text-violet-600" },
  red: { bg: "bg-red-50 dark:bg-red-500/10", text: "text-red-600" },
  amber: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600" },
  cyan: { bg: "bg-cyan-50 dark:bg-cyan-500/10", text: "text-cyan-600" },
};

function PulseTile({
  icon,
  label,
  value,
  delta,
  deltaSuffix,
  tint,
  href,
  slot,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number | null;
  deltaSuffix?: string;
  tint: keyof typeof TINT;
  href?: string;
  slot: string;
}) {
  const t = TINT[tint]!;
  const inner = (
    <Card
      hoverable={!!href}
      className="bg-white dark:bg-zinc-900 border-border dark:border-zinc-800 h-full"
      data-testid={`analytics.home.pulse.${slot}`}
    >
      <CardContent className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.bg} ${t.text}`}>
            {icon}
          </div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        </div>
        <div className="mt-2.5 flex items-end justify-between gap-2">
          <p
            data-testid={`analytics.home.pulse.${slot}.value`}
            className="font-mono text-2xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}
          >
            {value}
          </p>
          {delta != null && delta !== 0 && (
            <span
              data-testid={`analytics.home.pulse.${slot}.delta`}
              className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
                delta > 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {delta > 0 ? (
                <TrendUp size={12} weight="bold" />
              ) : (
                <TrendDown size={12} weight="bold" />
              )}
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}
              {deltaSuffix ?? ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// ── 30-day trend ─────────────────────────────────────────────

function TrendCard({
  data,
  loading,
}: {
  data: HomeV2["trend30d"];
  loading: boolean;
}) {
  const display = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: new Date(d.day).toLocaleDateString([], { month: "short", day: "numeric" }),
      })),
    [data],
  );

  const hasData = display.length > 0;

  return (
    <Card className="bg-white dark:bg-zinc-900 border-border dark:border-zinc-800">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChartLineUp size={18} weight="duotone" className="text-blue-600" />
            <h2 className="text-sm font-semibold">Score trend · last 30 days</h2>
          </div>
          {hasData && (
            <p data-testid="analytics.home.trend.days" className="text-xs text-muted-foreground">
              {display.length} day{display.length === 1 ? "" : "s"} with submissions
            </p>
          )}
        </div>

        <div className="mt-4 h-[220px]">
          {loading ? (
            <Skeleton className={`${SK} h-full w-full rounded-xl`} />
          ) : !hasData ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground dark:border-zinc-700">
              No submissions in the last 30 days
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={display} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={20}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <RTooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 12,
                  }}
                  formatter={(v: number, name: string) =>
                    name === "avgPct" ? [`${v}%`, "Avg score"] : [v, "Submissions"]
                  }
                  labelFormatter={(l) => `${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="avgPct"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="url(#trend-fill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Movers (risers/fallers) ──────────────────────────────────

function MoversCard({
  title,
  icon,
  rows,
  loading,
  accent,
  emptyHint,
  rowPrefix,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Mover[];
  loading: boolean;
  accent: "emerald" | "red";
  emptyHint: string;
  rowPrefix: string;
}) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-border dark:border-zinc-800">
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>

        <div className="mt-3 divide-y divide-border dark:divide-zinc-800">
          {loading ? (
            [0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <Skeleton className={`${SK} h-8 w-8 rounded-full`} />
                <Skeleton className={`${SK} h-3 flex-1 rounded`} />
                <Skeleton className={`${SK} h-3 w-14 rounded`} />
              </div>
            ))
          ) : rows.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">{emptyHint}</div>
          ) : (
            rows.map((r) => (
              <Link
                key={r.studentId}
                href={`/analytics/student/${r.studentId}`}
                data-testid={`${rowPrefix}.row.${r.studentId}`}
                className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 -mx-2 px-2 rounded-lg"
              >
                <Avatar name={r.name} url={r.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p
                    data-testid={`${rowPrefix}.row.${r.studentId}.name`}
                    className="truncate text-sm font-medium text-foreground"
                  >
                    {r.name}
                  </p>
                  <p
                    data-testid={`${rowPrefix}.row.${r.studentId}.recent`}
                    className="truncate text-[11px] text-muted-foreground"
                  >
                    {r.batchName ?? "No batch"} · now {r.recent}%
                  </p>
                </div>
                <span
                  data-testid={`${rowPrefix}.row.${r.studentId}.delta`}
                  className={`font-mono text-sm font-semibold tabular-nums ${
                    accent === "emerald" ? "text-emerald-600" : "text-red-600"
                  }`}
                  style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}
                >
                  {r.delta > 0 ? "+" : ""}
                  {r.delta.toFixed(1)}
                </span>
                <CaretRight
                  size={14}
                  className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                />
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-[10px] font-semibold text-white">
      {initials || "?"}
    </div>
  );
}

// ── Batch grid ───────────────────────────────────────────────

const HEALTH_DOT: Record<BatchRow["health"], string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  muted: "bg-zinc-300 dark:bg-zinc-600",
};

const HEALTH_LABEL: Record<BatchRow["health"], string> = {
  green: "Healthy",
  amber: "Watch",
  red: "Needs attention",
  muted: "Inactive",
};

function BatchGrid({ rows, loading }: { rows: BatchRow[]; loading: boolean }) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-border dark:border-zinc-800">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={18} weight="duotone" className="text-violet-600" />
            <h2 className="text-sm font-semibold">Batch health</h2>
          </div>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            All batches
            <ArrowRight size={12} weight="bold" />
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? [0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className={`${SK} h-[112px] rounded-xl`} />
              ))
            : rows.length === 0
              ? (
                <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
                  No batches in scope yet.
                </div>
              )
              : rows.map((b) => (
                  <Link
                    key={b.batchId}
                    href={`/analytics/batch/${b.batchId}`}
                    data-testid={`analytics.home.list.row.${b.batchId}`}
                    className="group block rounded-xl border border-border bg-white p-4 transition-all hover:border-blue-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {b.branchName ?? "Unassigned branch"}
                        </p>
                        <p
                          data-testid={`analytics.home.list.row.${b.batchId}.name`}
                          className="mt-0.5 truncate text-sm font-semibold text-foreground"
                        >
                          {batchDisplayName(b)}
                        </p>
                        <p
                          data-testid={`analytics.home.list.row.${b.batchId}.size`}
                          className="mt-0.5 truncate text-[11px] text-muted-foreground"
                        >
                          {formatTargetExam(b.targetExam)} · {b.size} student{b.size === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span
                        className={`mt-1 inline-flex h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[b.health]}`}
                        title={HEALTH_LABEL[b.health]}
                      />
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <p
                        data-testid={`analytics.home.list.row.${b.batchId}.avg`}
                        className="font-mono text-lg font-semibold tracking-tight"
                        style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}
                      >
                        {b.avgPct != null ? `${b.avgPct}%` : "—"}
                      </p>
                      <p
                        data-testid={`analytics.home.list.row.${b.batchId}.last`}
                        className="text-[11px] text-muted-foreground"
                      >
                        {b.lastAttemptAt
                          ? `last test ${relTime(b.lastAttemptAt)}`
                          : "no submissions yet"}
                      </p>
                    </div>
                  </Link>
                ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Countdown ribbon ─────────────────────────────────────────

function CountdownRibbon({
  items,
  loading,
}: {
  items: Countdown[];
  loading: boolean;
}) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-border dark:border-zinc-800">
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <CalendarDots size={18} weight="duotone" className="text-amber-600" />
          <h2 className="text-sm font-semibold">Upcoming exams</h2>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            [0, 1, 2].map((i) => (
              <Skeleton key={i} className={`${SK} h-[72px] rounded-xl`} />
            ))
          ) : items.length === 0 ? (
            <div className="col-span-full py-4 text-center text-xs text-muted-foreground">
              No upcoming exams scheduled for your target boards.
            </div>
          ) : null}
          {!loading && items.map((c) => (
            <Link
              key={c.examId}
              href={`/exams/${c.examId}`}
              data-testid={`analytics.home.countdown.row.${c.examId}`}
              className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 transition-colors hover:border-amber-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-700"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" className="text-[10px]">
                    {formatTargetExam(c.targetExam)}
                  </Badge>
                  <p
                    data-testid={`analytics.home.countdown.row.${c.examId}.title`}
                    className="truncate text-xs font-medium text-foreground"
                  >
                    {c.examTitle}
                  </p>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {new Date(c.scheduledStart).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  data-testid={`analytics.home.countdown.row.${c.examId}.days`}
                  className="font-mono text-lg font-semibold tracking-tight text-amber-600"
                  style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}
                >
                  {c.daysAway}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  day{c.daysAway === 1 ? "" : "s"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Insights row ─────────────────────────────────────────────

const KIND_META: Record<string, { icon: typeof TrendUp; tint: keyof typeof TINT }> = {
  velocity_up: { icon: TrendUp, tint: "emerald" },
  velocity_down: { icon: TrendDown, tint: "red" },
  inefficient_study: { icon: Lightning, tint: "amber" },
  weakness_resolved: { icon: ShieldCheck, tint: "emerald" },
  weakness_introduced: { icon: Fire, tint: "red" },
  topic_hotspot: { icon: Target, tint: "violet" },
  attendance_drop: { icon: Warning, tint: "amber" },
  comeback_plan: { icon: Sparkle, tint: "blue" },
  predicted_dip: { icon: Eye, tint: "red" },
};

const SEV_META: Record<string, { icon: typeof Lightbulb; tint: keyof typeof TINT }> = {
  critical: { icon: Warning, tint: "red" },
  high: { icon: Fire, tint: "amber" },
  warning: { icon: Lightbulb, tint: "amber" },
  medium: { icon: Lightbulb, tint: "blue" },
  info: { icon: Lightbulb, tint: "blue" },
  low: { icon: TrendUp, tint: "emerald" },
  celebrate: { icon: Sparkle, tint: "emerald" },
};

function insightLook(i: Insight) {
  if (i.kind && KIND_META[i.kind]) return KIND_META[i.kind]!;
  if (i.severity && SEV_META[i.severity]) return SEV_META[i.severity]!;
  return { icon: Lightbulb, tint: "blue" as const };
}

function InsightsRow({ items, loading }: { items: Insight[]; loading: boolean }) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-border dark:border-zinc-800">
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <Sparkle size={18} weight="duotone" className="text-blue-600" />
          <h2 className="text-sm font-semibold">Latest insights</h2>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {loading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className={`${SK} h-24 rounded-xl`} />)
          ) : items.length === 0 ? (
            <div className="col-span-full py-6 text-center text-xs text-muted-foreground">
              Insights generate as more exams are taken — check back soon.
            </div>
          ) : (
            items.map((i) => {
              const look = insightLook(i);
              const t = TINT[look.tint]!;
              const Icon = look.icon;
              return (
                <div
                  key={i.id}
                  data-testid={`analytics.home.insight.row.${i.id}`}
                  className="rounded-xl border border-border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.bg} ${t.text}`}>
                      <Icon size={16} weight="duotone" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        data-testid={`analytics.home.insight.row.${i.id}.title`}
                        className="line-clamp-1 text-sm font-semibold text-foreground"
                      >
                        {i.title}
                      </h3>
                      <p
                        data-testid={`analytics.home.insight.row.${i.id}.body`}
                        className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground"
                      >
                        {i.body}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Utils ────────────────────────────────────────────────────

function fmtInt(n: number): string {
  return n.toLocaleString("en-IN");
}

// Many institutions use the same `name` (e.g. "SR MPC") across batches that
// differ only by academic year. Append the year when present so each card is
// uniquely identifiable at a glance. Branch is rendered on the line above.
function batchDisplayName(b: BatchRow): string {
  const parts = [b.batchName];
  if (b.academicYear) parts.push(b.academicYear);
  else if (b.yearGroup) parts.push(b.yearGroup);
  return parts.join(" · ");
}

// Target exam values are stored lowercased with underscores (e.g. "jee_mains")
// in the batches table. Render them as user-facing labels.
const TARGET_EXAM_LABEL: Record<string, string> = {
  jee_mains: "JEE Mains",
  jee_main: "JEE Mains",
  jee_advanced: "JEE Advanced",
  jee: "JEE",
  neet: "NEET",
  clat: "CLAT",
  ipmat: "IPMAT",
  bitsat: "BITSAT",
  state: "State board",
  eapcet: "EAPCET",
};

function formatTargetExam(raw: string | null | undefined): string {
  if (!raw) return "—";
  const key = raw.toLowerCase();
  if (TARGET_EXAM_LABEL[key]) return TARGET_EXAM_LABEL[key]!;
  return raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
