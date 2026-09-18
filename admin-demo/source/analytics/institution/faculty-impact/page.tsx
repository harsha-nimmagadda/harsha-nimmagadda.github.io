"use client";

// ============================================================
// BRILLIANCE — Faculty Impact Ranking (Institution Analytics)
// Horizontal bar chart + detail table ranking faculty by avg
// student score delta over selected period.
// ============================================================

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChalkboardTeacher,
  TrendUp,
} from "@phosphor-icons/react";
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
const { chartColors } = analyticsTokens;
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Types ────────────────────────────────────────────────────
interface FacultyImpact {
  facultyId: string;
  name: string;
  batch: string;
  subject: string;
  avgScoreDelta: number;
  studentCount: number;
  topDrivers: string;
}

interface FacultyImpactResponse {
  faculty: FacultyImpact[];
}

type Period = "rolling_90d" | "this_month" | "this_quarter" | "ytd";

const PERIOD_LABELS: Record<Period, string> = {
  rolling_90d: "Rolling 90d",
  this_month: "This month",
  this_quarter: "This quarter",
  ytd: "YTD",
};

// ── Helpers ──────────────────────────────────────────────────
function barColor(delta: number): string {
  if (delta >= 10) return chartColors[1]; // green
  if (delta >= 6) return chartColors[0]; // blue
  if (delta >= 3) return chartColors[2]; // amber
  return chartColors[4]; // red
}

// ── Page ─────────────────────────────────────────────────────
export default function FacultyImpactPage() {
  const [faculty, setFaculty] = useState<FacultyImpact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("rolling_90d");

  useEffect(() => {
    let alive = true;
    setLoading(true);

    apiClient
      .get<FacultyImpactResponse>(
        `/api/v1/analytics/v3/institution/faculty-impact?period=${period}`,
      )
      .then((res) => {
        if (!alive) return;
        if (res.success && res.data?.faculty?.length) {
          setFaculty(res.data.faculty);
        } else {
          setFaculty([]);
          setError(
            "No faculty impact metrics yet. They populate after the first nightly analytics run.",
          );
        }
      })
      .catch(() => {
        if (!alive) return;
        setFaculty([]);
        setError("Could not load faculty impact data — please retry.");
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [period]);

  // Sort descending for chart
  const sorted = [...faculty].sort(
    (a, b) => b.avgScoreDelta - a.avgScoreDelta,
  );

  // ── Skeleton ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Skeleton className="mb-2 h-5 w-32" />
        <Skeleton className="mb-6 h-9 w-72" />
        <div className="mb-6 flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="mt-6 h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.main
      initial="hidden"
      animate="visible"
      variants={motionVariants.staggerContainer}
      className="mx-auto max-w-5xl px-6 py-10"
    >
      {/* Back link */}
      <motion.div variants={motionVariants.fadeUp}>
        <BackLink
          href="/analytics"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} weight="bold" />
          Back
        </BackLink>
      </motion.div>

      {/* Header */}
      <motion.header variants={motionVariants.fadeUp} className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Faculty Impact
        </h1>
        <p className="mt-1 text-muted-foreground">
          Faculty ranked by average student score improvement.
        </p>
      </motion.header>

      {/* Error banner */}
      {error && (
        <motion.div variants={motionVariants.fadeUp} className="mb-6">
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardContent className="py-3 text-sm text-amber-700 dark:text-amber-300">
              {error}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Period tabs */}
      <motion.div
        variants={motionVariants.fadeUp}
        className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-white p-1 dark:border-border-dark dark:bg-surface-dark"
      >
        {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
                period === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ),
        )}
      </motion.div>

      {/* Horizontal bar chart */}
      <motion.div variants={motionVariants.fadeUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ChalkboardTeacher size={20} weight="duotone" />
              Score Delta by Faculty
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={sorted.length * 56 + 32}>
              <BarChart
                data={sorted}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  className="stroke-border"
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  domain={[0, "auto"]}
                  unit=" pts"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 13 }}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    fontSize: 13,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                  }}
                  formatter={(value: number) => [
                    `+${value.toFixed(1)} pts`,
                    "Avg Score Delta",
                  ]}
                />
                <Bar dataKey="avgScoreDelta" radius={[0, 6, 6, 0]} barSize={28}>
                  {sorted.map((entry) => (
                    <Cell
                      key={entry.facultyId}
                      fill={barColor(entry.avgScoreDelta)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Detail table */}
      <motion.div variants={motionVariants.fadeUp} className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendUp size={20} weight="duotone" />
              Detailed Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Faculty</th>
                  <th className="pb-3 font-medium">Batch</th>
                  <th className="pb-3 font-medium">Subject</th>
                  <th className="pb-3 text-right font-medium">
                    Avg Delta
                  </th>
                  <th className="pb-3 text-right font-medium">
                    Students
                  </th>
                  <th className="pb-3 font-medium">Top Drivers</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((f) => (
                  <tr
                    key={f.facultyId}
                    className="border-b last:border-0 hover:bg-primary/5"
                  >
                    <td className="py-3 font-medium">{f.name}</td>
                    <td className="py-3 text-muted-foreground">{f.batch}</td>
                    <td className="py-3">
                      <Badge variant="neutral">{f.subject}</Badge>
                    </td>
                    <td
                      className="py-3 text-right font-semibold"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{f.avgScoreDelta.toFixed(1)}
                      </span>
                    </td>
                    <td
                      className="py-3 text-right"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      {f.studentCount}
                    </td>
                    <td className="max-w-xs py-3 text-xs leading-relaxed text-muted-foreground">
                      {f.topDrivers}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </motion.div>
    </motion.main>
  );
}
