"use client";

// ============================================================
// BRILLIANCE — Admin: Student Attendance x Performance
// Scatter chart + correlation coefficient + impact bands.
// ============================================================

import { useEffect, useState } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion } from "framer-motion";
import { ArrowLeft, Users, UserCircle, Calendar } from "@phosphor-icons/react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
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
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";

/* eslint-disable @typescript-eslint/no-explicit-any */

const { color, chartColors } = analyticsTokens;

// --------------- types ---------------

interface StudentDot {
  name: string;
  attendance: number;
  score: number;
  isTarget: boolean;
}

interface AbsenceBand {
  label: string;
  avgScore: number;
  count: number;
}

interface AttendanceData {
  students: StudentDot[];
  bands: AbsenceBand[];
  correlation: number;
  targetAttendance: number;
  targetScore: number;
}

// --------------- custom tooltip ---------------

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium">
        {d.isTarget ? "This Student" : `Student ${d.name}`}
      </p>
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-muted-foreground">Attendance</span>
        <span
          className="font-semibold text-right"
          style={{ fontFamily: analyticsTokens.type.number }}
        >
          {d.attendance}%
        </span>
        <span className="text-muted-foreground">Avg Score</span>
        <span
          className="font-semibold text-right"
          style={{ fontFamily: analyticsTokens.type.number }}
        >
          {d.score}%
        </span>
      </div>
    </div>
  );
}

// --------------- component ---------------

export default function AdminStudentAttendanceImpactPage() {
  const studentId = useUrlSegment(-2);

  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/student/${studentId}/attendance-impact`,
        );
        if (alive && res.success && res.data) setData(res.data);
        else if (alive) setData(null);
      } catch {
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchData();
    return () => {
      alive = false;
    };
  }, [studentId]);

  // Optional-chain each hop: older responses and the empty-state
  // payload omit `students` entirely, so `data.students.filter`
  // crashed on first render before loading finished.
  const peers = data?.students?.filter((s) => !s.isTarget) ?? [];
  const target = data?.students?.find((s) => s.isTarget);

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
          Correlation
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Attendance x Performance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How attendance predicts exam scores in this student&apos;s batch.
        </p>
      </motion.header>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && (
        <motion.div
          variants={motionVariants.fadeUp}
          className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white p-10 text-center dark:border-border-dark dark:bg-surface-dark"
        >
          <Calendar size={40} weight="duotone" className="text-blue-400 mb-3" />
          <h3 className="text-base font-semibold">
            No attendance correlation yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Populates once this student&apos;s batch has enough attendance
            records and exam submissions to correlate.
          </p>
        </motion.div>
      )}

      {!loading && data && (
        <>
          {/* Correlation insight */}
          <motion.div variants={motionVariants.fadeUp} className="mb-5">
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Correlation Coefficient
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {data.correlation == null
                      ? "Not enough exam + attendance data yet"
                      : `Attendance ${data.correlation >= 0.5 ? "strongly" : "moderately"} predicts performance`}
                  </p>
                </div>
                <p
                  className="text-3xl font-bold text-blue-600"
                  style={{ fontFamily: analyticsTokens.type.number }}
                >
                  {data.correlation == null
                    ? "—"
                    : `r=${data.correlation.toFixed(2)}`}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Student position */}
          <motion.div variants={motionVariants.fadeUp} className="mb-5">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <UserCircle
                    size={24}
                    weight="duotone"
                    className="text-blue-600"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Student Position</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Attendance{" "}
                    <span
                      className="font-semibold text-foreground"
                      style={{ fontFamily: analyticsTokens.type.number }}
                    >
                      {data.targetAttendance ?? "—"}%
                    </span>
                    {" | "}Avg Score{" "}
                    <span
                      className="font-semibold text-foreground"
                      style={{ fontFamily: analyticsTokens.type.number }}
                    >
                      {data.targetScore ?? "—"}%
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Scatter chart */}
          <motion.div variants={motionVariants.fadeUp} className="mb-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Batch Distribution</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      margin={{ top: 8, right: 8, bottom: 4, left: -8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        className="text-border"
                        opacity={0.3}
                      />
                      <XAxis
                        dataKey="attendance"
                        type="number"
                        name="Attendance"
                        unit="%"
                        domain={[50, 100]}
                        tick={{ fontSize: 10 }}
                        stroke="currentColor"
                        className="text-muted-foreground"
                        label={{
                          value: "Attendance %",
                          position: "insideBottom",
                          offset: -2,
                          style: { fontSize: 10, fill: "currentColor" },
                        }}
                      />
                      <YAxis
                        dataKey="score"
                        type="number"
                        name="Avg Score"
                        unit="%"
                        domain={[30, 100]}
                        tick={{ fontSize: 10 }}
                        stroke="currentColor"
                        className="text-muted-foreground"
                        label={{
                          value: "Exam Score %",
                          angle: -90,
                          position: "insideLeft",
                          offset: 16,
                          style: { fontSize: 10, fill: "currentColor" },
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Scatter
                        name="Peers"
                        data={peers}
                        fill={chartColors[0]}
                        fillOpacity={0.35}
                        stroke={chartColors[0]}
                        strokeWidth={1}
                        r={5}
                      />
                      {target && (
                        <Scatter
                          name="This Student"
                          data={[target]}
                          fill={color.danger}
                          stroke={color.danger}
                          strokeWidth={2}
                          r={8}
                        />
                      )}
                      <ReferenceLine
                        y={data.targetScore}
                        stroke={color.danger}
                        strokeDasharray="4 4"
                        strokeOpacity={0.4}
                      />
                      <ReferenceLine
                        x={data.targetAttendance}
                        stroke={color.danger}
                        strokeDasharray="4 4"
                        strokeOpacity={0.4}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: chartColors[0], opacity: 0.6 }}
                    />
                    Peers
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: color.danger }}
                    />
                    This Student
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Impact table */}
          <motion.div variants={motionVariants.fadeUp}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users size={16} weight="duotone" className="text-blue-600" />
                  <CardTitle className="text-sm">
                    Impact by Absence Band
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {(data.bands ?? []).map((band) => (
                    <div
                      key={band.label}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{band.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {band.count} students
                        </p>
                      </div>
                      <p
                        className="text-lg font-bold"
                        style={{
                          fontFamily: analyticsTokens.type.number,
                          color:
                            band.avgScore >= 70
                              ? color.success
                              : band.avgScore >= 55
                                ? color.warn
                                : color.danger,
                        }}
                      >
                        {band.avgScore}%
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          avg
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </motion.main>
  );
}
