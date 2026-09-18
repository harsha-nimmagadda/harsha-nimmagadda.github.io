"use client";

// ============================================================
// BRILLIANCE — Admin: Student Time vs Performance Scatter
// Each dot = one session. X = time, Y = accuracy, color = subject.
// ============================================================

import { useEffect, useState } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion } from "framer-motion";
import { ArrowLeft, Timer } from "@phosphor-icons/react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
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

const { chartColors } = analyticsTokens;

// --------------- types ---------------

interface SessionPoint {
  subject: string;
  timeMinutes: number;
  accuracy: number;
  label: string;
}

interface TimeVsData {
  points: SessionPoint[];
  subjects: string[];
}

const SUBJECT_COLORS: Record<string, string> = {
  Physics: chartColors[0],
  Chemistry: chartColors[1],
  Mathematics: chartColors[2],
};

// --------------- custom tooltip ---------------

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium">{d.label}</p>
      <p className="text-muted-foreground mt-0.5">{d.subject}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-muted-foreground">Time</span>
        <span
          className="font-semibold text-right"
          style={{ fontFamily: analyticsTokens.type.number }}
        >
          {d.timeMinutes}m
        </span>
        <span className="text-muted-foreground">Accuracy</span>
        <span
          className="font-semibold text-right"
          style={{ fontFamily: analyticsTokens.type.number }}
        >
          {d.accuracy}%
        </span>
      </div>
    </div>
  );
}

// --------------- component ---------------

export default function AdminStudentTimeVsPerformancePage() {
  const studentId = useUrlSegment(-2);

  const [data, setData] = useState<TimeVsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/student/${studentId}/time-vs-performance`,
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

  // Defensive: API may return shapes without `points`/`subjects`. Guard
  // every access — the page rendered demo data before, but per user
  // direction we now show real data or an empty state, never fakes.
  const points = data?.points ?? [];
  const subjects = data?.subjects ?? [];
  const subjectAvgs =
    subjects.map((subj) => {
      const pts = points.filter((p) => p.subject === subj);
      const avgTime = Math.round(
        pts.reduce((a, b) => a + b.timeMinutes, 0) / pts.length,
      );
      const avgAcc = Math.round(
        pts.reduce((a, b) => a + b.accuracy, 0) / pts.length,
      );
      return { subject: subj, avgTime, avgAcc, count: pts.length };
    }) ?? [];

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
          Efficiency
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Time vs Performance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How time invested correlates with accuracy.
        </p>
      </motion.header>

      {/* Empty state */}
      {!loading && (!data || points.length === 0) && (
        <motion.div
          variants={motionVariants.fadeUp}
          className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white p-10 text-center dark:border-border-dark dark:bg-surface-dark"
        >
          <Timer size={40} weight="duotone" className="text-blue-400 mb-3" />
          <h3 className="text-base font-semibold">No session data yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Time-vs-accuracy scatter populates once the student has completed
            a few exam sessions with time tracking.
          </p>
        </motion.div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {!loading && data && points.length > 0 && (
        <>
          {/* Subject summary cards */}
          <motion.div
            variants={motionVariants.fadeUp}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            {subjectAvgs.map((sa) => (
              <Card key={sa.subject}>
                <CardContent className="p-3 text-center">
                  <div
                    className="h-1.5 w-8 rounded-full mx-auto mb-2"
                    style={{ background: SUBJECT_COLORS[sa.subject] }}
                  />
                  <p className="text-[11px] text-muted-foreground mb-0.5 truncate">
                    {sa.subject}
                  </p>
                  <p
                    className="text-lg font-bold"
                    style={{ fontFamily: analyticsTokens.type.number }}
                  >
                    {sa.avgAcc}%
                  </p>
                  <p
                    className="text-[10px] text-muted-foreground"
                    style={{ fontFamily: analyticsTokens.type.number }}
                  >
                    ~{sa.avgTime}m avg
                  </p>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* Scatter chart */}
          <motion.div variants={motionVariants.fadeUp}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Session Distribution</CardTitle>
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
                        dataKey="timeMinutes"
                        type="number"
                        name="Time"
                        unit="m"
                        tick={{ fontSize: 10 }}
                        stroke="currentColor"
                        className="text-muted-foreground"
                        label={{
                          value: "Time (min)",
                          position: "insideBottom",
                          offset: -2,
                          style: { fontSize: 10, fill: "currentColor" },
                        }}
                      />
                      <YAxis
                        dataKey="accuracy"
                        type="number"
                        name="Accuracy"
                        unit="%"
                        domain={[30, 100]}
                        tick={{ fontSize: 10 }}
                        stroke="currentColor"
                        className="text-muted-foreground"
                        label={{
                          value: "Accuracy %",
                          angle: -90,
                          position: "insideLeft",
                          offset: 16,
                          style: { fontSize: 10, fill: "currentColor" },
                        }}
                      />
                      <ZAxis range={[48, 48]} />
                      <Tooltip content={<CustomTooltip />} />

                      {subjects.map((subj) => (
                        <Scatter
                          key={subj}
                          name={subj}
                          data={points.filter((p) => p.subject === subj)}
                          fill={SUBJECT_COLORS[subj]}
                          fillOpacity={0.8}
                          shape="circle"
                        />
                      ))}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                  {subjects.map((subj) => (
                    <span key={subj} className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full inline-block"
                        style={{ background: SUBJECT_COLORS[subj] }}
                      />
                      {subj}
                    </span>
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
