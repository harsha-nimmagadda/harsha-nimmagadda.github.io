"use client";

import { useState, useEffect } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion } from "framer-motion";
import { ArrowLeft, ChartBar, Exam, Exclude } from "@phosphor-icons/react";
import { InfoTooltip } from "@/components/info-tooltip";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ErrorBar,
  Cell,
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

interface BoxStats {
  subject: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
  examLabel: string;
}

interface BoxPlotData {
  batchName: string;
  exams: Array<{ examId: string; examName: string }>;
  subjects: string[];
  series: BoxStats[];
}

// --------------- demo data ---------------

function generateDemoData(): BoxPlotData {
  const subjects = ["Physics", "Chemistry", "Maths", "Biology", "English"];
  const exams = [
    { examId: "e1", examName: "Unit Test 1" },
    { examId: "e2", examName: "Unit Test 2" },
    { examId: "e3", examName: "Mid-Term" },
  ];

  const series: BoxStats[] = [];
  const baseScores: Record<string, number> = {
    Physics: 58,
    Chemistry: 64,
    Maths: 52,
    Biology: 70,
    English: 75,
  };

  subjects.forEach((subject, si) => {
    exams.forEach((exam, ei) => {
      const base = baseScores[subject] + ei * 3;
      const spread = 10 + si * 2;
      const q1 = Math.round(base - spread * 0.6);
      const q3 = Math.round(base + spread * 0.6);
      series.push({
        subject,
        examLabel: exam.examName,
        min: Math.max(0, q1 - Math.round(spread * 0.4)),
        q1,
        median: Math.round(base),
        q3,
        max: Math.min(100, q3 + Math.round(spread * 0.4)),
        outliers: si % 2 === 0 ? [Math.max(0, q1 - spread), Math.min(100, q3 + spread + 5)] : [],
      });
    });
  });

  return { batchName: "JEE Advanced 2026 — Batch A", exams, subjects, series };
}

// --------------- custom tooltip ---------------

function BoxTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: BoxStats = payload[0]?.payload;
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
      <p className="font-semibold text-gray-900 mb-1">{d.subject} — {d.examLabel}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5" style={{ fontFamily: typeTokens.number }}>
        <span className="text-muted">Max</span><span className="font-medium">{d.max}%</span>
        <span className="text-muted">Q3</span><span className="font-medium">{d.q3}%</span>
        <span className="text-muted">Median</span><span className="font-bold text-primary">{d.median}%</span>
        <span className="text-muted">Q1</span><span className="font-medium">{d.q1}%</span>
        <span className="text-muted">Min</span><span className="font-medium">{d.min}%</span>
        {d.outliers.length > 0 && (
          <>
            <span className="text-muted">Outliers</span>
            <span className="font-medium text-danger">{d.outliers.join(", ")}%</span>
          </>
        )}
      </div>
    </div>
  );
}

// --------------- component ---------------

