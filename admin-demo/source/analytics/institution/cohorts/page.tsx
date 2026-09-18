"use client";

// ============================================================
// BRILLIANCE — Institution Cohort Analytics
// Year-over-year cohort comparison + per-cohort drill-down with
// student-level lookup. See PR description / plan for context.
// ============================================================

import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, UsersThree } from "@phosphor-icons/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  motionVariants,
  analyticsTokens,
} from "@brilliance/ui";
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

import {
  CohortSummaryCards,
  type CohortSummary,
} from "./_components/cohort-summary-cards";
import { CohortDistributionChart } from "./_components/cohort-distribution-chart";
import { CohortTopPerformers } from "./_components/cohort-top-performers";
import { StudentCohortRank } from "./_components/student-cohort-rank";
import { BackLink } from "@/components/back-link";

const { chartColors } = analyticsTokens;

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Types matching backend payload ──────────────────────────

interface CohortMilestone {
  milestone: string;
  label: string;
  avgScore: number | null;
  studentCount: number | null;
}

interface CohortData extends CohortSummary {
  milestones: CohortMilestone[];
}

interface CohortsResponse {
  cohorts: CohortData[];
}

// ── Helpers ──────────────────────────────────────────────────

const MILESTONE_ORDER = ["month_1", "month_3", "month_6", "month_9", "month_12", "final_mock"];

function buildChartData(
  cohorts: CohortData[],
  visible: Set<string>,
): Record<string, any>[] {
  const milestoneMap = new Map<string, Record<string, any>>();
  for (const cohort of cohorts) {
    if (!visible.has(cohort.cohortId)) continue;
    for (const m of cohort.milestones) {
      const existing = milestoneMap.get(m.milestone) ?? {
        milestone: m.milestone,
        label: m.label,
      };
      existing[cohort.cohortId] = m.avgScore;
      milestoneMap.set(m.milestone, existing);
    }
  }
  return [...milestoneMap.entries()]
    .sort(([a], [b]) => MILESTONE_ORDER.indexOf(a) - MILESTONE_ORDER.indexOf(b))
    .map(([, v]) => v);
}

// ── Page ─────────────────────────────────────────────────────

