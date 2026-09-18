"use client";

// ============================================================
// BRILLIANCE — Admin: Student Answer Behavior Analysis
// Second-guess errors, indecision index, time pressure.
// ============================================================

import { useState, useEffect } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowsLeftRight,
  Flag,
  Eye,
  Timer,
  Lightbulb,
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
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  Badge,
  analyticsTokens,
} from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";

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
interface BehaviorKPIs {
  changedCorrectToWrong: number;
  flaggedQuestions: number;
  avgVisitsPerQuestion: number;
}

interface SecondGuessError {
  questionNumber: number;
  subject: string;
  originalAnswer: string;
  changedTo: string;
  marksLost: number;
}

interface TimePressureQuestion {
  questionNumber: number;
  subject: string;
  answeredInFinal5Min: boolean;
  isCorrect: boolean;
}

interface IndecisionBucket {
  visits: string;
  percentage: number;
  color: string;
}

interface AnswerBehaviorData {
  examName: string;
  kpis: BehaviorKPIs;
  secondGuessErrors: SecondGuessError[];
  totalMarksLost: number;
  timePressure: TimePressureQuestion[];
  indecisionIndex: IndecisionBucket[];
}

export default function AdminStudentAnswerBehaviorPage() {
  const studentId = useUrlSegment(-3);
  const examId = useUrlSegment(-1);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnswerBehaviorData | null>(null);

  useEffect(() => {
    let alive = true;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/student/${studentId}/answer-behavior/${examId}`,
        );
        if (alive && res.success && res.data) {
          setData(res.data);
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
  }, [studentId, examId]);

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

  const kpis = data?.kpis ?? {
    changedCorrectToWrong: 0,
    flaggedQuestions: 0,
    avgVisitsPerQuestion: 0,
  };
  const secondGuessErrors = data?.secondGuessErrors ?? [];
  const indecisionIndex = data?.indecisionIndex ?? [];
  const timePressure = data?.timePressure ?? [];
  const totalMarksLost = data?.totalMarksLost ?? 0;
  const timePressureCorrect = timePressure.filter((t) => t.isCorrect).length;
  const timePressureTotal = timePressure.length;

  const isEmpty =
    !data ||
    (secondGuessErrors.length === 0 &&
      indecisionIndex.length === 0 &&
      timePressure.length === 0);

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
          Behavior
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Answer Behavior Analysis
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data?.examName ?? "Exam behavior"}
        </p>
      </motion.header>

      {isEmpty && (
        <motion.div
          variants={fadeUp}
          className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white p-10 text-center dark:border-border-dark dark:bg-surface-dark"
        >
          <Eye size={40} weight="duotone" className="text-blue-400 mb-3" />
          <h3 className="text-base font-semibold">No behavior data yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Answer behavior insights (second-guess errors, indecision, time
            pressure) populate once proctored exam events are captured.
          </p>
        </motion.div>
      )}

      {!isEmpty && (
        <>
      {/* KPI cards */}
      <motion.div className="grid grid-cols-3 gap-3 mb-6" variants={fadeUp}>
        <Card>
          <CardContent className="p-4 text-center">
            <ArrowsLeftRight size={20} weight="duotone" className="mx-auto text-red-500 mb-1" />
            <p
              className="text-2xl font-bold text-red-600"
              style={{ fontFamily: analyticsTokens.type.number }}
            >
              {kpis.changedCorrectToWrong}
            </p>
            <p className="text-[10px] text-muted-foreground">Second-Guess Errors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Flag size={20} weight="duotone" className="mx-auto text-amber-500 mb-1" />
            <p
              className="text-2xl font-bold text-amber-600"
              style={{ fontFamily: analyticsTokens.type.number }}
            >
              {kpis.flaggedQuestions}
            </p>
            <p className="text-[10px] text-muted-foreground">Flagged Questions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Eye size={20} weight="duotone" className="mx-auto text-blue-500 mb-1" />
            <p
              className="text-2xl font-bold text-blue-600"
              style={{ fontFamily: analyticsTokens.type.number }}
            >
              {(kpis.avgVisitsPerQuestion ?? 0).toFixed(1)}
            </p>
            <p className="text-[10px] text-muted-foreground">Avg Visits / Q</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Second-Guess Errors */}
      {secondGuessErrors.length > 0 && (
      <motion.div variants={fadeUp} className="mb-5">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowsLeftRight size={16} weight="duotone" className="text-red-500" />
                <CardTitle className="text-sm">Second-Guess Errors</CardTitle>
              </div>
              <Badge variant="danger">
                <span style={{ fontFamily: analyticsTokens.type.number }}>
                  -{totalMarksLost}
                </span>{" "}
                marks lost
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {secondGuessErrors.map((e) => (
                <div
                  key={e.questionNumber}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-red-500/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-sm font-bold text-muted-foreground"
                      style={{ fontFamily: analyticsTokens.type.number }}
                    >
                      Q{e.questionNumber}
                    </span>
                    <Badge variant="neutral" className="text-[10px]">
                      {e.subject}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-600 font-medium">{e.originalAnswer}</span>
                    <ArrowsLeftRight size={12} className="text-muted-foreground" />
                    <span className="text-red-500 font-medium">{e.changedTo}</span>
                    <span
                      className="text-red-500 font-semibold ml-2"
                      style={{ fontFamily: analyticsTokens.type.number }}
                    >
                      -{e.marksLost}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
      )}

      {/* Indecision Index */}
      {indecisionIndex.length > 0 && (
      <motion.div variants={fadeUp} className="mb-5">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb size={16} weight="duotone" className="text-amber-500" />
              <CardTitle className="text-sm">Indecision Index</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={indecisionIndex}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                  <XAxis dataKey="visits" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      fontSize: 11,
                      border: "1px solid #e5e7eb",
                    }}
                    formatter={(value: any) => [`${value}%`, "Questions"]}
                  />
                  <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                    {indecisionIndex.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      )}

      {/* Time Pressure */}
      {timePressure.length > 0 && (
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer size={16} weight="duotone" className="text-amber-500" />
                <CardTitle className="text-sm">Time Pressure (Last 5 min)</CardTitle>
              </div>
              <Badge variant="neutral">
                <span style={{ fontFamily: analyticsTokens.type.number }}>
                  {timePressureCorrect}/{timePressureTotal}
                </span>{" "}
                correct
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {timePressure.map((t) => (
                <div
                  key={t.questionNumber}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-sm font-bold text-muted-foreground"
                      style={{ fontFamily: analyticsTokens.type.number }}
                    >
                      Q{t.questionNumber}
                    </span>
                    <Badge variant="neutral" className="text-[10px]">
                      {t.subject}
                    </Badge>
                  </div>
                  <Badge variant={t.isCorrect ? "success" : "danger"}>
                    {t.isCorrect ? "Correct" : "Wrong"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
      )}
        </>
      )}
    </motion.div>
  );
}
