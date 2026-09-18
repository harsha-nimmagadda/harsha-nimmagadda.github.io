"use client";

import { useState, useEffect } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion } from "framer-motion";
import { ArrowLeft, Books, CheckCircle, Warning } from "@phosphor-icons/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  Badge,
  motionVariants,
  analyticsTokens,
} from "@brilliance/ui";
const { chartColors, color, surface, type: typeTokens } = analyticsTokens;
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";

/* eslint-disable @typescript-eslint/no-explicit-any */

// --------------- types ---------------

interface SyllabusWeek {
  week: string;
  planned: number;
  covered: number;
}

interface SyllabusFlowData {
  batchName: string;
  totalTopics: number;
  coveredTopics: number;
  coveragePercent: number;
  gapPercent: number;
  weeks: SyllabusWeek[];
}

// --------------- demo data ---------------

function generateDemoData(): SyllabusFlowData {
  const weeks: SyllabusWeek[] = [
    { week: "Wk 1", planned: 12, covered: 11 },
    { week: "Wk 2", planned: 24, covered: 22 },
    { week: "Wk 3", planned: 36, covered: 33 },
    { week: "Wk 4", planned: 48, covered: 43 },
    { week: "Wk 5", planned: 60, covered: 54 },
    { week: "Wk 6", planned: 74, covered: 64 },
    { week: "Wk 7", planned: 87, covered: 72 },
    { week: "Wk 8", planned: 100, covered: 75 },
  ];

  const latest = weeks[weeks.length - 1];
  return {
    batchName: "JEE Advanced 2026 — Batch A",
    totalTopics: 120,
    coveredTopics: Math.round((latest.covered / 100) * 120),
    coveragePercent: latest.covered,
    gapPercent: latest.planned - latest.covered,
    weeks,
  };
}

// --------------- component ---------------

