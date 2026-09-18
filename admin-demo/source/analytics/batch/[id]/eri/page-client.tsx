"use client";

import { useState, useMemo } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  TrendUp,
  ChartBar,
  WarningCircle,
  Users,
  Lightning,
  CaretUp,
  CaretDown,
} from "@phosphor-icons/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BackLink } from "@/components/back-link";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

// ── Demo data ────────────────────────────────────────────────

const BATCH_KPI = {
  avgEri: 62,
  topEri: 85,
  lowestEri: 28,
  studentCount: 48,
};

// Bell curve distribution (ERI 0-100 in buckets of 10)
const BELL_CURVE_DATA = [
  { range: "0-10", count: 0 },
  { range: "10-20", count: 1 },
  { range: "20-30", count: 3 },
  { range: "30-40", count: 5 },
  { range: "40-50", count: 8 },
  { range: "50-60", count: 11 },
  { range: "60-70", count: 9 },
  { range: "70-80", count: 6 },
  { range: "80-90", count: 4 },
  { range: "90-100", count: 1 },
];

const LEADERBOARD = [
  { rank: 1, name: "Arjun Mehta", eri: 85, level: "Advanced", velocity: "+3.2" },
  { rank: 2, name: "Priya Sharma", eri: 82, level: "Advanced", velocity: "+2.8" },
  { rank: 3, name: "Rohan Gupta", eri: 79, level: "Proficient", velocity: "+1.5" },
  { rank: 4, name: "Ananya Reddy", eri: 76, level: "Proficient", velocity: "+2.1" },
  { rank: 5, name: "Karan Singh", eri: 73, level: "Proficient", velocity: "+0.9" },
  { rank: 6, name: "Neha Patel", eri: 70, level: "Proficient", velocity: "+1.8" },
  { rank: 7, name: "Aditya Kumar", eri: 67, level: "Intermediate", velocity: "+1.2" },
  { rank: 8, name: "Shreya Iyer", eri: 64, level: "Intermediate", velocity: "-0.3" },
  { rank: 9, name: "Vikram Joshi", eri: 58, level: "Intermediate", velocity: "+0.7" },
  { rank: 10, name: "Meera Das", eri: 52, level: "Developing", velocity: "-1.1" },
];

const WEAK_CELLS = [
  { topic: "Thermodynamics", qtype: "Numerical", difficulty: "Hard", avgMastery: 22 },
  { topic: "Organic Chemistry", qtype: "MCQ", difficulty: "Hard", avgMastery: 28 },
  { topic: "Differential Equations", qtype: "Numerical", difficulty: "Hard", avgMastery: 31 },
  { topic: "Electrostatics", qtype: "Assertion-Reason", difficulty: "Medium", avgMastery: 35 },
  { topic: "Coordination Chemistry", qtype: "MCQ", difficulty: "Medium", avgMastery: 38 },
];

// ── Helpers ──────────────────────────────────────────────────

function eriLevelColor(level: string): string {
  switch (level.toLowerCase()) {
    case "advanced":
      return "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30";
    case "proficient":
      return "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30";
    case "intermediate":
      return "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30";
    case "developing":
      return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30";
    default:
      return "text-muted bg-slate-50/70";
  }
}

function masteryBarColor(mastery: number): string {
  if (mastery >= 60) return "#10B981";
  if (mastery >= 40) return "#F59E0B";
  return "#EF4444";
}

type SortField = "rank" | "name" | "eri" | "velocity";
type SortDir = "asc" | "desc";

// ── Page ─────────────────────────────────────────────────────

