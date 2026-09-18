"use client";

// ============================================================
// BRILLIANCE — Admin: Student Rank & College Predictor
// AIR prediction, college list, what-if analysis.
// ============================================================

import { useEffect, useState, useMemo } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  TrendUp,
  TrendDown,
  Trophy,
  ShieldCheck,
  Crosshair,
  SlidersHorizontal,
  ChartLineUp,
  Info,
  CaretRight,
} from "@phosphor-icons/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Card,
  CardContent,
  Skeleton,
  motionVariants,
  analyticsTokens,
} from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";
import { InfoTooltip } from "@/components/info-tooltip";
import { BackLink } from "@/components/back-link";

/* eslint-disable @typescript-eslint/no-explicit-any */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

const MONO = { fontFamily: "JetBrains Mono, monospace" };

interface College {
  name: string;
  program: string;
  closingRank: number;
}

interface DataSource {
  source: "josaa-scrape" | "fallback";
  year?: number;
  round?: number;
  category?: string;
  subCategory?: string;
  quota?: string;
}

interface RankData {
  predictedAIR: number;
  rankLow: number;
  rankHigh: number;
  confidence: number;
  trend: "improving" | "declining" | "stable";
  category: string;
  categoryRank: number | null;
  basedOnScore: number;
  maxScore: number;
  predictedPercentile: number;
  totalCandidates: number;
  targetExam: string;
  trendHistory: { exam: string; rank: number }[];
  colleges: {
    safe: College[];
    moderate: College[];
    ambitious: College[];
  };
}

function formatRank(n: number): string {
  return n.toLocaleString("en-IN");
}

// Map a what-if score to a realistic AIR via percentile — not by scaling the
// current rank. Percentile math handles both JEE (1.2M candidates) and NEET
// (2M candidates) correctly, and doesn't collapse to AIR=1 for students
// already at the ceiling of their predicted percentile.
function interpolateRank(
  score: number,
  maxScore: number,
  basedOnScore: number,
  basedOnPercentile: number,
  totalCandidates: number,
): number {
  if (maxScore <= 0 || totalCandidates <= 0) return 1;
  const scoreDelta = score - basedOnScore;
  // 1 score point ≈ (100 / maxScore) percentile points. Rough linear
  // approximation — works fine inside the exam's score range.
  const percentileDelta = (scoreDelta * 100) / maxScore;
  const newPercentile = Math.min(
    99.99,
    Math.max(0, basedOnPercentile + percentileDelta),
  );
  return Math.max(
    1,
    Math.round(totalCandidates * (1 - newPercentile / 100)),
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{label}</p>
      <p className="mt-0.5 text-muted-foreground">
        AIR:{" "}
        <span className="font-semibold" style={MONO}>
          {formatRank(payload[0].value)}
        </span>
      </p>
    </div>
  );
}

interface CutoffHistoryEntry {
  year: number;
  round: number;
  closingRank: number;
}

function CutoffHistoryTooltip({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{label}</p>
      <p className="mt-0.5 text-muted-foreground">
        Closing Rank:{" "}
        <span className="font-semibold" style={MONO}>
          {formatRank(payload[0].value)}
        </span>
      </p>
    </div>
  );
}

