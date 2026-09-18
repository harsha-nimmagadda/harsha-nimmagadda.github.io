"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useUrlSegment } from "@/lib/use-url-segment";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { QuestionCard, type QuestionData } from "@/components/question-card";
import { QuestionDetailModal } from "@/components/question-detail-modal";
import { QuestionMarkdown } from "@/components/question-markdown";
import { InfoTooltip } from "@/components/info-tooltip";
import { useBackNavigation } from "@/components/back-link";
import {
  ArrowLeft,
  Trophy,
  Users,
  TrendUp,
  ChartBar,
  CaretUp,
  CaretDown,
  Question,
  CheckCircle,
  XCircle,
  MinusCircle,
  DownloadSimple,
  Warning,
  CaretRight,
  CircleNotch,
  UserMinus,
  CaretLeft,
  Lightbulb,
  Scales,
  Skull,
  ArrowsLeftRight,
  Flag,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api-fetch";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { Skeleton } from "@brilliance/ui";
import {
  RollupTable,
  resolveSectionLabel,
  type RollupGroup,
  type RollupRow,
  type RollupTimeColumn,
} from "@/components/exam-rollup-table";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Types ───────────────────────────────────────────────────

interface ExamAnalyticsData {
  examId: string;
  title: string;
  examType: string;
  totalSubmissions: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  standardDeviation: number;
  passRate: number;
  scoreDistribution: Record<string, number>;
  subjectBreakdown: Array<{
    subjectId: string;
    subjectName: string;
    totalQuestions: number;
    avgAccuracy: number;
    avgTimeSeconds: number;
  }>;
  topicBreakdown: Array<{
    topicId: string;
    topicName: string;
    subjectName: string;
    totalQuestions: number;
    avgAccuracy: number;
    avgTimeSeconds: number;
  }>;
  questionAnalysis: Array<{
    questionId: string;
    questionText: string;
    questionType: string;
    difficulty: string;
    subjectName: string;
    topicName: string;
    totalAttempts: number;
    correctCount: number;
    incorrectCount: number;
    skippedCount: number;
    accuracy: number;
    errorAnalysisCount: number;
    avgTimeSeconds: number;
    /**
     * Time the single highest-percentage scorer spent on this question.
     * Served by the API (sourced from that student's exam_responses) but
     * absent for questions they never answered.
     */
    topperTimeSeconds?: number | null;
    optionDistribution: Record<string, number>;
    discriminationIndex: number;
    telemetry?: {
      flaggedCount: number;
      flagRate: number;
      avgVisitCount: number;
      revisitedCount: number;
      revisitRate: number;
      secondGuessWrongCount: number;
      secondGuessWrongRate: number;
    };
  }>;
  topScorers: Array<{
    studentId: string;
    name: string;
    /** null when the student's result is held (unranked). */
    rank: number | null;
    score: number;
    maxScore: number;
    percentage: number;
    timeTakenSeconds: number | null;
    /** Set when the student's result is currently held. */
    resultHold?: { reason: string } | null;
    /**
     * Integrity flag — true when the student was EVER held on this exam,
     * including holds since released. Marking only: it does not affect
     * rank, aggregates or what the student sees.
     */
    flagged?: boolean;
    flagReason?: string | null;
    telemetry?: {
      tabSwitchCount: number;
      windowBlurCount: number;
      fullscreenExitCount: number;
      totalRevisits: number;
      flaggedCount: number;
      answerChangeCount: number;
      secondGuessedToWrong: number;
    };
  }>;
  telemetrySummary?: {
    avgTabSwitches: number;
    avgRevisits: number;
    pctWithFlags: number;
    pctSecondGuessedToWrong: number;
  };
  subjectRankings?: Array<{
    subjectId: string;
    subjectName: string;
    students: Array<{
      studentId: string;
      name: string;
      rank: number;
      total: number;
      correct: number;
      incorrect: number;
      skipped: number;
      accuracy: number;
      avgTimeSeconds: number;
    }>;
  }>;
  sectionRankings?: Array<OrgRankingGroup>;
  branchRankings?: Array<OrgRankingGroup>;
  atRiskStudents?: Array<{
    studentId: string;
    name: string;
    severity: "critical" | "warning" | "low";
    percentage: number;
    score: number;
    maxScore: number;
    deltaVsAvg: number;
    timeTakenSeconds: number | null;
  }>;
  atRiskSummary?: {
    critical: number;
    warning: number;
    low: number;
    total: number;
  };
  absentCount?: number;
  absentStudents?: Array<{
    studentId: string;
    name: string;
    batchName: string | null;
    markedAbsent: boolean;
  }>;
  // Branch / Batch / Section filter options, each with the number of
  // students assigned to this exam. Computed from the full roster so the
  // counts stay stable regardless of the currently-applied filter.
  rosterFacets?: {
    branches: Array<{ id: string; name: string; count: number }>;
    batches: Array<{
      id: string;
      name: string;
      branchId: string | null;
      branchName: string | null;
      count: number;
    }>;
    sections: Array<{
      key: string;
      section: string;
      batchId: string | null;
      batchName: string | null;
      branchId: string | null;
      branchName: string | null;
      count: number;
    }>;
  };
}

interface OrgRankingGroup {
  id: string;
  name: string;
  branchName?: string | null;
  batchName?: string | null;
  section?: string | null;
  avgPercentage: number;
  students: Array<{
    studentId: string;
    name: string;
    rank: number;
    score: number;
    maxScore: number;
    percentage: number;
    timeTakenSeconds: number | null;
    flagged?: boolean;
    flagReason?: string | null;
  }>;
}

type TopicSortField = "topicName" | "subjectName" | "avgAccuracy" | "totalQuestions" | "avgTimeSeconds";
type SortDir = "asc" | "desc";

// ── Helpers ─────────────────────────────────────────────────

function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "--";
  // 0 is a valid value (instant submit, rounding) — render it rather
  // than collapsing to "--" so we can tell "missing data" apart from
  // "took less than a second".
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

const BUCKET_ORDER = ["0-10", "10-20", "20-30", "30-40", "40-50", "50-60", "60-70", "70-80", "80-90", "90-100"];

const OPTION_COLORS: Record<string, string> = {
  A: "#2563EB",
  B: "#10B981",
  C: "#F59E0B",
  D: "#EF4444",
  skipped: "#9CA3AF",
};

/** Initial value for a URL-seeded filter; "" on the server render. */
function readFilterParam(key: string) {
  return typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get(key) ?? "";
}

// ── Subcomponents ───────────────────────────────────────────

function OrgRankingCard({
  group,
  examId,
  filterQuery,
}: {
  group: OrgRankingGroup;
  examId: string;
  filterQuery: string;
}) {
  // Build a breadcrumb of parent levels above the title. Only include
  // a level if a deeper one is the title — otherwise eyebrow + title
  // duplicate (e.g. branch cards would show "LB NAGAR" twice).
  //   Branch card (title = branch):  crumbs = []
  //   Batch card  (title = batch):   crumbs = [branch]
  //   Section card (title = "Section X"): crumbs = [branch, batch]
  const crumbs = [
    group.batchName ? group.branchName : null,
    group.section ? group.batchName : null,
  ].filter((c): c is string => Boolean(c));

  return (
    <div className="rounded-xl bg-white p-4 dark:bg-surface-dark">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {crumbs.length > 0 && (
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
              {crumbs.join(" • ")}
            </p>
          )}
          <h3 className="text-sm font-semibold truncate">{group.name}</h3>
        </div>
        <span
          className={`font-mono text-xs font-semibold shrink-0 mt-0.5 ${
            group.avgPercentage >= 70
              ? "text-success"
              : group.avgPercentage >= 40
                ? "text-primary"
                : "text-danger"
          }`}
        >
          avg {group.avgPercentage}%
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
        {group.students.length} student
        {group.students.length === 1 ? "" : "s"}
      </p>
      <div className="space-y-1.5">
        {group.students.slice(0, 5).map((s) => (
          <div
            key={s.studentId}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-primary/5 dark:hover:bg-surface-elevated-dark/40 transition-colors"
          >
            <span
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                s.rank === 1
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400"
                  : s.rank === 2
                    ? "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400"
                    : s.rank === 3
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400"
                      : "bg-slate-50/70 text-muted dark:bg-surface-elevated-dark"
              }`}
            >
              #{s.rank}
            </span>
            {s.flagged && (
              <span
                title={s.flagReason || "Flagged for integrity review"}
                aria-label="Flagged for integrity review"
                className="inline-flex shrink-0"
              >
                <Flag weight="fill" className="h-3 w-3 text-danger" />
              </span>
            )}
            <Link
              href={`/analytics/student/${s.studentId}/test-analysis/${examId}${filterQuery}`}
              className="flex-1 min-w-0 truncate text-xs font-medium hover:text-primary hover:underline"
            >
              {s.name}
            </Link>
            <span className="font-mono text-[11px]">
              <span
                className={`font-semibold ${
                  s.percentage >= 70
                    ? "text-success"
                    : s.percentage >= 40
                      ? "text-primary"
                      : "text-danger"
                }`}
              >
                {s.score}
              </span>
              <span className="text-muted">/{s.maxScore}</span>
            </span>
          </div>
        ))}
        {group.students.length > 5 && (
          <p className="px-2 pt-1 text-[10px] text-muted-foreground">
            +{group.students.length - 5} more student
            {group.students.length - 5 === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Question by Question Table ──────────────────────────────
//
// Flat sortable table view that mirrors the per-question palette
// view's accuracy data. Used as an alternative to the palette so
// faculty can scan the entire paper at once and identify which
// questions the cohort struggled with by sorting on R / W / L /
// accuracy / time.

type QATableField =
  | "index"
  | "subject"
  | "topic"
  | "difficulty"
  | "right"
  | "wrong"
  | "left"
  | "accuracy"
  | "errorAnalysis"
  | "avgTime";

const DIFFICULTY_RANK: Record<string, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
  advanced: 3,
  olympiad: 4,
};

interface QABTRow {
  questionId: string;
  questionText: string;
  questionType: string;
  difficulty: string;
  subjectName: string;
  topicName: string;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  accuracy: number;
  errorAnalysisCount: number;
  avgTimeSeconds: number;
}

function QuestionByQuestionTable({
  list,
  sortField,
  sortDir,
  toggleSort,
  SortIcon,
  onRowClick,
}: {
  list: QABTRow[];
  sortField: QATableField;
  sortDir: "asc" | "desc";
  toggleSort: (f: QATableField) => void;
  SortIcon: React.FC<{ field: QATableField }>;
  onRowClick: (originalIndex: number) => void;
}) {
  const dirMul = sortDir === "asc" ? 1 : -1;
  const sortedRows = list
    .map((q, i) => ({ q, originalIndex: i }))
    .sort((a, b) => {
      const A = a.q;
      const B = b.q;
      switch (sortField) {
        case "index":
          return dirMul * (a.originalIndex - b.originalIndex);
        case "subject":
          return dirMul * (A.subjectName ?? "").localeCompare(B.subjectName ?? "");
        case "topic":
          return dirMul * (A.topicName ?? "").localeCompare(B.topicName ?? "");
        case "difficulty": {
          const ra = DIFFICULTY_RANK[(A.difficulty ?? "").toLowerCase()] ?? 99;
          const rb = DIFFICULTY_RANK[(B.difficulty ?? "").toLowerCase()] ?? 99;
          return dirMul * (ra - rb);
        }
        case "right":
          return dirMul * (A.correctCount - B.correctCount);
        case "wrong":
          return dirMul * (A.incorrectCount - B.incorrectCount);
        case "left":
          return dirMul * (A.skippedCount - B.skippedCount);
        case "accuracy":
          return dirMul * (A.accuracy - B.accuracy);
        case "errorAnalysis":
          return dirMul * (A.errorAnalysisCount - B.errorAnalysisCount);
        case "avgTime":
          return dirMul * (A.avgTimeSeconds - B.avgTimeSeconds);
        default:
          return 0;
      }
    });

  const accuracyTone = (acc: number) =>
    acc >= 70 ? "text-success" : acc >= 40 ? "text-warning" : "text-danger";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
            <th className="cursor-pointer pb-3 pr-4 transition-colors hover:text-foreground" onClick={() => toggleSort("index")}>
              <span className="flex items-center gap-1">#  <SortIcon field="index" /></span>
            </th>
            <th className="cursor-pointer pb-3 pr-4 transition-colors hover:text-foreground" onClick={() => toggleSort("subject")}>
              <span className="flex items-center gap-1">Subject <SortIcon field="subject" /></span>
            </th>
            <th className="cursor-pointer pb-3 pr-4 transition-colors hover:text-foreground" onClick={() => toggleSort("topic")}>
              <span className="flex items-center gap-1">Topic <SortIcon field="topic" /></span>
            </th>
            <th className="cursor-pointer pb-3 pr-4 transition-colors hover:text-foreground" onClick={() => toggleSort("difficulty")}>
              <span className="flex items-center gap-1">Difficulty <SortIcon field="difficulty" /></span>
            </th>
            <th className="cursor-pointer pb-3 pr-4 text-right transition-colors hover:text-foreground" onClick={() => toggleSort("right")} title="Students who picked the correct option">
              <span className="flex items-center justify-end gap-1">R <SortIcon field="right" /></span>
            </th>
            <th className="cursor-pointer pb-3 pr-4 text-right transition-colors hover:text-foreground" onClick={() => toggleSort("wrong")} title="Students who picked an incorrect option">
              <span className="flex items-center justify-end gap-1">W <SortIcon field="wrong" /></span>
            </th>
            <th className="cursor-pointer pb-3 pr-4 text-right transition-colors hover:text-foreground" onClick={() => toggleSort("left")} title="Students who skipped the question">
              <span className="flex items-center justify-end gap-1">L <SortIcon field="left" /></span>
            </th>
            <th className="cursor-pointer pb-3 pr-4 text-right transition-colors hover:text-foreground" onClick={() => toggleSort("accuracy")}>
              <span className="flex items-center justify-end gap-1">Accuracy <SortIcon field="accuracy" /></span>
            </th>
            <th
              className="cursor-pointer pb-3 pr-4 text-right transition-colors hover:text-foreground"
              onClick={() => toggleSort("errorAnalysis")}
              title="Students who submitted error analysis on this question (errorClassification recorded)"
            >
              <span className="flex items-center justify-end gap-1">EA <SortIcon field="errorAnalysis" /></span>
            </th>
            <th className="cursor-pointer pb-3 text-right transition-colors hover:text-foreground" onClick={() => toggleSort("avgTime")} title="Mean time spent on the question">
              <span className="flex items-center justify-end gap-1">Avg Time <SortIcon field="avgTime" /></span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map(({ q, originalIndex }) => (
            <tr
              key={q.questionId}
              className="group cursor-pointer border-b border-border/30 transition-colors hover:bg-primary/5 dark:border-border-dark/30 dark:hover:bg-surface-elevated-dark/30"
              onClick={() => onRowClick(originalIndex)}
              title="Click to open the full question + solution in palette view"
            >
              <td className="py-3 pr-4 align-top">
                <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md bg-slate-50/70 px-1.5 font-mono text-[11px] font-bold text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary dark:bg-surface-elevated-dark">Q{originalIndex + 1}</span>
              </td>
              <td className="py-3 pr-4 align-top text-muted">{q.subjectName || "—"}</td>
              <td className="py-3 pr-4 align-top text-muted">{q.topicName ? <QuestionMarkdown text={q.topicName} inline /> : "—"}</td>
              <td className="py-3 pr-4 align-top">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${q.difficulty === "hard" || q.difficulty === "advanced" ? "bg-danger/10 text-danger" : q.difficulty === "medium" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                  {q.difficulty || "—"}
                </span>
              </td>
              <td className="py-3 pr-4 text-right align-top font-mono">
                <span className="font-semibold text-success">{q.correctCount}</span>
              </td>
              <td className="py-3 pr-4 text-right align-top font-mono">
                <span className="font-semibold text-danger">{q.incorrectCount}</span>
              </td>
              <td className="py-3 pr-4 text-right align-top font-mono text-muted">
                {q.skippedCount}
              </td>
              <td className="py-3 pr-4 text-right align-top">
                <span className={`font-mono font-semibold ${accuracyTone(q.accuracy)}`}>{q.accuracy}%</span>
              </td>
              <td className="py-3 pr-4 text-right align-top font-mono text-xs">
                {q.errorAnalysisCount > 0 ? (
                  <span>
                    <span className="font-semibold text-foreground">{q.errorAnalysisCount}</span>
                    <span className="text-muted">/{q.incorrectCount + q.skippedCount}</span>
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="py-3 text-right align-top font-mono text-xs text-muted">
                {formatTime(q.avgTimeSeconds)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Subject / Section roll-ups ──────────────────────────────
//
// The table itself lives in @/components/exam-rollup-table — the
// per-student test analysis page renders the same shape over one
// student instead of the cohort.

const EXAM_ROLLUP_TIME_COLUMNS: RollupTimeColumn[] = [
  {
    key: "cohort",
    header: "Cohort",
    title: "Mean time across every non-held submission — group total, with the per-question mean underneath",
  },
  {
    key: "topper",
    header: "Topper",
    title: "Time spent by the single highest-percentage scorer",
  },
];

// ── Page ────────────────────────────────────────────────────

export default function ExamAnalyticsPage() {
  const examId = useUrlSegment(-1);
  const router = useRouter();
  // This page is opened from the exam list, a batch dossier, search, a shared
  // link… — walk history back, and only land on /analytics when there is none.
  const goBack = useBackNavigation("/analytics");
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [viewingQuestionId, setViewingQuestionId] = useState<string | null>(null);
  // Palette-based question analysis: track which question (by index)
  // is open in the detail panel + cache full question payloads we've
  // already pulled so jumping back to a previously-viewed question
  // is instant.
  const [selectedQIdx, setSelectedQIdx] = useState(0);
  // Insights panel — collapsible quick-highlights derived from the
  // existing per-question + per-subject data. Default closed so it
  // doesn't dominate the top of the page.
  const [showInsights, setShowInsights] = useState(false);
  // Student Performance Insights — filter by which subject a student
  // is strongest or weakest in. "all" means show every imbalanced
  // student, sorted by gap.
  const [insightsStrongIn, setInsightsStrongIn] = useState<string>("all");
  const [insightsWeakIn, setInsightsWeakIn] = useState<string>("all");
  // View toggle for the Question Analysis section: palette+detail
  // (default — interactive drill-in) vs a flat sortable table (faster
  // when scanning the whole paper at once).
  // Four levels of grain: subject → section → question (table) →
  // single question (palette drill-in).
  type QAView = "palette" | "table" | "subject" | "section";
  const [qaView, setQaView] = useState<QAView>("palette");
  // Real section name per question — the analytics payload doesn't carry
  // it, so it comes from the per-question-time endpoint. Fetched
  // separately so the roll-ups render without waiting on it (they fall
  // back to question-type sections until it lands).
  const [sectionNameByQid, setSectionNameByQid] = useState<Map<string, string | null>>(new Map());
  // QATableField is defined at module scope alongside the
  // QuestionByQuestionTable component — reused here for the sort
  // state hooks.
  const [qaSortField, setQaSortField] = useState<QATableField>("index");
  const [qaSortDir, setQaSortDir] = useState<SortDir>("asc");
  const toggleQaSort = (f: QATableField) => {
    if (qaSortField === f) {
      setQaSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setQaSortField(f);
      // Numeric columns default to descending (highest-first reads
      // better when looking for "where did the cohort struggle?").
      // Index and string columns default to ascending.
      const numericFields: QATableField[] = ["right", "wrong", "left", "accuracy", "errorAnalysis", "avgTime"];
      setQaSortDir(numericFields.includes(f) ? "desc" : "asc");
    }
  };
  const QASortIcon = ({ field }: { field: QATableField }) => {
    if (qaSortField !== field) {
      // Faded up/down chevron stack on inactive columns so the
      // sortable affordance is always visible — same pattern used in
      // the Results table.
      return (
        <span className="inline-flex flex-col text-[7px] leading-[7px] text-muted/50">
          <CaretUp weight="bold" size={7} />
          <CaretDown weight="bold" size={7} />
        </span>
      );
    }
    return qaSortDir === "asc"
      ? <CaretUp size={10} weight="bold" className="text-primary" />
      : <CaretDown size={10} weight="bold" className="text-primary" />;
  };
  const [questionDetailCache, setQuestionDetailCache] = useState<Map<string, QuestionData>>(new Map());
  const [questionDetailLoading, setQuestionDetailLoading] = useState(false);
  const [questionDetailError, setQuestionDetailError] = useState<string | null>(null);
  // Org filters. Branch → Batch → Section cascade: picking a branch
  // narrows the batch list, picking a batch narrows the section list.
  // Options + their assigned-student counts come from data.rosterFacets.
  // Seeded from the URL (and mirrored back into it on change) so coming
  // back from a student drill-in restores the same selections. Read via
  // window.location instead of useSearchParams so the route can still be
  // statically prerendered without a Suspense boundary.
  const [branchFilter, setBranchFilter] = useState(() => readFilterParam("branchId"));
  const [batchFilter, setBatchFilter] = useState(() => readFilterParam("batchId"));
  const [sectionFilter, setSectionFilter] = useState(() => readFilterParam("section"));

  // Topic sort state
  const [topicSort, setTopicSort] = useState<TopicSortField>("avgAccuracy");
  const [topicSortDir, setTopicSortDir] = useState<SortDir>("asc");

  // Full-leaderboard toggle for Top Scorers — collapsed view shows the
  // Pagination + column sort for the Results table.
  // Sort is applied server-side; rank is always computed from the
  // percentage-desc ordering on the API so it stays correct.
  type ScorersSortField = "rank" | "name" | "score" | "percentage" | "revisits" | "flags";
  const [scorersPage, setScorersPage] = useState(1);
  // Subject-wise rankings cards: page per subject (10 students a page),
  // keyed by subjectId; missing key = page 1.
  const SUBJECT_RANK_PAGE_SIZE = 10;
  const [subjectRankPage, setSubjectRankPage] = useState<Record<string, number>>({});
  const [scorersSortBy, setScorersSortBy] = useState<ScorersSortField>("percentage");
  const [scorersSortDir, setScorersSortDir] = useState<SortDir>("desc");
  // Per-subject sort is layered on top of the server-side sort —
  // when set, the cohort returned by the API is re-sorted in the
  // browser by the chosen subject's correct count. Cleared whenever
  // the user clicks a server-side header (so the two states never
  // disagree about what's "active").
  const [scorersSubjectSort, setScorersSubjectSort] = useState<{
    subjectId: string;
    dir: SortDir;
  } | null>(null);
  // "Flagged only" view of the Results table. Filtered in the browser —
  // the API returns the whole cohort in one payload, so there is nothing
  // to refetch, and ranks stay the ones the server assigned.
  const [scorersFlaggedOnly, setScorersFlaggedOnly] = useState(false);
  // Name search on the Results table — same in-browser filter as "Flagged
  // only": the whole cohort is already loaded, ranks stay server-assigned.
  const [scorersSearch, setScorersSearch] = useState("");
  const SCORERS_PAGE_SIZE = 10;

  const toggleScorersSort = (field: ScorersSortField) => {
    // Clicking a server-side header overrides any active subject sort.
    setScorersSubjectSort(null);
    if (scorersSortBy === field) {
      setScorersSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setScorersSortBy(field);
      // Name reads better ascending; everything else defaults to
      // descending. For Rank in particular: ascending matches the
      // default percentage-desc order (#1 first), so the click would
      // appear to do nothing — descending puts last place at the top,
      // which is the actionable view faculty actually want.
      setScorersSortDir(field === "name" ? "asc" : "desc");
    }
    setScorersPage(1);
  };

  // Per-subject column header click — sorts the loaded scorers list
  // by the chosen subject's correct count (defaults to descending so
  // top performers in that subject surface first). A second click on
  // the same subject flips direction.
  const toggleScorersSubjectSort = (subjectId: string) => {
    setScorersSubjectSort((prev) =>
      prev?.subjectId === subjectId
        ? { subjectId, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { subjectId, dir: "desc" },
    );
    setScorersPage(1);
  };

  const ScorersSubjectSortIcon = ({ subjectId }: { subjectId: string }) => {
    if (scorersSubjectSort?.subjectId !== subjectId) {
      return (
        <span className="inline-flex flex-col text-[7px] leading-[7px] text-muted/50">
          <CaretUp weight="bold" size={7} />
          <CaretDown weight="bold" size={7} />
        </span>
      );
    }
    return scorersSubjectSort.dir === "asc"
      ? <CaretUp size={10} weight="bold" className="text-primary" />
      : <CaretDown size={10} weight="bold" className="text-primary" />;
  };

  const ScorersSortIcon = ({ field }: { field: ScorersSortField }) => {
    if (scorersSortBy !== field) {
      // Faded up/down chevron stack on inactive sortable columns so
      // the affordance is visible without competing with the active
      // sort's solid arrow.
      return (
        <span className="inline-flex flex-col text-[7px] leading-[7px] text-muted/50">
          <CaretUp weight="bold" size={7} />
          <CaretDown weight="bold" size={7} />
        </span>
      );
    }
    return scorersSortDir === "asc"
      ? <CaretUp size={10} weight="bold" className="text-primary" />
      : <CaretDown size={10} weight="bold" className="text-primary" />;
  };

  // At-risk filter — limits the per-exam at-risk list to one severity
  // band so faculty can drill into the most urgent group first.
  const [atRiskFilter, setAtRiskFilter] = useState<
    "all" | "critical" | "warning" | "low"
  >("all");

  // Pagination for the at-risk list and the absent list.
  const [atRiskPage, setAtRiskPage] = useState(1);
  const [absentPage, setAbsentPage] = useState(1);
  const AT_RISK_PAGE_SIZE = 10;
  const ABSENT_PAGE_SIZE = 10;
  // Reset at-risk pagination whenever the severity filter flips.
  useEffect(() => { setAtRiskPage(1); }, [atRiskFilter]);

  // Export toast state — surfaces the server-side reason when an
  // export (RWL PDF/Excel, Full Results Excel) fails so admins know
  // whether to retry, switch formats, or wait for submissions.
  const [exportToast, setExportToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [exporting, setExporting] = useState<"rwl-pdf" | "rwl-xlsx" | "full-xlsx" | null>(null);

  useEffect(() => {
    if (!exportToast) return;
    const t = setTimeout(() => setExportToast(null), 4000);
    return () => clearTimeout(t);
  }, [exportToast]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  // Cached analytics fetch — TanStack Query honors the 60s staleTime
  // configured globally (apps/dashboard/src/providers/query-provider.tsx),
  // so revisits within a minute paint from cache instantly. Re-runs when
  // batchFilter changes because that's part of the query key.
  const examQuery = useQuery({
    queryKey: ["exam-analytics", examId, branchFilter, batchFilter, sectionFilter, scorersSortBy, scorersSortDir],
    enabled: !!examId && !authLoading && isAuthenticated,
    // Keep showing the previous result while a new sort/filter fetches —
    // otherwise switching queryKey blanks the page back to the full
    // skeleton until the response lands.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchFilter) params.set("branchId", branchFilter);
      if (batchFilter) params.set("batchId", batchFilter);
      if (sectionFilter) params.set("section", sectionFilter);
      params.set("scorersSortBy", scorersSortBy);
      params.set("scorersSortDir", scorersSortDir);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await apiClient.get<ExamAnalyticsData>(
        `/api/v1/exam-analytics/${examId}${qs}`,
      );
      if (!res.success) throw new Error(res.error || "Failed to load exam analytics");
      return res.data as ExamAnalyticsData;
    },
  });

  const data = examQuery.data ?? null;
  const error = examQuery.error ? (examQuery.error as Error).message : "";
  // While we have cached data, render it (even when refetching for the new
  // filter) — only show the full-page skeleton on the very first load.
  const loading = examQuery.isLoading && !data;

  // Reset palette selection when the exam payload (and therefore the
  // question list) changes — e.g. when batch filter swaps in a new
  // cohort whose questionAnalysis array could be a different length.
  useEffect(() => {
    setSelectedQIdx(0);
  }, [data?.examId]);

  // Section names for the Section roll-up. Kept out of the main query so
  // a slow or failed response just falls back to question-type sections
  // instead of blocking the whole card.
  useEffect(() => {
    if (!examId || authLoading || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const qs = batchFilter ? `?batchId=${encodeURIComponent(batchFilter)}` : "";
      const res = await apiClient.get<{
        questions: Array<{ questionId: string; sectionName: string | null }>;
      }>(`/api/v1/exam-analytics/${examId}/per-question-time${qs}`);
      if (cancelled) return;
      if (!res.success || !res.data) {
        setSectionNameByQid(new Map());
        return;
      }
      const next = new Map<string, string | null>();
      for (const q of res.data.questions ?? []) next.set(q.questionId, q.sectionName);
      setSectionNameByQid(next);
    })().catch(() => {
      if (!cancelled) setSectionNameByQid(new Map());
    });
    return () => { cancelled = true; };
  }, [examId, batchFilter, authLoading, isAuthenticated]);

  // ── Roll-up builders ──────────────────────────────────────
  //
  // Both views aggregate the same questionAnalysis rows the palette and
  // the question table already use, so every number stays consistent
  // across the four views.
  const { subjectGroups, sectionGroups, rollupTotal } = useMemo(() => {
    const list = data?.questionAnalysis ?? [];
    if (list.length === 0) {
      return { subjectGroups: [] as RollupGroup[], sectionGroups: [] as RollupGroup[], rollupTotal: null };
    }

    interface Acc {
      label: string;
      subject: string;
      questionCount: number;
      correct: number;
      incorrect: number;
      skipped: number;
      responses: number;
      cohortTotal: number;
      topperTotal: number;
      topperCovered: number;
      firstIndex: number;
    }

    const blank = (label: string, subject: string, firstIndex: number): Acc => ({
      label, subject, questionCount: 0, correct: 0, incorrect: 0, skipped: 0,
      responses: 0, cohortTotal: 0, topperTotal: 0, topperCovered: 0, firstIndex,
    });

    const add = (acc: Acc, q: (typeof list)[number]) => {
      acc.questionCount += 1;
      acc.correct += q.correctCount;
      acc.incorrect += q.incorrectCount;
      acc.skipped += q.skippedCount;
      acc.responses += q.correctCount + q.incorrectCount + q.skippedCount;
      acc.cohortTotal += q.avgTimeSeconds ?? 0;
      // The topper's time is absent for questions they never answered —
      // excluded from the sum AND the divisor so a partially-attempted
      // group doesn't read as unusually fast.
      if (q.topperTimeSeconds != null) {
        acc.topperTotal += q.topperTimeSeconds;
        acc.topperCovered += 1;
      }
    };

    const finish = (acc: Acc, key: string): RollupRow => ({
      key,
      label: acc.label,
      questionCount: acc.questionCount,
      correct: acc.correct,
      // The cohort payload has no partial-credit bucket — a partially
      // correct response lands in incorrectCount upstream.
      partial: 0,
      incorrect: acc.incorrect,
      skipped: acc.skipped,
      responses: acc.responses,
      accuracy: acc.responses > 0 ? (acc.correct / acc.responses) * 100 : 0,
      times: [
        {
          total: acc.cohortTotal,
          perQ: acc.questionCount > 0 ? acc.cohortTotal / acc.questionCount : 0,
          covered: acc.questionCount,
        },
        {
          total: acc.topperCovered > 0 ? acc.topperTotal : null,
          perQ: acc.topperCovered > 0 ? acc.topperTotal / acc.topperCovered : null,
          covered: acc.topperCovered,
        },
      ],
      firstIndex: acc.firstIndex,
    });

    const subjectAcc = new Map<string, Acc>();
    // Keyed subject → section so sections stay nested under their subject
    // and two subjects can both have a "Numerical" section.
    const sectionAcc = new Map<string, Map<string, Acc>>();
    const whole = blank("Whole paper", "", 0);

    list.forEach((q, i) => {
      const subject = q.subjectName || "Unassigned";
      const section = resolveSectionLabel(
        subject,
        sectionNameByQid.get(q.questionId),
        q.questionType,
      );

      let sAcc = subjectAcc.get(subject);
      if (!sAcc) { sAcc = blank(subject, subject, i); subjectAcc.set(subject, sAcc); }
      add(sAcc, q);

      let bySection = sectionAcc.get(subject);
      if (!bySection) { bySection = new Map(); sectionAcc.set(subject, bySection); }
      let secAcc = bySection.get(section);
      if (!secAcc) { secAcc = blank(section, subject, i); bySection.set(section, secAcc); }
      add(secAcc, q);

      add(whole, q);
    });

    return {
      subjectGroups: [
        { rows: Array.from(subjectAcc, ([name, acc]) => finish(acc, `subject:${name}`)) },
      ] as RollupGroup[],
      sectionGroups: Array.from(sectionAcc, ([subject, bySection]) => ({
        header: subject,
        rows: Array.from(bySection, ([name, acc]) => finish(acc, `section:${subject}:${name}`)),
      })) as RollupGroup[],
      rollupTotal: finish(whole, "whole-paper"),
    };
  }, [data?.questionAnalysis, sectionNameByQid]);

  // Lazy-fetch the full question payload for the palette-selected
  // question. Cached so flipping back to a previously-viewed cell is
  // instant and doesn't re-render the loader.
  useEffect(() => {
    const list = data?.questionAnalysis;
    if (!list || list.length === 0) return;
    const target = list[Math.min(selectedQIdx, list.length - 1)];
    if (!target) return;
    const id = target.questionId;
    if (questionDetailCache.has(id)) {
      setQuestionDetailLoading(false);
      setQuestionDetailError(null);
      return;
    }
    let cancelled = false;
    setQuestionDetailLoading(true);
    setQuestionDetailError(null);
    apiClient
      .get<QuestionData>(`/api/v1/questions/${id}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setQuestionDetailCache((prev) => {
            const next = new Map(prev);
            next.set(id, res.data as QuestionData);
            return next;
          });
        } else {
          setQuestionDetailError(res.error || "Failed to load question");
        }
      })
      .catch((e) => {
        if (!cancelled) setQuestionDetailError(e?.message || "Failed to load question");
      })
      .finally(() => {
        if (!cancelled) setQuestionDetailLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedQIdx, data?.questionAnalysis, questionDetailCache]);

  // ── Loading ───────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen overflow-y-auto bg-bg p-8 dark:bg-bg-dark">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
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

  // ── Error ─────────────────────────────────────────────────
  if (error || !data) {
    const notReleased = /not been released/i.test(error);
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg dark:bg-bg-dark">
        <div className="mx-auto max-w-sm text-center">
          {notReleased ? (
            <>
              <p className="text-base font-semibold text-primary-text">Results not released yet</p>
              <p className="mt-1 text-sm text-muted">
                Analytics for this exam become available once results are released.
              </p>
            </>
          ) : (
            <p className="text-sm text-danger">{error || "No data available"}</p>
          )}
          <button onClick={goBack} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── Computed ──────────────────────────────────────────────
  const distributionData = BUCKET_ORDER.map((bucket) => ({
    range: bucket,
    count: data.scoreDistribution[bucket] ?? 0,
  }));

  const subjectRadarData = data.subjectBreakdown.map((s) => ({
    subject: s.subjectName.length > 12 ? s.subjectName.slice(0, 12) + "..." : s.subjectName,
    accuracy: s.avgAccuracy,
    fullMark: 100,
  }));

  // Subject-wise RWL — Right / Wrong / Left aggregated across the
  // cohort, summed from per-question counts. Frontend-only because
  // the per-question payload already carries everything we need.
  const subjectRwlData = (() => {
    const map = new Map<string, { subject: string; right: number; wrong: number; left: number; total: number }>();
    for (const q of data.questionAnalysis) {
      const key = q.subjectName || "Unknown";
      const entry = map.get(key) ?? { subject: key, right: 0, wrong: 0, left: 0, total: 0 };
      entry.right += q.correctCount;
      entry.wrong += q.incorrectCount;
      entry.left += q.skippedCount;
      entry.total += q.correctCount + q.incorrectCount + q.skippedCount;
      map.set(key, entry);
    }
    return Array.from(map.values());
  })();

  const toggleTopicSort = (field: TopicSortField) => {
    if (topicSort === field) {
      setTopicSortDir(topicSortDir === "asc" ? "desc" : "asc");
    } else {
      setTopicSort(field);
      setTopicSortDir(field === "avgAccuracy" ? "asc" : "desc");
    }
  };

  const sortedTopics = [...data.topicBreakdown].sort((a, b) => {
    const mul = topicSortDir === "asc" ? 1 : -1;
    if (topicSort === "topicName" || topicSort === "subjectName") return mul * a[topicSort].localeCompare(b[topicSort]);
    return mul * ((a[topicSort] ?? 0) - (b[topicSort] ?? 0));
  });

  const TopicSortIcon = ({ field }: { field: TopicSortField }) => {
    if (topicSort !== field) return null;
    return topicSortDir === "asc" ? <CaretUp size={10} weight="bold" /> : <CaretDown size={10} weight="bold" />;
  };

  // ── Export handlers ─────────────────────────────────────────
  // Downloads the per-question Right/Wrong/Left report the coaching
  // team has historically shared over Drive. Reuses the endpoint
  // already powering /exams/[id]/rwl so the two pages stay consistent.
  const handleExportRwlReport = async (format: "pdf" | "xlsx") => {
    const key = format === "pdf" ? "rwl-pdf" : "rwl-xlsx";
    setExporting(key);
    try {
      const qp = new URLSearchParams({ format });
      // RWL export scopes by branch/batch (section is on-screen only).
      if (branchFilter) qp.set("branchId", branchFilter);
      if (batchFilter) qp.set("batchId", batchFilter);
      const res = await apiFetch(`/api/v1/exam-analytics/${examId}/rwl/export?${qp.toString()}`);
      if (!res.ok) {
        let message = "Failed to export RWL report";
        try {
          const err = await res.json();
          message = err?.error?.message || err?.error?.code || err?.message || message;
        } catch {
          /* response wasn't JSON — keep the generic message */
        }
        setExportToast({ type: "error", message });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rwl-${data?.title || examId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportToast({ type: "error", message: (err as Error)?.message || "Failed to export RWL report" });
    } finally {
      setExporting(null);
    }
  };

  const handleExportFullResults = async () => {
    setExporting("full-xlsx");
    try {
      const res = await apiFetch(`/api/v1/exam-lifecycle/${examId}/export-results`);
      if (!res.ok) {
        setExportToast({ type: "error", message: "Failed to export results" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data?.title || "results"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportToast({ type: "error", message: "Failed to export results" });
    } finally {
      setExporting(null);
    }
  };

  // ── Org filter options (Branch → Batch → Section) ───────────
  // Driven by data.rosterFacets; the counts are the number of students
  // assigned to this exam in each branch / batch / section. The lists
  // cascade so the batch dropdown narrows to the picked branch and the
  // section dropdown narrows to the picked batch.
  const facets = data.rosterFacets;
  const branchOptions = facets?.branches ?? [];
  const batchOptionsFiltered = (facets?.batches ?? []).filter(
    (b) => !branchFilter || b.branchId === branchFilter,
  );
  const sectionOptions = (() => {
    const scoped = (facets?.sections ?? []).filter(
      (s) =>
        (!branchFilter || s.branchId === branchFilter) &&
        (!batchFilter || s.batchId === batchFilter),
    );
    // Collapse same-named sections (across batches) into one option with
    // summed counts when no batch is selected; within a batch they're
    // already unique.
    const m = new Map<string, number>();
    for (const s of scoped) m.set(s.section, (m.get(s.section) ?? 0) + s.count);
    return Array.from(m, ([section, count]) => ({ section, count })).sort(
      (a, b) => a.section.localeCompare(b.section),
    );
  })();

  // Picking a coarser filter clears the finer ones so we never send an
  // impossible branch+batch combination. Selections are mirrored into the
  // URL so a drill-in to a student page can bring the user back here with
  // the same branch/batch/section.
  const syncFiltersToUrl = (branch: string, batch: string, section: string) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of [["branchId", branch], ["batchId", batch], ["section", section]] as const) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  };
  const handleBranchChange = (v: string) => {
    setBranchFilter(v);
    setBatchFilter("");
    setSectionFilter("");
    syncFiltersToUrl(v, "", "");
  };
  const handleBatchChange = (v: string) => {
    setBatchFilter(v);
    setSectionFilter("");
    syncFiltersToUrl(branchFilter, v, "");
  };
  const handleSectionChange = (v: string) => {
    setSectionFilter(v);
    syncFiltersToUrl(branchFilter, batchFilter, v);
  };
  // Query string appended to student drill-in links so their back button
  // can restore these selections even without browser history.
  const filterQuery = (() => {
    const p = new URLSearchParams();
    if (branchFilter) p.set("branchId", branchFilter);
    if (batchFilter) p.set("batchId", batchFilter);
    if (sectionFilter) p.set("section", sectionFilter);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  })();

  const orgSelectCls =
    "max-w-[200px] truncate rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-border-dark dark:bg-surface-dark dark:text-foreground-dark";

  const overviewCards = [
    { label: "Submissions", value: data.totalSubmissions, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Absent", value: data.absentCount ?? 0, icon: UserMinus, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-500/10" },
    { label: "Avg Score", value: `${data.averageScore}%`, icon: TrendUp, color: "text-success", bg: "bg-success/10" },
    { label: "Highest", value: `${data.highestScore}%`, icon: Trophy, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-500/10" },
    { label: "Lowest", value: `${data.lowestScore}%`, icon: ChartBar, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-500/10" },
    { label: "Std Dev", value: `${data.standardDeviation}`, icon: ChartBar, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
    { label: "Pass Rate", value: `${Math.round(data.passRate * 100)}%`, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
  ];

  return (
    <div className="min-h-screen overflow-y-auto bg-bg p-8 dark:bg-bg-dark">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div className="flex items-center gap-4" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={goBack} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border transition-colors hover:bg-primary/5 dark:border-border-dark dark:hover:bg-surface-elevated-dark">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
            <p className="mt-0.5 text-sm text-muted">
              <span className="capitalize">{data.examType.replace(/_/g, " ")}</span>
              {` \u2014 ${data.totalSubmissions} submissions`}
            </p>
          </div>
          {/* Branch / Batch / Section filters + exports. Each option is
              labelled with the number of students assigned to this exam in
              that cohort. max-w caps the control so long names don't push
              the export buttons off the row; the open menu still shows the
              full label. */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {branchOptions.length > 0 && (
              <select
                value={branchFilter}
                onChange={(e) => handleBranchChange(e.target.value)}
                className={orgSelectCls}
              >
                <option value="">All Branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.count})
                  </option>
                ))}
              </select>
            )}
            <select
              value={batchFilter}
              onChange={(e) => handleBatchChange(e.target.value)}
              className={orgSelectCls}
            >
              <option value="">All Batches</option>
              {batchOptionsFiltered.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.count})
                </option>
              ))}
            </select>
            {sectionOptions.length > 0 && (
              <select
                value={sectionFilter}
                onChange={(e) => handleSectionChange(e.target.value)}
                className={orgSelectCls}
              >
                <option value="">All Sections</option>
                {sectionOptions.map((s) => (
                  <option key={s.section} value={s.section}>
                    Section {s.section} ({s.count})
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => void handleExportRwlReport("pdf")}
              disabled={exporting !== null}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
            >
              <DownloadSimple weight="duotone" className="h-3.5 w-3.5" />
              {exporting === "rwl-pdf" ? "Exporting…" : "RWL (PDF)"}
            </button>
            <button
              type="button"
              onClick={() => void handleExportRwlReport("xlsx")}
              disabled={exporting !== null}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
            >
              <DownloadSimple weight="duotone" className="h-3.5 w-3.5" />
              {exporting === "rwl-xlsx" ? "Exporting…" : "RWL (Excel)"}
            </button>
            <button
              type="button"
              onClick={() => void handleExportFullResults()}
              disabled={exporting !== null}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
            >
              <DownloadSimple weight="duotone" className="h-3.5 w-3.5" />
              {exporting === "full-xlsx" ? "Exporting…" : "Full Results (Excel)"}
            </button>
          </div>
        </motion.div>

        {/* Export toast */}
        <AnimatePresence>
          {exportToast && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${
                exportToast.type === "success" ? "bg-emerald-500/95 text-white" : "bg-red-500/95 text-white"
              }`}
            >
              {exportToast.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overview Cards */}
        <motion.div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-7" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {overviewCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bg}`}>
                  <card.icon weight="duotone" className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="font-mono text-lg font-bold">{card.value}</p>
                  <p className="text-[11px] text-muted">{card.label}</p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Insights — collapsible quick-highlights derived from the
            per-question stats. Surfaces "killer questions" (low
            accuracy) and "most skipped" (high left-blank rate) so
            faculty don't have to scroll the question palette to find
            outliers. Card matches the rest of the page's surface
            style; the toggle is a section header chevron. */}
        {data.questionAnalysis.length > 0 && (() => {
          const list = data.questionAnalysis;
          const totalAttempts = (q: any) => q.totalAttempts || 0;
          const killerQs = list.filter(
            (q) => q.totalAttempts > 0 && q.accuracy === 0,
          );
          const almostKillerQs =
            killerQs.length === 0
              ? list
                  .filter((q) => q.totalAttempts > 0 && q.accuracy < 20)
                  .sort((a, b) => a.accuracy - b.accuracy)
              : [];
          const killerList = killerQs.length > 0 ? killerQs : almostKillerQs;
          const killerHeading =
            killerQs.length > 0 ? "Nobody got these right" : almostKillerQs.length > 0 ? "Cohort struggled here" : "Killer questions";
          const skippedQs = list
            .map((q) => {
              const total =
                q.correctCount + q.incorrectCount + q.skippedCount;
              const rate = total > 0 ? (q.skippedCount / total) * 100 : 0;
              return { q, rate };
            })
            .filter(({ rate }) => rate >= 20)
            .sort((a, b) => b.rate - a.rate);

          // Don't render the section at all if both columns would be
          // empty — keeps the page tidy on healthy cohorts.
          if (killerList.length === 0 && skippedQs.length === 0) return null;

          return (
            <motion.div
              className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-xs dark:border-border-dark dark:bg-surface-dark"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.13 }}
            >
              <button
                type="button"
                onClick={() => setShowInsights((v) => !v)}
                aria-expanded={showInsights}
                className="flex w-full items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                  <Lightbulb weight="duotone" className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold">Insights</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {killerList.length} killer question{killerList.length === 1 ? "" : "s"} · {skippedQs.length} skipped by ≥20%
                  </p>
                </div>
                <CaretDown
                  weight="bold"
                  className={`h-4 w-4 shrink-0 text-muted transition-transform ${showInsights ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence initial={false}>
                {showInsights && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="grid gap-px border-t border-border bg-border dark:border-border-dark dark:bg-border-dark md:grid-cols-2">
                      {/* Killer questions */}
                      <div className="bg-surface p-5 dark:bg-surface-dark">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                            <XCircle weight="duotone" className="h-4 w-4" />
                          </span>
                          <h3 className="text-sm font-semibold">{killerHeading}</h3>
                          {killerList.length > 0 && (
                            <span className="ml-auto rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">
                              {killerList.length}
                            </span>
                          )}
                        </div>
                        {killerList.length === 0 ? (
                          <p className="text-xs text-muted">Every question had at least one student get it right at decent rate.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {killerList.map((q) => {
                              const idx = list.findIndex((x) => x.questionId === q.questionId);
                              return (
                                <button
                                  key={q.questionId}
                                  type="button"
                                  onClick={() => { setSelectedQIdx(idx); setQaView("palette"); document.getElementById("question-analysis")?.scrollIntoView({ behavior: "smooth" }); }}
                                  title={`${q.subjectName || ""}${q.topicName ? ` · ${q.topicName}` : ""} · ${q.accuracy}% correct`}
                                  className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-all hover:-translate-y-px hover:border-rose-300 hover:bg-rose-50 dark:border-border-dark dark:bg-surface-dark dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10"
                                >
                                  <span className="font-mono font-semibold">Q{idx + 1}</span>
                                  <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">{q.accuracy}%</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Most skipped */}
                      <div className="bg-surface p-5 dark:bg-surface-dark">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400">
                            <MinusCircle weight="duotone" className="h-4 w-4" />
                          </span>
                          <h3 className="text-sm font-semibold">Most skipped</h3>
                          {skippedQs.length > 0 && (
                            <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-400">
                              {skippedQs.length}
                            </span>
                          )}
                        </div>
                        {skippedQs.length === 0 ? (
                          <p className="text-xs text-muted">No question was skipped by more than 20% of the cohort.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {skippedQs.map(({ q, rate }) => {
                              const idx = list.findIndex((x) => x.questionId === q.questionId);
                              return (
                                <button
                                  key={q.questionId}
                                  type="button"
                                  onClick={() => { setSelectedQIdx(idx); setQaView("palette"); document.getElementById("question-analysis")?.scrollIntoView({ behavior: "smooth" }); }}
                                  title={`${q.subjectName || ""}${q.topicName ? ` · ${q.topicName}` : ""} · ${q.skippedCount}/${totalAttempts(q)} skipped (${Math.round(rate)}%)`}
                                  className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-all hover:-translate-y-px hover:border-zinc-400 hover:bg-primary/5 dark:border-border-dark dark:bg-surface-dark dark:hover:border-zinc-500/40 dark:hover:bg-zinc-500/10"
                                >
                                  <span className="font-mono font-semibold">Q{idx + 1}</span>
                                  <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">{Math.round(rate)}%</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })()}

        {/* Behavioral signals — telemetry roll-up across the cohort.
            Shown between overview KPIs and the charts so the cohort
            "how did they behave" signal is visible without scrolling. */}
        {data.telemetrySummary && (
          <motion.div
            className="mt-4 rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Behavioral signals</h2>
                <p className="text-[11px] text-muted">Averaged across {data.totalSubmissions} submission{data.totalSubmissions === 1 ? "" : "s"}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-slate-50/70/30 p-4 dark:border-border-dark dark:bg-surface-elevated-dark/30">
                <p className="text-[10px] uppercase tracking-wider text-muted">Avg tab switches</p>
                <p className="mt-1 font-mono text-lg font-bold">{data.telemetrySummary.avgTabSwitches}</p>
                <p className="text-[10px] text-muted">per student</p>
              </div>
              <div className="rounded-xl border border-border bg-slate-50/70/30 p-4 dark:border-border-dark dark:bg-surface-elevated-dark/30">
                <p className="text-[10px] uppercase tracking-wider text-muted">Avg revisits</p>
                <p className="mt-1 font-mono text-lg font-bold">{data.telemetrySummary.avgRevisits}</p>
                <p className="text-[10px] text-muted">question opens per student</p>
              </div>
              <div className="rounded-xl border border-border bg-slate-50/70/30 p-4 dark:border-border-dark dark:bg-surface-elevated-dark/30">
                <p className="text-[10px] uppercase tracking-wider text-muted">Flagged ≥ 1 Q</p>
                <p className="mt-1 font-mono text-lg font-bold">{data.telemetrySummary.pctWithFlags}%</p>
                <p className="text-[10px] text-muted">of students</p>
              </div>
              <div className="rounded-xl border border-border bg-slate-50/70/30 p-4 dark:border-border-dark dark:bg-surface-elevated-dark/30">
                <p className="text-[10px] uppercase tracking-wider text-muted">2nd-guessed → wrong</p>
                <p className="mt-1 font-mono text-lg font-bold">{data.telemetrySummary.pctSecondGuessedToWrong}%</p>
                <p className="text-[10px] text-muted">of students</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Score Distribution + Subject Accuracy */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <motion.div className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-base font-semibold">Score Distribution</h2>
            <p className="text-xs text-muted">Histogram of student scores</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} name="Students" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {subjectRadarData.length > 0 && (
            <motion.div className="flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <h2 className="text-base font-semibold">Subject Accuracy</h2>
              <p className="text-xs text-muted">Overall accuracy by subject</p>
              <div className="mt-4 min-h-[256px] flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={subjectRadarData}
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
                      width={110}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
                      contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid var(--color-border, #e5e7eb)" }}
                      formatter={(v: number) => [`${v}%`, "Accuracy"]}
                    />
                    <Bar dataKey="accuracy" radius={[0, 8, 8, 0]} maxBarSize={36}>
                      {subjectRadarData.map((s, i) => (
                        <Cell
                          key={i}
                          fill={s.accuracy >= 75 ? "#10B981" : s.accuracy >= 50 ? "#2563EB" : s.accuracy >= 30 ? "#F59E0B" : "#EF4444"}
                        />
                      ))}
                      <LabelList
                        dataKey="accuracy"
                        position="right"
                        formatter={(v: number) => `${v}%`}
                        style={{ fontSize: 12, fontWeight: 600, fill: "var(--color-foreground, #111827)" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </div>

        {/* Results — full ranked list with pagination so faculty can scan
            the entire cohort without one giant scroll table. */}
        {data.topScorers.length > 0 && (() => {
          // Flagged = ever placed under integrity review on this exam,
          // including reviews already released. Counted across the whole
          // cohort so the toggle's badge doesn't change as you page.
          const flaggedScorers = data.topScorers.filter((s) => s.flagged).length;
          const searchNeedle = scorersSearch.trim().toLowerCase();
          const visibleScorers = data.topScorers.filter(
            (s) =>
              (!scorersFlaggedOnly || s.flagged) &&
              (!searchNeedle || s.name.toLowerCase().includes(searchNeedle)),
          );
          const totalScorers = visibleScorers.length;
          // Held students sit in topScorers with rank=null — count them
          // separately so the header doesn't call them "ranked".
          const heldScorers = visibleScorers.filter((s) => s.resultHold).length;
          const totalScorerPages = Math.max(1, Math.ceil(totalScorers / SCORERS_PAGE_SIZE));
          const safePage = Math.min(scorersPage, totalScorerPages);
          const startIdx = (safePage - 1) * SCORERS_PAGE_SIZE;
          // True while a sort/filter refetch is in flight on top of cached
          // data — drives the inline loader so the user knows their click
          // registered even though `keepPreviousData` keeps the rows visible.
          const isResorting = examQuery.isFetching && !examQuery.isLoading;
          // Per-(student, subject) breakdown derived from the cohort
          // `subjectRankings`. Each subject ranking already carries every
          // student's correct/total/accuracy on that subject so we just
          // index it by studentId for O(1) lookup in the row map below.
          type SubjectCell = { correct: number; total: number; accuracy: number };
          const subjectColumns = (data.subjectRankings ?? []).map((s) => ({
            id: s.subjectId,
            name: s.subjectName,
          }));
          const subjectScoreMap = new Map<string, Map<string, SubjectCell>>();
          for (const subj of data.subjectRankings ?? []) {
            for (const s of subj.students) {
              const inner = subjectScoreMap.get(s.studentId) ?? new Map<string, SubjectCell>();
              inner.set(subj.subjectId, {
                correct: s.correct,
                total: s.total,
                accuracy: s.accuracy,
              });
              subjectScoreMap.set(s.studentId, inner);
            }
          }
          const subjectScoreTone = (acc: number) =>
            acc >= 70
              ? "text-success"
              : acc >= 40
                ? "text-primary"
                : "text-danger";
          // Layer client-side subject sort over the API-sorted list.
          // When a subject column header is active, re-order
          // `data.topScorers` by that subject's `correct` count
          // (missing rows go to the end). Otherwise keep the order
          // the API returned (server-side sort is authoritative).
          const orderedScorers = scorersSubjectSort
            ? [...visibleScorers].sort((a, b) => {
                const va = subjectScoreMap.get(a.studentId)?.get(scorersSubjectSort.subjectId)?.correct;
                const vb = subjectScoreMap.get(b.studentId)?.get(scorersSubjectSort.subjectId)?.correct;
                if (va == null && vb == null) return 0;
                if (va == null) return 1;
                if (vb == null) return -1;
                return scorersSubjectSort.dir === "asc" ? va - vb : vb - va;
              })
            : visibleScorers;
          const pageRows = orderedScorers.slice(
            startIdx,
            startIdx + SCORERS_PAGE_SIZE,
          );
          return (
            <motion.div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10"><Trophy weight="duotone" className="h-5 w-5 text-warning" /></div>
                <div className="flex-1">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    Results
                    {isResorting && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                        <CircleNotch weight="bold" className="h-3 w-3 animate-spin" />
                        Updating
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted">
                    {totalScorers - heldScorers} ranked student{totalScorers - heldScorers === 1 ? "" : "s"}
                    {heldScorers > 0 ? ` · ${heldScorers} on hold` : ""}
                    {flaggedScorers > 0 ? ` · ${flaggedScorers} flagged` : ""}
                  </p>
                </div>
                <div className="relative shrink-0">
                  <MagnifyingGlass
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="text"
                    value={scorersSearch}
                    onChange={(e) => {
                      setScorersSearch(e.target.value);
                      setScorersPage(1);
                    }}
                    placeholder="Search students…"
                    aria-label="Search students in results"
                    className="h-8 w-56 rounded-lg border border-border bg-surface pl-8 pr-8 text-xs text-foreground focus:border-primary focus:outline-none dark:border-border-dark dark:bg-surface-dark"
                  />
                  {scorersSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setScorersSearch("");
                        setScorersPage(1);
                      }}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    >
                      <X size={12} weight="bold" />
                    </button>
                  )}
                </div>
                {flaggedScorers > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setScorersFlaggedOnly((v) => !v);
                      setScorersPage(1);
                    }}
                    aria-pressed={scorersFlaggedOnly}
                    title="Show only students placed under integrity review on this exam"
                    className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
                      scorersFlaggedOnly
                        ? "border-danger/30 bg-danger/10 text-danger"
                        : "border-border text-muted hover:bg-primary/5 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                    }`}
                  >
                    <Flag weight={scorersFlaggedOnly ? "fill" : "bold"} className="h-3.5 w-3.5" />
                    Flagged only
                    <span className="font-mono">{flaggedScorers}</span>
                  </button>
                )}
              </div>
              <div className={`relative overflow-x-auto transition-opacity ${isResorting ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
                {isResorting && (
                  <div className="pointer-events-none absolute left-1/2 top-12 z-10 -translate-x-1/2">
                    <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted shadow-sm dark:border-border-dark dark:bg-surface-dark">
                      <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin text-primary" />
                      Sorting…
                    </div>
                  </div>
                )}
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
                      <th className="cursor-pointer pb-3 pr-4 transition-colors hover:text-foreground" onClick={() => toggleScorersSort("name")}>
                        <span className="flex items-center gap-1">Student <ScorersSortIcon field="name" /></span>
                      </th>
                      <th className="cursor-pointer pb-3 pr-4 transition-colors hover:text-foreground" onClick={() => toggleScorersSort("rank")} title="Click to sort — descending shows last-place first">
                        <span className="flex items-center gap-1">Rank <ScorersSortIcon field="rank" /></span>
                      </th>
                      <th className="cursor-pointer pb-3 pr-4 text-right transition-colors hover:text-foreground" onClick={() => toggleScorersSort("score")}>
                        <span className="flex items-center justify-end gap-1">Total <ScorersSortIcon field="score" /></span>
                      </th>
                      {subjectColumns.map((c, i) => (
                        <th
                          key={c.id}
                          className={`cursor-pointer pb-3 ${i === subjectColumns.length - 1 ? "" : "pr-4"} text-right transition-colors hover:text-foreground`}
                          title={`Sort by ${c.name} score`}
                          onClick={() => toggleScorersSubjectSort(c.id)}
                        >
                          <span className="flex items-center justify-end gap-1 truncate">
                            {c.name}
                            <ScorersSubjectSortIcon subjectId={c.id} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((scorer, i) => {
                      // Held students carry rank=null — show a "Held" chip
                      // (with the reason on hover) instead of a rank number.
                      const isHeld = !!scorer.resultHold;
                      const rank = scorer.rank ?? (isHeld ? null : startIdx + i + 1);
                      const isFlagged = !!scorer.flagged;
                      return (
                        <motion.tr key={scorer.studentId} className={`border-b transition-colors ${isFlagged ? "border-danger/20 bg-danger/5 hover:bg-danger/10 dark:border-danger/20" : "border-border/30 hover:bg-primary/5 dark:border-border-dark/30 dark:hover:bg-surface-elevated-dark/30"}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.02 }}>
                          <td className="py-3 pr-4">
                            <span className="flex items-center gap-1.5">
                              {isFlagged && (
                                <span
                                  title={scorer.flagReason || "Flagged for integrity review"}
                                  aria-label="Flagged for integrity review"
                                  className="inline-flex shrink-0"
                                >
                                  <Flag weight="fill" className="h-3.5 w-3.5 text-danger" />
                                </span>
                              )}
                              <Link href={`/analytics/student/${scorer.studentId}/test-analysis/${data.examId}${filterQuery}`} className="font-medium text-primary hover:underline">{scorer.name}</Link>
                            </span>
                          </td>
                          <td className="py-3 pr-4">{rank == null ? (
                            <span title={scorer.resultHold?.reason || "Result on hold"} className="inline-flex h-7 items-center justify-center rounded-lg bg-amber-100 px-2 text-[11px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Held</span>
                          ) : (
                            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${rank === 1 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400" : rank === 2 ? "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400" : rank === 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400" : "bg-slate-50/70 text-muted dark:bg-surface-elevated-dark"}`}>#{rank}</span>
                          )}</td>
                          <td className="py-3 pr-4 text-right font-mono">{scorer.score}/{scorer.maxScore}</td>
                          {subjectColumns.map((c, i) => {
                            const cell = subjectScoreMap.get(scorer.studentId)?.get(c.id);
                            const cls = `py-3 ${i === subjectColumns.length - 1 ? "" : "pr-4"} text-right font-mono text-xs`;
                            if (!cell) {
                              return (
                                <td key={c.id} className={`${cls} text-muted`}>—</td>
                              );
                            }
                            return (
                              <td key={c.id} className={cls}>
                                <span className={`font-semibold ${subjectScoreTone(cell.accuracy)}`}>{cell.correct}</span>
                                <span className="text-muted">/{cell.total}</span>
                              </td>
                            );
                          })}
                        </motion.tr>
                      );
                    })}
                    {pageRows.length === 0 && (
                      <tr>
                        <td colSpan={99} className="py-8 text-center text-sm text-muted">
                          No students match{searchNeedle ? ` “${scorersSearch.trim()}”` : ""}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalScorerPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4 dark:border-border-dark">
                  <p className="text-xs text-muted">
                    Showing{" "}
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{startIdx + 1}</span>
                    {" - "}
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{Math.min(startIdx + SCORERS_PAGE_SIZE, totalScorers)}</span>{" "}
                    of{" "}
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{totalScorers}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setScorersPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                    >
                      Prev
                    </button>
                    <span className="min-w-[64px] text-center text-xs font-medium text-gray-700 dark:text-gray-300">
                      Page <span className="font-mono">{safePage}</span> / <span className="font-mono">{totalScorerPages}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setScorersPage((p) => Math.min(totalScorerPages, p + 1))}
                      disabled={safePage >= totalScorerPages}
                      className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })()}

        {/* ── Students at risk on THIS exam ──────────────────────
            Per-exam risk classifier. Bucketed by absolute score on
            this specific paper so faculty can react to a bad paper
            without waiting for the batch-wide trend detector to
            catch up. < 40% critical, 40–50% warning, 50–60% low. */}
        {data.atRiskStudents && data.atRiskStudents.length > 0 && data.atRiskSummary && (() => {
          const summary = data.atRiskSummary;
          const students = data.atRiskStudents;
          const filtered =
            atRiskFilter === "all"
              ? students
              : students.filter((s) => s.severity === atRiskFilter);
          const total = students.length;
          const pc = {
            critical: (summary.critical / Math.max(total, 1)) * 100,
            warning: (summary.warning / Math.max(total, 1)) * 100,
            low: (summary.low / Math.max(total, 1)) * 100,
          };
          const atRiskTotalPages = Math.max(1, Math.ceil(filtered.length / AT_RISK_PAGE_SIZE));
          const safeAtRiskPage = Math.min(atRiskPage, atRiskTotalPages);
          const atRiskStart = (safeAtRiskPage - 1) * AT_RISK_PAGE_SIZE;
          const pagedFiltered = filtered.slice(atRiskStart, atRiskStart + AT_RISK_PAGE_SIZE);
          return (
            <motion.div
              className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.36 }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger/10">
                    <Warning weight="duotone" className="h-5 w-5 text-danger" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">Students at risk on this exam</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {total} of {data.totalSubmissions} submitters scored below 60%
                      {" · "}bucketed by absolute score on this paper
                    </p>
                  </div>
                </div>
                <Link
                  href="/analytics/at-risk-explainer"
                  className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary dark:border-border-dark dark:bg-surface-dark"
                >
                  <Question size={14} weight="duotone" /> How this works
                </Link>
              </div>

              {/* Severity split bar */}
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-slate-50/60 dark:bg-surface-elevated-dark/60">
                {summary.critical > 0 && (
                  <div
                    title={`Critical · ${summary.critical} (${pc.critical.toFixed(0)}%)`}
                    style={{ width: `${pc.critical}%` }}
                    className="bg-danger/90"
                  />
                )}
                {summary.warning > 0 && (
                  <div
                    title={`Warning · ${summary.warning} (${pc.warning.toFixed(0)}%)`}
                    style={{ width: `${pc.warning}%` }}
                    className="bg-warning/90"
                  />
                )}
                {summary.low > 0 && (
                  <div
                    title={`Low · ${summary.low} (${pc.low.toFixed(0)}%)`}
                    style={{ width: `${pc.low}%` }}
                    className="bg-amber-500/70"
                  />
                )}
              </div>

              {/* Severity filter pills */}
              <div className="mt-4 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-white p-1 text-xs font-medium dark:border-border-dark dark:bg-surface-dark">
                {(
                  [
                    { id: "all", label: `All (${total})` },
                    { id: "critical", label: `Critical <40% (${summary.critical})` },
                    { id: "warning", label: `Warning 40–50% (${summary.warning})` },
                    { id: "low", label: `Low 50–60% (${summary.low})` },
                  ] as const
                ).map((opt) => {
                  const active = atRiskFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAtRiskFilter(opt.id)}
                      className={`rounded-md px-2.5 py-1 transition-colors ${
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

              {/* Student list */}
              <ul className="mt-4 divide-y divide-border dark:divide-border-dark">
                {filtered.length === 0 && (
                  <li className="py-6 text-center text-xs text-muted">
                    No students in this severity band.
                  </li>
                )}
                {pagedFiltered.map((s) => {
                  const tint =
                    s.severity === "critical"
                      ? "text-danger"
                      : s.severity === "warning"
                        ? "text-warning"
                        : "text-amber-600";
                  const barColor =
                    s.severity === "critical"
                      ? "bg-danger"
                      : s.severity === "warning"
                        ? "bg-warning"
                        : "bg-amber-500/70";
                  return (
                    <li key={s.studentId}>
                      <Link
                        href={`/analytics/student/${s.studentId}/test-analysis/${data.examId}${filterQuery}`}
                        className="group grid grid-cols-12 items-center gap-3 py-3 transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark/40"
                      >
                        <div className="col-span-12 md:col-span-4">
                          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                            {s.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {s.score}/{s.maxScore}{" · "}
                            <span className={tint}>
                              {s.deltaVsAvg >= 0 ? "+" : ""}
                              {s.deltaVsAvg}% vs avg
                            </span>
                          </p>
                        </div>
                        <div className="col-span-8 md:col-span-5">
                          <div className="flex items-center gap-2">
                            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-50/70 dark:bg-surface-elevated-dark/60">
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${Math.min(100, s.percentage)}%` }}
                              />
                            </div>
                            <span
                              className={`shrink-0 font-mono text-[13px] font-bold ${tint}`}
                              style={{ minWidth: "2.5rem", textAlign: "right" }}
                            >
                              {s.percentage}%
                            </span>
                          </div>
                        </div>
                        <div className="hidden items-center justify-end gap-2 md:col-span-3 md:flex">
                          <span className="text-[11px] font-mono text-muted">
                            {formatTime(s.timeTakenSeconds)}
                          </span>
                          <CaretRight
                            size={14}
                            weight="bold"
                            className="text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                          />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {atRiskTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4 dark:border-border-dark">
                  <p className="text-xs text-muted">
                    Showing{" "}
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{atRiskStart + 1}</span>
                    {" - "}
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{Math.min(atRiskStart + AT_RISK_PAGE_SIZE, filtered.length)}</span>{" "}
                    of{" "}
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{filtered.length}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAtRiskPage((p) => Math.max(1, p - 1))}
                      disabled={safeAtRiskPage <= 1}
                      className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                    >
                      <CaretLeft size={12} weight="bold" /> Prev
                    </button>
                    <span className="min-w-[64px] text-center text-xs font-medium text-gray-700 dark:text-gray-300">
                      Page <span className="font-mono">{safeAtRiskPage}</span> / <span className="font-mono">{atRiskTotalPages}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAtRiskPage((p) => Math.min(atRiskTotalPages, p + 1))}
                      disabled={safeAtRiskPage >= atRiskTotalPages}
                      className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                    >
                      Next <CaretRight size={12} weight="bold" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })()}

        {/* Mixed performance — students who excel at one subject but
            struggle at another. Surfaces "imbalanced" cohort members
            who would otherwise be hidden in the overall Top Scorers
            (which collapses subject-level signal). Filterable by which
            subject they're strongest / weakest in. */}
        {data.subjectRankings && data.subjectRankings.length >= 2 && (() => {
          // Build per-student per-subject accuracy map.
          type StudentPerf = {
            studentId: string;
            name: string;
            scores: Array<{ subjectId: string; subjectName: string; accuracy: number; rank: number; cohortSize: number }>;
          };
          const map = new Map<string, StudentPerf>();
          for (const subj of data.subjectRankings) {
            const cohortSize = subj.students.length;
            for (const s of subj.students) {
              const existing = map.get(s.studentId) ?? {
                studentId: s.studentId,
                name: s.name,
                scores: [],
              };
              existing.scores.push({
                subjectId: subj.subjectId,
                subjectName: subj.subjectName,
                accuracy: s.accuracy,
                rank: s.rank,
                cohortSize,
              });
              map.set(s.studentId, existing);
            }
          }

          // Compute best/worst subject + gap, keep students who
          // appear in at least 2 subjects.
          const ranked = Array.from(map.values())
            .filter((p) => p.scores.length >= 2)
            .map((p) => {
              const sorted = [...p.scores].sort((a, b) => b.accuracy - a.accuracy);
              const best = sorted[0]!;
              const worst = sorted[sorted.length - 1]!;
              return { ...p, best, worst, gap: best.accuracy - worst.accuracy };
            })
            // Surface only meaningful gaps. < 20pp isn't really an
            // imbalance worth flagging.
            .filter((p) => p.gap >= 20);

          // Apply user filters.
          const filtered = ranked.filter((p) => {
            if (insightsStrongIn !== "all" && p.best.subjectId !== insightsStrongIn) return false;
            if (insightsWeakIn !== "all" && p.worst.subjectId !== insightsWeakIn) return false;
            return true;
          });

          // Sort by gap desc (most imbalanced first).
          filtered.sort((a, b) => b.gap - a.gap);

          const allSubjects = data.subjectRankings.map((s) => ({ id: s.subjectId, name: s.subjectName }));
          const topToShow = filtered.slice(0, 12);

          return (
            <motion.div
              className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.37 }}
            >
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Scales weight="duotone" className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold">Mixed Performance</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Students excelling in one subject and lagging in another · {ranked.length} flagged
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-muted">Strong in</span>
                    <select
                      value={insightsStrongIn}
                      onChange={(e) => setInsightsStrongIn(e.target.value)}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium outline-none transition-colors hover:border-primary focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                    >
                      <option value="all">Any</option>
                      {allSubjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-muted">Weak in</span>
                    <select
                      value={insightsWeakIn}
                      onChange={(e) => setInsightsWeakIn(e.target.value)}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium outline-none transition-colors hover:border-primary focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                    >
                      <option value="all">Any</option>
                      {allSubjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  {(insightsStrongIn !== "all" || insightsWeakIn !== "all") && (
                    <button
                      type="button"
                      onClick={() => { setInsightsStrongIn("all"); setInsightsWeakIn("all"); }}
                      className="rounded-lg px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-primary/5 hover:text-foreground dark:hover:bg-surface-elevated-dark"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {topToShow.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-slate-50/30 px-4 py-10 text-center text-sm text-muted dark:border-border-dark dark:bg-surface-elevated-dark/30">
                  {ranked.length === 0
                    ? "No student in this exam shows a 20+ point gap between their best and worst subject."
                    : "No students match these filters. Try clearing them."}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {topToShow.map((p) => (
                    <Link
                      key={p.studentId}
                      href={`/analytics/student/${p.studentId}/test-analysis/${data.examId}${filterQuery}`}
                      className="group rounded-xl border border-border bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm dark:border-border-dark dark:bg-surface-elevated-dark/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{p.name}</p>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{Math.round(p.gap)}pp gap</span>
                      </div>
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            Strong: <span className="font-medium text-foreground">{p.best.subjectName}</span>
                          </span>
                          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{p.best.accuracy}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                            <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
                            Weak: <span className="font-medium text-foreground">{p.worst.subjectName}</span>
                          </span>
                          <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">{p.worst.accuracy}%</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })()}

        {/* Per-Subject Rankings — who led each subject's papers.
            A student strong in Chemistry may be weak in Physics; the
            overall Top Scorers table above collapses that. */}
        {data.subjectRankings && data.subjectRankings.length > 0 && (
          <motion.div
            className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ChartBar weight="duotone" className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">
                  Subject-wise Student Rankings
                </h2>
                <p className="text-xs text-muted">
                  Each subject&apos;s leaderboard — accuracy on that
                  subject&apos;s questions
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.subjectRankings.map((subj) => {
                const rankPage = subjectRankPage[subj.subjectId] ?? 1;
                const rankPages = Math.max(
                  1,
                  Math.ceil(subj.students.length / SUBJECT_RANK_PAGE_SIZE),
                );
                const pagedStudents = subj.students.slice(
                  (rankPage - 1) * SUBJECT_RANK_PAGE_SIZE,
                  rankPage * SUBJECT_RANK_PAGE_SIZE,
                );
                return (
                <div
                  key={subj.subjectId}
                  className="rounded-xl border border-border bg-white p-4 dark:border-border-dark dark:bg-surface-dark"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {subj.subjectName}
                    </h3>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {subj.students.length} student
                      {subj.students.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {subj.students.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No attempts in this subject yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {pagedStudents.map((s) => (
                        <div
                          key={s.studentId}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-primary/5 dark:hover:bg-surface-elevated-dark/40 transition-colors"
                        >
                          <span
                            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                              s.rank === 1
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400"
                                : s.rank === 2
                                  ? "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400"
                                  : s.rank === 3
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400"
                                    : "bg-slate-50/70 text-muted dark:bg-surface-elevated-dark"
                            }`}
                          >
                            #{s.rank}
                          </span>
                          <Link
                            href={`/analytics/student/${s.studentId}/test-analysis/${data.examId}${filterQuery}`}
                            className="flex-1 min-w-0 truncate text-xs font-medium hover:text-primary hover:underline"
                          >
                            {s.name}
                          </Link>
                          <span className="font-mono text-[11px]">
                            <span
                              className={`font-semibold ${
                                s.accuracy >= 70
                                  ? "text-success"
                                  : s.accuracy >= 40
                                    ? "text-primary"
                                    : "text-danger"
                              }`}
                            >
                              {s.correct}
                            </span>
                            <span className="text-muted">/{s.total}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {rankPages > 1 && (
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3 dark:border-border-dark">
                      <button
                        type="button"
                        disabled={rankPage <= 1}
                        onClick={() =>
                          setSubjectRankPage((prev) => ({
                            ...prev,
                            [subj.subjectId]: rankPage - 1,
                          }))
                        }
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark"
                      >
                        Prev
                      </button>
                      <span className="font-mono text-[11px] tabular-nums text-muted">
                        {rankPage} / {rankPages}
                      </span>
                      <button
                        type="button"
                        disabled={rankPage >= rankPages}
                        onClick={() =>
                          setSubjectRankPage((prev) => ({
                            ...prev,
                            [subj.subjectId]: rankPage + 1,
                          }))
                        }
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Per-Section and Per-Branch rankings — same shape as subject.
            Useful when an exam spans multiple cohorts so the top
            performer in Section A doesn't hide the top performer in
            Section B under the overall leaderboard. Sections are
            keyed by (branch, batch, section) so two batches with the
            same name in different branches stay distinct. */}
        {((data.sectionRankings && data.sectionRankings.length > 0) ||
          (data.branchRankings && data.branchRankings.length > 0)) && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {data.sectionRankings && data.sectionRankings.length > 0 && (
              <motion.div
                className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.39 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
                    <Users weight="duotone" className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">Section-wise Rankings</h2>
                    <p className="text-xs text-muted">
                      Students grouped by Branch → Batch → Section — ranked
                      by exam percentage within each section
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  {data.sectionRankings.map((group) => (
                    <OrgRankingCard
                      key={group.id}
                      group={group}
                      examId={data.examId}
                      filterQuery={filterQuery}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {data.branchRankings && data.branchRankings.length > 0 && (
              <motion.div
                className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Users weight="duotone" className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">Branch-wise Rankings</h2>
                    <p className="text-xs text-muted">
                      Students grouped by their branch — ranked by exam percentage
                      within each branch
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  {data.branchRankings.map((group) => (
                    <OrgRankingCard
                      key={group.id}
                      group={group}
                      examId={data.examId}
                      filterQuery={filterQuery}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Topic Breakdown Table (sortable) */}
        {data.topicBreakdown.length > 0 && (
          <motion.div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <h2 className="text-base font-semibold">Topic Breakdown</h2>
            <p className="mb-4 text-xs text-muted">Click column headers to sort</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
                    <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleTopicSort("topicName")}><span className="flex items-center gap-1">Topic <TopicSortIcon field="topicName" /></span></th>
                    <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleTopicSort("subjectName")}><span className="flex items-center gap-1">Subject <TopicSortIcon field="subjectName" /></span></th>
                    <th className="cursor-pointer pb-3 pr-4 text-right" onClick={() => toggleTopicSort("totalQuestions")}><span className="flex items-center justify-end gap-1">Questions <TopicSortIcon field="totalQuestions" /></span></th>
                    <th className="cursor-pointer pb-3 pr-4 text-right" onClick={() => toggleTopicSort("avgAccuracy")}><span className="flex items-center justify-end gap-1">Accuracy <TopicSortIcon field="avgAccuracy" /></span></th>
                    <th className="cursor-pointer pb-3 text-right" onClick={() => toggleTopicSort("avgTimeSeconds")}><span className="flex items-center justify-end gap-1">Avg Time <TopicSortIcon field="avgTimeSeconds" /></span></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTopics.map((t) => (
                    <tr key={t.topicId} className="border-b border-border/30 transition-colors hover:bg-primary/5 dark:border-border-dark/30 dark:hover:bg-surface-elevated-dark/30">
                      <td className="py-2.5 pr-4 font-medium"><QuestionMarkdown text={t.topicName} inline /></td>
                      <td className="py-2.5 pr-4 text-muted">{t.subjectName}</td>
                      <td className="py-2.5 pr-4 text-right font-mono">{t.totalQuestions}</td>
                      <td className="py-2.5 pr-4 text-right"><span className={`font-mono font-bold ${t.avgAccuracy < 40 ? "text-danger" : t.avgAccuracy < 60 ? "text-warning" : "text-success"}`}>{t.avgAccuracy}%</span></td>
                      <td className="py-2.5 text-right font-mono text-muted">{formatTime(t.avgTimeSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Per-Question Analysis — palette-driven layout matching the
            student exam-taking UI. Click a numbered cell to render the
            question (via the same QuestionCard the create-exam wizard
            uses) plus its option distribution and behavioural signals. */}
        {data.questionAnalysis.length > 0 && (() => {
          const list = data.questionAnalysis;
          const safeIdx = Math.min(selectedQIdx, list.length - 1);
          const current = list[safeIdx];
          if (!current) return null;
          const cachedDetail = questionDetailCache.get(current.questionId);
          // Color the palette by accuracy band so faculty can scan for
          // killer questions before clicking. Mirrors the band thresholds
          // used in the score / risk classifiers (>=70 good, >=40 mid).
          const accuracyTone = (acc: number): string => {
            if (acc >= 70) return "bg-success/10 text-success ring-1 ring-success/30 hover:bg-success/15";
            if (acc >= 40) return "bg-warning/10 text-warning ring-1 ring-warning/30 hover:bg-warning/15";
            return "bg-danger/10 text-danger ring-1 ring-danger/30 hover:bg-danger/15";
          };
          const optionEntries = Object.entries(current.optionDistribution).filter(([key]) => key !== "skipped");
          const totalResponses = current.totalAttempts;
          // Build a QuestionData object — prefer the freshly-fetched
          // payload (full options, solution, images) but fall back to
          // the analytics row's stem so the panel never looks empty
          // while the detail request is in flight.
          const renderQuestion: QuestionData = cachedDetail ?? {
            questionId: current.questionId,
            questionText: current.questionText,
            questionType: current.questionType,
            difficulty: current.difficulty,
            topicName: current.topicName,
          };
          return (
            <motion.div id="question-analysis" className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Question weight="duotone" className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold">Question Analysis</h2>
                  <p className="text-xs text-muted">
                    {qaView === "palette"
                      ? "Pick a question from the palette to see how the cohort answered it"
                      : qaView === "subject"
                        ? `Subject-wise roll-up across ${subjectGroups[0]?.rows.length ?? 0} subject${(subjectGroups[0]?.rows.length ?? 0) === 1 ? "" : "s"} — click a row to open its first question`
                        : qaView === "section"
                          ? `Section-wise roll-up across ${sectionGroups.reduce((n, g) => n + g.rows.length, 0)} sections — click a row to open its first question`
                          : `Question by question — Right / Wrong / Left across ${list.length} question${list.length === 1 ? "" : "s"}, click any column to sort`}
                  </p>
                </div>
                {/* View toggle — coarse to fine: subject → section →
                    question → single-question drill-in. */}
                <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1 text-xs font-medium dark:border-border-dark dark:bg-surface-dark">
                  {([
                    ["subject", "Subject"],
                    ["section", "Section"],
                    ["table", "Question by Question"],
                    ["palette", "Palette"],
                  ] as Array<[QAView, string]>).map(([view, label]) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setQaView(view)}
                      className={`rounded-lg px-3 py-1.5 transition-colors ${
                        qaView === view
                          ? "bg-primary/10 text-primary"
                          : "text-muted hover:bg-primary/5 hover:text-foreground dark:hover:bg-surface-elevated-dark"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {qaView === "subject" || qaView === "section" ? (
                <RollupTable
                  labelHeader={qaView === "subject" ? "Subject" : "Section"}
                  groups={qaView === "subject" ? subjectGroups : sectionGroups}
                  total={rollupTotal}
                  timeColumns={EXAM_ROLLUP_TIME_COLUMNS}
                  countMode="percent"
                  onRowClick={(idx) => { setSelectedQIdx(idx); setQaView("palette"); }}
                />
              ) : qaView === "table" ? (
                <QuestionByQuestionTable
                  list={list}
                  sortField={qaSortField}
                  sortDir={qaSortDir}
                  toggleSort={toggleQaSort}
                  SortIcon={QASortIcon}
                  onRowClick={(idx) => { setSelectedQIdx(idx); setQaView("palette"); }}
                />
              ) : (
              <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                {/* ── Palette ────────────────────────────────────── */}
                <div className="rounded-xl border border-border bg-slate-50/70/30 p-4 dark:border-border-dark dark:bg-surface-elevated-dark/30 lg:sticky lg:top-4 lg:self-start">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Question Palette</h3>
                  <div className="grid grid-cols-7 place-items-center gap-y-2">
                    {list.map((q, i) => {
                      const isCurrent = i === safeIdx;
                      const tone = isCurrent
                        ? "bg-primary text-white shadow-md shadow-primary/30"
                        : accuracyTone(q.accuracy);
                      return (
                        <motion.button
                          key={q.questionId}
                          type="button"
                          whileHover={{ scale: 1.12 }}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => setSelectedQIdx(i)}
                          aria-label={`Question ${i + 1} — ${q.accuracy}% correct`}
                          title={`Q${i + 1} · ${q.subjectName}${q.topicName ? ` · ${q.topicName}` : ""} · ${q.accuracy}% correct`}
                          className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold transition-colors ${tone}`}
                        >
                          {i + 1}
                          {isCurrent && (
                            <motion.span
                              className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-primary"
                              animate={{ opacity: [1, 0.35, 1] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="mt-4 space-y-1.5 text-[10px] text-muted">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-success/40 ring-1 ring-success/30" />
                      <span>≥ 70% correct</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-warning/40 ring-1 ring-warning/30" />
                      <span>40 – 70%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-danger/40 ring-1 ring-danger/30" />
                      <span>&lt; 40%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                      <span>Selected</span>
                    </div>
                  </div>
                </div>

                {/* ── Detail panel ───────────────────────────────── */}
                <div className="min-w-0 space-y-4">
                  {/* Quick stats strip */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                      Q{safeIdx + 1} of {list.length}
                    </span>
                    <span className="rounded-full bg-slate-50/70 px-2.5 py-1 font-medium text-muted dark:bg-surface-elevated-dark">
                      {current.subjectName}
                    </span>
                    {current.topicName && (
                      <span className="rounded-full bg-slate-50/70 px-2.5 py-1 font-medium text-muted dark:bg-surface-elevated-dark">
                        <QuestionMarkdown text={current.topicName} inline />
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-1 font-bold uppercase ${current.difficulty === "hard" || current.difficulty === "advanced" ? "bg-danger/10 text-danger" : current.difficulty === "medium" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                      {current.difficulty}
                    </span>
                    <span className="ml-auto flex items-center gap-3 font-mono text-xs">
                      <span className="flex items-center gap-1"><CheckCircle weight="fill" className="h-3.5 w-3.5 text-success" /><span className="font-semibold text-success">{current.correctCount}</span></span>
                      <span className="flex items-center gap-1"><XCircle weight="fill" className="h-3.5 w-3.5 text-danger" /><span className="font-semibold text-danger">{current.incorrectCount}</span></span>
                      <span className="flex items-center gap-1"><MinusCircle weight="fill" className="h-3.5 w-3.5 text-muted" /><span className="font-semibold text-muted">{current.skippedCount}</span></span>
                      <span className={`font-bold ${current.accuracy >= 70 ? "text-success" : current.accuracy >= 40 ? "text-warning" : "text-danger"}`}>{current.accuracy}%</span>
                      <span className="text-muted">{formatTime(current.avgTimeSeconds)}</span>
                    </span>
                  </div>

                  {/* Question render — same component the create-exam
                      wizard uses, in read-only mode. */}
                  <div className="relative">
                    {questionDetailLoading && !cachedDetail && (
                      <div className="flex items-center gap-2 rounded-xl border border-border bg-slate-50/30 px-4 py-8 text-xs text-muted dark:border-border-dark dark:bg-surface-elevated-dark/30">
                        <CircleNotch weight="bold" className="h-4 w-4 animate-spin text-primary" />
                        Loading question…
                      </div>
                    )}
                    {questionDetailError && !cachedDetail && (
                      <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">
                        {questionDetailError}
                      </div>
                    )}
                    {(cachedDetail || (!questionDetailLoading && !questionDetailError)) && (
                      <QuestionCard
                        question={renderQuestion}
                        index={safeIdx}
                        showActions={false}
                        showAnswer={true}
                        defaultExpanded={true}
                      />
                    )}
                  </div>

                  {/* Telemetry signals */}
                  {current.telemetry && (current.telemetry.flagRate > 0 || current.telemetry.revisitRate > 0 || current.telemetry.secondGuessWrongRate > 0) && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {current.telemetry.flagRate > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" title={`${current.telemetry.flaggedCount} students flagged this`}>🚩 Flagged {current.telemetry.flagRate}%</span>
                      )}
                      {current.telemetry.revisitRate > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" title={`${current.telemetry.revisitedCount} students revisited — avg ${current.telemetry.avgVisitCount} visits`}>↻ Revisited {current.telemetry.revisitRate}%</span>
                      )}
                      {current.telemetry.secondGuessWrongRate > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" title={`${current.telemetry.secondGuessWrongCount} students changed correct → wrong`}>⇆ Second-guessed {current.telemetry.secondGuessWrongRate}%</span>
                      )}
                    </div>
                  )}

                  {/* Option distribution */}
                  <div className="rounded-xl border border-border bg-slate-50/70/30 p-4 dark:border-border-dark dark:bg-surface-elevated-dark/30">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Option Distribution</p>
                    <div className="mb-4 flex h-8 w-full overflow-hidden rounded-lg">
                      {optionEntries.map(([option, cnt]) => {
                        const pct = totalResponses > 0 ? (cnt / totalResponses) * 100 : 0;
                        if (pct === 0) return null;
                        return (
                          <motion.div
                            key={option}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.4 }}
                            className="flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: OPTION_COLORS[option] || "#6B7280" }}
                            title={`${option}: ${cnt} (${Math.round(pct)}%)`}
                          >
                            {pct >= 8 && option}
                          </motion.div>
                        );
                      })}
                      {current.skippedCount > 0 && (() => {
                        const pct = totalResponses > 0 ? (current.skippedCount / totalResponses) * 100 : 0;
                        if (pct === 0) return null;
                        return (
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.4 }}
                            className="flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: OPTION_COLORS.skipped }}
                            title={`Skipped: ${current.skippedCount} (${Math.round(pct)}%)`}
                          >
                            {pct >= 8 && "Skip"}
                          </motion.div>
                        );
                      })()}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {optionEntries.map(([option, cnt]) => (
                        <div key={option} className="flex items-center gap-1.5 text-xs">
                          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: OPTION_COLORS[option] || "#6B7280" }} />
                          <span className="font-mono font-semibold">{option}</span>
                          <span className="text-muted">({cnt} · {totalResponses > 0 ? Math.round((cnt / totalResponses) * 100) : 0}%)</span>
                        </div>
                      ))}
                      {current.skippedCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: OPTION_COLORS.skipped }} />
                          <span className="font-mono font-semibold">Skipped</span>
                          <span className="text-muted">({current.skippedCount} · {totalResponses > 0 ? Math.round((current.skippedCount / totalResponses) * 100) : 0}%)</span>
                        </div>
                      )}
                    </div>
                    {current.discriminationIndex !== 0 && (
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <span className="text-muted">Discrimination Index<InfoTooltip term="Discrimination Index" />:</span>
                        <span className={`font-mono font-bold ${current.discriminationIndex >= 0.3 ? "text-success" : current.discriminationIndex >= 0.1 ? "text-warning" : "text-danger"}`}>{current.discriminationIndex.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Prev / Next */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedQIdx((i) => Math.max(0, i - 1))}
                      disabled={safeIdx <= 0}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:bg-surface-dark dark:hover:bg-surface-elevated-dark"
                    >
                      <CaretLeft size={12} weight="bold" /> Previous
                    </button>
                    <span className="font-mono text-xs text-muted">
                      Q{safeIdx + 1} / {list.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedQIdx((i) => Math.min(list.length - 1, i + 1))}
                      disabled={safeIdx >= list.length - 1}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:bg-surface-dark dark:hover:bg-surface-elevated-dark"
                    >
                      Next <CaretRight size={12} weight="bold" />
                    </button>
                  </div>
                </div>
              </div>
              )}
            </motion.div>
          );
        })()}

        {/* Subject-wise RWL — stacked horizontal bars showing how the
            cohort split across Right/Wrong/Left for each subject. Helps
            distinguish "subject is hard" (lots of wrongs) from "subject
            ran out of time" (lots of lefts) at a glance. Sits below the
            Question Analysis section so the per-question drill-in stays
            adjacent to the cohort question palette. */}
        {subjectRwlData.length > 0 && (
          <motion.div
            className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ChartBar weight="duotone" className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Subject-wise RWL</h2>
                <p className="text-xs text-muted">
                  Cohort attempts split into Right / Wrong / Left for each subject
                </p>
              </div>
              <div className="ml-auto flex items-center gap-3 text-[11px] font-medium">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Right</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" />Wrong</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-zinc-400" />Left</span>
              </div>
            </div>
            <div style={{ height: Math.max(180, subjectRwlData.length * 56 + 48) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={subjectRwlData}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                  stackOffset="expand"
                >
                  <CartesianGrid horizontal={false} stroke="var(--color-border, #e5e7eb)" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${Math.round(v * 100)}%`}
                    tick={{ fontSize: 11, fill: "var(--color-muted, #6b7280)" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 1]}
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
                    formatter={(value: number, name: string, item: any) => {
                      const total = item?.payload?.total ?? 0;
                      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                      return [`${value} (${pct}%)`, name];
                    }}
                  />
                  <Bar dataKey="right" stackId="rwl" name="Right" fill="#10B981" maxBarSize={32} radius={[8, 0, 0, 8]} />
                  <Bar dataKey="wrong" stackId="rwl" name="Wrong" fill="#EF4444" maxBarSize={32} />
                  <Bar dataKey="left" stackId="rwl" name="Left" fill="#9CA3AF" maxBarSize={32} radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Absent students for THIS exam — paginated list of students
            with a submission row but no submittedAt timestamp. Pinned
            at the bottom of the page since "needs follow-up" cohorts
            are most actionable after the rest of the analysis has been
            scanned. */}
        {data.absentStudents && data.absentStudents.length > 0 && (() => {
          const absentees = data.absentStudents;
          const absentTotalPages = Math.max(1, Math.ceil(absentees.length / ABSENT_PAGE_SIZE));
          const safeAbsentPage = Math.min(absentPage, absentTotalPages);
          const absentStart = (safeAbsentPage - 1) * ABSENT_PAGE_SIZE;
          const pageRows = absentees.slice(absentStart, absentStart + ABSENT_PAGE_SIZE);
          return (
            <motion.div
              className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-500/10">
                  <UserMinus weight="duotone" className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Absent Students</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {absentees.length} student{absentees.length === 1 ? "" : "s"} did not submit this exam
                  </p>
                </div>
              </div>

              <ul className="divide-y divide-border dark:divide-border-dark">
                {pageRows.map((s) => (
                  <li key={s.studentId} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[11px] font-semibold uppercase text-rose-600 dark:bg-rose-500/10">
                        {s.name.split(" ").map((p) => p[0]).slice(0, 2).join("") || "?"}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/analytics/student/${s.studentId}`}
                          className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                        >
                          {s.name}
                        </Link>
                        {s.batchName && (
                          <p className="mt-0.5 truncate text-[11px] text-muted">{s.batchName}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${
                        s.markedAbsent
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                      }`}
                    >
                      {s.markedAbsent ? "Marked absent" : "No submission"}
                    </span>
                  </li>
                ))}
              </ul>

              {absentTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4 dark:border-border-dark">
                  <p className="text-xs text-muted">
                    Showing{" "}
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{absentStart + 1}</span>
                    {" - "}
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{Math.min(absentStart + ABSENT_PAGE_SIZE, absentees.length)}</span>{" "}
                    of{" "}
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{absentees.length}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAbsentPage((p) => Math.max(1, p - 1))}
                      disabled={safeAbsentPage <= 1}
                      className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                    >
                      <CaretLeft size={12} weight="bold" /> Prev
                    </button>
                    <span className="min-w-[64px] text-center text-xs font-medium text-gray-700 dark:text-gray-300">
                      Page <span className="font-mono">{safeAbsentPage}</span> / <span className="font-mono">{absentTotalPages}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAbsentPage((p) => Math.min(absentTotalPages, p + 1))}
                      disabled={safeAbsentPage >= absentTotalPages}
                      className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                    >
                      Next <CaretRight size={12} weight="bold" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })()}

      </div>

      {/* Question Detail Modal — with left/right navigation */}
      <QuestionDetailModal
        questionId={viewingQuestionId}
        questionIds={data?.questionAnalysis?.map((q: any) => q.questionId) ?? []}
        editable={false}
        onClose={() => setViewingQuestionId(null)}
      />
    </div>
  );
}
