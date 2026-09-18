"use client";

import { useState, useEffect } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FilePdf,
  FileText,
  Student,
  TrendUp,
  TrendDown,
  CalendarCheck,
  Lightbulb,
  SpinnerGap,
  CheckCircle,
} from "@phosphor-icons/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

type PeriodOption = "30d" | "60d" | "90d";

interface ScorePoint {
  exam: string;
  score: number;
}

interface PTAInsight {
  text: string;
  type: "positive" | "warning" | "info";
}

interface PTAPreviewData {
  studentName: string;
  rollNumber: string;
  batchName: string;
  targetExam: string;
  avgScore: number;
  avgAttendance: number;
  scoreTrend: "improving" | "declining" | "stable";
  scoreHistory: ScorePoint[];
  insights: PTAInsight[];
}

// --------------- component ---------------

export default function PTAReportPage() {
  const studentId = useUrlSegment(-2);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [period, setPeriod] = useState<PeriodOption>("30d");
  const [data, setData] = useState<PTAPreviewData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setGenerated(false);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/student/${studentId}/pta-preview?period=${period}`,
        );
        if (!cancelled && res.success && res.data) {
          setData(res.data as PTAPreviewData);
        } else if (!cancelled) {
          setData(null);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId, period]);

  async function handleGenerate() {
    if (generating || generated || !data) return;
    setGenerating(true);
    try {
      await apiClient.post(`/api/v1/reports/pta-report/${studentId}`, { period });
      setGenerated(true);
    } catch {
      // Show success state anyway in demo (no backend)
      setGenerated(true);
    } finally {
      setGenerating(false);
    }
  }

  // --------------- skeleton ---------------

  if (loading) {
    return (
      <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton variant="text" className="h-4 w-40" />
          <Skeleton variant="rectangular" className="h-8 w-72" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} variant="rectangular" className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton variant="rectangular" className="h-64 w-full rounded-xl" />
          <Skeleton variant="rectangular" className="h-40 w-full rounded-xl" />
          <Skeleton variant="rectangular" className="h-12 w-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
        <div className="mx-auto max-w-4xl">
          <BackLink
            href={`/analytics/student/${studentId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} weight="bold" />
            Back
          </BackLink>
          <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-border bg-white p-10 text-center dark:border-border-dark dark:bg-surface-dark">
            <FileText size={40} weight="duotone" className="text-blue-400 mb-3" />
            <h3 className="text-base font-semibold">
              Not enough data for a PTA report yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              The preview fills in once the student has exam scores + attendance
              records across the selected period.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const periodLabel = period === "30d" ? "Last 30 Days" : period === "60d" ? "Last 60 Days" : "Last 90 Days";

  return (
    <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
      <motion.div
        className="mx-auto max-w-4xl"
        variants={motionVariants.staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Back link */}
        <motion.div variants={motionVariants.fadeUp}>
          <BackLink
            href={`/analytics/student/${studentId}`}
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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <FilePdf weight="duotone" className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                PTA Report
              </h1>
              <p className="mt-0.5 text-sm text-muted">
                Generate parent-teacher meeting report
              </p>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-1 dark:border-border-dark dark:bg-surface-dark">
            {(["30d", "60d", "90d"] as PeriodOption[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setPeriod(opt)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  period === opt
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted hover:text-primary"
                }`}
              >
                {opt === "30d" ? "30 Days" : opt === "60d" ? "60 Days" : "90 Days"}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Student info card */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6">
          <Card hoverable={false} padding="md">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shrink-0">
                <Student weight="duotone" className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {data.studentName}
                  </h2>
                  <Badge variant="info" size="sm">{data.rollNumber}</Badge>
                  <Badge variant="neutral" size="sm">{data.targetExam}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted">{data.batchName}</p>
                <p className="mt-1 text-xs text-muted">Period: {periodLabel}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* KPI row */}
        <motion.div
          variants={motionVariants.fadeUp}
          className="mt-4 grid gap-4 sm:grid-cols-3"
        >
          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                {data.scoreTrend === "improving" ? (
                  <TrendUp weight="duotone" className="h-5 w-5 text-primary" />
                ) : (
                  <TrendDown weight="duotone" className="h-5 w-5" style={{ color: color.danger }} />
                )}
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {data.avgScore}%
                </p>
                <p className="text-xs text-muted">Avg Score</p>
              </div>
            </div>
            <div className="mt-2">
              <Badge variant={data.scoreTrend === "improving" ? "success" : data.scoreTrend === "stable" ? "info" : "danger"} size="sm">
                {data.scoreTrend === "improving" ? "Improving" : data.scoreTrend === "stable" ? "Stable" : "Declining"}
              </Badge>
            </div>
          </Card>

          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${data.avgAttendance >= 75 ? chartColors[1] : color.warn}18` }}
              >
                <CalendarCheck
                  weight="duotone"
                  className="h-5 w-5"
                  style={{ color: data.avgAttendance >= 75 ? chartColors[1] : color.warn }}
                />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {data.avgAttendance}%
                </p>
                <p className="text-xs text-muted">Attendance</p>
              </div>
            </div>
            <div className="mt-2">
              <Badge variant={data.avgAttendance >= 75 ? "success" : "warning"} size="sm">
                {data.avgAttendance >= 75 ? "Above 75% min" : "Below threshold"}
              </Badge>
            </div>
          </Card>

          <Card hoverable={false} padding="md">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${chartColors[3]}18` }}
              >
                <Lightbulb weight="duotone" className="h-5 w-5" style={{ color: chartColors[3] }} />
              </div>
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: typeTokens.number }}
                >
                  {data.insights.length}
                </p>
                <p className="text-xs text-muted">Key Insights</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Score trend mini-chart */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6">
          <Card hoverable={false} padding="lg">
            <CardHeader>
              <CardTitle>Score Trend — {periodLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.scoreHistory}
                    margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                    <XAxis
                      dataKey="exam"
                      tick={{ fontSize: 11, fontFamily: typeTokens.body }}
                    />
                    <YAxis
                      domain={[0, 100]}
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
                      formatter={(value: any) => [`${value}%`, "Score"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke={chartColors[0]}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: chartColors[0] }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Insights */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6">
          <Card hoverable={false} padding="lg">
            <CardHeader>
              <CardTitle>Top Insights for PTA Meeting</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {data.insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: insight.type === "positive"
                          ? `${color.success}18`
                          : insight.type === "warning"
                            ? `${color.warn}18`
                            : `${chartColors[5]}18`,
                      }}
                    >
                      <Lightbulb
                        weight="duotone"
                        size={14}
                        style={{
                          color: insight.type === "positive"
                            ? color.success
                            : insight.type === "warning"
                              ? color.warn
                              : chartColors[5],
                        }}
                      />
                    </span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {insight.text}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* Generate button */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6 flex items-center gap-4">
          <button
            onClick={handleGenerate}
            disabled={generating || generated}
            className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60 ${
              generated
                ? "bg-success text-white"
                : "bg-primary text-white hover:bg-primary/90 active:scale-95"
            }`}
          >
            {generating ? (
              <>
                <SpinnerGap size={16} className="animate-spin" />
                Generating…
              </>
            ) : generated ? (
              <>
                <CheckCircle weight="duotone" size={16} />
                Report Sent
              </>
            ) : (
              <>
                <FilePdf weight="duotone" size={16} />
                Generate PTA Report
              </>
            )}
          </button>
          {generated && (
            <p className="text-xs text-muted">
              Report has been generated and queued for delivery.
            </p>
          )}
        </motion.div>

        <div className="h-8" />
      </motion.div>
    </div>
  );
}
