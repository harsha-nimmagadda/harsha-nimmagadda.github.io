"use client";

// ============================================================
// BRILLIANCE — Per-Exam Test Analysis (per-student)
// Pulls /api/v1/student-exam-analytics/:studentId/exam/:examId and
// renders four sections: KPI tiles, Subject breakdown, Topic
// breakdown, full Question Results with LaTeX-rendered question text.
// Replaces the inline accordion drill-down on the student dossier
// — clicking a "Recent Exam" navigates here.
// ============================================================

import { useEffect, useState, useMemo, useRef } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  Timer,
  Target,
  ClipboardText,
  Trophy,
  ArrowRight,
  CaretRight,
  ChartBar,
  User,
} from "@phosphor-icons/react";
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
import {
  Skeleton,
  Badge,
  motionVariants,
  analyticsTokens,
} from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";
import { AnalyticsExportButtons } from "@/components/analytics/export-buttons";
import { QuestionCard, type QuestionData } from "@/components/question-card";
import { QuestionDetailModal } from "@/components/question-detail-modal";
import { QuestionMarkdown } from "@/components/question-markdown";
import { ArrowLeft, CircleNotch, CaretLeft, NotePencil } from "@phosphor-icons/react";
import { BackLink } from "@/components/back-link";
import { ERROR_CLASSIFICATION_LABELS } from "@brilliance/types";
import {
  RollupTable,
  resolveSectionLabel,
  type RollupGroup,
  type RollupRow,
  type RollupTimeColumn,
} from "@/components/exam-rollup-table";

const { type: typeTokens } = analyticsTokens;

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Types matching backend payload ──────────────────────────

interface ExamSubmission {
  totalScore: number;
  totalMax: number;
  percentage: number;
  percentile: number | null;
  timeTakenSeconds: number | null;
  rank: number | null;
  cohortSize: number;
  // 'offline' = OMR / paper. Used to hide time- and engagement-based
  // panels that the OMR pipeline can't populate.
  examMode?: string | null;
}

interface SubjectRow {
  subjectName: string;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  skipped: number;
  accuracy: number;
  marksEarned?: number;
  maxMarks?: number;
  rank?: number | null;
  cohortSize?: number;
}

