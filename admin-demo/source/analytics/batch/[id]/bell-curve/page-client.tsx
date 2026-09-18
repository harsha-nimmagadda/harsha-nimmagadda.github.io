"use client";

import { useState, useEffect, useMemo } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion } from "framer-motion";
import { ArrowLeft, ChartLine, Exam } from "@phosphor-icons/react";
import { InfoTooltip } from "@/components/info-tooltip";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  motionVariants,
  analyticsTokens,
} from "@brilliance/ui";
const { chartColors, color, surface, type: typeTokens } = analyticsTokens;
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";

/* eslint-disable @typescript-eslint/no-explicit-any */

// --------------- types ---------------

interface BellCurveExam {
  examId: string;
  examName: string;
}

interface BellCurveData {
  batchName: string;
  exams: BellCurveExam[];
  mean: number;
  stdDev: number;
  histogram: { bucket: string; count: number; midpoint: number }[];
}

// --------------- gaussian helpers ---------------

function gaussianPdf(x: number, mu: number, sigma: number): number {
  if (sigma === 0) return x === mu ? 1 : 0;
  const exp = -0.5 * ((x - mu) / sigma) ** 2;
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(exp);
}

function generateDemoData(): BellCurveData {
  const mu = 62;
  const sigma = 14;
  const buckets = [
    "0-10", "10-20", "20-30", "30-40", "40-50",
    "50-60", "60-70", "70-80", "80-90", "90-100",
  ];

  // Generate realistic student counts following approximate normal distribution
  const totalStudents = 120;
  const histogram = buckets.map((bucket) => {
    const [lo, hi] = bucket.split("-").map(Number);
    const mid = (lo + hi) / 2;
    const density = gaussianPdf(mid, mu, sigma);
    const count = Math.max(1, Math.round(density * totalStudents * 10));
    return { bucket, count, midpoint: mid };
  });

  return {
    batchName: "JEE Advanced 2026 — Batch A",
    exams: [
      { examId: "exam-1", examName: "Unit Test 1 — Mechanics" },
      { examId: "exam-2", examName: "Unit Test 2 — Thermodynamics" },
      { examId: "exam-3", examName: "Mid-Term Exam" },
      { examId: "exam-4", examName: "Unit Test 3 — Electrostatics" },
    ],
    mean: mu,
    stdDev: sigma,
    histogram,
  };
}

// --------------- component ---------------

export default function BellCurvePage() {
  const batchId = useUrlSegment(-2);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BellCurveData | null>(null);
  const [selectedExam, setSelectedExam] = useState<string>("all");
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/batch/${batchId}/bell-curve${selectedExam !== "all" ? `?examId=${selectedExam}` : ""}`,
        );
        if (!cancelled && res.success && res.data) {
          setIsDemo(false);
          setData(res.data as BellCurveData);
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
  }, [batchId, selectedExam]);

  // Compose chart data: histogram bars + smooth bell curve overlay
  const chartData = useMemo(() => {
    if (!data) return [];
    const { histogram, mean, stdDev } = data;
    const totalCount = histogram.reduce((s, h) => s + h.count, 0);

    return histogram.map((h) => {
      // Scale PDF to match histogram bar heights
      const pdf = gaussianPdf(h.midpoint, mean, stdDev);
      const scaledPdf = pdf * totalCount * 10; // bucket width = 10
      return {
        bucket: h.bucket,
        count: h.count,
        curve: Math.round(scaledPdf * 100) / 100,
        midpoint: h.midpoint,
      };
    });
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

        {/* Title + exam selector */}
        <motion.div
          variants={motionVariants.fadeUp}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Score Distribution &amp; Bell Curve<InfoTooltip term="Bell Curve" />
            </h1>
            <p className="mt-1 text-sm text-muted">{data.batchName}</p>
          </div>

          {/* Exam selector dropdown */}
          <div className="flex items-center gap-2">
            <Exam size={18} weight="duotone" className="text-muted" />
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-gray-900 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-white"
            >
              <option value="all">All Exams (Cumulative)</option>
              {data.exams.map((exam) => (
                <option key={exam.examId} value={exam.examId}>
                  {exam.examName}
                </option>
              ))}
            </select>
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
          {/* Mean */}
          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <ChartLine weight="duotone" className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {data.mean.toFixed(1)}%
                </p>
                <p className="text-xs text-muted">Mean (&#956;)</p>
              </div>
            </div>
          </Card>

          {/* Std Dev */}
          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                <ChartLine weight="duotone" className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {data.stdDev.toFixed(1)}
                </p>
                <p className="text-xs text-muted">Std Dev (&#963;)</p>
              </div>
            </div>
          </Card>

          {/* Total submissions */}
          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                <Exam weight="duotone" className="h-5 w-5 text-success" />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {data.histogram.reduce((s, h) => s + h.count, 0)}
                </p>
                <p className="text-xs text-muted">Total Submissions</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Chart — histogram bars + bell curve overlay */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6">
          <Card hoverable={false} padding="lg">
            <CardHeader>
              <CardTitle>Score Histogram with Normal Distribution Overlay</CardTitle>
              <p className="text-xs text-muted">
                Bars show actual student counts per score bucket. The curve shows the
                fitted normal distribution (&#956;={data.mean.toFixed(1)}, &#963;=
                {data.stdDev.toFixed(1)}).
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-72 sm:h-80 md:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border, #e5e7eb)"
                    />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 11, fontFamily: typeTokens.number }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fontFamily: typeTokens.number }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: surface.radius.md,
                        border: "1px solid #e5e7eb",
                        fontSize: 12,
                        fontFamily: typeTokens.body,
                      }}
                      formatter={(value: any, name: string) => [
                        name === "count"
                          ? `${value} students`
                          : `${Number(value).toFixed(1)} (expected)`,
                        name === "count" ? "Actual" : "Bell Curve",
                      ]}
                    />
                    <Bar
                      dataKey="count"
                      fill={chartColors[0]}
                      fillOpacity={0.7}
                      radius={[4, 4, 0, 0]}
                      name="count"
                    />
                    <Area
                      type="monotone"
                      dataKey="curve"
                      stroke={color.danger}
                      strokeWidth={2.5}
                      fill={color.danger}
                      fillOpacity={0.08}
                      dot={false}
                      name="curve"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Legend / interpretation hint */}
        <motion.div variants={motionVariants.fadeUp} className="mt-4 mb-8">
          <p className="text-xs text-muted">
            <span className="mr-3 inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: chartColors[0] }}
              />
              Actual distribution
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: color.danger }}
              />
              Normal (Gaussian) fit
            </span>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
