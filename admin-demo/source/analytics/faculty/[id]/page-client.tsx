"use client";

import { useState, useEffect } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChalkboardTeacher,
  TrendUp,
  Users,
  Star,
  Books,
  ChartBar,
} from "@phosphor-icons/react";
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

interface BatchImpact {
  batchName: string;
  batchId: string;
  masteryDelta: number;   // average mastery improvement across students in this batch
  studentCount: number;
}

interface FacultyData {
  facultyId: string;
  facultyName: string;
  subjects: string[];
  batches: string[];
  totalStudents: number;
  avgMasteryDelta: number;
  percentileVsPeers: number;
  batchImpacts: BatchImpact[];
}

// --------------- demo data ---------------

function generateDemoData(facultyId: string): FacultyData {
  return {
    facultyId,
    facultyName: "Dr. Priya Nair",
    subjects: ["Physics", "Physical Chemistry"],
    batches: ["Batch A", "Batch B", "Batch C"],
    totalStudents: 96,
    avgMasteryDelta: 12.4,
    percentileVsPeers: 82,
    batchImpacts: [
      { batchId: "batch-a", batchName: "JEE Adv 2026 — Batch A", masteryDelta: 15.2, studentCount: 38 },
      { batchId: "batch-b", batchName: "JEE Adv 2026 — Batch B", masteryDelta: 10.8, studentCount: 35 },
      { batchId: "batch-c", batchName: "JEE Main 2026 — Batch C", masteryDelta: 11.1, studentCount: 23 },
    ],
  };
}

// --------------- custom tooltip ---------------

function ImpactTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: BatchImpact = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      style={{
        borderRadius: surface.radius.md,
        border: "1px solid #e5e7eb",
        background: "white",
        padding: "10px 14px",
        fontSize: 12,
        fontFamily: typeTokens.body,
      }}
    >
      <p className="font-semibold text-gray-900 mb-1.5">{d.batchName}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5" style={{ fontFamily: typeTokens.number }}>
        <span className="text-muted">Mastery Δ</span>
        <span
          className="font-bold"
          style={{ color: d.masteryDelta >= 10 ? color.success : color.warn }}
        >
          +{d.masteryDelta}%
        </span>
        <span className="text-muted">Students</span>
        <span className="font-medium">{d.studentCount}</span>
      </div>
    </div>
  );
}

// --------------- component ---------------

