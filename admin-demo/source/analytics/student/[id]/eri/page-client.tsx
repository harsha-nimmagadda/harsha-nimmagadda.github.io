"use client";

// ============================================================
// BRILLIANCE — Admin: Student ERI (Exam Readiness Index)
// ============================================================

import { useEffect, useState } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Target,
  TrendUp,
  TrendDown,
  WarningCircle,
  Lightning,
  ArrowRight,
  BookOpen,
  Sparkle,
  ListChecks,
} from "@phosphor-icons/react";
import { InfoTooltip } from "@/components/info-tooltip";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Types ────────────────────────────────────────────────────

interface EriScore {
  eriValue: number;
  activeCells: number;
  masteredCells: number;
  totalCells: number;
  level?: string;
  levelDescription?: string;
  lastUpdateAt?: string | null;
}

interface EriVelocity {
  dataPoints: Array<{
    date: string;
    eriValue: number;
    activeCells: number;
    masteredCells: number;
  }>;
  deltaWeek: number | null;
  deltaMonth: number | null;
}

interface SubjectBreakdown {
  subjectId: string;
  subjectName: string;
  eriValue: number;
  activeCells: number;
  masteredCells: number;
  totalCells: number;
}

interface WeakCell {
  id: string;
  topicName: string;
  subjectName: string;
  questionType: string;
  difficulty: string;
  totalAttempts: number;
  correctCount: number;
  accuracy: number;
  masteryState: string;
}

