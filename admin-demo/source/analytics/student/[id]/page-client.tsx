"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUrlSegment } from "@/lib/use-url-segment";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  TrendUp,
  TrendDown,
  Exam,
  Target,
  ChartBar,
  CaretDown,
  CheckCircle,
  XCircle,
  MinusCircle,
  SquaresFour,
  ChartLineUp,
  Trophy,
  ClipboardText,
  Fire,
  ArrowsLeftRight,
  Scales,
  ArrowsClockwise,
  Timer,
  Users,
  CaretRight,
} from "@phosphor-icons/react";
import { Skeleton } from "@brilliance/ui";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LabelList,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { ordinal } from "@/lib/ordinal";
import { ErrorTrendTimeline } from "@/components/error-trend-timeline";

// Deep-dive analytics card tints — keyed by the `tint` field on each card.
// Centralizing the Tailwind class strings makes them visible to the JIT
// compiler (concatenating class names from variables wouldn't be).
const DEEP_DIVE_TINTS: Record<
  string,
  {
    icon: string;
    iconBg: string;
    iconBgHover: string;
    hoverBorder: string;
  }
> = {
  violet: {
    icon: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-50 dark:bg-violet-500/15",
    iconBgHover: "group-hover:bg-violet-100 dark:group-hover:bg-violet-500/25",
    hoverBorder: "hover:ring-1 hover:ring-violet-200 dark:hover:ring-violet-500/30",
  },
  blue: {
    icon: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-50 dark:bg-blue-500/15",
    iconBgHover: "group-hover:bg-blue-100 dark:group-hover:bg-blue-500/25",
    hoverBorder: "hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-500/30",
  },
  amber: {
    icon: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-50 dark:bg-amber-500/15",
    iconBgHover: "group-hover:bg-amber-100 dark:group-hover:bg-amber-500/25",
    hoverBorder: "hover:ring-1 hover:ring-amber-200 dark:hover:ring-amber-500/30",
  },
  orange: {
    icon: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-50 dark:bg-orange-500/15",
    iconBgHover: "group-hover:bg-orange-100 dark:group-hover:bg-orange-500/25",
    hoverBorder: "hover:ring-1 hover:ring-orange-200 dark:hover:ring-orange-500/30",
  },
  emerald: {
    icon: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-500/15",
    iconBgHover: "group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/25",
    hoverBorder: "hover:ring-1 hover:ring-emerald-200 dark:hover:ring-emerald-500/30",
  },
  teal: {
    icon: "text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-50 dark:bg-teal-500/15",
    iconBgHover: "group-hover:bg-teal-100 dark:group-hover:bg-teal-500/25",
    hoverBorder: "hover:ring-1 hover:ring-teal-200 dark:hover:ring-teal-500/30",
  },
  indigo: {
    icon: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-50 dark:bg-indigo-500/15",
    iconBgHover: "group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/25",
    hoverBorder: "hover:ring-1 hover:ring-indigo-200 dark:hover:ring-indigo-500/30",
  },
  pink: {
    icon: "text-pink-600 dark:text-pink-400",
    iconBg: "bg-pink-50 dark:bg-pink-500/15",
    iconBgHover: "group-hover:bg-pink-100 dark:group-hover:bg-pink-500/25",
    hoverBorder: "hover:ring-1 hover:ring-pink-200 dark:hover:ring-pink-500/30",
  },
};

/* ── ERI Readiness inline section ─────────────────────────────
 *
 * Renders the ERI score + mastery-cell breakdown. The fetch is
 * hoisted into the parent so the whole wrapping card can be hidden
 * when ERI has no real data (cell-population pipeline not yet wired
 * for this exam type — see CLAUDE.md "ERI — In Design"). Parent
 * passes the student's `targetExam` so the lookup matches the exam
 * matrix the student is actually preparing for; otherwise the API
 * defaults to "jee_mains" and a non-JEE student always sees zero
 * cells even when there's data for their exam type.
 */
