"use client";

// ============================================================
// BRILLIANCE — Admin: Student Practice Analytics
// DPP streak, mock frequency, practice cadence.
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  Fire,
  Exam,
  Scales,
  ChartBar,
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
  Clock,
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
  X as XIcon,
} from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  Skeleton,
  motionVariants,
  analyticsTokens,
  DateRangeFilter,
} from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";
import {
  QuestionStatsPalette,
  type QuestionStat,
  type QuestionStatsData,
} from "@/components/question-stats-palette";

/* eslint-disable @typescript-eslint/no-explicit-any */

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

// ── Types ────────────────────────────────────────────────────
interface PracticeKPIs {
  dppStreak: number;
  mockFrequency: number;
  selfAssignedRatio: number;
}

interface WeeklySession {
  week: string;
  sessions: number;
}

interface PracticeTypeBreakdown {
  type: string;
  percentage: number;
  color: string;
}

interface ErrorCorrectionStats {
  avgRevisionsToMaster: number;
  complianceRate: number;
  overdueReviews: number;
}

interface PracticeData {
  kpis: PracticeKPIs;
  cadence: WeeklySession[];
  typeBreakdown: PracticeTypeBreakdown[];
  errorCorrection: ErrorCorrectionStats;
}

const PAGE_SIZE = 24;

type Outcome = "all" | "correct" | "wrong";
type RangeKey = "7d" | "14d" | "30d" | "custom";

const RANGE_PRESETS: Array<{ key: RangeKey; label: string; days: number }> = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "14d", label: "Last 14 days", days: 14 },
  { key: "30d", label: "Last 30 days", days: 30 },
];
const MAX_SPAN_DAYS = 90;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDay(iso: string): string {
  if (!iso) return "…";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}
function resolveRange(
  key: RangeKey,
  cFrom: string,
  cTo: string,
): { from: string; to: string } {
  if (key === "custom") return { from: cFrom, to: cTo };
  const days = RANGE_PRESETS.find((p) => p.key === key)?.days ?? 30;
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { from: ymd(start), to: ymd(end) };
}
function rangeLabel(key: RangeKey, cFrom: string, cTo: string): string {
  if (key !== "custom") {
    return RANGE_PRESETS.find((p) => p.key === key)?.label ?? "Last 30 days";
  }
  if (!cFrom && !cTo) return "Custom range";
  return `${fmtDay(cFrom)} → ${cTo ? fmtDay(cTo) : "today"}`;
}

interface PracticeQuestionRow extends QuestionStat {
  topicName?: string | null;
  practiceType?: string | null;
  selectedAnswer?: string | null;
}
const DAYS_PAGE_SIZE = 10;
type Grain = "day" | "week" | "month";
type DaySort = "recent" | "oldest" | "worst" | "best";

