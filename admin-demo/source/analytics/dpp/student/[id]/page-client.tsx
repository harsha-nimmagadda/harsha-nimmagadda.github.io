"use client";

// ============================================================
// Daily Practice (DPP) — one student
// ============================================================
//
// A DEDICATED DPP surface, deliberately not the general
// /analytics/student/[id]/practice page. That page is a practice dossier
// covering dpp, daily5, mock, topic, chapter, error_revision and
// peer_pairing; arriving from the DPP report and being shown all seven
// averaged together answers a question nobody asked. Panels that are
// meaningless here (mock frequency, self-vs-assigned, the practice-type mix)
// are absent rather than shown at 100%.
//
// Everything below is exam_type='dpp' only — the same filter the staff
// rollup uses, so this page and /analytics/dpp can never disagree.

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  Lightning,
  Fire,
  Target,
  CheckCircle,
  CaretLeft,
  CaretRight,
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
import { Skeleton, DateRangeFilter } from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";
import { InfoTip } from "@/components/info-tip";
import {
  QuestionStatsPalette,
  type QuestionStat,
  type QuestionStatsData,
} from "@/components/question-stats-palette";

/* eslint-disable @typescript-eslint/no-explicit-any */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

const DAYS_PAGE_SIZE = 10;
const Q_PAGE_SIZE = 24;

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
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function resolveRange(key: RangeKey, cFrom: string, cTo: string) {
  if (key === "custom") return { from: cFrom, to: cTo };
  const days = RANGE_PRESETS.find((p) => p.key === key)?.days ?? 30;
  const end = new Date();
  return { from: ymd(new Date(end.getTime() - (days - 1) * 86_400_000)), to: ymd(end) };
}
function rangeLabel(key: RangeKey, cFrom: string, cTo: string) {
  if (key !== "custom") return RANGE_PRESETS.find((p) => p.key === key)?.label ?? "Last 30 days";
  if (!cFrom && !cTo) return "Custom range";
  return `${fmtDay(cFrom)} → ${cTo ? fmtDay(cTo) : "today"}`;
}
function accuracyTone(v: number | null): string {
  if (v == null) return "text-muted";
  if (v >= 0.7) return "text-success";
  if (v >= 0.4) return "text-warning";
  return "text-danger";
}

interface DppDay {
  date: string;
  answered: number;
  presented: number;
  correct: number;
  seconds: number;
  accuracy: number | null;
}