export default function FacultyImpactPage() {
  const facultyId = useUrlSegment(-1);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FacultyData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/faculty/${facultyId}`,
        );
        if (!cancelled && res.success && res.data) {
          setData(res.data as FacultyData);
        } else if (!cancelled) {
          setData(generateDemoData(facultyId));
        }
      } catch {
        if (!cancelled) setData(generateDemoData(facultyId));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [facultyId]);

  // --------------- skeleton ---------------

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Skeleton variant="text" className="h-4 w-40" />
          <Skeleton variant="rectangular" className="h-20 w-full rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton variant="rectangular" className="h-72 w-full rounded-xl" />
          <Skeleton variant="rectangular" className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const avgDeltaGood = data.avgMasteryDelta >= 10;

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
            href="/analytics"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} /> Back
          </BackLink>
        </motion.div>

        {/* Faculty info card */}
        <motion.div variants={motionVariants.fadeUp}>
          <Card hoverable={false} padding="md">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <ChalkboardTeacher weight="duotone" className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    {data.facultyName}
                  </h1>
                  <Badge variant="info" size="sm">Faculty</Badge>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Books size={13} weight="duotone" />
                    {data.subjects.join(" · ")}
                  </div>
                  <span className="text-muted/40">|</span>
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <ChartBar size={13} weight="duotone" />
                    {data.batches.join(" · ")}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* KPI row */}
        <motion.div
          variants={motionVariants.fadeUp}
          className="mt-4 grid gap-4 sm:grid-cols-3"
        >
          {/* Avg mastery delta */}
          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${avgDeltaGood ? color.success : color.warn}18` }}
              >
                <TrendUp
                  weight="duotone"
                  className="h-5 w-5"
                  style={{ color: avgDeltaGood ? color.success : color.warn }}
                />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{
                    fontFamily: typeTokens.number,
                    color: avgDeltaGood ? color.success : color.warn,
                  }}
                >
                  +{data.avgMasteryDelta}%
                </p>
                <p className="text-xs text-muted">Avg Mastery Delta</p>
              </div>
            </div>
            <div className="mt-2">
              <Badge variant={avgDeltaGood ? "success" : "warning"} size="sm">
                {avgDeltaGood ? "High Impact" : "Moderate Impact"}
              </Badge>
            </div>
          </Card>

          {/* Student count */}
          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Users weight="duotone" className="h-5 w-5 text-primary" />
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

          {/* Peer percentile */}
          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${chartColors[3]}18` }}
              >
                <Star
                  weight="duotone"
                  className="h-5 w-5"
                  style={{ color: chartColors[3] }}
                />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {data.percentileVsPeers}
                  <span className="text-sm font-normal text-muted">th</span>
                </p>
                <p className="text-xs text-muted">Percentile vs Peers</p>
              </div>
            </div>
            <div className="mt-2">
              <Badge
                variant={data.percentileVsPeers >= 75 ? "success" : data.percentileVsPeers >= 50 ? "info" : "warning"}
                size="sm"
              >
                {data.percentileVsPeers >= 75
                  ? "Top Quartile"
                  : data.percentileVsPeers >= 50
                    ? "Above Median"
                    : "Below Median"}
              </Badge>
            </div>
          </Card>
        </motion.div>

        {/* Per-batch impact bar chart */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6">
          <Card hoverable={false} padding="lg">
            <CardHeader>
              <CardTitle>Per-Batch Mastery Delta</CardTitle>
              <p className="text-xs text-muted">
                Average mastery improvement (pre → post) per assigned batch.
                Dashed line = overall avg ({data.avgMasteryDelta}%).
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.batchImpacts}
                    margin={{ top: 8, right: 16, bottom: 24, left: 0 }}
                    barCategoryGap="35%"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border, #e5e7eb)"
                    />
                    <XAxis
                      dataKey="batchName"
                      tick={{ fontSize: 11, fontFamily: typeTokens.body }}
                      angle={-12}
                      textAnchor="end"
                      height={48}
                    />
                    <YAxis
                      tickFormatter={(v) => `+${v}%`}
                      tick={{ fontSize: 11, fontFamily: typeTokens.number }}
                      domain={[0, "dataMax + 4"]}
                    />
                    <Tooltip content={<ImpactTooltip />} />
                    <ReferenceLine
                      y={data.avgMasteryDelta}
                      stroke={chartColors[0]}
                      strokeDasharray="5 3"
                      strokeWidth={1.5}
                      label={{
                        value: `Avg ${data.avgMasteryDelta}%`,
                        position: "insideTopRight",
                        style: { fontSize: 10, fill: chartColors[0], fontFamily: typeTokens.body },
                      }}
                    />
                    <Bar dataKey="masteryDelta" radius={[6, 6, 0, 0]}>
                      {data.batchImpacts.map((batch, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={chartColors[index % chartColors.length]}
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

        {/* Batch breakdown table */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6">
          <Card hoverable={false} padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
                    <th className="px-6 py-3">Batch</th>
                    <th className="px-4 py-3 text-right">Students</th>
                    <th className="px-4 py-3 text-right">Mastery Delta</th>
                    <th className="px-4 py-3 text-center">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {data.batchImpacts.map((batch, idx) => {
                    const delta = batch.masteryDelta;
                    const rating = delta >= 14 ? "Excellent" : delta >= 10 ? "Good" : "Average";
                    const ratingVariant =
                      delta >= 14 ? "success" : delta >= 10 ? "info" : "warning";
                    return (
                      <tr
                        key={batch.batchId}
                        className="border-b border-border/30 transition-colors hover:bg-primary/5 dark:border-border-dark/30 dark:hover:bg-surface-elevated-dark/30"
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-sm"
                              style={{ backgroundColor: chartColors[idx % chartColors.length] }}
                            />
                            <Link
                              href={`/analytics/batch/${batch.batchId}`}
                              className="font-medium text-gray-900 hover:text-primary dark:text-white"
                            >
                              {batch.batchName}
                            </Link>
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          style={{ fontFamily: typeTokens.number }}
                        >
                          {batch.studentCount}
                        </td>
                        <td
                          className="px-4 py-3 text-right font-bold"
                          style={{
                            fontFamily: typeTokens.number,
                            color: delta >= 10 ? color.success : color.warn,
                          }}
                        >
                          +{delta}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={ratingVariant} size="sm">{rating}</Badge>
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