/** Monday-anchored week key + label, and month key/label. */
function groupKeyOf(dateStr: string, grain: Grain): { key: string; label: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  if (grain === "month") {
    return {
      key: `${y}-${String(m).padStart(2, "0")}`,
      label: dt.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    };
  }
  // Week: back up to Monday.
  const dow = (dt.getDay() + 6) % 7;
  const monday = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - dow);
  return {
    key: `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`,
    label: `Week of ${monday.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
  };
}

function accuracyTone(v: number | null): string {
  if (v == null) return "text-muted-foreground";
  if (v >= 0.7) return "text-success";
  if (v >= 0.4) return "text-warning";
  return "text-danger";
}

interface PracticeDay {
  date: string;
  title: string | null;
  practiceType: string | null;
  answered: number;
  correct: number;
  seconds: number;
  accuracy: number | null;
}
interface PracticeQuestions {
  questionCount: number;
  submissionCount: number;
  questions: PracticeQuestionRow[];
  byDay: PracticeDay[];
  day: string | null;
  practiceType: string | null;
  availableTypes: Array<{ type: string; days: number }>;
}

/** One practice day — the same row whether it is listed flat or nested
 *  inside a week/month bucket. */
function DayRow({ day, onOpen }: { day: PracticeDay; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold">
          {fmtDay(day.date)}
          <span className="ml-1.5 text-[10px] font-normal uppercase text-muted-foreground">
            {day.practiceType ?? "practice"}
          </span>
        </span>
        <span className="block text-[10px] text-muted-foreground">
          {day.correct}/{day.answered} correct · {Math.round(day.seconds / 60)}m
        </span>
      </span>
      <span className={`font-mono text-xs font-semibold tabular-nums ${accuracyTone(day.accuracy)}`}>
        {day.accuracy == null ? "—" : `${Math.round(day.accuracy * 100)}%`}
      </span>
      <CaretRight size={13} weight="bold" className="text-muted-foreground" />
    </button>
  );
}

export default function AdminStudentPracticePage() {
  const studentId = useUrlSegment(-2);
  // Where to go when there is no history to walk (deep link, fresh tab).
  // Callers that drilled in pass ?from=<their view>; otherwise the student's
  // own dossier is the sensible parent.
  const backSearch = useSearchParams();
  // Arriving from the DPP report should show DPP, not every practice surface
  // averaged together — the caller passes ?type=. The filter below can widen
  // it, and the KPI band + type breakdown above stay whole-picture on purpose.
  const [practiceType, setPracticeType] = useState<string>(
    backSearch.get("type") ?? "",
  );
  const backHref =
    backSearch.get("from") || `/analytics/student/${studentId}`;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PracticeData | null>(null);

  // ── Range (drives the activity chart + the question history) ──
  // Habit windows, same vocabulary as /analytics/dpp.
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const { from, to } = resolveRange(rangeKey, customFrom, customTo);

  // ── Question history ──
  const [qData, setQData] = useState<PracticeQuestions | null>(null);
  const [qLoading, setQLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("all");
  const [page, setPage] = useState(0);
  /** One day at a time — a month of practice is ~500 questions. */
  const [openDay, setOpenDay] = useState<string | null>(null);
  /** How the practice-day list is bucketed, and which bucket is expanded. */
  const [grain, setGrain] = useState<Grain>("day");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [dayPage, setDayPage] = useState(0);
  const [daySort, setDaySort] = useState<DaySort>("recent");
  const [dayData, setDayData] = useState<PracticeQuestions | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/student/${studentId}/practice`,
        );
        if (alive && res.success && res.data) {
          const d = res.data;
          setData({
            kpis: {
              dppStreak: d.dppStreak ?? d.streak ?? 0,
              mockFrequency: d.mockFrequency ?? 0,
              selfAssignedRatio: d.selfAssignedRatio ?? d.selfRatio ?? 50,
            },
            cadence: (d.cadence || d.weeklySessions || []).map((w: any) => ({
              week: w.week || w.label,
              sessions: w.sessions ?? w.count ?? 0,
            })),
            typeBreakdown: (d.typeBreakdown || d.practiceTypes || []).map(
              (t: any, i: number) => ({
                type: t.type || t.name,
                percentage: t.percentage ?? t.value ?? 0,
                color:
                  t.color || ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6"][i % 4],
              }),
            ),
            errorCorrection: {
              avgRevisionsToMaster:
                d.errorCorrection?.avgRevisionsToMaster ?? d.avgRevisions ?? 0,
              complianceRate:
                d.errorCorrection?.complianceRate ?? d.compliance ?? 0,
              overdueReviews:
                d.errorCorrection?.overdueReviews ?? d.overdue ?? 0,
            },
          });
        } else if (alive) {
          setData(null);
        }
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

  // Question history — refetched whenever the window changes.
  useEffect(() => {
    if (rangeKey === "custom" && !customFrom) return;
    let alive = true;
    (async () => {
      setQLoading(true);
      try {
        const qs = new URLSearchParams({ from, to });
        if (practiceType) qs.set("type", practiceType);
        const res = await apiClient.get<any>(
          `/api/v1/analytics/student/${studentId}/practice/questions?${qs.toString()}`,
        );
        if (alive) {
          setQData(res.success && res.data ? res.data : null);
          setOpenDay(null);
          setDayData(null);
        }
      } catch {
        if (alive) setQData(null);
      } finally {
        if (alive) setQLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [studentId, from, to, rangeKey, customFrom, practiceType]);

  // One day's questions, fetched only when a day is opened.
  useEffect(() => {
    if (!openDay) {
      setDayData(null);
      return;
    }
    let alive = true;
    (async () => {
      setDayLoading(true);
      try {
        const qs = new URLSearchParams({ from, to, day: openDay });
        if (practiceType) qs.set("type", practiceType);
        const res = await apiClient.get<any>(
          `/api/v1/analytics/student/${studentId}/practice/questions?${qs.toString()}`,
        );
        if (alive) setDayData(res.success && res.data ? res.data : null);
      } catch {
        if (alive) setDayData(null);
      } finally {
        if (alive) setDayLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [studentId, openDay, from, to, practiceType]);

  // Any change to what's listed resets paging.
  useEffect(() => {
    setPage(0);
  }, [search, outcome, openDay, from, to]);

  useEffect(() => {
    setDayPage(0);
    setOpenGroup(null);
  }, [grain, from, to, daySort, practiceType]);

  const q = search.trim().toLowerCase();
  const filteredQuestions = useMemo(() => {
    let rows = dayData?.questions ?? [];
    if (outcome === "correct") rows = rows.filter((r) => r.correct === 1);
    else if (outcome === "wrong") rows = rows.filter((r) => r.correct === 0);
    if (q) {
      rows = rows.filter((r) =>
        `${r.questionTextMd ?? ""} ${r.topicName ?? ""} ${r.sectionName}`
          .toLowerCase()
          .includes(q),
      );
    }
    return rows;
  }, [dayData, outcome, q]);

  const qPageCount = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const qPage = Math.min(page, qPageCount - 1);
  // The palette re-indexes what it is given, so a page IS a valid dataset.
  const palette: QuestionStatsData = useMemo(
    () => ({
      questionCount: filteredQuestions.length,
      submissionCount: dayData?.submissionCount ?? 0,
      questions: filteredQuestions.slice(
        qPage * PAGE_SIZE,
        qPage * PAGE_SIZE + PAGE_SIZE,
      ),
    }),
    [filteredQuestions, qPage, dayData],
  );

  // Buckets of practice days. byDay is already bounded by the window (90
  // days max), so grouping and paging client-side costs nothing and keeps
  // the API to one shape.
  const dayGroups = useMemo(() => {
    const days = qData?.byDay ?? [];
    if (grain === "day") return [];
    const map = new Map<
      string,
      { key: string; label: string; days: PracticeDay[]; answered: number; correct: number; seconds: number }
    >();
    for (const d of days) {
      const { key, label } = groupKeyOf(d.date, grain);
      const g =
        map.get(key) ?? { key, label, days: [], answered: 0, correct: 0, seconds: 0 };
      g.days.push(d);
      g.answered += d.answered;
      g.correct += d.correct;
      g.seconds += d.seconds;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [qData, grain]);

  const sortDays = <T extends { date?: string; key?: string; accuracy?: number | null; answered: number; correct: number }>(
    rows: T[],
  ): T[] => {
    const acc = (r: T) =>
      r.accuracy ?? (r.answered > 0 ? r.correct / r.answered : null);
    const stamp = (r: T) => r.date ?? r.key ?? "";
    return [...rows].sort((a, b) => {
      switch (daySort) {
        case "oldest":
          return stamp(a).localeCompare(stamp(b));
        case "worst":
          return (acc(a) ?? 2) - (acc(b) ?? 2);
        case "best":
          return (acc(b) ?? -1) - (acc(a) ?? -1);
        default:
          return stamp(b).localeCompare(stamp(a));
      }
    });
  };

  const dayRows = sortDays(qData?.byDay ?? []);
  const listLength = grain === "day" ? dayRows.length : dayGroups.length;
  const dayPageCount = Math.max(1, Math.ceil(listLength / DAYS_PAGE_SIZE));
  const safeDayPage = Math.min(dayPage, dayPageCount - 1);
  const visibleDays = dayRows.slice(
    safeDayPage * DAYS_PAGE_SIZE,
    safeDayPage * DAYS_PAGE_SIZE + DAYS_PAGE_SIZE,
  );
  const visibleGroups = sortDays(dayGroups).slice(
    safeDayPage * DAYS_PAGE_SIZE,
    safeDayPage * DAYS_PAGE_SIZE + DAYS_PAGE_SIZE,
  );

  const outcomeCounts = useMemo(() => {
    const all = dayData?.questions ?? [];
    return {
      all: all.length,
      correct: all.filter((r) => r.correct === 1).length,
      wrong: all.filter((r) => r.correct === 0).length,
    };
  }, [dayData]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 pt-8 space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
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
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} weight="bold" />
            Back
          </BackLink>
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white p-10 text-center dark:border-border-dark dark:bg-surface-dark"
        >
          <Fire size={40} weight="duotone" className="text-blue-400 mb-3" />
          <h3 className="text-base font-semibold">No practice activity yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            DPP streaks, mock frequency, and cadence populate once this
            student starts submitting practice sessions.
          </p>
        </motion.div>
      </motion.div>
    );
  }

  const kpiCards = [
    {
      label: "DPP Streak",
      value: `${data.kpis.dppStreak} days`,
      icon: Fire,
      iconColor: "text-orange-500",
      bg: "bg-orange-100 dark:bg-orange-500/10",
    },
    {
      label: "Mock Frequency",
      value: `${data.kpis.mockFrequency}/wk`,
      icon: Exam,
      iconColor: "text-blue-600",
      bg: "bg-blue-100 dark:bg-blue-500/10",
    },
    {
      label: "Self : Assigned",
      value: `${data.kpis.selfAssignedRatio}:${100 - data.kpis.selfAssignedRatio}`,
      icon: Scales,
      iconColor: "text-purple-600",
      bg: "bg-purple-100 dark:bg-purple-500/10",
    },
  ];

  const errCards = [
    {
      label: "Avg Revisions to Master",
      value: data.errorCorrection.avgRevisionsToMaster.toFixed(1),
      icon: ArrowsClockwise,
      iconColor: "text-blue-600",
    },
    {
      label: "Compliance Rate",
      value: `${data.errorCorrection.complianceRate}%`,
      icon: CheckCircle,
      iconColor: "text-emerald-600",
    },
    {
      label: "Overdue Reviews",
      value: String(data.errorCorrection.overdueReviews),
      icon: Clock,
      iconColor:
        data.errorCorrection.overdueReviews > 0
          ? "text-red-500"
          : "text-muted-foreground",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-8">
      {/* Back link */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <BackLink
          href={`/analytics/student/${studentId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} weight="bold" />
          Back
        </BackLink>
      </motion.div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
          Practice
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Practice Analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          DPP streaks, mock frequency, and practice habits.
        </p>
      </motion.header>

      {/* KPIs */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {kpiCards.map((k) => (
          <motion.div
            key={k.label}
            variants={fadeUp}
            className="rounded-2xl border border-border bg-card p-4 shadow-xs"
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${k.bg}`}>
              <k.icon weight="duotone" className={`h-4 w-4 ${k.iconColor}`} />
            </div>
            <p
              className="mt-2 text-lg font-bold tracking-tight"
              style={{ fontFamily: analyticsTokens.type.number }}
            >
              {k.value}
            </p>
            <p className="text-[10px] text-muted-foreground">{k.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Practice Cadence Chart */}
      <motion.div
        className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-xs"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <ChartBar size={18} weight="duotone" className="text-blue-600" />
          <h2 className="text-sm font-semibold">Practice Activity</h2>
          <span className="ml-auto">
            <DateRangeFilter
              label={rangeLabel(rangeKey, customFrom, customTo)}
              options={RANGE_PRESETS.map((p) => ({ key: p.key, label: p.label }))}
              activeKey={rangeKey}
              onSelect={(key) => {
                setRangeKey(key as RangeKey);
                setCustomFrom("");
                setCustomTo("");
              }}
              draftFrom={draftFrom}
              draftTo={draftTo}
              onDraftChange={(f, t) => {
                setDraftFrom(f);
                setDraftTo(t);
              }}
              maxSpanDays={MAX_SPAN_DAYS}
              onApplyCustom={() => {
                setRangeKey("custom");
                setCustomFrom(draftFrom);
                setCustomTo(draftTo);
              }}
              applyDisabled={
                (!draftFrom && !draftTo) ||
                (rangeKey === "custom" &&
                  draftFrom === customFrom &&
                  draftTo === customTo)
              }
              applyHint={`Up to ${MAX_SPAN_DAYS} days`}
            />
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Questions answered per day, and how many were right
          {practiceType ? ` · ${practiceType} only` : ""}
        </p>
        <div className="mt-3 h-44">
          {qLoading ? (
            <Skeleton className="h-full w-full rounded-xl" />
          ) : (qData?.byDay.length ?? 0) === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No practice in this window.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                /* byDay arrives DESC (the day LIST wants newest first), but a
                   time axis must run left-to-right or an improving student
                   reads as a declining one. */
                data={[...(qData?.byDay ?? [])]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((d) => ({ ...d, label: fmtDay(d.date) }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="answered" name="Answered" fill="#93C5FD" radius={[4, 4, 0, 0]} />
                <Bar dataKey="correct" name="Correct" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {/* Question history — the shared palette, grouped by practice day.
          For one student `answered`/`eligible` are 1 and `correct` is 0 or 1,
          so the palette's accuracy tint reads as a right/wrong grid. */}
      <motion.div
        className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-xs"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">
            {openDay ? `Questions — ${fmtDay(openDay)}` : "Practice days"}
          </h2>
          <span className="text-[10px] text-muted-foreground">
            {openDay
              ? `${dayData?.questions.length ?? 0} answered`
              : `${qData?.submissionCount ?? 0} days · ${qData?.questionCount ?? 0} questions`}
          </span>
          {/* Practice type — only offered when the student actually has more
              than one, so a DPP-only student sees no pointless control. */}
          {/* Also shown whenever a type IS active, even if this window has none
              of it — otherwise the control that filtered the page to nothing
              hides itself and cannot be cleared. */}
          {!openDay &&
            ((qData?.availableTypes?.length ?? 0) > 1 || !!practiceType) && (
            <select
              value={practiceType}
              onChange={(e) => setPracticeType(e.target.value)}
              aria-label="Filter by practice type"
              className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-medium outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            >
              <option value="">All practice</option>
              {(qData?.availableTypes ?? []).map((t) => (
                <option key={t.type} value={t.type}>
                  {t.type} ({t.days}d)
                </option>
              ))}
              {practiceType &&
                !(qData?.availableTypes ?? []).some((t) => t.type === practiceType) && (
                  <option value={practiceType}>{practiceType} (0d)</option>
                )}
            </select>
          )}
          {!openDay && (
            <div className="flex items-center gap-1">
              {(["day", "week", "month"] as Grain[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrain(g)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                    grain === g
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {g}
                </button>
              ))}
              {/* No search on this list: the date-range picker above and the
                  Day/Week/Month buckets already narrow it, and searching a
                  list of dates by text answers nothing the range cannot. */}
              <select
                value={daySort}
                onChange={(e) => setDaySort(e.target.value as DaySort)}
                aria-label="Sort practice days"
                className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-medium outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
              >
                <option value="recent">Most recent</option>
                <option value="oldest">Oldest first</option>
                <option value="worst">Lowest accuracy</option>
                <option value="best">Highest accuracy</option>
              </select>
            </div>
          )}
          {openDay && (
            <button
              type="button"
              onClick={() => setOpenDay(null)}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
            >
              ← All days
            </button>
          )}
          <div className={`relative ml-auto ${openDay ? "" : "hidden"}`}>
            <MagnifyingGlass
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search question or topic…"
              aria-label="Search questions"
              className="w-56 rounded-lg border border-border bg-surface py-1.5 pl-8 pr-7 text-xs outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XIcon size={12} weight="bold" />
              </button>
            )}
          </div>
        </div>

        {openDay && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", "All"],
                ["correct", "Correct"],
                ["wrong", "Wrong"],
              ] as Array<[Outcome, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setOutcome(key)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  outcome === key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {label} {outcomeCounts[key]}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3">
          {qLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : !openDay ? (
            /* Day index — one row per practice set. Questions load only when
               a day is opened: a month is ~500 rows and the page shows one
               day at a time. */
            (qData?.byDay.length ?? 0) === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
                No practice answered in this window.
              </div>
            ) : (
              <>
                <div className="divide-y divide-border rounded-xl border border-border">
                  {grain === "day"
                    ? visibleDays.map((d) => (
                        <DayRow key={d.date} day={d} onOpen={() => setOpenDay(d.date)} />
                      ))
                    : visibleGroups.map((g) => {
                        const acc = g.answered > 0 ? g.correct / g.answered : null;
                        const expanded = openGroup === g.key;
                        return (
                          <div key={g.key}>
                            <button
                              type="button"
                              onClick={() => setOpenGroup(expanded ? null : g.key)}
                              aria-expanded={expanded}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-semibold">{g.label}</span>
                                <span className="block text-[10px] text-muted-foreground">
                                  {g.days.length} day{g.days.length === 1 ? "" : "s"} ·{" "}
                                  {g.correct}/{g.answered} correct ·{" "}
                                  {Math.round(g.seconds / 60)}m
                                </span>
                              </span>
                              <span
                                className={`font-mono text-xs font-semibold tabular-nums ${accuracyTone(acc)}`}
                              >
                                {acc == null ? "—" : `${Math.round(acc * 100)}%`}
                              </span>
                              <CaretRight
                                size={13}
                                weight="bold"
                                className={`text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
                              />
                            </button>
                            {expanded && (
                              <div className="border-t border-border bg-secondary/30 pl-3">
                                {g.days.map((d) => (
                                  <DayRow
                                    key={d.date}
                                    day={d}
                                    onOpen={() => setOpenDay(d.date)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                </div>

                {listLength > DAYS_PAGE_SIZE && (
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {safeDayPage * DAYS_PAGE_SIZE + 1}–
                      {Math.min((safeDayPage + 1) * DAYS_PAGE_SIZE, listLength)} of{" "}
                      {listLength} {grain === "day" ? "days" : `${grain}s`}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDayPage((p) => Math.max(0, p - 1))}
                        disabled={safeDayPage === 0}
                        aria-label="Previous page"
                        className="rounded-lg border border-border p-1.5 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                      >
                        <CaretLeft size={13} weight="bold" />
                      </button>
                      <span className="px-2 text-[11px] tabular-nums text-muted-foreground">
                        {safeDayPage + 1} / {dayPageCount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDayPage((p) => Math.min(dayPageCount - 1, p + 1))
                        }
                        disabled={safeDayPage >= dayPageCount - 1}
                        aria-label="Next page"
                        className="rounded-lg border border-border p-1.5 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                      >
                        <CaretRight size={13} weight="bold" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )
          ) : dayLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : filteredQuestions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
              Nothing matches this search or filter.
            </div>
          ) : (
            <QuestionStatsPalette data={palette} />
          )}
        </div>

        {filteredQuestions.length > PAGE_SIZE && (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-[11px] text-muted-foreground">
              {qPage * PAGE_SIZE + 1}–
              {Math.min((qPage + 1) * PAGE_SIZE, filteredQuestions.length)} of{" "}
              {filteredQuestions.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={qPage === 0}
                aria-label="Previous page"
                className="rounded-lg border border-border p-1.5 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
              >
                <CaretLeft size={13} weight="bold" />
              </button>
              <span className="px-2 text-[11px] tabular-nums text-muted-foreground">
                {qPage + 1} / {qPageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(qPageCount - 1, p + 1))}
                disabled={qPage >= qPageCount - 1}
                aria-label="Next page"
                className="rounded-lg border border-border p-1.5 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
              >
                <CaretRight size={13} weight="bold" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Practice Type Breakdown */}
      <motion.div
        className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-xs"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-sm font-semibold">Practice Type Breakdown</h2>
        <div className="mt-4 space-y-3">
          {data.typeBreakdown.map((t) => (
            <div key={t.type}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{t.type}</span>
                <span
                  className="font-semibold"
                  style={{
                    color: t.color,
                    fontFamily: analyticsTokens.type.number,
                  }}
                >
                  {t.percentage}%
                </span>
              </div>
              <div className="mt-1 h-2.5 w-full rounded-full bg-slate-50/70 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: t.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${t.percentage}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Error Correction Cycles */}
      <motion.div
        className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-xs"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center gap-2">
          <ArrowsClockwise size={18} weight="duotone" className="text-blue-600" />
          <h2 className="text-sm font-semibold">Error Correction Cycles</h2>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {errCards.map((c) => (
            <div key={c.label} className="text-center">
              <c.icon size={20} weight="duotone" className={`mx-auto ${c.iconColor}`} />
              <p
                className="mt-1 text-lg font-bold"
                style={{ fontFamily: analyticsTokens.type.number }}
              >
                {c.value}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {c.label}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