export default function ERIBatchPage() {
  const batchId = useUrlSegment(-2);

  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "rank" ? "asc" : "desc");
    }
  };

  const sortedLeaderboard = useMemo(
    () =>
      [...LEADERBOARD].sort((a, b) => {
        const mul = sortDir === "asc" ? 1 : -1;
        if (sortField === "name") return mul * a.name.localeCompare(b.name);
        if (sortField === "velocity")
          return mul * (parseFloat(a.velocity) - parseFloat(b.velocity));
        return mul * ((a[sortField] ?? 0) - (b[sortField] ?? 0));
      }),
    [sortField, sortDir],
  );

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <CaretUp size={10} weight="bold" />
    ) : (
      <CaretDown size={10} weight="bold" />
    );
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-bg p-6 dark:bg-bg-dark lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <BackLink
            href={`/analytics/batch/${batchId}`}
            className="mb-4 flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} /> Back
          </BackLink>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                ERI Distribution
              </h1>
              <p className="mt-1 text-sm text-muted">
                Exam Readiness Index across the batch
              </p>
            </div>
          </div>
        </motion.div>

        {/* Demo banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          Demo data — ERI computation is in design phase.
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mt-6 space-y-6"
        >
          {/* KPI Cards */}
          <motion.div
            variants={fadeUp}
            className="grid grid-cols-2 gap-4 lg:grid-cols-4"
          >
            {[
              {
                label: "Batch Avg ERI",
                value: BATCH_KPI.avgEri,
                icon: ChartBar,
                color: "text-primary",
              },
              {
                label: "Top ERI",
                value: BATCH_KPI.topEri,
                icon: Trophy,
                color: "text-emerald-600 dark:text-emerald-400",
              },
              {
                label: "Lowest ERI",
                value: BATCH_KPI.lowestEri,
                icon: WarningCircle,
                color: "text-red-600 dark:text-red-400",
              },
              {
                label: "Students",
                value: BATCH_KPI.studentCount,
                icon: Users,
                color: "text-muted",
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark"
              >
                <kpi.icon
                  weight="duotone"
                  className={`mb-2 h-5 w-5 ${kpi.color}`}
                />
                <p className={`font-mono text-3xl font-bold ${kpi.color}`}>
                  {kpi.value}
                </p>
                <p className="mt-1 text-xs text-muted">{kpi.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Bell Curve Chart */}
          <motion.div
            variants={fadeUp}
            className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
          >
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              ERI Bell Curve
            </h2>
            <p className="text-xs text-muted">
              Distribution of ERI scores across the batch
            </p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={BELL_CURVE_DATA}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border, #e5e7eb)"
                  />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                    label={{
                      value: "Students",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 11 },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [
                      `${value} students`,
                      "Count",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#2563EB"
                    fill="#2563EB"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Leaderboard */}
          <motion.div
            variants={fadeUp}
            className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
          >
            <div className="mb-4 flex items-center gap-2">
              <Trophy weight="duotone" className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                ERI Leaderboard
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
                    <th
                      className="cursor-pointer pb-2 pr-4"
                      onClick={() => toggleSort("rank")}
                    >
                      <span className="flex items-center gap-1">
                        Rank {renderSortIcon("rank")}
                      </span>
                    </th>
                    <th
                      className="cursor-pointer pb-2 pr-4"
                      onClick={() => toggleSort("name")}
                    >
                      <span className="flex items-center gap-1">
                        Student {renderSortIcon("name")}
                      </span>
                    </th>
                    <th
                      className="cursor-pointer pb-2 pr-4 text-right"
                      onClick={() => toggleSort("eri")}
                    >
                      <span className="flex items-center justify-end gap-1">
                        ERI {renderSortIcon("eri")}
                      </span>
                    </th>
                    <th className="pb-2 pr-4">Level</th>
                    <th
                      className="cursor-pointer pb-2 text-right"
                      onClick={() => toggleSort("velocity")}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Weekly Velocity {renderSortIcon("velocity")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLeaderboard.map((student) => {
                    const vel = parseFloat(student.velocity);
                    return (
                      <tr
                        key={student.rank}
                        className="border-b border-border/50 last:border-0 dark:border-border-dark/50"
                      >
                        <td className="py-3 pr-4">
                          <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                            #{student.rank}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-200">
                          {student.name}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono font-bold text-primary">
                          {student.eri}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${eriLevelColor(student.level)}`}
                          >
                            {student.level}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-sm font-semibold ${vel >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                          >
                            {vel >= 0 ? (
                              <TrendUp size={14} weight="bold" />
                            ) : (
                              <Lightning size={14} weight="bold" />
                            )}
                            {student.velocity}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Common Weak Cells */}
          <motion.div
            variants={fadeUp}
            className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
          >
            <div className="mb-4 flex items-center gap-2">
              <WarningCircle
                weight="duotone"
                className="h-5 w-5 text-red-500"
              />
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Common Weak Cells
                </h2>
                <p className="text-xs text-muted">
                  Cells where most students are below mastery threshold
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {WEAK_CELLS.map((cell, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-xl border border-border/50 p-4 dark:border-border-dark/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {cell.topic}
                      </span>
                      <span className="text-xs text-muted">x</span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-zinc-800 dark:text-gray-400">
                        {cell.qtype}
                      </span>
                      <span className="text-xs text-muted">x</span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-zinc-800 dark:text-gray-400">
                        {cell.difficulty}
                      </span>
                    </div>
                    {/* Mastery bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${cell.avgMastery}%`,
                            backgroundColor: masteryBarColor(cell.avgMastery),
                          }}
                        />
                      </div>
                      <span
                        className="font-mono text-xs font-bold"
                        style={{
                          color: masteryBarColor(cell.avgMastery),
                        }}
                      >
                        {cell.avgMastery}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
