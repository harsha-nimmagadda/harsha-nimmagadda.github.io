"use client";

import { useState, useEffect, useMemo } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion } from "framer-motion";
import { ArrowLeft, Flag, CheckCircle } from "@phosphor-icons/react";
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
  Badge,
  Skeleton,
  motionVariants,
  analyticsTokens,
} from "@brilliance/ui";
const { chartColors, color, surface, type: typeTokens } = analyticsTokens;
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";

/* eslint-disable @typescript-eslint/no-explicit-any */

// --------------- types ---------------

interface QuestionDiscrimination {
  questionNumber: number;
  questionId: string;
  discriminationIndex: number;
  topQuartilePercent: number;
  bottomQuartilePercent: number;
  flagged: boolean;
  flagReason: string | null;
}

interface DiscriminationData {
  batchName: string;
  examName: string;
  questions: QuestionDiscrimination[];
  averageDiscrimination: number;
  flaggedCount: number;
}

// --------------- demo data ---------------

const FLAG_REASONS = [
  "Top performers scored lower than bottom performers",
  "Discrimination index below 0.2 — question may be ambiguous",
  "Negative discrimination — likely flawed or mis-keyed",
  "Near-zero discrimination — no differentiating power",
];

function generateDemoData(examId: string): DiscriminationData {
  const count = 30;
  const questions: QuestionDiscrimination[] = Array.from(
    { length: count },
    (_, i) => {
      // Most questions have decent discrimination; a few are poor
      const isPoor = Math.random() < 0.2;
      const isNegative = isPoor && Math.random() < 0.35;

      const topPct = isNegative
        ? Math.round(30 + Math.random() * 25)
        : Math.round(60 + Math.random() * 35);
      const bottomPct = isNegative
        ? Math.round(topPct + Math.random() * 15)
        : isPoor
          ? Math.round(topPct - Math.random() * 10)
          : Math.round(10 + Math.random() * 35);

      const di = Number(((topPct - bottomPct) / 100).toFixed(2));
      const flagged = di < 0.2;
      let flagReason: string | null = null;
      if (flagged) {
        if (di < 0) flagReason = FLAG_REASONS[2];
        else if (di < 0.1) flagReason = FLAG_REASONS[3];
        else flagReason = FLAG_REASONS[1];
        if (topPct < bottomPct) flagReason = FLAG_REASONS[0];
      }

      return {
        questionNumber: i + 1,
        questionId: `q-${examId}-${String(i + 1).padStart(3, "0")}`,
        discriminationIndex: di,
        topQuartilePercent: topPct,
        bottomQuartilePercent: bottomPct,
        flagged,
        flagReason,
      };
    },
  );

  const total = questions.reduce((s, q) => s + q.discriminationIndex, 0);
  const flaggedCount = questions.filter((q) => q.flagged).length;

  return {
    batchName: "JEE Advanced 2026 — Batch A",
    examName: "Unit Test 3 — Electrostatics",
    questions,
    averageDiscrimination: Number((total / count).toFixed(2)),
    flaggedCount,
  };
}

// --------------- component ---------------