export default function SyllabusFlowPage() {
  const batchId = useUrlSegment(-2);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SyllabusFlowData | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/batch/${batchId}/syllabus-cumulative-flow`,
        );
        if (!cancelled && res.success && res.data) {
          setIsDemo(false);
          setData(res.data as SyllabusFlowData);
        } else if (!cancelled) {
          setIsDemo(true);
          setData(generateDemoData());
        }
      } catch {
        if (!cancelled) { setIsDemo(true); setData(generateDemoData()); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [batchId]);

  // --------------- skeleton ---------------

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Skeleton variant="text" className="h-4 w-40" />
          <Skeleton variant="rectangular" className="h-8 w-72" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton variant="rectangular" className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const onTrack = data.gapPercent <= 5;

  // Empty state when no teaching plan data
  if (!data.weeks || data.weeks.length === 0) {
    return (
      <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
        <div className="mx-auto max-w-5xl">
          <BackLink href={`/analytics/batch/${batchId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-primary">
            <ArrowLeft size={16} /> Back
          </BackLink>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Syllabus Coverage</h1>
          <div className="mt-8 flex flex-col items-center py-16 text-center">
            <Books weight="duotone" className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h2 className="text-lg font-semibold text-foreground">No teaching plan data yet</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">Syllabus coverage analytics will appear once the teaching calendar is set up and classes are logged for this batch.</p>
          </div>
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

        {/* Header */}
        <motion.div variants={motionVariants.fadeUp} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Books weight="duotone" className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Cumulative Syllabus Flow
            </h1>
            <p className="mt-0.5 text-sm text-muted">{data.batchName}</p>
          </div>
        </motion.div>

        {isDemo && (
          <motion.div variants={motionVariants.fadeUp} className="mt-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              Showing preview data — live data will appear when the API is connected.
            </div>
          </motion.div>
        )}

        {/* KPI row */}
        <motion.div
          variants={motionVariants.fadeUp}
          className="mt-6 grid gap-4 sm:grid-cols-3"
        >
          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${chartColors[1]}18` }}
              >
                <CheckCircle weight="duotone" className="h-5 w-5" style={{ color: chartColors[1] }} />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {data.coveragePercent}%
                </p>
                <p className="text-xs text-muted">Coverage (Week 8)</p>
              </div>
            </div>
          </Card>

          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${color.warn}18` }}
              >
                <Warning weight="duotone" className="h-5 w-5" style={{ color: color.warn }} />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {data.gapPercent}%
                </p>
                <p className="text-xs text-muted">Coverage Gap</p>
              </div>
            </div>
          </Card>

          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Books weight="duotone" className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {data.coveredTopics} / {data.totalTopics}
                </p>
                <p className="text-xs text-muted">Topics Covered</p>
              </div>
            </div>
            <div className="mt-2">
              <Badge variant={onTrack ? "success" : "warning"} size="sm">
                {onTrack ? "On Track" : "Behind Schedule"}
              </Badge>
            </div>
          </Card>
        </motion.div>

        {/* Progress bar */}
        <motion.div variants={motionVariants.fadeUp} className="mt-4">
          <Card hoverable={false} padding="md">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Overall Completion
              </p>
              <span style={{ fontFamily: typeTokens.number, fontSize: 13, fontWeight: 700 }}>
                {data.coveragePercent}% covered vs {(data.weeks[data.weeks.length - 1]?.planned ?? 100)}% planned
              </span>
            </div>
            <div className="relative h-3 w-full rounded-full bg-border/40 overflow-hidden dark:bg-border-dark/40">
              {/* Planned bar (background) */}
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${(data.weeks[data.weeks.length - 1]?.planned ?? 100)}%`,
                  background: `${chartColors[0]}30`,
                }}
              />
              {/* Covered bar */}
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                style={{
                  width: `${data.coveragePercent}%`,
                  background: chartColors[1],
                }}
              />
            </div>
            <div className="mt-1.5 flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: `${chartColors[0]}80` }} />
                Planned
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: chartColors[1] }} />
                Covered
              </span>
            </div>
          </Card>
        </motion.div>

        {/* Area Chart */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6">
          <Card hoverable={false} padding="lg">
            <CardHeader>
              <CardTitle>Cumulative Syllabus Coverage Over 8 Weeks</CardTitle>
              <p className="text-xs text-muted">
                Planned trajectory (target) vs actual topics covered. Gap between curves = coverage debt.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-72 sm:h-80 md:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.weeks}
                    margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="gradPlanned" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors[0]} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={chartColors[0]} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradCovered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors[1]} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={chartColors[1]} stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 12, fontFamily: typeTokens.body }}
                    />
                    <YAxis
                      domain={[0, 110]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fontFamily: typeTokens.number }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: surface.radius.md,
                        border: "1px solid #e5e7eb",
                        fontSize: 12,
                        fontFamily: typeTokens.body,
                      }}
                      formatter={(value: any, name: string) => [
                        `${value}%`,
                        name === "planned" ? "Planned" : "Covered",
                      ]}
                    />
                    <Legend
                      formatter={(value) => value === "planned" ? "Planned" : "Covered"}
                      wrapperStyle={{ fontSize: 12, fontFamily: typeTokens.body }}
                    />
                    <Area
                      type="monotone"
                      dataKey="planned"
                      stroke={chartColors[0]}
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      fill="url(#gradPlanned)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="covered"
                      stroke={chartColors[1]}
                      strokeWidth={2.5}
                      fill="url(#gradCovered)"
                      dot={{ r: 4, fill: chartColors[1] }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Week-by-week table */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6">
          <Card hoverable={false} padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
                    <th className="px-6 py-3">Week</th>
                    <th className="px-4 py-3 text-right">Planned %</th>
                    <th className="px-4 py-3 text-right">Covered %</th>
                    <th className="px-4 py-3 text-right">Gap</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weeks.map((row) => {
                    const gap = row.planned - row.covered;
                    const status = gap <= 2 ? "on-track" : gap <= 8 ? "slight-lag" : "behind";
                    return (
                      <tr
                        key={row.week}
                        className="border-b border-border/30 transition-colors hover:bg-primary/5 dark:border-border-dark/30 dark:hover:bg-surface-elevated-dark/30"
                      >
                        <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">
                          {row.week}
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          style={{ fontFamily: typeTokens.number }}
                        >
                          {row.planned}%
                        </td>
                        <td
                          className="px-4 py-3 text-right font-semibold"
                          style={{ fontFamily: typeTokens.number, color: chartColors[1] }}
                        >
                          {row.covered}%
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          style={{
                            fontFamily: typeTokens.number,
                            color: gap > 8 ? color.danger : gap > 2 ? color.warn : color.success,
                          }}
                        >
                          {gap > 0 ? `−${gap}%` : "0%"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant={status === "on-track" ? "success" : status === "slight-lag" ? "warning" : "danger"}
                            size="sm"
                          >
                            {status === "on-track" ? "On Track" : status === "slight-lag" ? "Slight Lag" : "Behind"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        <div className="h-8" />
      </motion.div>
    </div>
  );
}