export default function CohortComparisonPage() {
  const cohortsQuery = useQuery({
    queryKey: ["institution-cohorts"],
    queryFn: async () => {
      const res = await apiClient.get<CohortsResponse>(
        "/api/v1/analytics/v3/institution/cohorts",
      );
      if (!res.success) throw new Error(res.error || "Failed to load cohorts");
      return (res.data as CohortsResponse).cohorts ?? [];
    },
  });

  const cohorts = cohortsQuery.data ?? [];
  const loading = cohortsQuery.isLoading;
  const error = cohortsQuery.error
    ? (cohortsQuery.error as Error).message
    : null;

  // Visibility chips — default all on, persist within-session only.
  // Seed once: keying this on `visible.size === 0` re-selected every cohort the
  // moment the last chip was switched off, so it snapped straight back on and
  // the chip read as broken.
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const seededVisible = useRef(false);
  useEffect(() => {
    if (!seededVisible.current && cohorts.length > 0) {
      seededVisible.current = true;
      setVisible(new Set(cohorts.map((c) => c.cohortId)));
    }
  }, [cohorts]);

  function toggleCohort(id: string) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const chartData = useMemo(
    () => buildChartData(cohorts, visible),
    [cohorts, visible],
  );

  const visibleCohorts = useMemo(
    () => cohorts.filter((c) => visible.has(c.cohortId)),
    [cohorts, visible],
  );

  // Color map keyed by cohortId so distribution + chart stay aligned.
  const colorMap = useMemo(() => {
    const m: Record<string, string> = {};
    cohorts.forEach((c, i) => {
      m[c.cohortId] = chartColors[i % chartColors.length] as string;
    });
    return m;
  }, [cohorts]);

  // ── Loading skeleton ──────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.main
      initial="hidden"
      animate="visible"
      variants={motionVariants.staggerContainer}
      className="mx-auto max-w-5xl space-y-6 px-6 py-10"
    >
      {/* Back link */}
      <motion.div variants={motionVariants.fadeUp}>
        <BackLink
          href="/analytics"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} weight="bold" />
          Back
        </BackLink>
      </motion.div>

      {/* Header */}
      <motion.header variants={motionVariants.fadeUp} className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <UsersThree size={22} weight="duotone" className="text-primary" />
        </div>
        <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Cohort Analytics
        </h1>
        <p className="mt-1 text-muted-foreground">
          Compare cohorts side-by-side and see where individual students stand
          inside their cohort.
        </p>
        </div>
      </motion.header>

      {/* Error banner */}
      {error && (
        <motion.div variants={motionVariants.fadeUp}>
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardContent className="py-3 text-sm text-amber-700 dark:text-amber-300">
              {error}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && !error && cohorts.length === 0 && (
        <motion.div variants={motionVariants.fadeUp}>
          <div data-testid="analytics-cohorts.list.empty" className="rounded-2xl border border-dashed border-border bg-white p-10 text-center dark:border-border-dark dark:bg-surface-dark">
            <p className="text-sm font-medium text-foreground">
              No cohorts yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cohorts derive from active batches. Create a batch with an
              academic year + target exam to see one here.
            </p>
          </div>
        </motion.div>
      )}

      {cohorts.length > 0 && (
        <>
          {/* Summary cards */}
          <CohortSummaryCards cohorts={cohorts} />

          {/* Visibility chips */}
          <motion.div
            variants={motionVariants.fadeUp}
            className="flex flex-wrap gap-2"
          >
            {cohorts.map((c, i) => {
              const active = visible.has(c.cohortId);
              const color = chartColors[i % chartColors.length];
              return (
                <button
                  key={c.cohortId}
                  data-testid={`analytics-cohorts.chip.${c.cohortId}`}
                  onClick={() => toggleCohort(c.cohortId)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                    active
                      ? "border-transparent text-white shadow-sm"
                      : "border-border bg-white text-muted-foreground hover:text-foreground dark:bg-surface-dark"
                  }`}
                  style={active ? { backgroundColor: color } : undefined}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {c.cohortName}
                </button>
              );
            })}
          </motion.div>

          {/* Score trajectory line chart */}
          <motion.div variants={motionVariants.fadeUp}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Average Score by Milestone
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  /* Two very different situations were sharing one message, so
                     the panel told you to select a cohort while every chip was
                     already on. Say which one it actually is. */
                  visible.size === 0 ? (
                    <p data-testid="analytics-cohorts.chart.empty" className="py-10 text-center text-sm text-muted-foreground">
                      No cohorts selected. Pick one above to view trends.
                    </p>
                  ) : (
                    <p data-testid="analytics-cohorts.chart.empty" className="py-10 text-center text-sm text-muted-foreground">
                      No milestone data for{" "}
                      {visibleCohorts.length === 1
                        ? "this cohort"
                        : "these cohorts"}{" "}
                      yet — the nightly snapshot job populates it.
                    </p>
                  )
                ) : (
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12 }}
                        className="fill-muted-foreground"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                        className="fill-muted-foreground"
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          fontSize: 13,
                          border: "1px solid var(--border)",
                          background: "var(--popover)",
                          color: "var(--popover-foreground)",
                        }}
                      />
                      <Legend />
                      {visibleCohorts.map((c, i) => (
                        <Line
                          key={c.cohortId}
                          type="monotone"
                          dataKey={c.cohortId}
                          name={c.cohortName}
                          stroke={colorMap[c.cohortId]}
                          strokeWidth={2.5}
                          dot={{ r: 5, fill: colorMap[c.cohortId] }}
                          activeDot={{ r: 7 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Score distribution per cohort (quartile bars) */}
          {visibleCohorts.length > 0 && (
            <CohortDistributionChart
              cohorts={visibleCohorts}
              colorMap={colorMap}
            />
          )}

          {/* Top performers — tabbed by cohort */}
          <CohortTopPerformers
            cohorts={cohorts.map((c) => ({
              cohortId: c.cohortId,
              cohortName: c.cohortName,
            }))}
          />

          {/* Student-vs-cohort lookup */}
          <StudentCohortRank
            cohorts={cohorts.map((c) => ({
              cohortId: c.cohortId,
              cohortName: c.cohortName,
            }))}
          />
        </>
      )}
    </motion.main>
  );
}