export default function DiscriminationPage() {
  const batchId = useUrlSegment(-3);
  const examId = useUrlSegment(-1);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiscriminationData | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/batch/${batchId}/discrimination/${examId}`,
        );
        if (!cancelled && res.success && res.data) {
          setIsDemo(false);
          setData(res.data as DiscriminationData);
        } else if (!cancelled) {
          setIsDemo(true);
          setData(generateDemoData(examId));
        }
      } catch {
        if (!cancelled) { setIsDemo(true); setData(generateDemoData(examId)); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [batchId, examId]);

  const flaggedQuestions = useMemo(
    () => (data ? data.questions.filter((q) => q.flagged) : []),
    [data],
  );

  // --------------- skeletons ---------------

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton variant="text" className="h-4 w-40" />
          <Skeleton variant="rectangular" className="h-8 w-80" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton variant="rectangular" className="h-72 w-full rounded-xl" />
          <Skeleton variant="rectangular" className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
      <motion.div
        className="mx-auto max-w-6xl"
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
        <motion.div variants={motionVariants.fadeUp}>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Question Discrimination Index
          </h1>
          <p className="mt-1 text-sm text-muted">
            {data.batchName} &middot; {data.examName}
          </p>
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
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              Avg Discrimination
            </p>
            <p
              className="mt-2 text-3xl font-bold text-primary"
              style={{ fontFamily: typeTokens.number }}
            >
              {data.averageDiscrimination.toFixed(2)}
            </p>
          </Card>
          <Card hoverable={false} padding="md">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              Total Questions
            </p>
            <p
              className="mt-2 text-3xl font-bold text-gray-900 dark:text-white"
              style={{ fontFamily: typeTokens.number }}
            >
              {data.questions.length}
            </p>
          </Card>
          <Card hoverable={false} padding="md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Flagged Questions
              </p>
              {data.flaggedCount > 0 && (
                <Badge variant="danger" size="sm" dot>
                  Needs Review
                </Badge>
              )}
            </div>
            <p
              className="mt-2 text-3xl font-bold"
              style={{
                fontFamily: typeTokens.number,
                color: data.flaggedCount > 0 ? color.danger : color.success,
              }}
            >
              {data.flaggedCount}
            </p>
          </Card>
        </motion.div>

        {/* Bar chart — discrimination index per question */}
        <motion.div variants={motionVariants.fadeUp} className="mt-6">
          <Card hoverable={false} padding="lg">
            <CardHeader>
              <CardTitle>Discrimination Index by Question</CardTitle>
              <p className="text-xs text-muted">
                Values below 0.2 (red line) indicate poorly discriminating questions.
                Negative values suggest the question may be flawed or mis-keyed.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-72 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.questions}
                    margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border, #e5e7eb)"
                    />
                    <XAxis
                      dataKey="questionNumber"
                      tick={{ fontSize: 10, fontFamily: typeTokens.number }}
                      label={{
                        value: "Question #",
                        position: "insideBottom",
                        offset: -2,
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fontFamily: typeTokens.number }}
                      domain={[-0.3, 1]}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: surface.radius.md,
                        border: "1px solid #e5e7eb",
                        fontSize: 12,
                        fontFamily: typeTokens.body,
                      }}
                      formatter={(value: any) => [
                        Number(value).toFixed(2),
                        "Discrimination Index",
                      ]}
                      labelFormatter={(label) => `Question ${label}`}
                    />
                    <ReferenceLine
                      y={0.2}
                      stroke={color.danger}
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: "Threshold (0.2)",
                        position: "right",
                        fontSize: 10,
                        fill: color.danger,
                      }}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="#94A3B8"
                      strokeWidth={1}
                    />
                    <Bar dataKey="discriminationIndex" radius={[3, 3, 0, 0]}>
                      {data.questions.map((q) => (
                        <Cell
                          key={q.questionId}
                          fill={
                            q.flagged
                              ? color.danger
                              : q.discriminationIndex >= 0.4
                                ? color.success
                                : chartColors[0]
                          }
                          fillOpacity={q.flagged ? 0.85 : 0.7}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Flagged questions table */}
        {flaggedQuestions.length > 0 && (
          <motion.div variants={motionVariants.fadeUp} className="mt-6">
            <Card hoverable={false} padding="none">
              <div className="flex items-center gap-3 px-6 pt-6 pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger/10">
                  <Flag weight="duotone" className="h-5 w-5 text-danger" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    Flagged Questions
                  </h2>
                  <p className="text-xs text-muted">
                    {flaggedQuestions.length} question{flaggedQuestions.length !== 1 ? "s" : ""} with
                    discrimination index below 0.2
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
                      <th className="px-6 py-3">Q #</th>
                      <th className="px-4 py-3 text-right">DI</th>
                      <th className="px-4 py-3 text-right">Top 25%</th>
                      <th className="px-4 py-3 text-right">Bottom 25%</th>
                      <th className="px-4 py-3">Flag Reason</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flaggedQuestions.map((q) => (
                      <motion.tr
                        key={q.questionId}
                        variants={motionVariants.fadeUp}
                        className="border-b border-border/30 transition-colors hover:bg-danger/[0.03] dark:border-border-dark/30"
                      >
                        <td className="px-6 py-3">
                          <span
                            className="font-bold text-gray-900 dark:text-white"
                            style={{ fontFamily: typeTokens.number }}
                          >
                            {q.questionNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className="font-bold text-danger"
                            style={{ fontFamily: typeTokens.number }}
                          >
                            {q.discriminationIndex.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span style={{ fontFamily: typeTokens.number }}>
                            {q.topQuartilePercent}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span style={{ fontFamily: typeTokens.number }}>
                            {q.bottomQuartilePercent}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted">
                          {q.flagReason || "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="danger" size="sm">
                            <Flag size={10} weight="fill" />
                            Review
                          </Badge>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}

        {/* All clear message if nothing flagged */}
        {flaggedQuestions.length === 0 && (
          <motion.div variants={motionVariants.fadeUp} className="mt-6">
            <Card hoverable={false} padding="lg">
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle
                  weight="duotone"
                  className="h-12 w-12 text-success"
                />
                <p className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                  All Questions Pass
                </p>
                <p className="mt-1 text-sm text-muted">
                  No questions were flagged with poor discrimination. Every item
                  effectively differentiates between high and low performers.
                </p>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Legend */}
        <motion.div variants={motionVariants.fadeUp} className="mt-4 mb-8">
          <p className="text-xs text-muted">
            <span className="mr-4 inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: color.success }}
              />
              Good (DI &ge; 0.4)
            </span>
            <span className="mr-4 inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: chartColors[0] }}
              />
              Acceptable (0.2 &le; DI &lt; 0.4)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: color.danger }}
              />
              Flagged (DI &lt; 0.2)
            </span>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
