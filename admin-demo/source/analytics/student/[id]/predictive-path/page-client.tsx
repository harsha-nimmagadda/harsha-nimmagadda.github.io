"use client";

// ============================================================
// BRILLIANCE — Admin: Student Predictive Path
// Linear regression forecast with confidence band.
// ============================================================

import { useEffect, useState } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion } from "framer-motion";
import { ArrowLeft, TrendUp, TrendDown, ChartLineUp } from "@phosphor-icons/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
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
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";

const { color } = analyticsTokens;

// --------------- types ---------------

interface ExamPoint {
  label: string;
  score: number;
  predicted?: boolean;
  upper?: number;
  lower?: number;
}

interface PredictiveData {
  points: ExamPoint[];
  predictedNext: number;
  trend: "up" | "down" | "flat";
  confidence: number;
  trendDelta: number;
}

// --------------- component ---------------

export default function AdminStudentPredictivePathPage() {
  const studentId = useUrlSegment(-2);

  const [data, setData] = useState<PredictiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function fetchData() {
      setLoading(true);
      try {
        // The /predictions endpoint returns scalar rank/percentile values.
        // This page renders a points[]-based regression chart, which is
        // what /predictive-path returns.
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/student/${studentId}/predictive-path`,
        );
        if (res.success && res.data && Array.isArray(res.data.points)) {
          setData(res.data);
        } else {
          setData(null);
        }
      } catch {
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchData();
    return () => {
      alive = false;
    };
  }, [studentId]);

  // Defensive: API may return rows where `points` is undefined / shape
  // mismatch. Don't crash the page — fall through to the empty state.
  const points = data?.points ?? [];
  const pastPoints = points.filter((p) => !p.predicted);
  const futurePoints = points.filter((p) => p.predicted);
  const transitionPoint =
    pastPoints.length > 0 ? pastPoints[pastPoints.length - 1] : null;

  const chartData = points.map((p) => ({
    label: p.label,
    score: p.predicted ? undefined : p.score,
    projected: p.predicted ? p.score : undefined,
    bridge:
      transitionPoint && p.label === transitionPoint.label
        ? p.score
        : p.predicted
          ? p.score
          : undefined,
    upper: p.upper,
    lower: p.lower,
  }));

  return (
    <motion.main
      initial="hidden"
      animate="visible"
      variants={motionVariants.staggerContainer}
      className="mx-auto max-w-5xl px-6 pb-16 pt-8"
    >
      {/* Back link */}
      <motion.div variants={motionVariants.fadeUp} className="mb-6">
        <BackLink
          href={`/analytics/student/${studentId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} weight="bold" />
          Back
        </BackLink>
      </motion.div>

      {/* Header */}
      <motion.header variants={motionVariants.fadeUp} className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
          Forecast
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Predictive Path
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Where this student&apos;s scores are headed, based on trajectory.
        </p>
      </motion.header>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      )}

      {/* Empty state */}
      {!loading && (!data || points.length === 0) && (
        <motion.div
          variants={motionVariants.fadeUp}
          className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white p-10 text-center dark:border-border-dark dark:bg-surface-dark"
        >
          <ChartLineUp
            size={40}
            weight="duotone"
            className="text-blue-400 mb-3"
          />
          <h3 className="text-base font-semibold">
            No forecast data yet
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Populates once the student has enough recent exam scores to model a
            trajectory.
          </p>
        </motion.div>
      )}

      {!loading && data && points.length > 0 && (
        <>
          {/* KPI row */}
          <motion.div
            variants={motionVariants.fadeUp}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-[11px] text-muted-foreground mb-1">
                  Next Exam
                </p>
                <p
                  className="text-2xl font-bold text-blue-600"
                  style={{ fontFamily: analyticsTokens.type.number }}
                >
                  {data.predictedNext}
                </p>
                <p className="text-[10px] text-muted-foreground">predicted</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-[11px] text-muted-foreground mb-1">Trend</p>
                <Badge
                  variant={data.trend === "up" ? "success" : "danger"}
                  className="gap-1"
                >
                  {data.trend === "up" ? (
                    <TrendUp size={12} weight="bold" />
                  ) : (
                    <TrendDown size={12} weight="bold" />
                  )}
                  <span style={{ fontFamily: analyticsTokens.type.number }}>
                    +{data.trendDelta}
                  </span>
                  /exam
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-[11px] text-muted-foreground mb-1">
                  Confidence
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{
                    fontFamily: analyticsTokens.type.number,
                    color: color.success,
                  }}
                >
                  {data.confidence}%
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Chart */}
          <motion.div variants={motionVariants.fadeUp}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Score Trajectory + Forecast
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        className="text-border"
                        opacity={0.3}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        stroke="currentColor"
                        className="text-muted-foreground"
                        interval={0}
                        angle={-35}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis
                        domain={[40, 100]}
                        tick={{ fontSize: 10 }}
                        stroke="currentColor"
                        className="text-muted-foreground"
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          fontSize: 12,
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                          color: "hsl(var(--foreground))",
                        }}
                      />

                      <Line
                        dataKey="upper"
                        stroke="none"
                        fill="none"
                        dot={false}
                        activeDot={false}
                        connectNulls={false}
                      />
                      <Line
                        dataKey="lower"
                        stroke="none"
                        fill="none"
                        dot={false}
                        activeDot={false}
                        connectNulls={false}
                      />

                      {futurePoints.length >= 2 && (
                        <ReferenceArea
                          x1={transitionPoint?.label}
                          x2={futurePoints[futurePoints.length - 1].label}
                          y1={Math.min(
                            ...futurePoints.map((p) => (p.lower ?? p.score) - 2),
                          )}
                          y2={Math.max(
                            ...futurePoints.map((p) => (p.upper ?? p.score) + 2),
                          )}
                          fill={color.brand}
                          fillOpacity={0.08}
                          stroke={color.brand}
                          strokeOpacity={0.2}
                          strokeDasharray="4 4"
                        />
                      )}

                      {transitionPoint && (
                        <ReferenceLine
                          x={transitionPoint.label}
                          stroke={color.brand}
                          strokeDasharray="4 4"
                          strokeOpacity={0.4}
                        />
                      )}

                      <Line
                        dataKey="score"
                        stroke={color.brand}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: color.brand }}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                      />

                      <Line
                        dataKey="bridge"
                        stroke={color.brand}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={{ r: 3, fill: color.brand, strokeDasharray: "0" }}
                        connectNulls
                        opacity={0.6}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 bg-blue-600 rounded-full inline-block" />
                    Actual
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-0.5 w-4 bg-blue-600/50 rounded-full inline-block"
                      style={{
                        borderTop: "2px dashed",
                        borderColor: color.brand,
                      }}
                    />
                    Projected
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-3 w-3 rounded-sm inline-block"
                      style={{
                        background: `${color.brand}14`,
                        border: `1px dashed ${color.brand}40`,
                      }}
                    />
                    Confidence
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </motion.main>
  );
}