function EriSection({
  eri,
  velocity,
}: {
  eri: any;
  velocity: any;
}) {
  const eriValue = eri?.eriValue ?? 0;
  const activeCells = eri?.activeCells ?? 0;
  const masteredCells = eri?.masteredCells ?? 0;
  const weakCells = Math.max(0, activeCells - masteredCells);
  const deltaWeek: number | null = velocity?.deltaWeek ?? null;
  const level = eriValue >= 80 ? "Titan" : eriValue >= 60 ? "Challenger" : eriValue >= 40 ? "Contender" : eriValue >= 20 ? "Scholar" : "Aspirant";
  const levelColor = eriValue >= 80 ? "text-emerald-600" : eriValue >= 60 ? "text-blue-600" : eriValue >= 40 ? "text-amber-600" : "text-red-600";

  return (
    <div className="mt-4">
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-3xl font-extrabold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{Math.round(eriValue)}</p>
          <p className={`text-xs font-semibold ${levelColor}`}>{level}</p>
          <p className="text-[10px] text-muted">ERI Score</p>
        </div>
        <div className="flex-1 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border p-2.5 dark:border-border-dark">
            <p className="text-lg font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{activeCells}</p>
            <p className="text-[10px] text-muted inline-flex items-center">Active Cells<InfoTooltip term="Active Cells" /></p>
          </div>
          <div className="rounded-lg border border-border p-2.5 dark:border-border-dark">
            <p className="text-lg font-bold text-emerald-600" style={{ fontFamily: "JetBrains Mono, monospace" }}>{masteredCells}</p>
            <p className="text-[10px] text-muted inline-flex items-center">Mastered<InfoTooltip term="Mastered Cells" /></p>
          </div>
          <div className="rounded-lg border border-border p-2.5 dark:border-border-dark">
            <p className="text-lg font-bold text-red-500" style={{ fontFamily: "JetBrains Mono, monospace" }}>{weakCells}</p>
            <p className="text-[10px] text-muted inline-flex items-center">Weak<InfoTooltip term="Weak Cells" /></p>
          </div>
        </div>
      </div>
      {deltaWeek != null && (
        <p className="mt-2 text-xs text-muted">
          Weekly change: <span className={deltaWeek >= 0 ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>{deltaWeek >= 0 ? "+" : ""}{deltaWeek.toFixed(1)}</span> ERI points
        </p>
      )}
    </div>
  );
}
import { TheoryVsProblemCard } from "@/components/theory-vs-problem-card";
import { InfoTooltip } from "@/components/info-tooltip";
import { QuestionMarkdown } from "@/components/question-markdown";
import { useBackNavigation } from "@/components/back-link";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface StudentAnalytics {
  studentId: string;
  profile: {
    name: string;
    email: string;
    batchId: string;
    targetExam: string;
    rollNumber: string;
    enrollmentDate: string;
  };
  overview: {
    totalExams: number;
    averageScore: number;
    averagePercentile: number;
    highestScore: number;
    lowestScore: number;
    consistencyScore: number | null;
    batchSize?: number;
    batchRank?: number | null;
    practiceCount?: number;
    practiceAverage?: number;
  };
  scoreTrajectory: Array<{
    examId: string;
    examTitle: string;
    score: number;
    maxScore: number;
    percentage: number;
    percentile: number | null;
    date: string | null;
  }>;
  subjectWise: Array<{
    subjectId: string;
    subjectName: string;
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
  }>;
  recentExams: Array<{
    examId: string;
    examTitle: string;
    percentage: number;
    percentile: number;
    date: string | null;
  }>;
}

interface SkillMapData {
  current: Array<{
    topicId: string;
    topicName: string;
    subjectId: string;
    subjectName: string;
    mastery: number;
    questionsAttempted: number;
    accuracy: number;
  }>;
  historical: Array<{
    topicId: string;
    topicName: string;
    subjectName: string;
    mastery: number | null;
  }>;
}

interface ErrorPatternData {
  totalErrors: number;
  byType: Array<{
    errorType: string;
    label: string;
    count: number;
    percentage: number;
    category: string;
  }>;
  trend: {
    last30Days: number;
    previous30Days: number;
    direction: string;
    changePercent: number;
  };
}

interface WeakAreasData {
  studentId: string;
  totalSubjectsWithErrors: number;
  totalErrors: number;
  totalUnresolved: number;
  subjects: Array<{
    subjectId: string;
    subjectName: string;
    errorCount: number;
    unresolvedCount: number;
    topics: Array<{
      topicId: string;
      topicName: string;
      errorCount: number;
      unresolvedCount: number;
      lastErrorAt: string | null;
      topErrorTypes: string[];
    }>;
  }>;
}

interface RwlData {
  studentId: string;
  total: number;
  questions: Array<{
    questionId: string;
    questionTextMd: string | null;
    subjectName: string | null;
    topicName: string | null;
    errorType: string;
    difficulty: string;
    repeatCount: number;
    masteryStatus: string;
    firstErrorAt: string | null;
  }>;
}

interface ExamDrilldown {
  studentId: string;
  examId: string;
  examTitle: string;
  submission: {
    totalScore: number;
    totalMax: number;
    percentage: number;
    percentile: number;
    timeTakenSeconds: number | null;
  };
  subjectBreakdown: Array<{
    subjectName: string;
    totalQuestions: number;
    correct: number;
    incorrect: number;
    skipped: number;
    accuracy: number;
    avgTimeSeconds: number;
  }>;
  topicBreakdown: Array<{
    topicName: string;
    subjectName: string;
    total: number;
    correct: number;
    accuracy: number;
  }>;
  questionResults: Array<{
    questionId: string;
    questionText: string;
    subjectName: string;
    topicName: string;
    difficulty: string;
    selectedAnswer: string | null;
    correctAnswer: string | null;
    isCorrect: boolean | null;
    timeSpentSeconds: number | null;
    errorClassification: string | null;
  }>;
}

export default function StudentAnalyticsPage() {
  const studentId = useUrlSegment(-1);
  const router = useRouter();
  // Fallback only — a deep-linked tab has no history to go back to.
  const goBack = useBackNavigation("/analytics/students");
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<StudentAnalytics | null>(null);
  const [skillMap, setSkillMap] = useState<SkillMapData | null>(null);
  const [errorPatterns, setErrorPatterns] = useState<ErrorPatternData | null>(null);
  const [weakAreas, setWeakAreas] = useState<WeakAreasData | null>(null);
  const [rwl, setRwl] = useState<RwlData | null>(null);
  // ERI is hoisted up here so the wrapping "Exam Readiness" card can
  // hide itself when there's nothing meaningful to show. Empty state =
  // either the cell-population pipeline hasn't run for this exam type
  // (still in design per CLAUDE.md) or the student hasn't attempted
  // questions tagged with cell metadata yet.
  const [eri, setEri] = useState<any>(null);
  const [velocity, setVelocity] = useState<any>(null);

  // Assignments & Practice state
  const [assignmentData, setAssignmentData] = useState<any[] | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Time range filter — scopes the Exams table to a window. Applied
  // client-side from `recentExams.date`. Default = "all" so first-load
  // matches the previous behaviour.
  type TimeRangeKey = "all" | "7d" | "30d" | "90d" | "year";
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("all");
  // Pagination for the Exams table — keeps the page light when a
  // student has 50+ historical attempts.
  const [examsPage, setExamsPage] = useState(1);
  const EXAMS_PAGE_SIZE = 10;
  // Reset page when the range changes.
  useEffect(() => { setExamsPage(1); }, [timeRange]);


  // Hoisted out of the useEffect so the Refresh button can re-trigger
  // it. `force=true` adds ?refresh=1 to the main analytics call, which
  // forces a synchronous cache rebuild server-side (see analytics.ts).
  const fetchStudentAnalytics = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force ?? false;
      if (force) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      try {
        const mainUrl = `/api/v1/analytics/student/${studentId}${force ? "?refresh=1" : ""}`;
        const [mainRes, skillRes, errorRes, weakRes, rwlRes] = await Promise.all([
          apiClient.get<any>(mainUrl),
          apiClient.get<any>(`/api/v1/analytics/student/${studentId}/skill-map`).catch(() => null),
          apiClient.get<any>(`/api/v1/analytics/student/${studentId}/error-patterns`).catch(() => null),
          apiClient.get<any>(`/api/v1/analytics/student/${studentId}/weak-areas`).catch(() => null),
          apiClient.get<any>(`/api/v1/analytics/student/${studentId}/rwl?limit=30`).catch(() => null),
        ]);

        if (mainRes.success) {
          setData(mainRes.data);
        } else {
          setError(mainRes.error || "Failed to load student analytics");
          return;
        }

        if (skillRes?.success) setSkillMap(skillRes.data);
        if (errorRes?.success) setErrorPatterns(errorRes.data);
        if (weakRes?.success) setWeakAreas(weakRes.data);
        if (rwlRes?.success) setRwl(rwlRes.data);

        // Fetch ERI scoped to the student's actual target exam — the
        // backend defaults to "jee_mains" if no examType is given,
        // which guarantees a zero-row result for non-JEE students.
        // Doing this AFTER mainRes so we know the target exam.
        const targetExam = mainRes.data?.profile?.targetExam;
        const examTypeParam = targetExam ? `?examType=${encodeURIComponent(targetExam)}` : "";
        const [eriRes, velRes] = await Promise.all([
          apiClient
            .get<any>(`/api/v1/eri/${studentId}/score${examTypeParam}`)
            .catch(() => null),
          apiClient
            .get<any>(
              `/api/v1/eri/${studentId}/velocity?days=7${
                targetExam ? `&examType=${encodeURIComponent(targetExam)}` : ""
              }`,
            )
            .catch(() => null),
        ]);
        if (eriRes?.success && eriRes.data) setEri(eriRes.data);
        else setEri(null);
        if (velRes?.success && velRes.data) setVelocity(velRes.data);
        else setVelocity(null);
      } catch (err: any) {
        setError(err.message || "Failed to load student analytics");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [studentId],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchStudentAnalytics();
  }, [authLoading, isAuthenticated, router, fetchStudentAnalytics]);

  // Fetch assignments for this student
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    async function fetchAssignments() {
      setAssignmentLoading(true);
      try {
        // Server-side per-student list. The old shape fetched the newest 50
        // assignments institution-wide and filtered client-side — once
        // per-student practice rows dominated the table, this student's
        // work almost never made the newest 50 and the panel came up
        // empty. `studentId` also keys the completedAt/score enrichment
        // to THIS student, and `includeStudentCreated=1` keeps their own
        // DPP/practice activity visible (this panel labels DPP rows).
        const res = await apiClient.get<any>(
          `/api/v1/assignments?studentId=${encodeURIComponent(studentId)}&includeStudentCreated=1&limit=100`,
        );
        if (res?.success) {
          const raw = res.data;
          const list: any[] = Array.isArray(raw)
            ? raw
            : raw?.items || raw?.assignments || [];
          setAssignmentData(list);
        } else {
          setAssignmentData([]);
        }
      } catch {
        setAssignmentData([]);
      } finally {
        setAssignmentLoading(false);
      }
    }

    fetchAssignments();
  }, [authLoading, isAuthenticated, studentId]);


  if (authLoading || loading) {
    return (
      <div className="min-h-screen overflow-y-auto bg-bg p-8 dark:bg-bg-dark">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg dark:bg-bg-dark">
        <div className="text-center">
          <p className="text-sm text-danger">{error}</p>
          <button
            onClick={goBack}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Cap the timeline at the most recent 10 exams. Recharts bar charts
  // get unreadable past ~12 categories: labels overlap, bars get too
  // thin, and the cumulative-average computation becomes meaningless
  // for older exams the student probably doesn't think about anymore.
  // The "Full timeline" link on the page can host the long-tail view.
  const TRAJECTORY_LIMIT = 10;
  const totalTrajectoryCount = data.scoreTrajectory.length;
  // scoreTrajectory comes back ordered ASC by submitted_at (oldest →
  // newest). Slice from the end to show the most recent N.
  const recentTrajectory =
    totalTrajectoryCount > TRAJECTORY_LIMIT
      ? data.scoreTrajectory.slice(-TRAJECTORY_LIMIT)
      : data.scoreTrajectory;

  // Running cumulative average — reveals whether recent performance
  // is pulling the student up or dragging them down. Computed against
  // the visible window so the trend matches what the user sees.
  let cumSum = 0;
  let cumCount = 0;
  const trajectoryData = recentTrajectory.map((t) => {
    cumSum += t.percentage;
    cumCount++;
    return {
      name: t.examTitle.length > 15 ? t.examTitle.slice(0, 15) + "..." : t.examTitle,
      examId: t.examId,
      percentage: t.percentage,
      percentile: t.percentile,
      cumulative: Math.round((cumSum / cumCount) * 10) / 10,
    };
  });

  const subjectRadarData = data.subjectWise.map((s) => ({
    subject: s.subjectName.length > 18 ? s.subjectName.slice(0, 18) + "…" : s.subjectName,
    fullSubject: s.subjectName,
    accuracy: Math.round(s.accuracy),
    totalQuestions: s.totalQuestions,
    correctAnswers: s.correctAnswers,
    fullMark: 100,
  }));

  // Mastery colour bands — same thresholds the Mastery State glossary
  // entry uses (see info-tooltip.tsx). Keeps the chart consistent with
  // how mastery is described elsewhere on this page.
  const accuracyFill = (a: number) =>
    a >= 85 ? "#10B981" // mastered (emerald)
      : a >= 70 ? "#2563EB" // proficient (primary blue)
      : a >= 50 ? "#F59E0B" // developing (amber)
      : "#EF4444"; // weak (red)

  const skillRadarData = skillMap?.current
    .filter((s) => s.questionsAttempted > 0)
    .slice(0, 10)
    .map((s) => ({
      topic: s.topicName.length > 12 ? s.topicName.slice(0, 12) + "..." : s.topicName,
      mastery: s.mastery,
      fullMark: 100,
    })) || [];

  const errorBarData = errorPatterns?.byType.slice(0, 8).map((e) => ({
    name: e.label.length > 15 ? e.label.slice(0, 15) + "..." : e.label,
    count: e.count,
  })) || [];

  // ── Error analytics overview ─────────────────────────────────
  // Single-glance summary that feeds the Weak Areas + RWL sections
  // below. Combines weakAreas (per-subject totals + unresolved) with
  // errorPatterns (category mix) and rwl (avg repeat count).
  //
  // Mirrors packages/types/src/index.ts → ERROR_CLASSIFICATION_CATEGORIES.
  // Kept inline (not imported) so the page stays self-contained and
  // doesn't bloat the bundle with the full types index.
  const errorTypeToCategory = (raw: string | null | undefined): string => {
    if (!raw) return "Other";
    switch (raw) {
      case "no_concept_knowledge":
      case "no_idea_of_concept":
      case "applied_wrong_concept":
      case "did_not_understand":
        return "Conceptual";
      case "cannot_derive_formula":
      case "used_wrong_formula":
      case "incomplete_solution":
        return "Formula/Method";
      case "calculation_mistake":
      case "incorrect_units":
      case "misread_question":
      case "unmarked_correct":
      case "wrong_option_despite_solving":
      case "premature_conclusion":
        return "Careless";
      case "time_management":
      case "lengthy_calculation":
      case "confused_multiple_options":
      case "did_not_check_all_options":
        return "Time/Strategy";
      case "poor_print_diagram":
      case "not_in_list":
        return "External";
      case "unclassified":
        return "Unclassified";
      default:
        return "Other";
    }
  };
  const errorCategoryColors: Record<string, string> = {
    Conceptual: "#3B82F6",
    "Formula/Method": "#8B5CF6",
    Careless: "#F59E0B",
    "Time/Strategy": "#EF4444",
    External: "#64748B",
    Unclassified: "#94A3B8",
    Other: "#94A3B8",
  };

  const errorOverview = (() => {
    if (!weakAreas || weakAreas.subjects.length === 0) return null;

    // Per-subject closure status (resolved vs unresolved).
    const subjects = weakAreas.subjects
      .map((s) => ({
        name: s.subjectName,
        resolved: Math.max(0, s.errorCount - s.unresolvedCount),
        unresolved: s.unresolvedCount,
        total: s.errorCount,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    // Error category mix — prefer the cached errorPatterns endpoint
    // (covers ALL mistakes including resolved ones), but fall back to
    // rwl.questions when the cache hasn't been rebuilt yet so the donut
    // shows _something_ instead of a "No tagged mistakes yet" placeholder
    // when error_log clearly has data.
    const categoryMap: Record<string, number> = {};
    let categorySource: "errorPatterns" | "rwl" | "none" = "none";

    if (errorPatterns && errorPatterns.byType.length > 0) {
      for (const e of errorPatterns.byType) {
        const cat = e.category || errorTypeToCategory(e.errorType);
        categoryMap[cat] = (categoryMap[cat] || 0) + e.count;
      }
      categorySource = "errorPatterns";
    } else if (rwl && rwl.questions.length > 0) {
      for (const q of rwl.questions) {
        const cat = errorTypeToCategory(q.errorType);
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;
      }
      categorySource = "rwl";
    }

    const categories = Object.entries(categoryMap)
      .map(([name, value]) => ({
        name,
        value,
        fill: errorCategoryColors[name] || errorCategoryColors.Other!,
      }))
      .sort((a, b) => b.value - a.value);

    const totalErrors = weakAreas.totalErrors;
    const unresolved = weakAreas.totalUnresolved;
    const closureRate =
      totalErrors > 0
        ? Math.round(((totalErrors - unresolved) / totalErrors) * 100)
        : 0;
    const avgRepeat =
      rwl && rwl.questions.length > 0
        ? rwl.questions.reduce((sum, q) => sum + q.repeatCount, 0) /
          rwl.questions.length
        : 0;
    const topSubject = subjects[0]?.name ?? "—";

    return {
      subjects,
      categories,
      categorySource,
      totalErrors,
      unresolved,
      closureRate,
      avgRepeat,
      topSubject,
    };
  })();

  const overviewCards = [
    {
      label: "Batch Rank",
      // Highest-impact metric for a student dossier — show first.
      value:
        data.overview.batchRank != null && data.overview.batchSize
          ? `#${data.overview.batchRank}`
          : "—",
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      icon: Trophy,
    },
    { label: "Total Exams", value: data.overview.totalExams, color: "text-primary", bg: "bg-primary/10", icon: Exam },
    {
      // Average score across taken exams. Per-exam "marks earned"
      // doesn't aggregate cleanly across papers with different totals,
      // so the percentage average is the meaningful "score" metric.
      label: "Score",
      value: `${data.overview.averageScore}%`,
      color: "text-success",
      bg: "bg-success/10",
      icon: TrendUp,
    },
    {
      label: "Consistency",
      tooltip: "Consistency Score" as const,
      // null = not enough data (< 2 percentiled exams). Show em-dash so
      // students don't read "0" as a real consistency score of zero.
      value: data.overview.consistencyScore == null ? "—" : `${data.overview.consistencyScore}`,
      color: "text-purple-600",
      bg: "bg-purple-100 dark:bg-purple-500/10",
      icon: ChartBar,
    },
  ];

  return (
    <div className="min-h-screen overflow-y-auto bg-bg p-8 dark:bg-bg-dark">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={goBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border transition-colors hover:bg-primary/5 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {data.profile.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {data.profile.targetExam && `${data.profile.targetExam} - `}
              {data.profile.rollNumber && `ID: ${data.profile.rollNumber} - `}
              Student Analytics
            </p>
          </div>
          {/* Force-rebuild the analytics cache. Use this when scores were
              just rescored (answer-key edit, regrade) or when the cache
              was built before a code change to the analytics handlers
              and the headline numbers (avg, highest, percentile) are
              stale. Hits ?refresh=1 which runs rebuildAllAnalytics()
              synchronously before reading. */}
          {/* Time range — applied client-side to the Exams table. The
              other analytics blocks are computed by the API and don't
              re-fetch on range change yet, so this control is scoped
              to scoping which exams appear below. */}
          <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1 text-xs font-medium dark:border-border-dark dark:bg-surface-dark">
            {([
              { id: "all", label: "All" },
              { id: "7d", label: "7d" },
              { id: "30d", label: "30d" },
              { id: "90d", label: "90d" },
              { id: "year", label: "Year" },
            ] as const).map((opt) => {
              const active = timeRange === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTimeRange(opt.id)}
                  className={`rounded-lg px-2.5 py-1 transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:bg-primary/5 hover:text-foreground dark:hover:bg-surface-elevated-dark"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => fetchStudentAnalytics({ force: true })}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:hover:bg-surface-elevated-dark"
            title="Recompute this student's analytics cache from scratch"
          >
            <ArrowsClockwise
              size={14}
              weight="bold"
              className={refreshing ? "animate-spin" : ""}
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </motion.div>

        {/* Rank Banner — FIRST thing after profile */}
        <motion.div
          className="mt-4 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-4 dark:border-indigo-800 dark:from-indigo-950/30 dark:to-blue-950/20"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex items-center justify-between text-center">
            <div className="flex-1">
              <p className="text-lg font-extrabold text-indigo-700 dark:text-indigo-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                {data.overview.batchRank != null && data.overview.batchSize
                  ? `${ordinal(data.overview.batchRank)} / ${data.overview.batchSize}`
                  : "—"}
              </p>
              <p className="text-[10px] text-indigo-500">Batch Rank</p>
            </div>
            <div className="flex-1 border-l border-indigo-200 dark:border-indigo-700">
              <p className="text-base font-bold text-zinc-700 dark:text-zinc-200" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                {data.overview.averagePercentile > 0
                  ? ordinal(Math.round(data.overview.averagePercentile))
                  : "—"}
              </p>
              <p className="text-[10px] text-zinc-400">Batch %ile</p>
            </div>
            <div className="flex-1 border-l border-indigo-200 dark:border-indigo-700">
              <p className="text-base font-bold text-zinc-700 dark:text-zinc-200" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                {Math.round(data.overview.averageScore)}%
              </p>
              <p className="text-[10px] text-zinc-400">Avg Score</p>
            </div>
            <div className="flex-1 border-l border-indigo-200 dark:border-indigo-700">
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                {data.overview.highestScore}%
              </p>
              <p className="text-[10px] text-zinc-400">Highest</p>
            </div>
          </div>
        </motion.div>

        {/* Overview Cards */}
        <motion.div
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {overviewCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bg}`}>
                  <card.icon weight="duotone" className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="font-mono text-xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted">
                    {card.label}
                    {(card as any).tooltip && <InfoTooltip term={(card as any).tooltip} />}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Exam Readiness (ERI) */}
        <motion.div
          className="mt-6 rounded-2xl border border-border bg-white p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">
                Exam Readiness
                <InfoTooltip term="ERI" />
              </h2>
              <p className="text-xs text-muted">
                ERI score and mastery cell breakdown
              </p>
            </div>
            <Link
              href={`/analytics/student/${studentId}/eri`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Full Readiness View →
            </Link>
          </div>
          {/* Show real ERI when the cell-population pipeline has data
              for this student; show an explanatory empty state otherwise
              (was previously hiding the whole card, which left users
              wondering where ERI went). */}
          {(() => {
            const eriHasData =
              eri &&
              ((eri.totalCells ?? 0) > 0 ||
                (eri.activeCells ?? 0) > 0 ||
                (eri.eriValue ?? 0) > 0);
            if (eriHasData) {
              return <EriSection eri={eri} velocity={velocity} />;
            }
            return (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-bg/40 p-5 dark:border-border-dark dark:bg-surface-elevated-dark/30">
                <p className="text-sm font-medium text-foreground">
                  No mastery data yet
                </p>
                <p className="mt-1 text-xs text-muted">
                  ERI tracks topic-level mastery as the student attempts
                  more questions. Cells light up once questions are tagged
                  with subtopic + difficulty metadata for{" "}
                  <span className="font-medium text-foreground">
                    {data.profile.targetExam || "this exam"}
                  </span>
                  . Score and breakdown will populate after the next exam
                  attempt and overnight rollup.
                </p>
              </div>
            );
          })()}
        </motion.div>

        {/* Deep-Dive Analytics Navigation */}
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            Deep-Dive Analytics
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                href: `/analytics/student/${studentId}/heatmap`,
                label: "Knowledge Heatmap",
                desc: "Topic × difficulty mastery grid",
                icon: SquaresFour,
                tint: "violet",
              },
              {
                href: `/analytics/student/${studentId}/predictive-path`,
                label: "Predictive Path",
                desc: "Forecast next exam scores",
                icon: ChartLineUp,
                tint: "blue",
              },
              {
                href: `/analytics/student/${studentId}/rank-predictor`,
                label: "Rank Predictor",
                desc: "Estimated rank + colleges",
                icon: Trophy,
                tint: "amber",
              },
              {
                href: `/analytics/student/${studentId}/practice`,
                label: "Practice Analytics",
                desc: "Self-practice activity log",
                icon: Fire,
                tint: "orange",
              },
              {
                href: `/analytics/student/${studentId}/success-gap`,
                label: "Success Gap",
                desc: "Strongest vs weakest topics",
                icon: Scales,
                tint: "emerald",
              },
              {
                href: `/analytics/student/${studentId}/weakness-improvement`,
                label: "Weakness Recovery",
                desc: "30-day before / after deltas",
                icon: ArrowsClockwise,
                tint: "teal",
              },
              {
                href: `/analytics/student/${studentId}/time-vs-performance`,
                label: "Time vs Performance",
                desc: "Speed-accuracy scatter",
                icon: Timer,
                tint: "indigo",
              },
              {
                href: `/analytics/student/${studentId}/attendance-impact`,
                label: "Attendance Impact",
                desc: "Class-attendance × score",
                icon: Users,
                tint: "pink",
              },
            ].map((item) => {
              const tint = DEEP_DIVE_TINTS[item.tint];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-transparent dark:border-border-dark dark:bg-surface-dark ${tint.hoverBorder}`}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${tint.iconBg} ${tint.iconBgHover}`}
                  >
                    <item.icon
                      size={22}
                      weight="duotone"
                      className={tint.icon}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary">
                      {item.label}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {item.desc}
                    </p>
                  </div>
                  <CaretRight
                    size={14}
                    weight="bold"
                    className="mt-1 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              );
            })}
          </div>
        </motion.div>

        {/* Score Trajectory + Subject Radar */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Score Trajectory */}
          {trajectoryData.length > 0 && (
            <motion.div
              className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-base font-semibold">Score Timeline</h2>
              <p className="text-xs text-muted">
                {totalTrajectoryCount > TRAJECTORY_LIMIT
                  ? `Last ${TRAJECTORY_LIMIT} of ${totalTrajectoryCount} exams · click a bar to see details`
                  : trajectoryData.length === 1
                    ? "Click the bar to see exam details"
                    : "Click a bar to see exam details"}
              </p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {/* Bar chart instead of line chart — readable at any
                      cohort size. With 1 exam, a line is just an empty
                      grid; with bars the score % renders as a clear
                      vertical column. With many exams (~10+) bars also
                      handle dense X-axes more gracefully than dot+line. */}
                  <BarChart
                    data={trajectoryData}
                    margin={{ top: 16, right: 16, left: -10, bottom: 5 }}
                    onClick={(e: any) => {
                      const ex = e?.activePayload?.[0]?.payload?.examId;
                      if (ex) {
                        router.push(
                          `/analytics/student/${studentId}/test-analysis/${ex}`,
                        );
                      }
                    }}
                    style={{ cursor: "pointer" }}
                    barCategoryGap={trajectoryData.length === 1 ? "40%" : "20%"}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border, #e5e7eb)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      // Padding gives the lone bar real space when the
                      // dataset has just one entry. Recharts otherwise
                      // collapses the band to a hairline column.
                      padding={trajectoryData.length === 1 ? { left: 30, right: 30 } : undefined}
                      // Skip every other label past 6 exams — Recharts
                      // would otherwise overlap them into mush.
                      interval={trajectoryData.length > 6 ? 1 : 0}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, fontSize: 12 }}
                      formatter={(value: any, name: string) =>
                        value == null
                          ? ["—", name]
                          : [
                              `${Math.round(value as number)}${
                                name === "Percentile" ? "" : "%"
                              }`,
                              name,
                            ]
                      }
                    />
                    <Bar
                      dataKey="percentage"
                      fill="#2563EB"
                      radius={[8, 8, 0, 0]}
                      name="Score %"
                      maxBarSize={64}
                      // Show the score above each bar so 1-exam case is
                      // self-explanatory without needing to hover. Hide
                      // labels past 6 bars (they crowd into mush) and
                      // hide 0% labels (a row of "0% 0% 0%" looks broken).
                      label={
                        trajectoryData.length <= 6
                          ? {
                              position: "top",
                              fontSize: 11,
                              fill: "#2563EB",
                              formatter: (v: number) =>
                                v > 0 ? `${Math.round(v)}%` : "",
                            }
                          : false
                      }
                    />
                    {/* Percentile bars are a thinner secondary series in
                        the same band — only render if at least one exam
                        actually has a percentile (skips drawing zero
                        bars for un-percentiled custom exams). */}
                    {trajectoryData.some((t) => t.percentile != null && t.percentile > 0) && (
                      <Bar
                        dataKey="percentile"
                        fill="#10B981"
                        radius={[8, 8, 0, 0]}
                        name="Percentile"
                        maxBarSize={64}
                        opacity={0.7}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Subject Radar */}
          {subjectRadarData.length > 0 && (
            <motion.div
              className="flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-base font-semibold">Subject-wise Accuracy</h2>
              <p className="text-xs text-muted">
                Correct ÷ attempted, per subject. Bars colour by mastery band.
              </p>
              {/* Horizontal bars instead of radar — radar with 3 subjects
                  collapses to a triangle and the angle/radius labels
                  overlap. Bars stay readable from 1 subject to 10+,
                  show actual percentages without hovering, and the
                  colour-coded bands give a quick "where am I weak"
                  scan that radar can't.
                  flex-1 + min-height ensures the chart fills the card
                  when CSS Grid stretches us to match the left card's
                  height — without it we'd leave dead space at the
                  bottom of the card. */}
              <div
                className="mt-4 flex-1"
                style={{
                  minHeight: Math.max(
                    160,
                    subjectRadarData.length * 56 + 24,
                  ),
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={subjectRadarData}
                    layout="vertical"
                    margin={{ top: 8, right: 56, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border, #e5e7eb)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="subject"
                      tick={{ fontSize: 12 }}
                      width={100}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(37, 99, 235, 0.05)" }}
                      contentStyle={{ borderRadius: 12, fontSize: 12 }}
                      formatter={(value: any, _name: string, props: any) => [
                        `${value}% (${props?.payload?.correctAnswers ?? 0}/${props?.payload?.totalQuestions ?? 0})`,
                        "Accuracy",
                      ]}
                      labelFormatter={(_label: any, payload: any) =>
                        payload?.[0]?.payload?.fullSubject ?? ""
                      }
                    />
                    <Bar
                      dataKey="accuracy"
                      radius={[0, 8, 8, 0]}
                      barSize={26}
                      label={{
                        position: "right",
                        fontSize: 11,
                        fill: "var(--color-foreground, #111)",
                        formatter: (v: number) => `${v}%`,
                      }}
                    >
                      {subjectRadarData.map((s, i) => (
                        <Cell key={i} fill={accuracyFill(s.accuracy)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </div>

        {/* Skill Map + Error Patterns */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Skill Map Radar */}
          {skillRadarData.length > 0 && (
            <motion.div
              className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-base font-semibold">Skill Map</h2>
              <p className="text-xs text-muted">Topic-wise mastery (weighted recent + overall)</p>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={skillRadarData}>
                    <PolarGrid stroke="var(--color-border, #e5e7eb)" />
                    <PolarAngleAxis dataKey="topic" tick={{ fontSize: 9 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar name="Mastery" dataKey="mastery" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Error Patterns */}
          {errorBarData.length > 0 && (
            <motion.div
              className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Error Patterns</h2>
                  <p className="text-xs text-muted">Most common error types</p>
                </div>
                {errorPatterns?.trend && (
                  <div className="flex items-center gap-1.5">
                    {errorPatterns.trend.direction === "improving" ? (
                      <TrendDown weight="bold" className="h-4 w-4 text-success" />
                    ) : errorPatterns.trend.direction === "worsening" ? (
                      <TrendUp weight="bold" className="h-4 w-4 text-danger" />
                    ) : null}
                    <span
                      className={`text-xs font-semibold ${
                        errorPatterns.trend.direction === "improving"
                          ? "text-success"
                          : errorPatterns.trend.direction === "worsening"
                            ? "text-danger"
                            : "text-muted"
                      }`}
                    >
                      {errorPatterns.trend.direction === "improving"
                        ? "Improving"
                        : errorPatterns.trend.direction === "worsening"
                          ? "Worsening"
                          : "Stable"}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={errorBarData} layout="vertical" margin={{ top: 5, right: 10, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="count" fill="#EF4444" radius={[0, 6, 6, 0]} name="Errors" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </div>

        {/* Error Trend Timeline */}
        <div className="mt-6">
          <ErrorTrendTimeline studentId={studentId} />
        </div>

        {/* Theory vs Problem Error Split */}
        <div className="mt-6">
          <TheoryVsProblemCard studentId={studentId} />
        </div>

        {/* Cumulative Subject Mastery from Skill Map */}
        {skillMap && skillMap.current.length > 0 && (() => {
          // Group skill map topics by subject, compute average mastery per subject
          const subjectMasteryMap: Record<string, { name: string; totalMastery: number; count: number }> = {};
          for (const s of skillMap.current.filter((t) => t.questionsAttempted > 0)) {
            if (!subjectMasteryMap[s.subjectName]) {
              subjectMasteryMap[s.subjectName] = { name: s.subjectName, totalMastery: 0, count: 0 };
            }
            subjectMasteryMap[s.subjectName]!.totalMastery += s.mastery;
            subjectMasteryMap[s.subjectName]!.count += 1;
          }
          const subjectMasteryData = Object.values(subjectMasteryMap).map((s) => ({
            subject: s.name,
            mastery: Math.round(s.totalMastery / Math.max(s.count, 1)),
          }));

          if (subjectMasteryData.length < 2) return null;

          return (
            <motion.div
              className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
            >
              <h2 className="text-base font-semibold">Cumulative Subject Mastery</h2>
              <p className="text-xs text-muted">Average topic mastery aggregated by subject (from skill map)</p>
              <div
                className="mt-4"
                style={{ height: Math.max(180, subjectMasteryData.length * 52 + 40) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={subjectMasteryData}
                    layout="vertical"
                    margin={{ top: 8, right: 56, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid horizontal={false} stroke="var(--color-border, #e5e7eb)" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fill: "var(--color-muted, #6b7280)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="subject"
                      tick={{ fontSize: 12, fill: "var(--color-foreground, #111827)" }}
                      axisLine={false}
                      tickLine={false}
                      width={120}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
                      contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid var(--color-border, #e5e7eb)" }}
                      formatter={(v: number) => [`${v}%`, "Mastery"]}
                    />
                    <Bar dataKey="mastery" radius={[0, 8, 8, 0]} maxBarSize={32}>
                      {subjectMasteryData.map((s, i) => (
                        <Cell
                          key={i}
                          fill={s.mastery >= 75 ? "#10B981" : s.mastery >= 50 ? "#2563EB" : s.mastery >= 30 ? "#F59E0B" : "#EF4444"}
                        />
                      ))}
                      <LabelList
                        dataKey="mastery"
                        position="right"
                        formatter={(v: number) => `${v}%`}
                        style={{ fontSize: 12, fontWeight: 600, fill: "var(--color-foreground, #111827)" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          );
        })()}

        {/* Exams — full table, scoped by the time-range pills above.
            Each row links to the dedicated test-analysis page (full
            LaTeX rendering, subject + topic + question detail). */}
        {data.recentExams.length > 0 && (() => {
          // Compute filter cutoff from selected range.
          const now = Date.now();
          const cutoff = (() => {
            const days =
              timeRange === "7d" ? 7
              : timeRange === "30d" ? 30
              : timeRange === "90d" ? 90
              : timeRange === "year" ? 365
              : null;
            if (days === null) return null;
            return now - days * 24 * 60 * 60 * 1000;
          })();
          // Dedupe by examId before filtering — the API can return
          // the same exam twice (e.g., when a student has both a
          // primary and a re-attempt submission, or when the upstream
          // join double-counts). Keep the most recent occurrence so
          // pagination + the row key stay unique.
          const seenExamIds = new Set<string>();
          const dedupedExams: typeof data.recentExams = [];
          for (const e of [...data.recentExams].sort((a, b) => {
            const ta = a.date ? new Date(a.date).getTime() : 0;
            const tb = b.date ? new Date(b.date).getTime() : 0;
            return tb - ta;
          })) {
            if (seenExamIds.has(e.examId)) continue;
            seenExamIds.add(e.examId);
            dedupedExams.push(e);
          }
          const filteredExams = cutoff === null
            ? dedupedExams
            : dedupedExams.filter((e) => {
                if (!e.date) return false;
                const t = new Date(e.date).getTime();
                return Number.isFinite(t) && t >= cutoff;
              });
          const total = filteredExams.length;
          const totalPages = Math.max(1, Math.ceil(total / EXAMS_PAGE_SIZE));
          const safePage = Math.min(examsPage, totalPages);
          const startIdx = (safePage - 1) * EXAMS_PAGE_SIZE;
          const pageRows = filteredExams.slice(startIdx, startIdx + EXAMS_PAGE_SIZE);
          const RANGE_LABEL: Record<TimeRangeKey, string> = {
            all: "all time",
            "7d": "last 7 days",
            "30d": "last 30 days",
            "90d": "last 90 days",
            year: "last year",
          };
          return (
            <motion.div
              className="mt-6 mb-8 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <Exam size={18} weight="duotone" className="text-primary" />
                    Exams
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {total} exam{total === 1 ? "" : "s"} in {RANGE_LABEL[timeRange]} · click a row to open its full test analysis
                  </p>
                </div>
              </div>

              {total === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-slate-50/30 px-4 py-10 text-center text-sm text-muted dark:border-border-dark dark:bg-surface-elevated-dark/30">
                  No exams in {RANGE_LABEL[timeRange]}. Try widening the time range.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
                          <th className="pb-3 pr-4">Exam</th>
                          <th className="pb-3 pr-4">Date</th>
                          <th className="pb-3 pr-4 text-right">Score</th>
                          <th className="pb-3 pr-4 text-right">Percentile</th>
                          <th className="pb-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((exam, i) => (
                          <motion.tr
                            key={exam.examId}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 + i * 0.02 }}
                            className="group border-b border-border/30 transition-colors hover:bg-primary/5 dark:border-border-dark/30 dark:hover:bg-surface-elevated-dark/30"
                          >
                            <td className="py-3 pr-4">
                              <Link
                                href={`/analytics/student/${studentId}/test-analysis/${exam.examId}`}
                                className="block truncate font-medium text-foreground transition-colors group-hover:text-primary"
                              >
                                {exam.examTitle}
                              </Link>
                            </td>
                            <td className="py-3 pr-4 whitespace-nowrap text-[11px] text-muted">
                              {exam.date
                                ? new Date(exam.date).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "—"}
                            </td>
                            <td className="py-3 pr-4 text-right">
                              <span
                                className={`font-mono font-semibold ${
                                  exam.percentage >= 80
                                    ? "text-success"
                                    : exam.percentage >= 50
                                      ? "text-primary"
                                      : "text-danger"
                                }`}
                              >
                                {exam.percentage}%
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-right font-mono text-xs text-muted">
                              {exam.percentile}%ile
                            </td>
                            <td className="py-3">
                              <Link
                                href={`/analytics/student/${studentId}/test-analysis/${exam.examId}`}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 transition-all hover:bg-primary/10 hover:text-primary group-hover:opacity-100"
                              >
                                <CaretRight size={14} weight="bold" />
                              </Link>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4 dark:border-border-dark">
                      <p className="text-xs text-muted">
                        Showing{" "}
                        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{startIdx + 1}</span>
                        {" - "}
                        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{Math.min(startIdx + EXAMS_PAGE_SIZE, total)}</span>{" "}
                        of{" "}
                        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{total}</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExamsPage((p) => Math.max(1, p - 1))}
                          disabled={safePage <= 1}
                          className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                        >
                          Prev
                        </button>
                        <span className="min-w-[64px] text-center text-xs font-medium text-gray-700 dark:text-gray-300">
                          Page <span className="font-mono">{safePage}</span> / <span className="font-mono">{totalPages}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setExamsPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safePage >= totalPages}
                          className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          );
        })()}

        {/* Assignments & Practice */}
        <motion.div
          className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <ClipboardText size={18} weight="duotone" className="text-primary" />
            <h2 className="text-base font-semibold">Assignments & Practice</h2>
          </div>
          <p className="text-xs text-muted mb-4">
            Assignments, exams, and practice attempts — click any row to drill in
          </p>

          {assignmentLoading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-32 rounded-xl" />
            </div>
          ) : (() => {
            // Build a unified activity list: assignments + completed exams.
            // Completion of an assignment is inferred by cross-referencing its
            // linked examId against the student's scoreTrajectory (exams the
            // student has submitted). This lets an admin viewing a student's
            // dossier see per-student completion without changing the shared
            // /assignments endpoint.
            const exams = data.scoreTrajectory || [];
            const examById = new Map<string, (typeof exams)[number]>();
            for (const ex of exams) examById.set(ex.examId, ex);

            const assignmentRows = (assignmentData ?? []).map((a: any) => {
              const linkedExamId: string | undefined =
                a.examId || a.exam_id || undefined;
              const exam = linkedExamId ? examById.get(linkedExamId) : undefined;
              const hasSubmission = !!(
                a.submission ||
                a.submittedAt ||
                a.completedAt ||
                exam
              );
              const score =
                exam?.percentage ??
                a.submission?.percentage ??
                a.score ??
                null;
              const dateVal =
                exam?.date || a.completedAt || a.createdAt || a.created_at || null;
              return {
                key: `a-${a.id || a._id}`,
                kind: "assignment" as const,
                title: a.title || "Untitled Assignment",
                subtitle: a.type === "dpp" ? "DPP" : "Assignment",
                date: dateVal,
                score: score != null ? Number(score) : null,
                status: hasSubmission
                  ? "done"
                  : a.status === "expired"
                    ? "missed"
                    : "pending",
                href: `/assignments/${a.id || a._id}`,
                linkedExamId,
              };
            });

            // Exams that aren't already represented by an assignment row.
            const assignmentExamIds = new Set(
              assignmentRows
                .map((r) => r.linkedExamId)
                .filter((id): id is string => !!id),
            );
            const examRows = exams
              .filter((ex) => !assignmentExamIds.has(ex.examId))
              .map((ex) => ({
                key: `e-${ex.examId}`,
                kind: "exam" as const,
                title: ex.examTitle,
                subtitle: "Exam",
                date: ex.date,
                score: typeof ex.percentage === "number" ? ex.percentage : null,
                status: "done" as const,
                href: `/analytics/student/${studentId}/test-analysis/${ex.examId}`,
              }));

            const rows = [...assignmentRows, ...examRows].sort((a, b) => {
              const ad = a.date ? new Date(a.date).getTime() : 0;
              const bd = b.date ? new Date(b.date).getTime() : 0;
              return bd - ad;
            });

            if (rows.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-8 text-muted">
                  <ClipboardText size={36} weight="duotone" className="mb-2 opacity-40" />
                  <p className="text-sm font-medium">Nothing assigned or attempted yet</p>
                  <p className="mt-1 text-xs">
                    Assignments and completed tests will appear here as the student
                    progresses.
                  </p>
                </div>
              );
            }

            const total = rows.length;
            const completed = rows.filter((r) => r.status === "done").length;
            const completionRate =
              total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border/50 bg-slate-50/70/30 p-3 text-center dark:border-border-dark/50 dark:bg-surface-elevated-dark/30">
                    <p className="font-mono text-lg font-bold text-primary">{total}</p>
                    <p className="text-[10px] text-muted">Total</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-slate-50/70/30 p-3 text-center dark:border-border-dark/50 dark:bg-surface-elevated-dark/30">
                    <p className="font-mono text-lg font-bold text-success">{completed}</p>
                    <p className="text-[10px] text-muted">Completed</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-slate-50/70/30 p-3 text-center dark:border-border-dark/50 dark:bg-surface-elevated-dark/30">
                    <p
                      className={`font-mono text-lg font-bold ${
                        completionRate >= 80
                          ? "text-success"
                          : completionRate >= 50
                            ? "text-primary"
                            : "text-danger"
                      }`}
                    >
                      {completionRate}%
                    </p>
                    <p className="text-[10px] text-muted">Completion</p>
                  </div>
                </div>

                <div className="space-y-1">
                  {rows.slice(0, 12).map((r) => (
                    <Link
                      key={r.key}
                      href={r.href}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark/50"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          r.kind === "exam"
                            ? "bg-blue-50 dark:bg-blue-500/10"
                            : r.subtitle === "DPP"
                              ? "bg-orange-50 dark:bg-orange-500/10"
                              : "bg-primary/10"
                        }`}
                      >
                        {r.kind === "exam" ? (
                          <Exam size={14} weight="duotone" className="text-blue-600 dark:text-blue-400" />
                        ) : (
                          <ClipboardText
                            size={14}
                            weight="duotone"
                            className={
                              r.subtitle === "DPP"
                                ? "text-orange-600 dark:text-orange-400"
                                : "text-primary"
                            }
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-primary">
                          {r.title}
                        </p>
                        <p className="text-[11px] text-muted">
                          {r.subtitle}
                          {r.date ? ` \u00b7 ${new Date(r.date).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.score !== null && (
                          <span
                            className={`font-mono text-xs font-bold ${
                              r.score >= 80
                                ? "text-success"
                                : r.score >= 50
                                  ? "text-primary"
                                  : "text-danger"
                            }`}
                          >
                            {Math.round(r.score)}%
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            r.status === "done"
                              ? "bg-success/10 text-success"
                              : r.status === "missed"
                                ? "bg-danger/10 text-danger"
                                : "bg-warning/10 text-warning"
                          }`}
                        >
                          {r.status === "done"
                            ? "Done"
                            : r.status === "missed"
                              ? "Missed"
                              : "Pending"}
                        </span>
                        <CaretRight
                          size={14}
                          className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}
        </motion.div>

        {/* High/Low range */}
        <motion.div
          className="mt-6 mb-8 grid gap-4 sm:grid-cols-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="rounded-2xl border border-success/20 bg-success/5 p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-success">Highest Score</p>
            <p className="mt-1 font-mono text-2xl font-bold text-success">{data.overview.highestScore}%</p>
          </div>
          <div className="rounded-2xl border border-danger/20 bg-danger/5 p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-danger">Lowest Score</p>
            <p className="mt-1 font-mono text-2xl font-bold text-danger">{data.overview.lowestScore}%</p>
          </div>
        </motion.div>

        {/* Error analytics overview — single-glance summary that
            sits above the Weak Areas drilldown and the RWL list. */}
        {errorOverview && (
          <motion.div
            className="mb-8 rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.71 }}
          >
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark">
                  Error analytics overview
                </h3>
                <p className="text-[11px] text-muted">
                  Mistake portfolio · closure progress · category mix
                </p>
              </div>
              <p className="text-[11px] text-muted">
                Top subject:{" "}
                <span className="font-semibold text-primary-text dark:text-primary-text-dark">
                  {errorOverview.topSubject}
                </span>
              </p>
            </div>

            {/* Stat tiles */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-rose-200/60 bg-rose-50 px-3 py-2.5 dark:border-rose-900/40 dark:bg-rose-950/20">
                <p className="text-[10px] font-medium uppercase tracking-wider text-rose-700/80 dark:text-rose-300/80">
                  Total mistakes
                </p>
                <p className="mt-0.5 font-mono text-xl font-bold tabular-nums text-rose-700 dark:text-rose-300">
                  {errorOverview.totalErrors}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200/60 bg-amber-50 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700/80 dark:text-amber-300/80">
                  Unresolved
                </p>
                <p className="mt-0.5 font-mono text-xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                  {errorOverview.unresolved}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700/80 dark:text-emerald-300/80">
                  Closure rate
                </p>
                <p className="mt-0.5 font-mono text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {errorOverview.closureRate}%
                </p>
              </div>
              <div className="rounded-xl border border-blue-200/60 bg-blue-50 px-3 py-2.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                <p className="text-[10px] font-medium uppercase tracking-wider text-blue-700/80 dark:text-blue-300/80">
                  Avg repeat
                </p>
                <p className="mt-0.5 font-mono text-xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
                  ×{errorOverview.avgRepeat.toFixed(1)}
                </p>
              </div>
            </div>

            {/* Side-by-side charts */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Left: Category donut */}
              <div className="rounded-xl border border-border bg-background-secondary p-4 dark:border-border-dark dark:bg-surface-elevated-dark/40">
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-xs font-semibold text-primary-text dark:text-primary-text-dark">
                    Mistake category mix
                  </p>
                  {errorOverview.categorySource === "rwl" && (
                    <span
                      className="text-[9px] uppercase tracking-wide text-amber-600 dark:text-amber-400"
                      title="Cached error-patterns aren't ready yet — showing live unresolved-mistake mix from the RWL until the cache rebuilds."
                    >
                      Live · unresolved only
                    </span>
                  )}
                </div>
                <p className="mb-3 text-[10px] text-muted">
                  {errorOverview.categorySource === "rwl"
                    ? "Live category mix of unresolved mistakes"
                    : "Where the student's mistakes cluster"}
                </p>
                {errorOverview.categories.length > 0 ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={errorOverview.categories}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {errorOverview.categories.map((entry, idx) => (
                            <Cell key={`cat-${idx}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 12, fontSize: 12 }}
                          formatter={(value: any, name: string) => [
                            `${value} mistake${value === 1 ? "" : "s"}`,
                            name,
                          ]}
                        />
                        <Legend
                          verticalAlign="bottom"
                          align="center"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : errorOverview.totalErrors > 0 ? (
                  <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
                    <p className="text-xs text-muted">
                      Mistakes haven't been categorized yet
                    </p>
                    <p className="text-[10px] text-muted/80">
                      Tag mistakes on /review to see them cluster here
                    </p>
                  </div>
                ) : (
                  <div className="flex h-56 items-center justify-center text-xs text-muted">
                    No mistakes on file yet
                  </div>
                )}
              </div>

              {/* Right: Per-subject closure */}
              <div className="rounded-xl border border-border bg-background-secondary p-4 dark:border-border-dark dark:bg-surface-elevated-dark/40">
                <p className="mb-2 text-xs font-semibold text-primary-text dark:text-primary-text-dark">
                  Closure by subject
                </p>
                <p className="mb-3 text-[10px] text-muted">
                  Resolved vs still unresolved — where to focus next
                </p>
                <div
                  style={{
                    height: Math.max(
                      180,
                      errorOverview.subjects.length * 40 + 40,
                    ),
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={errorOverview.subjects}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                      barCategoryGap={10}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border, #e5e7eb)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10 }}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        width={90}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                        formatter={(value: any, name: string) => [
                          value,
                          name === "resolved" ? "Resolved" : "Unresolved",
                        ]}
                      />
                      <Bar
                        dataKey="resolved"
                        stackId="a"
                        fill="#10B981"
                        name="Resolved"
                        radius={[6, 0, 0, 6]}
                      />
                      <Bar
                        dataKey="unresolved"
                        stackId="a"
                        fill="#EF4444"
                        name="Unresolved"
                        radius={[0, 6, 6, 0]}
                      >
                        <LabelList
                          dataKey="total"
                          position="right"
                          style={{ fontSize: 10, fill: "#64748B" }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                    Resolved
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-rose-500" />
                    Unresolved
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Weak areas — subject → topic rollup */}
        {weakAreas && weakAreas.subjects.length > 0 && (
          <motion.div
            className="mb-8 rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.72 }}
          >
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark">Weak areas</h3>
              <p className="text-[11px] text-muted">
                {weakAreas.totalErrors} total errors · {weakAreas.totalUnresolved} unresolved
              </p>
            </div>
            <div className="space-y-4">
              {weakAreas.subjects.map((subj) => {
                const max = subj.topics[0]?.errorCount || 1;
                return (
                  <div key={subj.subjectId} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-primary-text dark:text-primary-text-dark">{subj.subjectName}</span>
                      <span className="font-mono text-xs text-muted">
                        {subj.errorCount} errors · {subj.unresolvedCount} unresolved
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {subj.topics.map((t) => {
                        const pct = Math.max(4, Math.round((t.errorCount / max) * 100));
                        return (
                          <div key={t.topicId} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-xs text-muted">{t.topicName}</p>
                              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-50/60 dark:bg-surface-elevated-dark/40">
                                <div
                                  className="h-full rounded-full bg-danger/70"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <span className="w-16 text-right font-mono text-xs text-danger">
                              {t.errorCount}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Recurring wrong list */}
        {rwl && rwl.questions.length > 0 && (
          <motion.div
            className="mb-8 rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.74 }}
          >
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark">
                Recurring wrong list (RWL)
              </h3>
              <p className="text-[11px] text-muted">{rwl.total} questions</p>
            </div>
            <div className="space-y-2">
              {rwl.questions.map((q, idx) => {
                const toneBg =
                  q.masteryStatus === "mastered"
                    ? "bg-emerald-50 dark:bg-emerald-950/30"
                    : q.masteryStatus === "in_revision"
                      ? "bg-amber-50 dark:bg-amber-950/30"
                      : "bg-rose-50 dark:bg-rose-950/30";
                return (
                  <div
                    key={`${q.questionId}-${idx}`}
                    className={`flex items-start gap-3 rounded-xl border border-border px-3 py-2 dark:border-border-dark ${toneBg}`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-sm font-bold tabular-nums text-danger">×{q.repeatCount}</span>
                      <span className="text-[9px] uppercase tracking-wide text-muted">{q.masteryStatus.replace("_", " ")}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-xs font-medium text-primary-text dark:text-primary-text-dark">
                        {q.questionTextMd ? (
                          <QuestionMarkdown text={q.questionTextMd} inline />
                        ) : (
                          "Question"
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {q.subjectName || "—"}
                        {q.topicName ? ` · ${q.topicName}` : ""}
                        {q.difficulty ? ` · ${q.difficulty}` : ""}
                        {q.errorType ? ` · ${q.errorType.replace(/_/g, " ")}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