function DppStudentInner() {
  const studentId = useUrlSegment(-1);
  const search = useSearchParams();
  const backHref = search.get("from") || "/analytics/dpp";

  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const { from, to } = resolveRange(rangeKey, customFrom, customTo);

  const [name, setName] = useState<string | null>(null);
  const [streak, setStreak] = useState<{ streak: number; totalCompleted: number; lastCompleted: string | null } | null>(null);
  const [days, setDays] = useState<DppDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [dayPage, setDayPage] = useState(0);

  const [openDay, setOpenDay] = useState<string | null>(null);
  const [dayQs, setDayQs] = useState<QuestionStat[] | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [outcome, setOutcome] = useState<"all" | "correct" | "wrong">("all");
  const [qPage, setQPage] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [profile, st] = await Promise.allSettled([
        apiClient.get<any>(`/api/v1/analytics/student/${studentId}`),
        apiClient.get<any>(`/api/v1/dpp/student/${studentId}/streak`),
      ]);
      if (!alive) return;
      if (profile.status === "fulfilled" && profile.value.success) {
        setName(profile.value.data?.profile?.name ?? null);
      }
      if (st.status === "fulfilled" && st.value.success) setStreak(st.value.data);
    })();
    return () => {
      alive = false;
    };
  }, [studentId]);

  useEffect(() => {
    if (rangeKey === "custom" && !customFrom) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // type=dpp — this route is DPP only, never the practice mix.
        const qs = new URLSearchParams({ from, to, type: "dpp" });
        const res = await apiClient.get<any>(
          `/api/v1/analytics/student/${studentId}/practice/questions?${qs.toString()}`,
        );
        if (!alive) return;
        setDays(res.success ? (res.data?.byDay ?? []) : []);
        setOpenDay(null);
        setDayQs(null);
        setDayPage(0);
      } catch {
        if (alive) setDays([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [studentId, from, to, rangeKey, customFrom]);

  useEffect(() => {
    if (!openDay) {
      setDayQs(null);
      return;
    }
    let alive = true;
    (async () => {
      setDayLoading(true);
      try {
        const qs = new URLSearchParams({ from, to, day: openDay, type: "dpp" });
        const res = await apiClient.get<any>(
          `/api/v1/analytics/student/${studentId}/practice/questions?${qs.toString()}`,
        );
        if (alive) setDayQs(res.success ? (res.data?.questions ?? []) : []);
      } catch {
        if (alive) setDayQs([]);
      } finally {
        if (alive) setDayLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [studentId, openDay, from, to]);

  useEffect(() => {
    setQPage(0);
  }, [outcome, openDay]);

  const windowDays = useMemo(() => {
    if (!from || !to) return 0;
    return (
      Math.round(
        (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
      ) + 1
    );
  }, [from, to]);

  const totals = useMemo(() => {
    const list = days ?? [];
    const answered = list.reduce((s, d) => s + d.answered, 0);
    const correct = list.reduce((s, d) => s + d.correct, 0);
    return {
      daysDone: list.length,
      answered,
      correct,
      accuracy: answered > 0 ? correct / answered : null,
      adherence: windowDays > 0 ? list.length / windowDays : null,
      minutes: Math.round(list.reduce((s, d) => s + d.seconds, 0) / 60),
    };
  }, [days, windowDays]);

  const filteredQs = useMemo(() => {
    const rows = dayQs ?? [];
    if (outcome === "correct") return rows.filter((r) => r.correct === 1);
    if (outcome === "wrong") return rows.filter((r) => r.correct === 0);
    return rows;
  }, [dayQs, outcome]);

  const qPageCount = Math.max(1, Math.ceil(filteredQs.length / Q_PAGE_SIZE));
  const safeQPage = Math.min(qPage, qPageCount - 1);
  const palette: QuestionStatsData = {
    questionCount: filteredQs.length,
    submissionCount: 1,
    questions: filteredQs.slice(safeQPage * Q_PAGE_SIZE, safeQPage * Q_PAGE_SIZE + Q_PAGE_SIZE),
  };

  const dayList = days ?? [];
  const dayPageCount = Math.max(1, Math.ceil(dayList.length / DAYS_PAGE_SIZE));
  const safeDayPage = Math.min(dayPage, dayPageCount - 1);
  const visibleDays = dayList.slice(
    safeDayPage * DAYS_PAGE_SIZE,
    safeDayPage * DAYS_PAGE_SIZE + DAYS_PAGE_SIZE,
  );

  const outcomeCounts = {
    all: (dayQs ?? []).length,
    correct: (dayQs ?? []).filter((r) => r.correct === 1).length,
    wrong: (dayQs ?? []).filter((r) => r.correct === 0).length,
  };

  const tiles = [
    {
      icon: <Fire size={16} weight="duotone" className="text-warning" />,
      label: "Streak",
      value: streak ? `${streak.streak} days` : "—",
      sub: streak?.lastCompleted ? `last ${fmtDay(streak.lastCompleted)}` : "never practised",
      info: "Consecutive days with a completed DPP. Breaks the moment a day is skipped — the same number the student sees.",
      tone: undefined as string | undefined,
    },
    {
      icon: <Target size={16} weight="duotone" className="text-primary" />,
      label: "Adherence",
      value: totals.adherence == null ? "—" : `${Math.round(totals.adherence * 100)}%`,
      sub: `${totals.daysDone}/${windowDays} days in window`,
      info: "Share of days in the selected window on which this student completed a DPP.",
      tone: accuracyTone(totals.adherence),
    },
    {
      icon: <CheckCircle size={16} weight="duotone" className="text-success" />,
      label: "Accuracy",
      value: totals.accuracy == null ? "—" : `${Math.round(totals.accuracy * 100)}%`,
      sub: `${totals.correct}/${totals.answered} answered`,
      info: "Correct answers across every DPP question in the window.",
      tone: undefined,
    },
    {
      icon: <Lightning size={16} weight="duotone" className="text-primary" />,
      label: "Time on DPP",
      value: `${totals.minutes}m`,
      sub: `${streak?.totalCompleted ?? 0} DPPs all time`,
      info: "Total time spent answering DPP questions in the window.",
      tone: undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
      <motion.div className="mx-auto max-w-5xl" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp}>
          <BackLink
            href={backHref}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} /> Back to Daily Practice
          </BackLink>
        </motion.div>

        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Lightning size={22} weight="duotone" className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Daily Practice · DPP
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {name ?? "Student"}
            </h1>
          </div>
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
              applyDisabled={!draftFrom && !draftTo}
              applyHint={`Up to ${MAX_SPAN_DAYS} days`}
            />
          </span>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                {t.icon}
                {t.label}
                <InfoTip content={t.info} side="bottom" />
              </div>
              <div className={`mt-2 font-mono text-2xl font-bold tabular-nums ${t.tone ?? "text-foreground"}`}>
                {t.value}
              </div>
              <p className="mt-1 text-[11px] text-muted">{t.sub}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="mt-5 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
        >
          <h2 className="text-sm font-semibold text-foreground">DPP activity</h2>
          <p className="mt-0.5 text-[10px] text-muted">
            DPP questions answered per day, and how many were right
          </p>
          <div className="mt-3 h-40">
            {loading ? (
              <Skeleton variant="rectangular" className="h-full w-full rounded-xl" />
            ) : dayList.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted">
                No DPP in this window.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...dayList]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((d) => ({ ...d, label: fmtDay(d.date) }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11 }} />
                  <Bar dataKey="answered" name="Answered" fill="#93C5FD" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="correct" name="Correct" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="mt-5 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {openDay ? `DPP — ${fmtDay(openDay)}` : "DPP days"}
            </h2>
            <span className="text-[10px] text-muted">
              {openDay
                ? `${dayQs?.length ?? 0} questions`
                : `${dayList.length} days · ${totals.answered} questions`}
            </span>
            {openDay && (
              <button
                type="button"
                onClick={() => setOpenDay(null)}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted transition hover:text-foreground"
              >
                ← All days
              </button>
            )}
          </div>

          {openDay && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {(
                [
                  ["all", "All"],
                  ["correct", "Correct"],
                  ["wrong", "Wrong"],
                ] as Array<["all" | "correct" | "wrong", string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOutcome(key)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    outcome === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:text-foreground"
                  }`}
                >
                  {label} {outcomeCounts[key]}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3">
            {loading ? (
              <Skeleton variant="rectangular" className="h-40 w-full rounded-xl" />
            ) : !openDay ? (
              dayList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted">
                  No DPP answered in this window.
                </div>
              ) : (
                <>
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {visibleDays.map((d) => (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => setOpenDay(d.date)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-foreground">
                            {fmtDay(d.date)}
                          </span>
                          <span className="block text-[10px] text-muted">
                            {d.correct}/{d.answered} correct · {Math.round(d.seconds / 60)}m
                          </span>
                        </span>
                        <span className={`font-mono text-xs font-semibold tabular-nums ${accuracyTone(d.accuracy)}`}>
                          {d.accuracy == null ? "—" : `${Math.round(d.accuracy * 100)}%`}
                        </span>
                        <CaretRight size={13} weight="bold" className="text-muted" />
                      </button>
                    ))}
                  </div>
                  {dayList.length > DAYS_PAGE_SIZE && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] text-muted">
                        {safeDayPage * DAYS_PAGE_SIZE + 1}–
                        {Math.min((safeDayPage + 1) * DAYS_PAGE_SIZE, dayList.length)} of{" "}
                        {dayList.length} days
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDayPage((p) => Math.max(0, p - 1))}
                          disabled={safeDayPage === 0}
                          aria-label="Previous page"
                          className="rounded-lg border border-border p-1.5 text-muted transition hover:text-foreground disabled:opacity-40"
                        >
                          <CaretLeft size={13} weight="bold" />
                        </button>
                        <span className="px-2 text-[11px] tabular-nums text-muted">
                          {safeDayPage + 1} / {dayPageCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDayPage((p) => Math.min(dayPageCount - 1, p + 1))}
                          disabled={safeDayPage >= dayPageCount - 1}
                          aria-label="Next page"
                          className="rounded-lg border border-border p-1.5 text-muted transition hover:text-foreground disabled:opacity-40"
                        >
                          <CaretRight size={13} weight="bold" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )
            ) : dayLoading ? (
              <Skeleton variant="rectangular" className="h-40 w-full rounded-xl" />
            ) : filteredQs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted">
                Nothing matches this filter.
              </div>
            ) : (
              <>
                <QuestionStatsPalette data={palette} />
                {filteredQs.length > Q_PAGE_SIZE && (
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-[11px] text-muted">
                      {safeQPage * Q_PAGE_SIZE + 1}–
                      {Math.min((safeQPage + 1) * Q_PAGE_SIZE, filteredQs.length)} of{" "}
                      {filteredQs.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQPage((p) => Math.max(0, p - 1))}
                        disabled={safeQPage === 0}
                        aria-label="Previous page"
                        className="rounded-lg border border-border p-1.5 text-muted transition hover:text-foreground disabled:opacity-40"
                      >
                        <CaretLeft size={13} weight="bold" />
                      </button>
                      <span className="px-2 text-[11px] tabular-nums text-muted">
                        {safeQPage + 1} / {qPageCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQPage((p) => Math.min(qPageCount - 1, p + 1))}
                        disabled={safeQPage >= qPageCount - 1}
                        aria-label="Next page"
                        className="rounded-lg border border-border p-1.5 text-muted transition hover:text-foreground disabled:opacity-40"
                      >
                        <CaretRight size={13} weight="bold" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// `useSearchParams()` opts a client page out of static prerendering unless it
// sits under a Suspense boundary — without one `next build` fails outright
// rather than degrading. Same wrapper as /error-analysis and /assignments.
export default function DppStudentPage() {
  return (
    <Suspense fallback={null}>
      <DppStudentInner />
    </Suspense>
  );
}
