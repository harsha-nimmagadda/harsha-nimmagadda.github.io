"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ChartLineUp,
  Users,
  TrendDown,
  WarningCircle,
  CaretDown,
  Funnel,
  Fire,
} from "@phosphor-icons/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { BackLink } from "@/components/back-link";
import { useBackNavigation } from "@/components/back-link";

/* eslint-disable @typescript-eslint/no-explicit-any */

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

// ── Types ────────────────────────────────────────────────────
interface BatchTrend {
  batchId: string;
  batchName: string;
  scores: { examName: string; avg: number }[];
}

interface BatchStats {
  batchName: string;
  mean: number;
  median: number;
  stddev: number;
}

interface SubjectHeat {
  subject: string;
  batches: { batchName: string; trend: "improving" | "declining" | "stable" }[];
}

interface AtRiskStudent {
  name: string;
  batch: string;
  recentScores: number[];
  drop: number;
}

interface CumulativeData {
  batchTrends: BatchTrend[];
  batchStats: BatchStats[];
  subjectHeatmap: SubjectHeat[];
  atRisk: AtRiskStudent[];
}

// ── Demo data ────────────────────────────────────────────────
const EXAM_NAMES = ["Unit Test 1", "Mock 1", "Unit Test 2", "Mock 2", "Unit Test 3"];
const BATCH_COLORS = ["#2563EB", "#10B981", "#F59E0B"];

function makeDemoData(): CumulativeData {
  // Deterministic jitter to avoid SSR/client hydration mismatch
  const jitter = [2, 3, 1, 4, 2];
  const batchTrends: BatchTrend[] = [
    {
      batchId: "b1",
      batchName: "JEE Titans",
      scores: EXAM_NAMES.map((e, i) => ({ examName: e, avg: 62 + i * 3 + jitter[i] })),
    },
    {
      batchId: "b2",
      batchName: "NEET Warriors",
      scores: EXAM_NAMES.map((e, i) => ({ examName: e, avg: 55 + i * 2 + jitter[(i + 1) % 5] })),
    },
    {
      batchId: "b3",
      batchName: "CLAT Scholars",
      scores: EXAM_NAMES.map((e, i) => ({ examName: e, avg: Math.round(70 - i * 1.5 + jitter[(i + 2) % 5]) })),
    },
  ];

  const batchStats: BatchStats[] = [
    { batchName: "JEE Titans", mean: 71.2, median: 72, stddev: 8.4 },
    { batchName: "NEET Warriors", mean: 63.5, median: 64, stddev: 11.2 },
    { batchName: "CLAT Scholars", mean: 66.8, median: 67, stddev: 7.1 },
  ];

  const subjects = ["Physics", "Chemistry", "Mathematics", "Biology"];
  const trendOptions = ["improving", "declining", "stable"] as const;
  const subjectHeatmap: SubjectHeat[] = subjects.map((subject, si) => ({
    subject,
    batches: batchStats.map((b, bi) => ({
      batchName: b.batchName,
      trend: trendOptions[(si + bi) % 3],
    })),
  }));

  const atRisk: AtRiskStudent[] = [
    { name: "Arjun Patel", batch: "JEE Titans", recentScores: [68, 61, 55], drop: 13 },
    { name: "Priya Sharma", batch: "NEET Warriors", recentScores: [72, 65, 58], drop: 14 },
    { name: "Rohan Verma", batch: "CLAT Scholars", recentScores: [60, 54, 48], drop: 12 },
    { name: "Sneha Gupta", batch: "JEE Titans", recentScores: [55, 50, 44], drop: 11 },
  ];

  return { batchTrends, batchStats, subjectHeatmap, atRisk };
}

// ── Filters ──────────────────────────────────────────────────
const EXAM_TYPES = ["All", "Mock Test", "Unit Test"] as const;
const DATE_RANGES = ["Last 30 days", "Last 90 days", "This Year"] as const;