interface TopicRow {
  topicName: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface QuestionRow {
  questionId: string;
  questionText: string | null;
  selectedAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean | null;
  isPartial?: boolean;
  /**
   * Question DROPPED as defective — every present student got full marks
   * whatever they answered. It grades as isCorrect=true, so without flagging it
   * the palette shows a plain "correct" and the marks look unexplainable.
   */
  bonusToAll?: boolean;
  /** Two options carried the key's value, so faculty accepted both. */
  graceMarkApplied?: boolean;
  marksAwarded?: string | number | null;
  timeSpentSeconds: number | null;
  difficulty: string | null;
  questionType: string | null;
  errorClassification: string | null;
  subjectName: string | null;
  topicName: string | null;
  visitCount?: number | null;
  wasFlagged?: boolean;
  answerChanges?: number;
  firstAttemptCorrect?: boolean | null;
  secondGuessedToWrong?: boolean;
}

// Question number as it appears on the actual paper, captured before any
// status filtering — filtering must never change what number a question
// displays as.
type IndexedQuestionRow = QuestionRow & { originalIndex: number };

interface TelemetryData {
  tabSwitchCount: number;
  windowBlurCount: number;
  fullscreenExitCount: number;
  sessionDurationSeconds: number | null;
  totalRevisits: number;
  flaggedCount: number;
  totalAnswerChanges: number;
  secondGuessedToWrong: number;
  fastestAnswerSeconds: number | null;
  slowestAnswerSeconds: number | null;
  avgTimePerQuestionSeconds: number;
}

interface DrilldownData {
  studentId: string;
  examId: string;
  examTitle: string;
  studentName?: string;
  submission: ExamSubmission;
  subjectBreakdown: SubjectRow[];
  topicBreakdown: TopicRow[];
  questionResults: QuestionRow[];
  telemetry?: TelemetryData;
  optionsShuffledFromPrinted?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────

function fmtTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function questionStatus(q: QuestionRow): "correct" | "partial" | "wrong" | "skipped" {
  if (q.isCorrect === true) return "correct";
  if (q.selectedAnswer === null || q.selectedAnswer === "") return "skipped";
  // Partial credit (JEE Advanced MSQ bands, matrix match) — a subset of the
  // correct options with no wrong pick earns marks and must not read "Wrong".
  if (q.isPartial === true) return "partial";
  return "wrong";
}

const STATUS_STYLE = {
  correct: {
    label: "Correct",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    ring: "ring-emerald-200 dark:ring-emerald-500/30",
    Icon: CheckCircle,
  },
  partial: {
    label: "Partially correct",
    text: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-500/10",
    ring: "ring-orange-200 dark:ring-orange-500/30",
    Icon: MinusCircle,
  },
  wrong: {
    label: "Wrong",
    text: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10",
    ring: "ring-red-200 dark:ring-red-500/30",
    Icon: XCircle,
  },
  skipped: {
    label: "Skipped",
    text: "text-zinc-500 dark:text-zinc-400",
    bg: "bg-zinc-50 dark:bg-zinc-500/10",
    ring: "ring-zinc-200 dark:ring-zinc-500/30",
    Icon: MinusCircle,
  },
} as const;

// Roll-up time columns for the per-student view: how long this student
// spent versus what the class averaged on the same questions.
const STUDENT_ROLLUP_TIME_COLUMNS: RollupTimeColumn[] = [
  {
    key: "student",
    header: "This student",
    title: "Time this student spent — group total, with the per-question mean underneath",
  },
  {
    key: "class",
    header: "Cohort",
    title: "Mean time across every student who answered the same questions",
  },
  {
    key: "topper",
    header: "Topper",
    title: "Time spent by the exam's highest-percentage scorer on the same questions",
  },
];

function difficultyTone(d: string | null) {
  const k = (d ?? "").toLowerCase();
  if (k === "easy") return "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10";
  if (k === "medium") return "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10";
  if (k === "hard" || k === "advanced" || k === "olympiad")
    return "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-500/10";
  return "text-zinc-700 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-500/15";
}

// ── Page ────────────────────────────────────────────────────

export default function StudentTestAnalysisPage() {
  const studentId = useUrlSegment(-3);
  const examId = useUrlSegment(-1);

  // Back target: the cohort exam analytics page, carrying forward the
  // branch/batch/section params the exam page appended to the link here,
  // so its filters restore even without browser history (fresh tab, deep
  // link). Read in an effect from window.location — not useSearchParams —
  // to keep the SSR markup stable and skip the Suspense boundary.
  const [examBackQuery, setExamBackQuery] = useState("");
  useEffect(() => {
    const current = new URLSearchParams(window.location.search);
    const forwarded = new URLSearchParams();
    for (const key of ["branchId", "batchId", "section"]) {
      const value = current.get(key);
      if (value) forwarded.set(key, value);
    }
    const qs = forwarded.toString();
    if (qs) setExamBackQuery(`?${qs}`);
  }, []);
  const examBackHref = `/analytics/exam/${examId}${examBackQuery}`;

  const query = useQuery({
    queryKey: ["student-exam-drilldown", studentId, examId],
    queryFn: async () => {
      const res = await apiClient.get<DrilldownData>(
        `/api/v1/student-exam-analytics/${studentId}/exam/${examId}`,
      );
      if (!res.success) throw new Error(res.error || "Failed to load");
      return res.data as DrilldownData;
    },
  });

  // Drawer fallback for the "View in drawer" link — kept for parity
  // with the rest of the app even though the inline palette renders
  // the question right on the page.
  const [viewingQuestionId, setViewingQuestionId] = useState<string | null>(
    null,
  );

  const [filter, setFilter] = useState<"all" | "wrong" | "partial" | "skipped" | "correct">(
    "all",
  );

  // Question Results grain: subject → section → individual questions,
  // mirroring the cohort exam analytics page.
  type QRView = "questions" | "subject" | "section";
  const [qrView, setQrView] = useState<QRView>("questions");
  // Section name + class-average time per question. Neither is in the
  // drilldown payload, so both come from the exam-analytics
  // per-question-time endpoint. Fetched separately: on failure the
  // roll-ups fall back to question-type sections and drop the class
  // column rather than failing the card.
  const [sectionNameByQid, setSectionNameByQid] = useState<Map<string, string | null>>(new Map());
  const [classAvgByQid, setClassAvgByQid] = useState<Map<string, number | null>>(new Map());

  // Palette-based question results — mirrors the exam analytics page.
  // `selectedQIdx` is an index INTO `filteredQuestions` so the cell
  // and the detail panel always agree even when the filter is on.
  const [selectedQIdx, setSelectedQIdx] = useState(0);
  // A roll-up row click has to clear the status filter to land on the
  // right question — but clearing the filter fires the reset effect
  // below, which would immediately snap the selection back to Q1. The
  // ref carries the intended index across that reset.
  const pendingSelectRef = useRef<number | null>(null);
  const [questionDetailCache, setQuestionDetailCache] = useState<
    Map<string, QuestionData>
  >(new Map());
  const [questionDetailLoading, setQuestionDetailLoading] = useState(false);
  const [questionDetailError, setQuestionDetailError] = useState<string | null>(
    null,
  );

  // Topper time per question — the exam's rank-1 scorer, same definition
  // the cohort analytics page uses for its Topper column. Only the cohort
  // endpoint carries it (per-question-time's "topper" is a top-5% median,
  // which is a different thing). Key + URL deliberately match the exam
  // analytics page's defaults so navigating between the two reuses one
  // cached response instead of paying for this twice.
  const cohortQuery = useQuery({
    queryKey: ["exam-analytics", examId, "", "", "", "percentage", "desc"],
    enabled: !!examId,
    queryFn: async () => {
      const res = await apiClient.get<{
        questionAnalysis: Array<{ questionId: string; topperTimeSeconds?: number | null }>;
      }>(`/api/v1/exam-analytics/${examId}?scorersSortBy=percentage&scorersSortDir=desc`);
      if (!res.success) throw new Error(res.error || "Failed to load cohort analytics");
      return res.data;
    },
    // Non-essential: the Topper column degrades to "—" if this fails
    // (e.g. the viewer lacks cohort analytics permission).
    retry: false,
  });

  const topperTimeByQid = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const q of cohortQuery.data?.questionAnalysis ?? []) {
      m.set(q.questionId, q.topperTimeSeconds ?? null);
    }
    return m;
  }, [cohortQuery.data]);

  const data = query.data;
  const loading = query.isLoading;
  const error = query.error;

  // Original test order, captured before any filtering happens.
  const indexedQuestions: IndexedQuestionRow[] = useMemo(
    () => data?.questionResults.map((q, idx) => ({ ...q, originalIndex: idx })) ?? [],
    [data],
  );

  // Filter for the question list — always derived from `indexedQuestions`
  // so filtering never disturbs each question's original number.
  const filteredQuestions = useMemo(() => {
    if (filter === "all") return indexedQuestions;
    return indexedQuestions.filter((q) => questionStatus(q) === filter);
  }, [indexedQuestions, filter]);

  const counts = useMemo(() => {
    const c = { correct: 0, partial: 0, wrong: 0, skipped: 0 };
    if (!data) return c;
    for (const q of data.questionResults) c[questionStatus(q)]++;
    return c;
  }, [data]);

  // Reset palette selection whenever the filter shrinks/expands the
  // visible list — otherwise a previously-valid index can land on the
  // wrong question or out of bounds. A pending roll-up drill-in wins
  // over the reset (see pendingSelectRef).
  useEffect(() => {
    const pending = pendingSelectRef.current;
    pendingSelectRef.current = null;
    setSelectedQIdx(pending ?? 0);
  }, [filter, data?.examId]);

  // Section names + class averages for the roll-up views.
  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    (async () => {
      const res = await apiClient.get<{
        questions: Array<{
          questionId: string;
          sectionName: string | null;
          classAvg: number | null;
        }>;
      }>(`/api/v1/exam-analytics/${examId}/per-question-time`);
      if (cancelled) return;
      if (!res.success || !res.data) {
        setSectionNameByQid(new Map());
        setClassAvgByQid(new Map());
        return;
      }
      const sections = new Map<string, string | null>();
      const classAvgs = new Map<string, number | null>();
      for (const q of res.data.questions ?? []) {
        sections.set(q.questionId, q.sectionName);
        classAvgs.set(q.questionId, q.classAvg);
      }
      setSectionNameByQid(sections);
      setClassAvgByQid(classAvgs);
    })().catch(() => {
      if (!cancelled) {
        setSectionNameByQid(new Map());
        setClassAvgByQid(new Map());
      }
    });
    return () => { cancelled = true; };
  }, [examId]);

  // ── Roll-up builders ──────────────────────────────────────
  //
  // Built from indexedQuestions (the whole paper), never the filtered
  // list — the status chips scope the palette, not the roll-up.
  const { subjectGroups, sectionGroups, rollupTotal } = useMemo(() => {
    if (indexedQuestions.length === 0) {
      return { subjectGroups: [] as RollupGroup[], sectionGroups: [] as RollupGroup[], rollupTotal: null };
    }

    interface Acc {
      label: string;
      questionCount: number;
      correct: number;
      partial: number;
      incorrect: number;
      skipped: number;
      studentTotal: number;
      studentCovered: number;
      classTotal: number;
      classCovered: number;
      topperTotal: number;
      topperCovered: number;
      firstIndex: number;
    }

    const blank = (label: string, firstIndex: number): Acc => ({
      label, questionCount: 0, correct: 0, partial: 0, incorrect: 0, skipped: 0,
      studentTotal: 0, studentCovered: 0, classTotal: 0, classCovered: 0,
      topperTotal: 0, topperCovered: 0, firstIndex,
    });

    const add = (acc: Acc, q: IndexedQuestionRow) => {
      acc.questionCount += 1;
      const status = questionStatus(q);
      if (status === "correct") acc.correct += 1;
      else if (status === "partial") acc.partial += 1;
      else if (status === "wrong") acc.incorrect += 1;
      else acc.skipped += 1;
      // Questions with no recorded time (OMR papers, never-reached
      // questions) drop out of the sum AND the divisor so a partly-timed
      // group doesn't read as unusually fast.
      if (q.timeSpentSeconds != null) {
        acc.studentTotal += q.timeSpentSeconds;
        acc.studentCovered += 1;
      }
      const classAvg = classAvgByQid.get(q.questionId);
      if (classAvg != null) {
        acc.classTotal += classAvg;
        acc.classCovered += 1;
      }
      const topper = topperTimeByQid.get(q.questionId);
      if (topper != null) {
        acc.topperTotal += topper;
        acc.topperCovered += 1;
      }
    };

    const finish = (acc: Acc, key: string): RollupRow => {
      // Denominator matches this page's other cards: attempted, not the
      // full group — dividing by every question would understate a
      // student who skipped a lot. Partials count as attempts.
      const attempted = acc.correct + acc.partial + acc.incorrect;
      return {
        key,
        label: acc.label,
        questionCount: acc.questionCount,
        correct: acc.correct,
        partial: acc.partial,
        incorrect: acc.incorrect,
        skipped: acc.skipped,
        responses: acc.questionCount,
        accuracy: attempted > 0 ? (acc.correct / attempted) * 100 : 0,
        times: [
          {
            total: acc.studentCovered > 0 ? acc.studentTotal : null,
            perQ: acc.studentCovered > 0 ? acc.studentTotal / acc.studentCovered : null,
            covered: acc.studentCovered,
          },
          {
            total: acc.classCovered > 0 ? acc.classTotal : null,
            perQ: acc.classCovered > 0 ? acc.classTotal / acc.classCovered : null,
            covered: acc.classCovered,
          },
          {
            total: acc.topperCovered > 0 ? acc.topperTotal : null,
            perQ: acc.topperCovered > 0 ? acc.topperTotal / acc.topperCovered : null,
            covered: acc.topperCovered,
          },
        ],
        firstIndex: acc.firstIndex,
      };
    };

    const subjectAcc = new Map<string, Acc>();
    const sectionAcc = new Map<string, Map<string, Acc>>();
    const whole = blank("Whole paper", 0);

    indexedQuestions.forEach((q) => {
      const subject = q.subjectName || "Unassigned";
      const section = resolveSectionLabel(
        subject,
        sectionNameByQid.get(q.questionId),
        q.questionType,
      );

      let sAcc = subjectAcc.get(subject);
      if (!sAcc) { sAcc = blank(subject, q.originalIndex); subjectAcc.set(subject, sAcc); }
      add(sAcc, q);

      let bySection = sectionAcc.get(subject);
      if (!bySection) { bySection = new Map(); sectionAcc.set(subject, bySection); }
      let secAcc = bySection.get(section);
      if (!secAcc) { secAcc = blank(section, q.originalIndex); bySection.set(section, secAcc); }
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
  }, [indexedQuestions, sectionNameByQid, classAvgByQid, topperTimeByQid]);

  // Roll-up row → that group's first question in the palette. Clearing
  // the filter is required because selectedQIdx indexes the FILTERED
  // list, and originalIndex is only valid against the unfiltered one.
  const openQuestionFromRollup = (originalIndex: number) => {
    setQrView("questions");
    if (filter === "all") {
      setSelectedQIdx(originalIndex);
    } else {
      pendingSelectRef.current = originalIndex;
      setFilter("all");
    }
  };

  // Lazy-fetch the full question payload for the palette-selected
  // question. Cached so flipping back to a previously-viewed cell is
  // instant.
  useEffect(() => {
    if (filteredQuestions.length === 0) return;
    const target = filteredQuestions[Math.min(selectedQIdx, filteredQuestions.length - 1)];
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
      .catch((e: any) => {
        if (!cancelled) setQuestionDetailError(e?.message || "Failed to load question");
      })
      .finally(() => {
        if (!cancelled) setQuestionDetailLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedQIdx, filteredQuestions, questionDetailCache]);

  // ── Loading ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-6 pb-16 pt-8">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-9 w-72" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  // ── Error / empty ──────────────────────────────────────
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-6 pb-16 pt-8 space-y-6">
        <div className="flex items-center gap-4">
          <BackLink
            href={examBackHref}
            aria-label="Back to exam analytics"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border transition-colors hover:bg-primary/5 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
          >
            <ArrowLeft size={18} />
          </BackLink>
          <Breadcrumb studentId={studentId} studentName={null} examTitle="Test analysis" />
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center dark:border-border-dark dark:bg-surface-dark">
          <p className="text-sm font-medium text-foreground">
            {(error as Error)?.message ?? "Test analysis isn't available yet"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Drill-down populates after the student submits this exam and
            responses are scored.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.main
      initial="hidden"
      animate="visible"
      variants={motionVariants.staggerContainer}
      className="mx-auto max-w-5xl space-y-6 px-6 pb-16 pt-8"
    >
      {/* Breadcrumb */}
      <motion.div variants={motionVariants.fadeUp}>
        <Breadcrumb
          studentId={studentId}
          studentName={data.studentName ?? null}
          examTitle={data.examTitle}
        />
      </motion.div>

      {/* Header */}
      <motion.header
        variants={motionVariants.fadeUp}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-4">
          <BackLink
            href={examBackHref}
            aria-label="Back to exam analytics"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border transition-colors hover:bg-primary/5 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
          >
            <ArrowLeft size={18} />
          </BackLink>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Exam Breakdown
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {data.examTitle}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AnalyticsExportButtons
            endpoint={`/api/v1/student-exam-analytics/${studentId}/exam/${examId}/export`}
            filename={`${data.examTitle.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 60)}-analysis`}
            formats={["pdf", "xlsx"]}
          />
        </div>
      </motion.header>

      {/* Related views — secondary links to sibling analytics for
          this student/exam. Bordered button styling matches the
          "How this works" convention used elsewhere. */}
      <motion.div
        variants={motionVariants.fadeUp}
        className="flex flex-wrap items-center gap-2"
      >
        <Link
          href={`/analytics/student/${studentId}/answer-behavior/${examId}`}
          className="group inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-border-dark dark:bg-surface-dark"
        >
          <ClipboardText size={14} weight="duotone" className="text-amber-600 dark:text-amber-400" />
          <span>Answer behavior</span>
          <ArrowRight
            size={12}
            weight="bold"
            className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </Link>
        <Link
          href={examBackHref}
          className="group inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-border-dark dark:bg-surface-dark"
        >
          <Trophy size={14} weight="duotone" className="text-primary" />
          <span>Full exam analytics</span>
          <ArrowRight
            size={12}
            weight="bold"
            className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </Link>
        <Link
          href={`/analytics/student/${studentId}`}
          className="group inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-border-dark dark:bg-surface-dark"
        >
          <User size={14} weight="duotone" className="text-emerald-600 dark:text-emerald-400" />
          <span>Overall analytics</span>
          <ArrowRight
            size={12}
            weight="bold"
            className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </Link>
      </motion.div>

      {/* KPI tiles — drop the "Time taken" tile for offline (OMR) submissions
          since the OMR pipeline can't capture timing. Grid collapses to 3
          columns so the remaining tiles stay aligned. */}
      {(() => {
        const isOfflineSubmission = data.submission.examMode === "offline";
        return (
      <motion.div
        variants={motionVariants.fadeUp}
        className={`grid grid-cols-2 gap-3 ${isOfflineSubmission ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}
      >
        <Kpi
          icon={Trophy}
          iconColor="text-amber-600 dark:text-amber-400"
          label="Rank"
          value={
            data.submission.rank
              ? `#${data.submission.rank}`
              : "—"
          }
          sub={
            data.submission.cohortSize
              ? `of ${data.submission.cohortSize} submitters`
              : "no cohort data"
          }
        />
        <Kpi
          icon={Target}
          iconColor="text-blue-600 dark:text-blue-400"
          label="Score"
          value={`${data.submission.totalScore} / ${data.submission.totalMax}`}
          sub="marks"
        />
        {!isOfflineSubmission && (
        <Kpi
          icon={Timer}
          iconColor="text-violet-600 dark:text-violet-400"
          label="Time taken"
          value={fmtTime(data.submission.timeTakenSeconds)}
          sub={
            data.submission.timeTakenSeconds
              ? `${Math.round(data.submission.timeTakenSeconds / 60)}m total`
              : "—"
          }
        />
        )}
        <Kpi
          icon={ClipboardText}
          iconColor="text-emerald-600 dark:text-emerald-400"
          label="Questions"
          value={data.questionResults.length.toString()}
          sub={`${counts.correct} correct · ${counts.partial} partial · ${counts.wrong} wrong · ${counts.skipped} skipped`}
        />
      </motion.div>
        );
      })()}

      {/* Behavioral telemetry — data captured by the student app while
          the student was taking the exam. Shows only when we have any
          signal (older submissions without telemetry skip it). */}
      {data.telemetry && (
        <motion.div
          variants={motionVariants.fadeUp}
          className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
        >
          <h2 className="text-base font-semibold">Behavioral signals</h2>
          <p className="mt-0.5 text-xs text-muted">
            Captured by the student app during this attempt.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TelemetryTile
              label="Tab switches"
              value={data.telemetry.tabSwitchCount}
              danger={data.telemetry.tabSwitchCount > 3}
            />
            <TelemetryTile
              label="Window blurs"
              value={data.telemetry.windowBlurCount}
              danger={data.telemetry.windowBlurCount > 3}
            />
            <TelemetryTile
              label="Fullscreen exits"
              value={data.telemetry.fullscreenExitCount}
              danger={data.telemetry.fullscreenExitCount > 0}
            />
            <TelemetryTile
              label="Revisits"
              value={data.telemetry.totalRevisits}
              sub="question re-opens"
            />
            <TelemetryTile
              label="Flagged"
              value={data.telemetry.flaggedCount}
              sub="for review"
            />
            <TelemetryTile
              label="Answer changes"
              value={data.telemetry.totalAnswerChanges}
            />
            <TelemetryTile
              label="2nd-guessed → wrong"
              value={data.telemetry.secondGuessedToWrong}
              danger={data.telemetry.secondGuessedToWrong > 0}
              sub="changed correct to wrong"
            />
            <TelemetryTile
              label="Avg / question"
              value={`${data.telemetry.avgTimePerQuestionSeconds}s`}
              sub={
                data.telemetry.fastestAnswerSeconds != null &&
                data.telemetry.slowestAnswerSeconds != null
                  ? `${data.telemetry.fastestAnswerSeconds}s – ${data.telemetry.slowestAnswerSeconds}s`
                  : undefined
              }
            />
          </div>
        </motion.div>
      )}

      {/* Subject score histogram — horizontal bar of accuracy by
          subject. Color-banded the same way the cohort exam page is
          (>=75 green / >=50 blue / >=30 amber / <30 red) so a single
          glance tells you where the student lost ground. */}
      {data.subjectBreakdown.length > 0 && (
        <motion.div
          variants={motionVariants.fadeUp}
          className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <ChartBar weight="duotone" className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Subject-wise Score</h2>
              <p className="mt-0.5 text-xs text-muted">Accuracy on each subject in this exam.</p>
            </div>
          </div>
          <div className="mt-4" style={{ height: Math.max(180, data.subjectBreakdown.length * 52 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.subjectBreakdown}
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
                  dataKey="subjectName"
                  tick={{ fontSize: 12, fill: "var(--color-foreground, #111827)" }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip
                  cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
                  contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid var(--color-border, #e5e7eb)" }}
                  formatter={(v: number) => [`${v}%`, "Accuracy"]}
                />
                <Bar dataKey="accuracy" radius={[0, 8, 8, 0]} maxBarSize={32}>
                  {data.subjectBreakdown.map((s, i) => (
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

      {/* Subject breakdown */}
      {data.subjectBreakdown.length > 0 && (
        <motion.div
          variants={motionVariants.fadeUp}
          className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
        >
          <h2 className="text-base font-semibold">Subject Breakdown</h2>
          <p className="mt-0.5 text-xs text-muted">How the student performed across subjects in this exam.</p>
          <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:border-border-dark">
                      <th className="pb-3 pr-4">Subject</th>
                      <th className="pb-3 pr-4 text-right">Marks</th>
                      <th className="pb-3 pr-4 text-right" title="This student's rank within the cohort on this subject">Rank</th>
                      <th className="pb-3 pr-4 text-right">Total</th>
                      <th className="pb-3 pr-4 text-right">Correct</th>
                      <th className="pb-3 pr-4 text-right">Wrong</th>
                      <th className="pb-3 pr-4 text-right">Skipped</th>
                      <th className="pb-3 text-right">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subjectBreakdown.map((s) => (
                      <tr
                        key={s.subjectName}
                        className="border-b border-border/30 dark:border-border-dark/30"
                      >
                        <td className="py-2.5 pr-4 font-medium">{s.subjectName}</td>
                        <td
                          className="py-2.5 pr-4 text-right font-mono"
                          style={{ fontFamily: typeTokens.number }}
                        >
                          {(s.marksEarned ?? null) !== null && (s.maxMarks ?? 0) > 0 ? (
                            <span>
                              <span className="font-semibold">{s.marksEarned}</span>
                              <span className="text-muted-foreground"> / {s.maxMarks}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{"—"}</span>
                          )}
                        </td>
                        <td
                          className="py-2.5 pr-4 text-right font-mono"
                          style={{ fontFamily: typeTokens.number }}
                        >
                          {s.rank ? (
                            <span>
                              <span className={`font-semibold ${s.rank === 1 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>#{s.rank}</span>
                              {s.cohortSize ? <span className="text-muted-foreground"> / {s.cohortSize}</span> : null}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{"—"}</span>
                          )}
                        </td>
                        <td
                          className="py-2.5 pr-4 text-right font-mono"
                          style={{ fontFamily: typeTokens.number }}
                        >
                          {s.totalQuestions}
                        </td>
                        <td
                          className="py-2.5 pr-4 text-right font-mono text-emerald-600 dark:text-emerald-400"
                          style={{ fontFamily: typeTokens.number }}
                        >
                          {s.correct}
                        </td>
                        <td
                          className="py-2.5 pr-4 text-right font-mono text-red-600 dark:text-red-400"
                          style={{ fontFamily: typeTokens.number }}
                        >
                          {s.incorrect}
                        </td>
                        <td
                          className="py-2.5 pr-4 text-right font-mono text-muted-foreground"
                          style={{ fontFamily: typeTokens.number }}
                        >
                          {s.skipped}
                        </td>
                        <td className="py-2.5 text-right">
                          <span
                            className={`font-mono font-semibold ${
                              s.accuracy >= 70
                                ? "text-emerald-600 dark:text-emerald-400"
                                : s.accuracy >= 40
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-red-600 dark:text-red-400"
                            }`}
                            style={{ fontFamily: typeTokens.number }}
                          >
                            {s.accuracy}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        </motion.div>
      )}

      {/* Topic breakdown */}
      {data.topicBreakdown.length > 0 && (
        <motion.div
          variants={motionVariants.fadeUp}
          className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
        >
          <h2 className="text-base font-semibold">Topic Breakdown</h2>
          <p className="mt-0.5 text-xs text-muted">
            Per-topic accuracy. Color codes the strength: red &lt; 40%, amber 40–69%, green ≥ 70%.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.topicBreakdown.map((t) => {
              const tone =
                t.accuracy >= 70
                  ? "border-emerald-300/50 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : t.accuracy >= 40
                    ? "border-amber-300/50 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                    : "border-red-300/50 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300";
              return (
                <div
                  key={t.topicName}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${tone}`}
                >
                  <QuestionMarkdown text={t.topicName} inline className="font-medium" />
                  <span
                    className="font-mono font-bold"
                    style={{ fontFamily: typeTokens.number }}
                  >
                    {t.accuracy}%
                  </span>
                  <span className="text-[10px] opacity-70">
                    ({t.correct}/{t.total})
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Question results — palette-driven layout that mirrors the
          cohort exam analytics page. Click a numbered cell to render
          the question (via QuestionCard) plus the student's selected
          answer, the correct answer, time spent, and any error tag. */}
      <motion.div
        variants={motionVariants.fadeUp}
        className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
      >
        {/* The title block must flex-1/min-w-0 and the toggle shrink-0:
            without it the long Questions-view description pushes the
            toggle onto its own line, so the control jumps from right to
            left as you switch tabs. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Question Results</h2>
            <p className="mt-0.5 text-xs text-muted">
              {qrView === "subject"
                ? `Subject-wise roll-up across ${subjectGroups[0]?.rows.length ?? 0} subject${(subjectGroups[0]?.rows.length ?? 0) === 1 ? "" : "s"} — click a row to open its first question`
                : qrView === "section"
                  ? `Section-wise roll-up across ${sectionGroups.reduce((n, g) => n + g.rows.length, 0)} sections — click a row to open its first question`
                  : "Each question with the student's answer, the correct answer, and time spent. Pick a question from the palette to see the full stem and solution."}
            </p>
          </div>
          {/* Grain toggle — coarse to fine, matching the cohort page. */}
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface p-1 text-xs font-medium dark:border-border-dark dark:bg-surface-dark">
            {(
              [
                ["subject", "Subject"],
                ["section", "Section"],
                ["questions", "Questions"],
              ] as Array<[QRView, string]>
            ).map(([view, label]) => (
              <button
                key={view}
                type="button"
                onClick={() => setQrView(view)}
                className={`rounded-md px-3 py-1 transition-all ${
                  qrView === view
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-muted hover:bg-primary/5 hover:text-foreground dark:hover:bg-surface-elevated-dark"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {/* Status filter scopes the palette only — the roll-ups always
            describe the whole paper. */}
        {qrView === "questions" && (
          <div className="mt-3 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1 dark:border-border-dark dark:bg-surface-dark">
            {(
              [
                ["all", `All (${data.questionResults.length})`],
                ["correct", `Correct (${counts.correct})`],
                ["partial", `Partial (${counts.partial})`],
                ["wrong", `Wrong (${counts.wrong})`],
                ["skipped", `Skipped (${counts.skipped})`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-md px-3 py-1 text-xs transition-all ${
                  filter === k
                    ? "bg-emerald-500 font-bold text-white shadow-sm"
                    : "font-medium text-muted hover:bg-primary/5 hover:text-foreground dark:hover:bg-surface-elevated-dark"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-4">
            {qrView === "subject" || qrView === "section" ? (
              <RollupTable
                labelHeader={qrView === "subject" ? "Subject" : "Section"}
                groups={qrView === "subject" ? subjectGroups : sectionGroups}
                total={rollupTotal}
                timeColumns={STUDENT_ROLLUP_TIME_COLUMNS}
                countMode="count"
                showPartial
                onRowClick={openQuestionFromRollup}
              />
            ) : filteredQuestions.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No questions match this filter.
              </p>
            ) : (() => {
              const safeIdx = Math.min(selectedQIdx, filteredQuestions.length - 1);
              const current = filteredQuestions[safeIdx]!;
              const currentStatus = questionStatus(current);
              const cfg = STATUS_STYLE[currentStatus];
              const StatusIcon = cfg.Icon;
              const cachedDetail = questionDetailCache.get(current.questionId);
              const renderQuestion: QuestionData = cachedDetail ?? {
                questionId: current.questionId,
                questionText: current.questionText ?? undefined,
                questionType: current.questionType ?? undefined,
                difficulty: current.difficulty ?? undefined,
                topicName: current.topicName ?? undefined,
                correctAnswer: current.correctAnswer ?? undefined,
              };
              const cellTone = (q: typeof current, isCurrent: boolean) => {
                if (isCurrent) return "bg-primary text-white shadow-md shadow-primary/30";
                // Dropped question: everyone got full marks whatever they
                // answered. It grades as correct, so amber keeps it visually
                // distinct from a genuinely correct answer. Student-app parity.
                if (q.bonusToAll) return "bg-amber-100 text-amber-700 ring-1 ring-amber-300 hover:bg-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30";
                const s = questionStatus(q);
                if (s === "correct") return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30";
                if (s === "partial") return "bg-orange-100 text-orange-700 ring-1 ring-orange-300 hover:bg-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/30";
                if (s === "wrong") return "bg-red-100 text-red-700 ring-1 ring-red-300 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30";
                return "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-300 hover:bg-primary/5 dark:bg-zinc-500/10 dark:text-zinc-400 dark:ring-zinc-500/30";
              };
              return (
                <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                  {/* ── Palette ──────────────────────────────── */}
                  <div className="rounded-xl border border-border bg-slate-50/70/30 p-4 dark:border-border-dark dark:bg-surface-elevated-dark/30 lg:sticky lg:top-4 lg:self-start">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Question Palette
                    </h3>
                    <div className="grid grid-cols-7 place-items-center gap-y-2">
                      {filteredQuestions.map((q, i) => {
                        const isCurrent = i === safeIdx;
                        const tone = cellTone(q, isCurrent);
                        const status = questionStatus(q);
                        const hasReview = !!q.errorClassification;
                        return (
                          <motion.button
                            key={q.questionId}
                            type="button"
                            whileHover={{ scale: 1.12 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => setSelectedQIdx(i)}
                            aria-label={`Question ${q.originalIndex + 1} — ${status}${hasReview ? " — error review added" : ""}`}
                            title={`Q${q.originalIndex + 1} · ${q.bonusToAll ? "bonus — question dropped, full marks to everyone" : status}${q.graceMarkApplied ? " · grace marks — two options accepted" : ""}${q.subjectName ? ` · ${q.subjectName}` : ""}${hasReview ? ` · review: ${ERROR_CLASSIFICATION_LABELS[q.errorClassification!] ?? q.errorClassification}` : ""}`}
                            className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold transition-colors ${tone}`}
                          >
                            {q.originalIndex + 1}
                            {hasReview && (
                              // Tiny pencil dot on cells the student
                              // wrote an error review for. Sits at the
                              // bottom-right outside the cell so it's
                              // visible even when the cell is the
                              // active (primary-blue) one.
                              <span
                                aria-hidden
                                className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm ring-2 ring-surface dark:ring-surface-dark"
                              >
                                <NotePencil weight="fill" size={7} />
                              </span>
                            )}
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

                    <div className="mt-4 space-y-1.5 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-200 ring-1 ring-emerald-300" />
                        <span>Correct</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-orange-200 ring-1 ring-orange-300" />
                        <span>Partial</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-200 ring-1 ring-red-300" />
                        <span>Wrong</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200 ring-1 ring-zinc-300" />
                        <span>Skipped</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                        <span>Selected</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-amber-500 text-white">
                          <NotePencil weight="fill" size={6} />
                        </span>
                        <span>Error review added</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Detail panel ─────────────────────────── */}
                  <div className="min-w-0 space-y-4">
                    {/* Quick stats strip */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                        Q{current.originalIndex + 1} of {filteredQuestions.length}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${cfg.bg} ${cfg.text}`}>
                        <StatusIcon size={11} weight="bold" />
                        {cfg.label}
                        {currentStatus === "partial" && current.marksAwarded != null && Number(current.marksAwarded) > 0
                          ? ` (+${Number(current.marksAwarded)})`
                          : ""}
                      </span>
                      {current.subjectName && (
                        <span className="rounded-full bg-slate-50/70 px-2.5 py-1 font-medium text-muted-foreground dark:bg-surface-elevated-dark">
                          {current.subjectName}
                        </span>
                      )}
                      {current.topicName && (
                        <span className="rounded-full bg-slate-50/70 px-2.5 py-1 font-medium text-muted-foreground dark:bg-surface-elevated-dark">
                          <QuestionMarkdown text={current.topicName} inline />
                        </span>
                      )}
                      {current.difficulty && (
                        <span className={`rounded-full px-2.5 py-1 font-bold uppercase ${difficultyTone(current.difficulty)}`}>
                          {current.difficulty}
                        </span>
                      )}
                      {current.errorClassification && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                          title="Student submitted an error review for this question"
                        >
                          <NotePencil weight="fill" size={11} />
                          Review: {ERROR_CLASSIFICATION_LABELS[current.errorClassification] ?? current.errorClassification}
                        </span>
                      )}
                      {/* Per-question timer hidden for offline (OMR) — no timing captured. */}
                      {data.submission.examMode !== "offline" && (
                        <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
                          <Timer size={11} weight="bold" />
                          {fmtTime(current.timeSpentSeconds ?? null)}
                        </span>
                      )}
                    </div>

                    {/* Options were shuffled online — this offline student's
                        printed answer is shown remapped to the online order so
                        it matches the options + solution below. */}
                    {data.optionsShuffledFromPrinted && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        Options were shuffled for the online version. The order and
                        letters shown here match the online paper and the solution —
                        they may differ from the student&apos;s printed OMR sheet. Their
                        marked answer has been mapped to the matching option.
                      </div>
                    )}

                    {/* Selected vs correct answer summary */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-border bg-slate-50/70/30 px-4 py-3 text-xs dark:border-border-dark dark:bg-surface-elevated-dark/30">
                      <span>
                        <span className="text-muted-foreground">Selected: </span>
                        {current.selectedAnswer !== null && current.selectedAnswer !== "" ? (
                          <span
                            className={`font-mono font-bold ${
                              currentStatus === "correct"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {current.selectedAnswer}
                          </span>
                        ) : (
                          <span className="font-mono text-muted-foreground">—</span>
                        )}
                      </span>
                      {current.correctAnswer && (
                        <span>
                          <span className="text-muted-foreground">Correct: </span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {current.correctAnswer}
                          </span>
                        </span>
                      )}
                      {current.firstAttemptCorrect !== null && current.firstAttemptCorrect !== undefined && (
                        <span className="text-muted-foreground">
                          First-attempt:{" "}
                          <span className={current.firstAttemptCorrect ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>
                            {current.firstAttemptCorrect ? "Right" : "Wrong"}
                          </span>
                        </span>
                      )}
                      {(current.answerChanges ?? 0) > 0 && (
                        <span className="text-muted-foreground">
                          Changes: <span className="font-mono font-semibold text-foreground">{current.answerChanges}</span>
                        </span>
                      )}
                      {current.wasFlagged && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                          🚩 Flagged
                        </span>
                      )}
                    </div>

                    {/* Question render — same component the create-exam
                        wizard / cohort exam analytics use, in read-only mode. */}
                    <div className="relative">
                      {questionDetailLoading && !cachedDetail && (
                        <div className="flex items-center gap-2 rounded-xl border border-border bg-slate-50/30 px-4 py-8 text-xs text-muted-foreground dark:border-border-dark dark:bg-surface-elevated-dark/30">
                          <CircleNotch weight="bold" className="h-4 w-4 animate-spin text-primary" />
                          Loading question…
                        </div>
                      )}
                      {questionDetailError && !cachedDetail && (
                        <div className="rounded-xl border border-red-300/50 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                          {questionDetailError}
                        </div>
                      )}
                      {(cachedDetail || (!questionDetailLoading && !questionDetailError)) && (
                        <QuestionCard
                          question={renderQuestion}
                          index={current.originalIndex}
                          showActions={false}
                          showAnswer={true}
                          defaultExpanded={true}
                        />
                      )}
                    </div>

                    {/* Prev / Next */}
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedQIdx((i) => Math.max(0, i - 1))}
                        disabled={safeIdx <= 0}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:bg-surface-dark dark:hover:bg-surface-elevated-dark"
                      >
                        <CaretLeft size={12} weight="bold" /> Previous
                      </button>
                      <span className="font-mono text-xs text-muted-foreground">
                        Q{current.originalIndex + 1} / {filteredQuestions.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedQIdx((i) => Math.min(filteredQuestions.length - 1, i + 1))}
                        disabled={safeIdx >= filteredQuestions.length - 1}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:bg-surface-dark dark:hover:bg-surface-elevated-dark"
                      >
                        Next <CaretRight size={12} weight="bold" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      </motion.div>

      {/* Full question + solution drawer. Left/right navigation walks
          through the currently-filtered list (so if the user is on
          the "Wrong" tab they only see wrong answers). */}
      <QuestionDetailModal
        questionId={viewingQuestionId}
        questionIds={filteredQuestions.map((q) => q.questionId)}
        editable={false}
        onClose={() => setViewingQuestionId(null)}
      />
    </motion.main>
  );
}

// ── Breadcrumb ──────────────────────────────────────────────
// Analytics / Students / <Student Name> / <Exam Title>. The last
// segment is the current page and is styled as inert text; the
// earlier segments are links.

function Breadcrumb({
  studentId,
  studentName,
  examTitle,
}: {
  studentId: string;
  studentName: string | null;
  examTitle: string;
}) {
  const linkCls =
    "text-muted-foreground transition-colors hover:text-foreground";
  const sepCls = "text-muted-foreground/50";
  return (
    <nav aria-label="Breadcrumb" className="text-xs">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/analytics" className={linkCls}>
            Analytics
          </Link>
        </li>
        <li aria-hidden className={sepCls}>
          <CaretRight size={11} weight="bold" />
        </li>
        <li>
          <Link href="/analytics/students" className={linkCls}>
            Students
          </Link>
        </li>
        <li aria-hidden className={sepCls}>
          <CaretRight size={11} weight="bold" />
        </li>
        <li>
          <Link
            href={`/analytics/student/${studentId}`}
            className={`${linkCls} max-w-[160px] truncate`}
            title={studentName ?? "Student"}
          >
            {studentName ?? "Student"}
          </Link>
        </li>
        <li aria-hidden className={sepCls}>
          <CaretRight size={11} weight="bold" />
        </li>
        <li
          className="max-w-[320px] truncate font-medium text-foreground"
          title={examTitle}
          aria-current="page"
        >
          {examTitle}
        </li>
      </ol>
    </nav>
  );
}

// ── KPI tile ────────────────────────────────────────────────

function Kpi({
  icon: Icon,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: any;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
          {label}
        </p>
        <Icon weight="duotone" className={`h-4 w-4 ${iconColor}`} />
      </div>
      <p
        className="mt-2 text-2xl font-bold text-foreground"
        style={{ fontFamily: typeTokens.number }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">{sub}</p>
    </div>
  );
}

function TelemetryTile({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: string | number;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        danger
          ? "border-danger/40 bg-danger/5"
          : "border-border bg-surface dark:border-border-dark dark:bg-surface-dark"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold ${danger ? "text-danger" : "text-foreground"}`}
        style={{ fontFamily: typeTokens.number }}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