function levelMeta(eri: number) {
  if (eri >= 80)
    return { label: "Titan", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/15" };
  if (eri >= 60)
    return { label: "Challenger", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-500/15" };
  if (eri >= 40)
    return { label: "Contender", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/15" };
  if (eri >= 20)
    return { label: "Scholar", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-500/15" };
  return { label: "Aspirant", color: "text-red-600", bg: "bg-red-50 dark:bg-red-500/15" };
}

const masteryBadge: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  mastered: "success",
  reinforced: "success",
  developing: "warning",
  stale: "warning",
  weak: "danger",
  untested: "neutral",
};

export default function AdminStudentEriPage() {
  const studentId = useUrlSegment(-2);

  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState<EriScore | null>(null);
  const [velocity, setVelocity] = useState<EriVelocity | null>(null);
  const [subjects, setSubjects] = useState<SubjectBreakdown[]>([]);
  const [weakCells, setWeakCells] = useState<WeakCell[]>([]);

  useEffect(() => {
    let alive = true;
    async function fetchAll() {
      setLoading(true);
      try {
        const [scoreRes, velRes, subjRes, weakRes] = await Promise.all([
          apiClient.get<any>(`/api/v1/eri/${studentId}/score`),
          apiClient.get<any>(`/api/v1/eri/${studentId}/velocity?days=30`),
          apiClient.get<any>(`/api/v1/eri/${studentId}/subject-breakdown`),
          apiClient.get<any>(`/api/v1/eri/${studentId}/weak-cells?limit=15`),
        ]);
        if (!alive) return;
        setScore(scoreRes.success && scoreRes.data ? scoreRes.data : null);
        setVelocity(velRes.success && velRes.data ? velRes.data : null);
        setSubjects(subjRes.success && Array.isArray(subjRes.data) ? subjRes.data : []);
        setWeakCells(weakRes.success && Array.isArray(weakRes.data) ? weakRes.data : []);
      } catch {
        if (!alive) return;
        setScore(null);
        setVelocity(null);
        setSubjects([]);
        setWeakCells([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchAll();
    return () => {
      alive = false;
    };
  }, [studentId]);

  const eri = score?.eriValue ?? 0;
  const level = levelMeta(eri);
  const activeCells = score?.activeCells ?? 0;
  const masteredCells = score?.masteredCells ?? 0;
  const totalCells = score?.totalCells ?? 0;
  const points = velocity?.dataPoints ?? [];
  const deltaWeek = velocity?.deltaWeek ?? null;
  const deltaMonth = velocity?.deltaMonth ?? null;

  const isEmpty =
    !loading &&
    (!score || eri === 0) &&
    points.length === 0 &&
    subjects.length === 0 &&
    weakCells.length === 0;

  return (
    <motion.main
      variants={motionVariants.staggerContainer}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-5xl px-6 pb-16 pt-8"
    >
      {/* Back */}
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
          Readiness
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight inline-flex items-center">
          Exam Readiness Index
          <InfoTooltip term="ERI" />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Subtopic × question-type × difficulty mastery, weighted by exam
          relevance.
        </p>
      </motion.header>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      )}

      {/* Empty */}
      {isEmpty && (
        <motion.div
          variants={motionVariants.fadeUp}
          className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white p-10 text-center dark:border-border-dark dark:bg-surface-dark"
        >
          <Target size={40} weight="duotone" className="text-blue-400 mb-3" />
          <h3 className="text-base font-semibold">No readiness data yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            ERI builds up as the student attempts questions across subtopics,
            difficulties, and question types. Populates after the first
            practice or exam.
          </p>
        </motion.div>
      )}

      {!loading && !isEmpty && (
        <>
          {/* Hero score card */}
          <motion.div variants={motionVariants.fadeUp} className="mb-5">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  <div
                    className={`flex shrink-0 h-24 w-24 items-center justify-center rounded-2xl ${level.bg}`}
                  >
                    <div className="text-center">
                      <p
                        className={`text-3xl font-extrabold ${level.color}`}
                        style={{ fontFamily: analyticsTokens.type.number }}
                      >
                        {Math.round(eri)}
                      </p>
                      <p className={`text-[10px] font-semibold ${level.color}`}>
                        {level.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-3 w-full">
                    <KpiTile label="Active" value={activeCells} tooltipTerm="Active Cells" />
                    <KpiTile
                      label="Mastered"
                      value={masteredCells}
                      color="text-emerald-600"
                      tooltipTerm="Mastered Cells"
                    />
                    <KpiTile
                      label="Total Cells"
                      value={totalCells}
                      color="text-muted-foreground"
                      tooltipTerm="Cell Matrix"
                    />
                  </div>
                  {(deltaWeek !== null || deltaMonth !== null) && (
                    <div className="flex sm:flex-col gap-3 sm:border-l sm:border-border sm:dark:border-border-dark sm:pl-4">
                      <DeltaPill label="7d" delta={deltaWeek} />
                      <DeltaPill label="30d" delta={deltaMonth} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Velocity chart */}
          {points.length > 0 && (
            <motion.div variants={motionVariants.fadeUp} className="mb-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm inline-flex items-center">
                    ERI Trajectory (last 30d)
                    <InfoTooltip term="ERI Trajectory" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={points}>
                        <defs>
                          <linearGradient id="eriGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border, #e5e7eb)"
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(d: string) =>
                            new Date(d).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          }
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v: number) => `${v}`}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            fontSize: 11,
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                          }}
                          formatter={(value: any) => [Math.round(value), "ERI"]}
                          labelFormatter={(label: string) =>
                            new Date(label).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="eriValue"
                          stroke="#2563EB"
                          strokeWidth={2}
                          fill="url(#eriGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Subject breakdown */}
          {subjects.length > 0 && (
            <motion.div variants={motionVariants.fadeUp} className="mb-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm inline-flex items-center">
                    Subject Readiness
                    <InfoTooltip term="Subject Readiness" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {subjects.map((s) => {
                      const meta = levelMeta(s.eriValue);
                      return (
                        <div
                          key={s.subjectId}
                          className="rounded-xl border border-border p-3 dark:border-border-dark"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold">{s.subjectName}</p>
                            <Badge variant="neutral" className={meta.color}>
                              {meta.label}
                            </Badge>
                          </div>
                          <p
                            className={`text-2xl font-bold ${meta.color}`}
                            style={{ fontFamily: analyticsTokens.type.number }}
                          >
                            {Math.round(s.eriValue)}
                          </p>
                          <div className="mt-2 h-1.5 w-full rounded-full bg-border dark:bg-border-dark overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all"
                              style={{ width: `${Math.min(100, s.eriValue)}%` }}
                            />
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {s.masteredCells}/{s.totalCells} mastered · {s.activeCells} active
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Action items */}
          <ActionItems
            studentId={studentId}
            eri={eri}
            activeCells={activeCells}
            masteredCells={masteredCells}
            totalCells={totalCells}
            subjects={subjects}
            weakCells={weakCells}
            deltaWeek={deltaWeek}
          />

          {/* Weak cells */}
          {weakCells.length > 0 && (
            <motion.div variants={motionVariants.fadeUp}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <WarningCircle size={16} weight="duotone" className="text-red-500" />
                    <CardTitle className="text-sm inline-flex items-center">
                      Top Weak Cells
                      <InfoTooltip term="Top Weak Cells" />
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border dark:divide-border-dark">
                    {weakCells.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {c.topicName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {c.subjectName} · {c.questionType} · {c.difficulty}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="text-xs font-semibold text-muted-foreground"
                            style={{ fontFamily: analyticsTokens.type.number }}
                          >
                            {c.correctCount}/{c.totalAttempts}
                          </span>
                          <Badge variant={masteryBadge[c.masteryState] ?? "neutral"}>
                            {c.masteryState}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </motion.main>
  );
}

// ── Small helpers ────────────────────────────────────────────

function KpiTile({
  label,
  value,
  color,
  tooltipTerm,
}: {
  label: string;
  value: number;
  color?: string;
  tooltipTerm?: string;
}) {
  return (
    <div className="rounded-xl border border-border p-3 dark:border-border-dark">
      <p
        className={`text-xl font-bold ${color ?? "text-foreground"}`}
        style={{ fontFamily: analyticsTokens.type.number }}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground inline-flex items-center">
        {label}
        {tooltipTerm && <InfoTooltip term={tooltipTerm} />}
      </p>
    </div>
  );
}

// ── Action Items ─────────────────────────────────────────────
// Derives concrete, data-driven next steps from the student's ERI state.
// Shown high up in the page so teachers see the "what to do" before the
// charts. Only renders items that are grounded in the data — no generic
// filler.

interface ActionItem {
  icon: React.ComponentType<any>;
  tint: "red" | "amber" | "blue" | "emerald";
  title: string;
  body: string;
  href: string;
  cta: string;
}

function ActionItems({
  studentId,
  eri,
  activeCells,
  masteredCells,
  totalCells,
  subjects,
  weakCells,
  deltaWeek,
}: {
  studentId: string;
  eri: number;
  activeCells: number;
  masteredCells: number;
  totalCells: number;
  subjects: SubjectBreakdown[];
  weakCells: WeakCell[];
  deltaWeek: number | null;
}) {
  const items: ActionItem[] = [];
  const coverage = totalCells > 0 ? activeCells / totalCells : 0;

  // 1. Weakest subject — highest priority if below 40
  const weakestSubject = [...subjects]
    .filter((s) => s.totalCells > 0)
    .sort((a, b) => a.eriValue - b.eriValue)[0];
  if (weakestSubject && weakestSubject.eriValue < 40) {
    items.push({
      icon: Target,
      tint: "red",
      title: `Focus on ${weakestSubject.subjectName}`,
      body: `Lowest readiness subject at ${Math.round(
        weakestSubject.eriValue,
      )} ERI — ${weakestSubject.masteredCells}/${weakestSubject.totalCells} cells mastered.`,
      href: `/analytics/student/${studentId}/weakness-improvement`,
      cta: "Plan revision",
    });
  }

  // 2. Weekly trend — if ERI dropped
  if (deltaWeek !== null && deltaWeek < -0.5) {
    items.push({
      icon: TrendDown,
      tint: "amber",
      title: "Readiness dipped this week",
      body: `ERI fell ${deltaWeek.toFixed(1)} points vs. last week — usually caused by skipped practice or stale topics.`,
      href: `/analytics/student/${studentId}/practice`,
      cta: "Check practice log",
    });
  }

  // 3. Weak cells — highest-leverage list
  if (weakCells.length >= 3) {
    const topic = weakCells[0];
    items.push({
      icon: BookOpen,
      tint: "blue",
      title: `Revise top ${Math.min(weakCells.length, 3)} weak topics`,
      body: `Start with "${topic.topicName}" (${topic.subjectName}) — ${topic.correctCount}/${topic.totalAttempts} correct so far.`,
      href: `/analytics/student/${studentId}/weakness-improvement`,
      cta: "Open weakness plan",
    });
  }

  // 4. Coverage gap — student has barely scratched the cell matrix
  if (coverage < 0.1 && totalCells > 0) {
    items.push({
      icon: Sparkle,
      tint: "blue",
      title: "Expand question coverage",
      body: `Only ${activeCells} of ${totalCells} cells attempted (${Math.round(
        coverage * 100,
      )}%). More varied practice will lift ERI fastest at this stage.`,
      href: `/analytics/student/${studentId}/practice`,
      cta: "See practice mix",
    });
  }

  // 5. Celebrate — if readiness is strong, point at the next rung
  if (eri >= 60 && masteredCells >= 20 && items.length === 0) {
    items.push({
      icon: Sparkle,
      tint: "emerald",
      title: "On track — push into high-difficulty",
      body: `${Math.round(eri)} ERI with ${masteredCells} mastered cells. Stretch with harder questions to convert Challenger → Titan.`,
      href: `/analytics/student/${studentId}/practice`,
      cta: "Start stretch set",
    });
  }

  if (items.length === 0) return null;

  const tintClass: Record<ActionItem["tint"], string> = {
    red: "text-red-600 bg-red-50 dark:bg-red-500/10",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-500/10",
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
  };

  return (
    <motion.div variants={motionVariants.fadeUp} className="mb-5">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListChecks size={16} weight="duotone" className="text-primary" />
            <CardTitle className="text-sm">Action Items</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border dark:divide-border-dark">
            {items.map((it, i) => {
              const Icon = it.icon;
              return (
                <Link
                  key={i}
                  href={it.href}
                  className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark/40"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tintClass[it.tint]}`}
                  >
                    <Icon size={16} weight="duotone" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold group-hover:text-primary">
                      {it.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{it.body}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-xs font-medium text-primary opacity-70 group-hover:opacity-100">
                    {it.cta}
                    <ArrowRight size={12} weight="bold" />
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DeltaPill({ label, delta }: { label: string; delta: number | null }) {
  if (delta === null) return null;
  const isUp = delta >= 0;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {isUp ? (
        <TrendUp size={14} className="text-emerald-600" />
      ) : (
        <TrendDown size={14} className="text-red-500" />
      )}
      <span
        className={isUp ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}
        style={{ fontFamily: analyticsTokens.type.number }}
      >
        {isUp ? "+" : ""}
        {delta.toFixed(1)}
      </span>
      <span className="text-muted-foreground">{label}</span>
      <Lightning size={10} className="text-muted-foreground" />
    </div>
  );
}