export default function CumulativeExamAnalysisPage() {
  const router = useRouter();
  // Fallback only — a deep-linked tab has no history to go back to.
  const goBack = useBackNavigation("/analytics");
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [data, setData] = useState<CumulativeData | null>(null);

  const [examType, setExamType] = useState<(typeof EXAM_TYPES)[number]>("All");
  const [dateRange, setDateRange] = useState<(typeof DATE_RANGES)[number]>("Last 90 days");
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());

  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [examDropdownOpen, setExamDropdownOpen] = useState(false);
  const [batchDropdownOpen, setBatchDropdownOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    async function fetchData() {
      setLoading(true);
      try {
        const [instRes, trendRes] = await Promise.all([
          apiClient.get<any>("/api/v1/analytics/institution"),
          apiClient.get<any>("/api/v1/analytics/institution/trends"),
        ]);

        if (instRes.success && trendRes.success) {
          const batchTrends: BatchTrend[] = (trendRes.data?.batchTrends || []).map((bt: any) => ({
            batchId: bt.batchId || bt.id,
            batchName: bt.batchName || bt.name,
            scores: (bt.scores || bt.examScores || []).map((s: any) => ({
              examName: s.examName || s.name,
              avg: s.avg ?? s.average ?? 0,
            })),
          }));
          const batchStats: BatchStats[] = (trendRes.data?.batchStats || instRes.data?.batchStats || []).map((b: any) => ({
            batchName: b.batchName || b.name,
            mean: b.mean ?? b.average ?? 0,
            median: b.median ?? 0,
            stddev: b.stddev ?? b.standardDeviation ?? 0,
          }));
          const subjectHeatmap: SubjectHeat[] = (trendRes.data?.subjectHeatmap || []).map((s: any) => ({
            subject: s.subject,
            batches: (s.batches || []).map((b: any) => ({
              batchName: b.batchName || b.name,
              trend: b.trend || "stable",
            })),
          }));
          const atRisk: AtRiskStudent[] = (instRes.data?.atRiskStudents || instRes.data?.atRisk || []).map((s: any) => ({
            name: s.name,
            batch: s.batch || s.batchName || "--",
            recentScores: s.recentScores || s.scores || [],
            drop: s.drop ?? (s.recentScores ? s.recentScores[0] - s.recentScores[s.recentScores.length - 1] : 0),
          }));

          setData({ batchTrends, batchStats, subjectHeatmap, atRisk });
          setSelectedBatches(new Set(batchTrends.map((b) => b.batchId)));
          setIsDemo(false);
        } else {
          throw new Error("API returned unsuccessful response");
        }
      } catch {
        const demo = makeDemoData();
        setData(demo);
        setSelectedBatches(new Set(demo.batchTrends.map((b) => b.batchId)));
        setIsDemo(true);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [authLoading, isAuthenticated, router]);

  // Build multi-line chart data
  const chartData = useMemo(() => {
    if (!data) return [];
    const examNames = data.batchTrends[0]?.scores.map((s) => s.examName) || [];
    return examNames.map((exam, idx) => {
      const point: Record<string, any> = { exam };
      for (const bt of data.batchTrends) {
        if (selectedBatches.has(bt.batchId)) {
          point[bt.batchName] = bt.scores[idx]?.avg ?? null;
        }
      }
      return point;
    });
  }, [data, selectedBatches]);

  const toggleBatch = (batchId: string) => {
    setSelectedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen overflow-y-auto bg-bg p-8 dark:bg-bg-dark">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-8 w-64 rounded-lg skeleton-shimmer-soft/70" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl skeleton-shimmer-soft/70" />
            ))}
          </div>
          <div className="h-80 rounded-2xl skeleton-shimmer-soft/70" />
          <div className="h-48 rounded-2xl skeleton-shimmer-soft/70" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg dark:bg-bg-dark">
        <div className="text-center">
          <WarningCircle size={40} weight="duotone" className="mx-auto text-danger" />
          <p className="mt-2 text-sm text-danger">Failed to load data</p>
          <button onClick={goBack} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white">
            Back
          </button>
        </div>
      </div>
    );
  }

  const trendIcon = (trend: string) => {
    if (trend === "improving") return <span className="text-success font-medium text-xs">Improving</span>;
    if (trend === "declining") return <span className="text-danger font-medium text-xs">Declining</span>;
    return <span className="text-muted font-medium text-xs">Stable</span>;
  };

  const trendBg = (trend: string) => {
    if (trend === "improving") return "bg-success/10";
    if (trend === "declining") return "bg-danger/10";
    return "bg-slate-50/70";
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-bg p-6 dark:bg-bg-dark lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <BackLink
            href="/analytics"
            className="mb-4 flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} weight="bold" /> Back
          </BackLink>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Cumulative Exam Analysis
          </h1>
          <p className="mt-1 text-sm text-muted">
            Compare batch performance across multiple exams over time
          </p>
        </motion.div>

        {/* Demo Banner */}
        {isDemo && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-200"
          >
            <WarningCircle size={18} weight="duotone" />
            Showing demo data. Live data will appear once exams are conducted.
          </motion.div>
        )}

        {/* Filters */}
        <motion.div
          className="mt-6 flex flex-wrap items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Funnel size={18} weight="duotone" className="text-muted" />

          {/* Exam Type Dropdown */}
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/5 dark:border-border-dark dark:bg-surface-dark"
              onClick={() => setExamDropdownOpen(!examDropdownOpen)}
            >
              {examType}
              <CaretDown size={12} weight="bold" className={examDropdownOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
            <AnimatePresence>
              {examDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 z-50 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-surface shadow-lg dark:border-border-dark dark:bg-surface-dark"
                >
                  {EXAM_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setExamType(t); setExamDropdownOpen(false); }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark ${examType === t ? "bg-primary/5 font-semibold text-primary" : ""}`}
                    >
                      {t}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Date Range Dropdown */}
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/5 dark:border-border-dark dark:bg-surface-dark"
              onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
            >
              {dateRange}
              <CaretDown size={12} weight="bold" className={dateDropdownOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
            <AnimatePresence>
              {dateDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-surface shadow-lg dark:border-border-dark dark:bg-surface-dark"
                >
                  {DATE_RANGES.map((r) => (
                    <button
                      key={r}
                      onClick={() => { setDateRange(r); setDateDropdownOpen(false); }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark ${dateRange === r ? "bg-primary/5 font-semibold text-primary" : ""}`}
                    >
                      {r}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Batch Multi-select */}
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/5 dark:border-border-dark dark:bg-surface-dark"
              onClick={() => setBatchDropdownOpen(!batchDropdownOpen)}
            >
              Batches ({selectedBatches.size})
              <CaretDown size={12} weight="bold" className={batchDropdownOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
            <AnimatePresence>
              {batchDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 z-50 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-surface p-2 shadow-lg dark:border-border-dark dark:bg-surface-dark"
                >
                  {data.batchTrends.map((bt) => (
                    <label
                      key={bt.batchId}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBatches.has(bt.batchId)}
                        onChange={() => toggleBatch(bt.batchId)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                      />
                      {bt.batchName}
                    </label>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Score Trend Chart */}
        <motion.div
          className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <div className="flex items-center gap-2">
            <ChartLineUp size={20} weight="duotone" className="text-primary" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Score Trend Across Exams</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted">Average batch scores per exam, one line per selected batch</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                <XAxis dataKey="exam" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(value: any) => [`${value}%`, ""]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {data.batchTrends
                  .filter((bt) => selectedBatches.has(bt.batchId))
                  .map((bt, i) => (
                    <Line
                      key={bt.batchId}
                      type="monotone"
                      dataKey={bt.batchName}
                      stroke={BATCH_COLORS[i % BATCH_COLORS.length]}
                      strokeWidth={2.5}
                      dot={{ r: 4, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Average Score Table + Subject Heatmap */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Average Score Table */}
          <motion.div
            className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center gap-2">
              <Users size={20} weight="duotone" className="text-primary" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Batch Statistics</h2>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted dark:border-border-dark">
                    <th className="pb-2 pr-4 font-medium">Batch</th>
                    <th className="pb-2 pr-4 font-medium text-right">Mean</th>
                    <th className="pb-2 pr-4 font-medium text-right">Median</th>
                    <th className="pb-2 font-medium text-right">Std Dev</th>
                  </tr>
                </thead>
                <tbody>
                  {data.batchStats.map((b) => (
                    <tr key={b.batchName} className="border-b border-border/50 last:border-0 dark:border-border-dark/50">
                      <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white">{b.batchName}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-primary">{b.mean.toFixed(1)}%</td>
                      <td className="py-2.5 pr-4 text-right font-mono">{b.median}%</td>
                      <td className="py-2.5 text-right font-mono text-muted">{b.stddev.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Subject Heatmap */}
          <motion.div
            className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2">
              <Fire size={20} weight="duotone" className="text-orange-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Subject Trend Heatmap</h2>
            </div>
            <p className="mt-0.5 text-xs text-muted">Per subject trend by batch (improving / declining / stable)</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted dark:border-border-dark">
                    <th className="pb-2 pr-4 font-medium">Subject</th>
                    {data.batchStats.map((b) => (
                      <th key={b.batchName} className="pb-2 pr-2 text-center font-medium">{b.batchName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.subjectHeatmap.map((sh) => (
                    <tr key={sh.subject} className="border-b border-border/50 last:border-0 dark:border-border-dark/50">
                      <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white">{sh.subject}</td>
                      {sh.batches.map((b) => (
                        <td key={b.batchName} className="py-2.5 pr-2 text-center">
                          <span className={`inline-block rounded-lg px-2 py-0.5 ${trendBg(b.trend)}`}>
                            {trendIcon(b.trend)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* At-Risk Students */}
        <motion.div
          className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-center gap-2">
            <TrendDown size={20} weight="duotone" className="text-danger" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Emerging At-Risk Students</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted">Students declining across 3+ consecutive exams</p>

          {data.atRisk.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No at-risk students detected.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.atRisk.map((s, idx) => (
                <motion.div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.05 }}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.name}</p>
                    <p className="text-xs text-muted">{s.batch}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {s.recentScores.map((score, si) => (
                        <span
                          key={si}
                          className="inline-block rounded-md bg-white px-1.5 py-0.5 font-mono text-xs font-medium dark:bg-surface-dark"
                        >
                          {score}%
                        </span>
                      ))}
                    </div>
                    <span className="rounded-lg bg-danger/10 px-2 py-0.5 font-mono text-xs font-bold text-danger">
                      -{s.drop} pts
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