export default function BoxPlotPage() {
  const batchId = useUrlSegment(-2);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BoxPlotData | null>(null);
  const [selectedExam, setSelectedExam] = useState<string>("all");
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/batch/${batchId}/box-plot${selectedExam !== "all" ? `?examId=${selectedExam}` : ""}`,
        );
        if (!cancelled && res.success && res.data) {
          setIsDemo(false);
          setData(res.data as BoxPlotData);
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

  // Derived KPIs
  const kpis = (() => {
    if (!data) return { medianScore: 0, avgIQR: 0, outlierCount: 0 };
    const filtered = selectedExam === "all"
      ? data.series
      : data.series.filter((s) => s.examLabel === (data.exams.find((e) => e.examId === selectedExam)?.examName));
    const medianScore = filtered.length
      ? Math.round(filtered.reduce((a, s) => a + s.median, 0) / filtered.length)
      : 0;
    const avgIQR = filtered.length
      ? Math.round(filtered.reduce((a, s) => a + (s.q3 - s.q1), 0) / filtered.length)
      : 0;
    const outlierCount = filtered.reduce((a, s) => a + s.outliers.length, 0);
    return { medianScore, avgIQR, outlierCount };
  })();

  // Chart data: one row per subject (with first exam or all-exam average)
  const chartData = (() => {
    if (!data) return [];
    const examName = selectedExam === "all"
      ? null
      : data.exams.find((e) => e.examId === selectedExam)?.examName ?? null;
    return data.subjects.map((subject) => {
      const rows = data.series.filter(
        (s) => s.subject === subject && (examName === null || s.examLabel === examName),
      );
      if (!rows.length) return null;
      const avg = (arr: number[]) => Math.round(arr.reduce((a, v) => a + v, 0) / arr.length);
      const merged: BoxStats = {
        subject,
        examLabel: examName ?? "All Exams",
        min: avg(rows.map((r) => r.min)),
        q1: avg(rows.map((r) => r.q1)),
        median: avg(rows.map((r) => r.median)),
        q3: avg(rows.map((r) => r.q3)),
        max: avg(rows.map((r) => r.max)),
        outliers: rows.flatMap((r) => r.outliers),
      };
      // Recharts ErrorBar expects: value = q2 (median), errorY = [down, up]
      // We model as: bar from q1 to q3, with error bars extending to min/max
      return {
        ...merged,
        // bar bottom = q1, bar height = IQR = q3 - q1
        iqrBottom: merged.q1,
        iqrRange: merged.q3 - merged.q1,
        // error bar: lower whisker from q1 down to min, upper whisker from q3 up to max
        errorLow: merged.q1 - merged.min,
        errorHigh: merged.max - merged.q3,
      };
    }).filter(Boolean) as any[];
  })();

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
        <motion.div
          variants={motionVariants.fadeUp}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Score Box Plot — Per Subject<InfoTooltip term="Box Plot" />
            </h1>
            <p className="mt-1 text-sm text-muted">{data.batchName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Exam size={18} weight="duotone" className="text-muted" />
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-gray-900 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-white"
            >
              <option value="all">All Exams (averaged)</option>
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
          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <ChartBar weight="duotone" className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {kpis.medianScore}%
                </p>
                <p className="text-xs text-muted">Median Score</p>
              </div>
            </div>
          </Card>

          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                <ChartBar weight="duotone" className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {kpis.avgIQR} pts
                </p>
                <p className="text-xs text-muted">Avg IQR Spread</p>
              </div>
            </div>
          </Card>

          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${color.danger}18` }}
              >
                <Exclude weight="duotone" className="h-5 w-5" style={{ color: color.danger }} />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {kpis.outlierCount}
                </p>
                <p className="text-xs text-muted">Outlier Points</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Chart */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6">
          <Card hoverable={false} padding="lg">
            <CardHeader>
              <CardTitle>Box-and-Whisker: Min / Q1 / Median / Q3 / Max</CardTitle>
              <p className="text-xs text-muted">
                Each bar spans Q1–Q3 (IQR). Whiskers extend to min and max. Hover for full stats.
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
                      dataKey="subject"
                      tick={{ fontSize: 12, fontFamily: typeTokens.body }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fontFamily: typeTokens.number }}
                    />
                    <Tooltip content={<BoxTooltip />} />
                    {/* Invisible base bar to offset IQR box */}
                    <Bar dataKey="iqrBottom" stackId="box" fill="transparent" legendType="none" />
                    {/* IQR box */}
                    <Bar dataKey="iqrRange" stackId="box" radius={[4, 4, 0, 0]}>
                      {chartData.map((_: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={chartColors[index % chartColors.length]}
                          fillOpacity={0.75}
                        />
                      ))}
                      <ErrorBar
                        dataKey="errorHigh"
                        width={6}
                        strokeWidth={2}
                        stroke="#64748b"
                        direction="y"
                      />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Subject stats table */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6">
          <Card hoverable={false} padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
                    <th className="px-6 py-3">Subject</th>
                    <th className="px-4 py-3 text-right">Min</th>
                    <th className="px-4 py-3 text-right">Q1</th>
                    <th className="px-4 py-3 text-right">Median</th>
                    <th className="px-4 py-3 text-right">Q3</th>
                    <th className="px-4 py-3 text-right">Max</th>
                    <th className="px-4 py-3 text-right">IQR</th>
                    <th className="px-4 py-3 text-center">Outliers</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row: any, idx: number) => (
                    <tr
                      key={row.subject}
                      className="border-b border-border/30 transition-colors hover:bg-primary/5 dark:border-border-dark/30 dark:hover:bg-surface-elevated-dark/30"
                    >
                      <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: chartColors[idx % chartColors.length] }}
                          />
                          {row.subject}
                        </div>
                      </td>
                      {([row.min, row.q1, row.median, row.q3, row.max] as number[]).map((v, vi) => (
                        <td
                          key={vi}
                          className="px-4 py-3 text-right"
                          style={{
                            fontFamily: typeTokens.number,
                            fontWeight: vi === 2 ? 700 : 400,
                          }}
                        >
                          {v}%
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right" style={{ fontFamily: typeTokens.number }}>
                        {row.iqrRange} pts
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.outliers.length > 0 ? (
                          <Badge variant="danger" size="sm">{row.outliers.length}</Badge>
                        ) : (
                          <Badge variant="success" size="sm">0</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
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
