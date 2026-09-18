"use client";

// ============================================================
// Student-vs-Cohort Lookup
// ============================================================
// Pick a cohort + a student → render their percentile, deltas vs
// cohort median, gap to top scorer, and per-subject deltas.
// Reuses the institution-wide /api/v1/users/students/search endpoint
// for the picker.

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  MagnifyingGlass,
  Crown,
  TrendUp,
  TrendDown,
  Minus,
  CaretRight,
  X,
} from "@phosphor-icons/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  motionVariants,
  analyticsTokens,
} from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";

const { type: typeTokens } = analyticsTokens;

interface StudentSearchResult {
  id: string;
  name: string;
  roll_number?: string | null;
  batch_name?: string | null;
  branch_name?: string | null;
}

interface SubjectDelta {
  subjectName: string;
  studentPct: number;
  cohortAvgPct: number;
  delta: number;
}

interface StudentRankResponse {
  studentId: string;
  studentName: string;
  cohortKey: string;
  cohortName: string;
  cohortSize: number;
  cohortMedianPct: number | null;
  studentAvgPct: number | null;
  percentile: number | null;
  rankInCohort: number | null;
  deltaVsMedian: number | null;
  topScorer: { studentId: string; name: string; avgPct: number } | null;
  gapToTop: number | null;
  subjectDeltas: SubjectDelta[];
}

