"use client";

import { useState, useEffect, useMemo } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarCheck, Warning, Users } from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
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

interface AttendanceBucket {
  label: string;
  rangeMin: number;
  rangeMax: number;
  count: number;
}

interface AttendanceHistogramData {
  batchName: string;
  totalStudents: number;
  avgAttendancePercent: number;
  belowThresholdCount: number;
  buckets: AttendanceBucket[];
}

// --------------- demo data ---------------

function generateDemoData(): AttendanceHistogramData {
  const buckets: AttendanceBucket[] = [
    { label: "0–20%",  rangeMin: 0,  rangeMax: 20,  count: 2  },
    { label: "20–40%", rangeMin: 20, rangeMax: 40,  count: 5  },
    { label: "40–60%", rangeMin: 40, rangeMax: 60,  count: 12 },
    { label: "60–80%", rangeMin: 60, rangeMax: 80,  count: 29 },
    { label: "80–100%",rangeMin: 80, rangeMax: 100, count: 32 },
  ];
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const belowThreshold = buckets
    .filter((b) => b.rangeMax <= 60)
    .reduce((s, b) => s + b.count, 0);
  const avgAttendance = Math.round(
    buckets.reduce((s, b) => s + ((b.rangeMin + b.rangeMax) / 2) * b.count, 0) / total,
  );

  return {
    batchName: "JEE Advanced 2026 — Batch A",
    totalStudents: total,
    avgAttendancePercent: avgAttendance,
    belowThresholdCount: belowThreshold,
    buckets,
  };
}

// --------------- bucket color helper ---------------

function bucketColor(rangeMax: number): string {
  if (rangeMax <= 20) return color.danger;
  if (rangeMax <= 40) return "#F97316"; // orange
  if (rangeMax <= 60) return color.warn;
  if (rangeMax <= 80) return chartColors[5]; // cyan
  return color.success;
}

// --------------- component ---------------

export default function AttendanceHistogramPage() {
  const batchId = useUrlSegment(-2);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AttendanceHistogramData | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/batch/${batchId}/attendance-histogram`,
        );
        if (!cancelled && res.success && res.data) {
          setIsDemo(false);
          setData(res.data as AttendanceHistogramData);
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

  const belowThresholdPct = useMemo(() => {
    if (!data) return 0;
    return Math.round((data.belowThresholdCount / data.totalStudents) * 100);
  }, [data]);

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
            <CalendarCheck weight="duotone" className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Attendance Distribution
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
          {/* Average attendance */}
          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <CalendarCheck weight="duotone" className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {data.avgAttendancePercent}%
                </p>
                <p className="text-xs text-muted">Avg Attendance</p>
              </div>
            </div>
          </Card>

          {/* Below threshold */}
          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${color.danger}18` }}
              >
                <Warning weight="duotone" className="h-5 w-5" style={{ color: color.danger }} />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number, color: color.danger }}
                >
                  {data.belowThresholdCount}
                </p>
                <p className="text-xs text-muted">
                  Below 60%{" "}
                  <span style={{ fontFamily: typeTokens.number }}>({belowThresholdPct}%)</span>
                </p>
              </div>
            </div>
            <div className="mt-1.5">
              <Badge variant={data.belowThresholdCount > 10 ? "danger" : "warning"} size="sm">
                {data.belowThresholdCount > 10 ? "Action Needed" : "Monitor"}
              </Badge>
            </div>
          </Card>

          {/* Total students */}
          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${chartColors[1]}18` }}
              >
                <Users weight="duotone" className="h-5 w-5" style={{ color: chartColors[1] }} />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {data.totalStudents}
                </p>
                <p className="text-xs text-muted">Total Students</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Histogram chart */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6">
          <Card hoverable={false} padding="lg">
            <CardHeader>
              <CardTitle>Student Attendance Distribution</CardTitle>
              <p className="text-xs text-muted">
                Bars show number of students per attendance bracket. Red dashed line marks the 60% minimum threshold.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-72 sm:h-80 md:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.buckets}
                    margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                    barCategoryGap="20%"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border, #e5e7eb)"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fontFamily: typeTokens.body }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fontFamily: typeTokens.number }}
                      allowDecimals={false}
                      label={{
                        value: "Students",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 11, fontFamily: typeTokens.body, fill: "#94A3B8" },
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: surface.radius.md,
                        border: "1px solid #e5e7eb",
                        fontSize: 12,
                        fontFamily: typeTokens.body,
                      }}
                      formatter={(value: any) => [`${value} students`, "Count"]}
                    />
                    {/* 60% minimum threshold reference — rendered as vertical marker on bucket axis */}
                    <ReferenceLine
                      x="40–60%"
                      stroke={color.danger}
                      strokeDasharray="4 2"
                      strokeWidth={1.5}
                      label={{
                        value: "60% min",
                        position: "insideTopRight",
                        style: { fontSize: 10, fill: color.danger, fontFamily: typeTokens.body },
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {data.buckets.map((bucket, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={bucketColor(bucket.rangeMax)}
                          fillOpacity={0.82}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Summary table */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6">
          <Card hoverable={false} padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
                    <th className="px-6 py-3">Attendance Band</th>
                    <th className="px-4 py-3 text-right">Students</th>
                    <th className="px-4 py-3 text-right">% of Batch</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.buckets.map((bucket) => {
                    const pct = Math.round((bucket.count / data.totalStudents) * 100);
                    const isBad = bucket.rangeMax <= 40;
                    const isWarn = bucket.rangeMax <= 60 && bucket.rangeMax > 40;
                    const variant = isBad ? "danger" : isWarn ? "warning" : "success";
                    const label = isBad ? "Critical" : isWarn ? "Below Min" : "Acceptable";
                    return (
                      <tr
                        key={bucket.label}
                        className="border-b border-border/30 transition-colors hover:bg-primary/5 dark:border-border-dark/30 dark:hover:bg-surface-elevated-dark/30"
                      >
                        <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-sm"
                              style={{ backgroundColor: bucketColor(bucket.rangeMax) }}
                            />
                            {bucket.label}
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 text-right font-semibold"
                          style={{ fontFamily: typeTokens.number }}
                        >
                          {bucket.count}
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          style={{ fontFamily: typeTokens.number }}
                        >
                          {pct}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={variant} size="sm">{label}</Badge>
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
