"use client";

// ============================================================
// Cohort Score Distribution — quartile bars per milestone
// ============================================================
// Recharts has no native box plot. We render quartile stats as a
// horizontal bar with a min..max whisker line and inner Q1..Q3
// box; the median is a vertical tick. One row per cohort per
// milestone the user has selected.

import { useQueries } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  motionVariants,
} from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";

interface DistributionRow {
  milestone: string;
  label: string;
  sampleSize: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
}

interface DistributionResponse {
  cohortKey: string;
  cohortName: string;
  distribution: DistributionRow[];
}

export function CohortDistributionChart({
  cohorts,
  colorMap,
}: {
  cohorts: { cohortId: string; cohortName: string }[];
  colorMap: Record<string, string>;
}) {
  const queries = useQueries({
    queries: cohorts.map((c) => ({
      queryKey: ["cohort-distribution", c.cohortId],
      queryFn: async () => {
        const res = await apiClient.get<DistributionResponse>(
          `/api/v1/analytics/v3/institution/cohorts/${encodeURIComponent(c.cohortId)}/distribution`,
        );
        if (!res.success) throw new Error(res.error || "Failed to load distribution");
        return res.data as DistributionResponse;
      },
    })),
  });

  const allLoaded = queries.every((q) => !q.isLoading);
  const everyEmpty =
    allLoaded &&
    queries.every(
      (q) => !q.data?.distribution || q.data.distribution.length === 0,
    );

  // Group: { milestone -> [{cohortId, row}, ...] }
  const grouped = new Map<string, { label: string; rows: { cohortId: string; cohortName: string; row: DistributionRow }[] }>();
  cohorts.forEach((c, i) => {
    const data = queries[i]?.data;
    if (!data) return;
    for (const row of data.distribution) {
      const entry = grouped.get(row.milestone) ?? { label: row.label, rows: [] };
      entry.rows.push({ cohortId: c.cohortId, cohortName: c.cohortName, row });
      grouped.set(row.milestone, entry);
    }
  });
  const milestones = [...grouped.entries()].sort(
    ([a], [b]) => MILESTONE_ORDER.indexOf(a) - MILESTONE_ORDER.indexOf(b),
  );

  return (
    <motion.div variants={motionVariants.fadeUp}>
      <Card hoverable={false} padding="md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Score Distribution</CardTitle>
          <p className="text-xs text-muted">
            Min · Q1 · Median · Q3 · Max per milestone — wider bars mean more
            score variance within the cohort.
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          {!allLoaded ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg skeleton-shimmer-soft/70 dark:bg-surface-elevated-dark"
                />
              ))}
            </div>
          ) : everyEmpty || milestones.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center dark:border-border-dark dark:bg-surface-dark">
              <p className="text-sm font-medium text-foreground">
                No distribution data yet
              </p>
              <p className="mt-1 text-xs text-muted">
                Score distributions populate once each cohort has submitted
                exams. Try after the next test cycle.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {milestones.map(([key, group]) => (
                <div key={key}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                    {group.label}
                  </p>
                  <div className="space-y-2">
                    {group.rows.map((r) => (
                      <QuartileBar
                        key={`${key}-${r.cohortId}`}
                        label={r.cohortName}
                        color={colorMap[r.cohortId] ?? "#6B7280"}
                        row={r.row}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

const MILESTONE_ORDER = [
  "month_1",
  "month_3",
  "month_6",
  "month_9",
  "month_12",
  "final_mock",
];

function QuartileBar({
  label,
  color,
  row,
}: {
  label: string;
  color: string;
  row: DistributionRow;
}) {
  // Map percentages (0..100) to bar widths.
  const minPct = row.min;
  const maxPct = row.max;
  const q1Pct = row.q1;
  const q3Pct = row.q3;
  const medianPct = row.median;

  return (
    <div className="grid grid-cols-[140px_1fr_72px] items-center gap-3">
      <span
        className="truncate text-xs font-medium"
        style={{ color }}
        title={label}
      >
        {label}
      </span>
      <div className="relative h-6 rounded-md bg-slate-50/70 dark:bg-surface-elevated-dark">
        {/* Whisker line from min to max */}
        <div
          className="absolute top-1/2 h-px"
          style={{
            left: `${minPct}%`,
            width: `${Math.max(maxPct - minPct, 0)}%`,
            background: color,
            opacity: 0.5,
          }}
        />
        {/* Inner box: Q1 → Q3 */}
        <div
          className="absolute top-1 bottom-1 rounded"
          style={{
            left: `${q1Pct}%`,
            width: `${Math.max(q3Pct - q1Pct, 1)}%`,
            background: color,
            opacity: 0.45,
          }}
          title={`Q1 ${q1Pct}% · Q3 ${q3Pct}%`}
        />
        {/* Median tick */}
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{ left: `${medianPct}%`, background: color }}
          title={`Median ${medianPct}%`}
        />
      </div>
      <span
        className="text-right font-mono text-xs text-muted"
        title={`Sample size: ${row.sampleSize}`}
      >
        n={row.sampleSize}
      </span>
    </div>
  );
}