function CutoffHistoryPanel({
  institute,
  program,
  enabled,
}: {
  institute: string;
  program: string;
  enabled: boolean;
}) {
  // Central defaults — if these ever become dynamic, include them in the
  // queryKey below so different filter combos don't share a cache entry.
  const category = "general";
  const subCategory = "gender_neutral";
  const quota = "AI";
  const qs = new URLSearchParams({
    institute,
    program,
    category,
    subCategory,
    quota,
  }).toString();

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "cutoff-history",
      institute,
      program,
      category,
      subCategory,
      quota,
    ],
    queryFn: async () => {
      const res = await apiClient.get<any>(
        `/api/v1/predictions/colleges/cutoff-history?${qs}`,
      );
      if (!res.success) return { history: [] as CutoffHistoryEntry[] };
      const raw = res.data;
      const history: CutoffHistoryEntry[] = Array.isArray(raw?.history)
        ? raw.history
        : Array.isArray(raw)
          ? raw
          : [];
      return { history };
    },
    // Only fire when the row is actually open. Mount-gating works today,
    // but this keeps the safety net if the panel is ever refactored to
    // always-mount.
    enabled,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }

  const history: CutoffHistoryEntry[] = isError ? [] : (data?.history ?? []);

  if (history.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          No historical data for this combo yet
        </p>
      </div>
    );
  }

  const chartData = [...history]
    .sort((a, b) => a.year - b.year || a.round - b.round)
    .map((h) => ({
      year: `${h.year}${h.round ? ` R${h.round}` : ""}`,
      rank: h.closingRank,
    }));

  return (
    <div className="p-4 space-y-4">
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10, fill: "#6B7280" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              reversed
              tick={{
                fontSize: 10,
                fill: "#6B7280",
                fontFamily: "JetBrains Mono, monospace",
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatRank(v)}
              width={56}
            />
            <Tooltip content={<CutoffHistoryTooltip />} />
            <Line
              type="monotone"
              dataKey="rank"
              stroke="#2563EB"
              strokeWidth={2.5}
              dot={{ fill: "#2563EB", r: 3.5, strokeWidth: 0 }}
              activeDot={{ r: 5.5, fill: "#2563EB", stroke: "#fff", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-white overflow-hidden dark:border-border-dark dark:bg-surface-dark">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border dark:border-border-dark">
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Year</th>
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                <span className="inline-flex items-center">
                  Round
                  <InfoTooltip term="Round" />
                </span>
              </th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                <span className="inline-flex items-center justify-end">
                  Closing Rank
                  <InfoTooltip term="Closing Rank" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, i) => (
              <tr
                key={`${h.year}-${h.round}-${i}`}
                className="border-t border-border/50 dark:border-border-dark/50"
              >
                <td className="px-3 py-2" style={MONO}>
                  {h.year}
                </td>
                <td className="px-3 py-2" style={MONO}>
                  {h.round}
                </td>
                <td className="px-3 py-2 text-right font-medium" style={MONO}>
                  #{formatRank(h.closingRank)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CollegeRow({
  college,
  expandedKey,
  setExpandedKey,
}: {
  college: College;
  expandedKey: string | null;
  setExpandedKey: (key: string | null) => void;
}) {
  const key = `${college.name}::${college.program}`;
  const isExpanded = expandedKey === key;

  return (
    <div
      className={`rounded-xl overflow-hidden transition-colors ${
        isExpanded
          ? "bg-blue-50/60 dark:bg-blue-950/20"
          : "bg-white/60 dark:bg-white/5"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold">{college.name}</p>
          <p className="text-xs text-muted-foreground">{college.program}</p>
        </div>
        <span className="text-xs font-medium text-muted-foreground" style={MONO}>
          #{formatRank(college.closingRank)}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setExpandedKey(isExpanded ? null : key)}
        className="flex w-full items-center gap-1 px-3 pb-2 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        aria-expanded={isExpanded}
      >
        <motion.span
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="inline-flex"
        >
          <CaretRight size={10} weight="bold" />
        </motion.span>
        {isExpanded ? "Hide cutoff trend" : "View cutoff trend"}
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-3 rounded-xl border border-border bg-white dark:border-border-dark dark:bg-surface-dark">
              <CutoffHistoryPanel
                institute={college.name}
                program={college.program}
                enabled={isExpanded}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CollegeBucket({
  title,
  icon,
  colorClass,
  bgClass,
  colleges,
  tooltipTerm,
  expandedKey,
  setExpandedKey,
}: {
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  colleges: College[];
  tooltipTerm?: string;
  expandedKey: string | null;
  setExpandedKey: (key: string | null) => void;
}) {
  if (colleges.length === 0) return null;
  return (
    <motion.div variants={fadeUp} className={`rounded-2xl p-4 ${bgClass}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${colorClass} inline-flex items-center`}
        >
          {title}
          {tooltipTerm && <InfoTooltip term={tooltipTerm} />}
        </span>
      </div>
      <div className="space-y-2">
        {colleges.map((c) => (
          <CollegeRow
            key={`${c.name}-${c.program}`}
            college={c}
            expandedKey={expandedKey}
            setExpandedKey={setExpandedKey}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default function AdminStudentRankPredictorPage() {
  const studentId = useUrlSegment(-2);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RankData | null>(null);
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [whatIfScore, setWhatIfScore] = useState<number>(0);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function fetchData() {
      setLoading(true);
      try {
        const [rankRes, collegeRes] = await Promise.all([
          apiClient.get<any>(`/api/v1/predictions/student/${studentId}/rank`),
          apiClient.get<any>(`/api/v1/predictions/student/${studentId}/colleges`),
        ]);
        if (rankRes.success && rankRes.data) {
          const rd = rankRes.data;
          const cd = collegeRes.success ? collegeRes.data : null;
          const ds: DataSource | null = cd?.dataSource ?? null;
          const next: RankData = {
            predictedAIR: rd.predictedAIR ?? rd.predictedRank ?? 0,
            rankLow: rd.rankLow ?? rd.rangeLow ?? 0,
            rankHigh: rd.rankHigh ?? rd.rangeHigh ?? 0,
            confidence: rd.confidence ?? 0,
            trend: rd.trend ?? "stable",
            category: rd.category ?? "general",
            categoryRank: rd.categoryRank ?? null,
            basedOnScore: rd.basedOnScore ?? rd.score ?? 0,
            maxScore: rd.maxScore ?? 0,
            predictedPercentile: rd.predictedPercentile ?? 0,
            totalCandidates: rd.totalCandidates ?? 1200000,
            targetExam: rd.targetExam ?? "jee_mains",
            trendHistory: rd.trendHistory ?? rd.rankHistory ?? [],
            colleges: {
              safe: cd?.safe ?? cd?.colleges?.safe ?? [],
              moderate: cd?.moderate ?? cd?.colleges?.moderate ?? [],
              ambitious: cd?.ambitious ?? cd?.colleges?.ambitious ?? [],
            },
          };
          if (alive) {
            setData(next);
            setDataSource(ds);
            setWhatIfScore(next.basedOnScore);
          }
        } else {
          if (alive) {
            setData(null);
            setDataSource(null);
          }
        }
      } catch {
        if (alive) {
          setData(null);
          setDataSource(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchData();
    return () => {
      alive = false;
    };
  }, [studentId]);

  const maxScore = data?.maxScore ?? 0;
  const basedOnScore = data?.basedOnScore ?? 0;
  const predictedPercentile = data?.predictedPercentile ?? 0;
  const totalCandidates = data?.totalCandidates ?? 1200000;

  const whatIfRank = useMemo(
    () =>
      interpolateRank(
        whatIfScore,
        maxScore,
        basedOnScore,
        predictedPercentile,
        totalCandidates,
      ),
    [whatIfScore, maxScore, basedOnScore, predictedPercentile, totalCandidates],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 pt-8 space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <motion.div
        className="mx-auto max-w-5xl px-6 pb-16 pt-8"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeUp} className="mb-6">
          <BackLink
            href={`/analytics/student/${studentId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} weight="bold" />
            Back
          </BackLink>
        </motion.div>
        <motion.header variants={fadeUp} className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
            Predictions
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Rank Predictor
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Based on this student&apos;s recent mock performance.
          </p>
        </motion.header>
        <motion.div
          variants={fadeUp}
          className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white p-10 text-center dark:border-border-dark dark:bg-surface-dark"
        >
          <ChartLineUp
            size={40}
            weight="duotone"
            className="text-blue-400 mb-3"
          />
          <h3 className="text-base font-semibold">No rank prediction yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Populates after the student has enough recent mock exam scores for
            the predictor to project a reliable AIR.
          </p>
        </motion.div>
      </motion.div>
    );
  }

  const isImproving = data.trend === "improving";
  const scorePercent = data.maxScore
    ? Math.round((whatIfScore / data.maxScore) * 100)
    : 0;
  const trendHistory = data.trendHistory ?? [];
  const safeColleges = data.colleges?.safe ?? [];
  const moderateColleges = data.colleges?.moderate ?? [];
  const ambitiousColleges = data.colleges?.ambitious ?? [];

  const dataSourceLabel = (() => {
    if (dataSource?.source !== "josaa-scrape") {
      return "approximate last-year cutoffs (fallback)";
    }
    // Every field is optional on the wire — if any is missing, drop back
    // to a short label rather than rendering "JoSAA undefined Round undefined".
    const { year, round, category, subCategory, quota } = dataSource;
    if (!year || !round || !category || !subCategory || !quota) {
      return "JoSAA (partial metadata)";
    }
    return `JoSAA ${year} Round ${round}, ${category}/${subCategory.replace(
      "_",
      "-",
    )}/${quota}`;
  })();

  return (
    <motion.div
      className="mx-auto max-w-5xl px-6 pb-16 pt-8"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Back link */}
      <motion.div variants={fadeUp} className="mb-6">
        <BackLink
          href={`/analytics/student/${studentId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} weight="bold" />
          Back
        </BackLink>
      </motion.div>

      {/* Header */}
      <motion.header variants={fadeUp} className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
          Predictions
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Rank Predictor
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Based on this student&apos;s recent mock performance.
        </p>
      </motion.header>

      {/* Hero Rank Banner */}
      <motion.div
        variants={scaleIn}
        className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 p-6 shadow-lg"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-blue-200">
              Predicted All India Rank
            </p>
            <p className="mt-2 text-4xl font-extrabold text-white" style={MONO}>
              ~{formatRank(data.predictedAIR)}
            </p>
            <p className="mt-1 text-sm text-blue-200" style={MONO}>
              {formatRank(data.rankLow)} &mdash; {formatRank(data.rankHigh)} range
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-sm">
              {isImproving ? (
                <TrendUp size={16} weight="bold" className="text-emerald-300" />
              ) : (
                <TrendDown size={16} weight="bold" className="text-red-300" />
              )}
              <span className="text-xs font-semibold text-white">
                {isImproving ? "Improving" : "Declining"}
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-sm">
              <span className="text-[10px] font-medium text-blue-200">Confidence</span>
              <span className="text-xs font-bold text-white" style={MONO}>
                {data.confidence}%
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
          <span className="text-xs text-blue-200">Based on score</span>
          <span className="text-sm font-bold text-white" style={MONO}>
            {data.basedOnScore}/{data.maxScore}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white/70"
              initial={{ width: 0 }}
              animate={{ width: `${(data.basedOnScore / data.maxScore) * 100}%` }}
              transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>

      {/* College Buckets */}
      <motion.div variants={fadeUp} className="mt-5">
        <h3 className="mb-3 inline-flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          College Predictions
          <InfoTooltip term="Data Source" />
        </h3>
        <div className="space-y-3">
          <CollegeBucket
            title="Safe"
            icon={<ShieldCheck size={16} weight="duotone" className="text-emerald-500" />}
            colorClass="text-emerald-600"
            bgClass="bg-emerald-50 dark:bg-emerald-900/20"
            colleges={safeColleges}
            tooltipTerm="Safe College"
            expandedKey={expandedKey}
            setExpandedKey={setExpandedKey}
          />
          <CollegeBucket
            title="Moderate"
            icon={<Crosshair size={16} weight="duotone" className="text-amber-500" />}
            colorClass="text-amber-600"
            bgClass="bg-amber-50 dark:bg-amber-900/20"
            colleges={moderateColleges}
            expandedKey={expandedKey}
            setExpandedKey={setExpandedKey}
          />
          <CollegeBucket
            title="Ambitious"
            icon={<Trophy size={16} weight="duotone" className="text-red-500" />}
            colorClass="text-red-600"
            bgClass="bg-red-50 dark:bg-red-900/20"
            colleges={ambitiousColleges}
            tooltipTerm="Ambitious College"
            expandedKey={expandedKey}
            setExpandedKey={setExpandedKey}
          />
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-[11px] text-muted-foreground dark:border-border-dark dark:bg-surface-dark">
          <Info size={12} weight="bold" />
          <span>Based on {dataSourceLabel}</span>
          <InfoTooltip term="Data Source" />
        </div>
      </motion.div>

      {/* Rank Trend Chart */}
      <motion.div
        variants={fadeUp}
        className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-xs"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rank Trend
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Last {trendHistory.length} mock exams (lower is better)
        </p>
        <div className="mt-4 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trendHistory}
              margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis
                dataKey="exam"
                tick={{ fontSize: 10, fill: "#6B7280" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                reversed
                tick={{
                  fontSize: 10,
                  fill: "#6B7280",
                  fontFamily: "JetBrains Mono, monospace",
                }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatRank(v)}
                width={52}
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine
                y={data.predictedAIR}
                stroke="#2563EB"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <Line
                type="monotone"
                dataKey="rank"
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={{ fill: "#2563EB", r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#2563EB", stroke: "#fff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* What-If Section */}
      <motion.div
        variants={fadeUp}
        className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-xs"
      >
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal size={18} weight="duotone" className="text-blue-600" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What-If Analysis
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          Slide to see how a different score would change the predicted rank.
        </p>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Score</span>
              <span className="text-sm font-bold" style={MONO}>
                {whatIfScore}/{data.maxScore}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({scorePercent}%)
                </span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={data.maxScore}
              value={whatIfScore}
              onChange={(e) => setWhatIfScore(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700 accent-blue-600"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">0</span>
              <span className="text-[10px] text-muted-foreground">{data.maxScore}</span>
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 p-4 dark:from-indigo-950/30 dark:to-blue-950/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Estimated AIR
                </p>
                <p className="text-2xl font-extrabold" style={MONO}>
                  ~{formatRank(whatIfRank)}
                </p>
              </div>
              {whatIfRank < data.predictedAIR ? (
                <div className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 dark:bg-emerald-900/30">
                  <TrendUp size={14} weight="bold" className="text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-600">
                    +{formatRank(data.predictedAIR - whatIfRank)} ranks
                  </span>
                </div>
              ) : whatIfRank > data.predictedAIR ? (
                <div className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 dark:bg-red-900/30">
                  <TrendDown size={14} weight="bold" className="text-red-600" />
                  <span className="text-xs font-semibold text-red-600">
                    -{formatRank(whatIfRank - data.predictedAIR)} ranks
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