export function StudentCohortRank({
  cohorts,
}: {
  cohorts: { cohortId: string; cohortName: string }[];
}) {
  const [selectedCohort, setSelectedCohort] = useState<string>(
    cohorts[0]?.cohortId ?? "",
  );
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [picked, setPicked] = useState<StudentSearchResult | null>(null);

  // Debounce the search input — typing shouldn't fire on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const searchQuery = useQuery({
    queryKey: ["student-search", debouncedQuery],
    enabled: debouncedQuery.trim().length >= 2 && !picked,
    queryFn: async () => {
      const res = await apiClient.get<StudentSearchResult[]>(
        `/api/v1/users/students/search?q=${encodeURIComponent(debouncedQuery)}&limit=10`,
      );
      if (!res.success) throw new Error(res.error || "Search failed");
      return (res.data ?? []) as StudentSearchResult[];
    },
  });

  const rankQuery = useQuery({
    queryKey: ["student-cohort-rank", selectedCohort, picked?.id],
    enabled: !!selectedCohort && !!picked?.id,
    queryFn: async () => {
      const res = await apiClient.get<StudentRankResponse>(
        `/api/v1/analytics/v3/institution/cohorts/${encodeURIComponent(selectedCohort)}/student-rank?studentId=${picked!.id}`,
      );
      if (!res.success) throw new Error(res.error || "Failed to load rank");
      return res.data as StudentRankResponse;
    },
    retry: false,
  });

  // Reset student when cohort changes (their rank wouldn't make sense in a
  // different cohort). Clearing `picked` is enough — the rank query is
  // gated on `picked?.id`, so it disables itself.
  const onCohortChange = (id: string) => {
    setSelectedCohort(id);
    setPicked(null);
  };

  if (cohorts.length === 0) return null;

  const selectedCohortName = cohorts.find(
    (c) => c.cohortId === selectedCohort,
  )?.cohortName;

  return (
    <motion.div variants={motionVariants.fadeUp}>
      <Card hoverable={false} padding="md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Where does a student stand?</CardTitle>
          <p className="text-xs text-muted">
            Pick a cohort and a student — see their percentile, gap to the top,
            and subjects they're behind/ahead of cohort peers.
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {/* Cohort tabs */}
          {/* The selected tab used to be `bg-white` inside a `bg-white` track,
              so picking a cohort produced no visible change anywhere. */}
          <div
            role="group"
            aria-label="Cohort"
            className="flex flex-wrap gap-1 overflow-x-auto rounded-lg border border-border bg-muted-light p-1 dark:border-border-dark dark:bg-surface-dark"
          >
            {cohorts.map((c) => (
              <button
                key={c.cohortId}
                type="button"
                onClick={() => onCohortChange(c.cohortId)}
                aria-pressed={selectedCohort === c.cohortId}
                className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
                  selectedCohort === c.cohortId
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-700 hover:text-foreground dark:text-zinc-300"
                }`}
              >
                {c.cohortName}
              </button>
            ))}
          </div>

          {/* Student picker */}
          <div className="relative">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 dark:border-border-dark dark:bg-surface-dark">
              <MagnifyingGlass
                size={14}
                weight="bold"
                className="text-muted"
              />
              <input
                type="text"
                value={picked ? picked.name : query}
                onChange={(e) => {
                  setPicked(null);
                  setQuery(e.target.value);
                }}
                placeholder="Search by name or roll number…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
              {picked && (
                <button
                  onClick={() => {
                    setPicked(null);
                    setQuery("");
                  }}
                  className="text-muted hover:text-foreground"
                  aria-label="Clear selection"
                >
                  <X size={14} weight="bold" />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {!picked &&
              debouncedQuery.trim().length >= 2 &&
              searchQuery.data &&
              searchQuery.data.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-lg dark:border-border-dark dark:bg-surface-dark">
                  {searchQuery.data.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setPicked(s);
                        setQuery("");
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-primary/5 dark:hover:bg-surface-elevated-dark"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.name}</p>
                        <p className="truncate text-[11px] text-muted">
                          {[s.roll_number, s.batch_name, s.branch_name]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <CaretRight
                        size={12}
                        weight="bold"
                        className="text-muted"
                      />
                    </button>
                  ))}
                </div>
              )}
            {!picked &&
              debouncedQuery.trim().length >= 2 &&
              searchQuery.data &&
              searchQuery.data.length === 0 &&
              !searchQuery.isLoading && (
                <p className="mt-1 px-2 text-xs text-muted">
                  No students match "{debouncedQuery}".
                </p>
              )}
          </div>

          {/* Result card. Without this prompt, switching cohorts changed
              nothing on screen — the rank query is gated on a picked student —
              so the tabs looked inert even once they were styled correctly. */}
          {!picked && (
            <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center dark:border-border-dark dark:bg-surface-dark">
              <p className="text-sm text-muted">
                {selectedCohortName
                  ? `Search for a student to see where they stand in ${selectedCohortName}.`
                  : "Search for a student to see where they stand."}
              </p>
            </div>
          )}
          {picked && rankQuery.isLoading && (
            <div className="h-32 rounded-xl skeleton-shimmer-soft/70 dark:bg-surface-elevated-dark" />
          )}
          {picked && rankQuery.error && (
            <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center dark:border-border-dark dark:bg-surface-dark">
              <p className="text-sm font-medium text-danger">
                {(rankQuery.error as Error).message}
              </p>
              <p className="mt-1 text-xs text-muted">
                The student may belong to a different cohort.
              </p>
            </div>
          )}
          {picked && rankQuery.data && (
            <RankResult data={rankQuery.data} />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RankResult({ data }: { data: StudentRankResponse }) {
  if (data.cohortSize === 0 || data.studentAvgPct === null) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center dark:border-border-dark dark:bg-surface-dark">
        <p className="text-sm font-medium text-foreground">
          No exam data for {data.studentName} in {data.cohortName} yet
        </p>
        <p className="mt-1 text-xs text-muted">
          The rank populates after this student has at least one submitted
          exam.
        </p>
      </div>
    );
  }

  const DeltaIcon =
    data.deltaVsMedian === null
      ? Minus
      : data.deltaVsMedian > 0
        ? TrendUp
        : data.deltaVsMedian < 0
          ? TrendDown
          : Minus;
  const deltaColor =
    data.deltaVsMedian === null
      ? "text-muted"
      : data.deltaVsMedian > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : data.deltaVsMedian < 0
          ? "text-red-600 dark:text-red-400"
          : "text-muted";

  const ahead = data.subjectDeltas.filter((s) => s.delta > 0).slice(0, 3);
  const behind = data.subjectDeltas
    .filter((s) => s.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-5 dark:border-border-dark dark:bg-surface-dark">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">
            {data.studentName}
          </p>
          <p className="text-xs text-muted">{data.cohortName}</p>
        </div>
        <Badge variant="info" size="sm">
          Rank #{data.rankInCohort} / {data.cohortSize}
        </Badge>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="Avg %"
          value={`${data.studentAvgPct}%`}
          sub={`cohort median ${data.cohortMedianPct ?? "—"}%`}
        />
        <Kpi
          label="Percentile"
          value={data.percentile !== null ? `p${Math.round(data.percentile)}` : "—"}
          sub="within cohort"
        />
        <Kpi
          label="Δ vs median"
          value={
            data.deltaVsMedian === null
              ? "—"
              : `${data.deltaVsMedian > 0 ? "+" : ""}${data.deltaVsMedian} pts`
          }
          sub={
            <span className={`inline-flex items-center gap-1 ${deltaColor}`}>
              <DeltaIcon size={11} weight="bold" />
              {data.deltaVsMedian === null
                ? "—"
                : data.deltaVsMedian > 0
                  ? "above median"
                  : "below median"}
            </span>
          }
        />
        <Kpi
          label="Gap to top"
          value={
            data.gapToTop !== null
              ? `${data.gapToTop > 0 ? "" : "+"}${data.gapToTop} pts`
              : "—"
          }
          sub={
            data.topScorer ? (
              <Link
                href={`/analytics/student/${data.topScorer.studentId}`}
                className="inline-flex items-center gap-1 text-amber-600 hover:underline dark:text-amber-400"
              >
                <Crown size={11} weight="duotone" />
                {data.topScorer.name}
              </Link>
            ) : (
              "—"
            )
          }
        />
      </div>

      {/* Subjects ahead/behind */}
      {(ahead.length > 0 || behind.length > 0) && (
        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2 dark:border-border-dark">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Ahead of cohort
            </p>
            {ahead.length === 0 ? (
              <p className="text-xs text-muted">No subject above cohort avg.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {ahead.map((s) => (
                  <li key={s.subjectName} className="flex items-center justify-between gap-2">
                    <span className="truncate">{s.subjectName}</span>
                    <span
                      className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                      style={{ fontFamily: typeTokens.number }}
                    >
                      +{s.delta} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
              Behind cohort
            </p>
            {behind.length === 0 ? (
              <p className="text-xs text-muted">No subject below cohort avg.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {behind.map((s) => (
                  <li key={s.subjectName} className="flex items-center justify-between gap-2">
                    <span className="truncate">{s.subjectName}</span>
                    <span
                      className="font-mono text-xs font-semibold text-red-600 dark:text-red-400"
                      style={{ fontFamily: typeTokens.number }}
                    >
                      {s.delta} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="flex items-center justify-end border-t border-border pt-3 dark:border-border-dark">
        <Link
          href={`/analytics/student/${data.studentId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
        >
          Open student page
          <CaretRight size={12} weight="bold" />
        </Link>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-3 dark:border-border-dark dark:bg-surface-dark">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p
        className="mt-1 text-lg font-bold text-foreground"
        style={{ fontFamily: typeTokens.number }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">{sub}</p>
    </div>
  );
}
