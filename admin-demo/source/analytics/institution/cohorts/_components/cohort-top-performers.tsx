"use client";

// ============================================================
// Cohort Top Performers — tabbed by cohort
// ============================================================
// One tab per cohort. Each tab calls /institution/cohorts/:key/toppers
// with its own React Query key (independent caches). Layout mirrors
// the sibling <TopPerformers> component but scoped to cohorts.

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Crown, Medal } from "@phosphor-icons/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  motionVariants,
} from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";

interface CohortTopper {
  rank: number;
  studentId: string;
  studentName: string;
  batchId: string | null;
  batchName: string | null;
  branchId: string | null;
  branchName: string | null;
  avgPercentage: number;
  examCount: number;
}

interface ToppersResponse {
  cohortKey: string;
  cohortName: string;
  recentN: number;
  toppers: CohortTopper[];
}

const RANK_BADGE: Record<number, string> = {
  1: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  2: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  3: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
};

export function CohortTopPerformers({
  cohorts,
}: {
  cohorts: { cohortId: string; cohortName: string }[];
}) {
  const [activeTab, setActiveTab] = useState<string>(
    cohorts[0]?.cohortId ?? "",
  );

  const query = useQuery({
    queryKey: ["cohort-toppers", activeTab],
    enabled: !!activeTab,
    queryFn: async () => {
      const res = await apiClient.get<ToppersResponse>(
        `/api/v1/analytics/v3/institution/cohorts/${encodeURIComponent(activeTab)}/toppers?limit=10`,
      );
      if (!res.success) throw new Error(res.error || "Failed to load toppers");
      return res.data as ToppersResponse;
    },
  });

  if (cohorts.length === 0) return null;

  return (
    <motion.div variants={motionVariants.fadeUp}>
      <Card hoverable={false} padding="md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/10">
              <Crown weight="duotone" className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">Top Performers</CardTitle>
              <p className="text-xs text-muted">
                Ranked by avg of last {query.data?.recentN ?? 5} exams · per cohort
              </p>
            </div>
          </div>
        </CardHeader>

        {/* Tabs (CLAUDE.md rule: white bg, no muted) */}
        <div className="mt-4 mb-4 flex flex-wrap gap-1 overflow-x-auto rounded-lg border border-border bg-white p-1 dark:border-border-dark dark:bg-surface-dark">
          {cohorts.map((c) => (
            <button
              key={c.cohortId}
              onClick={() => setActiveTab(c.cohortId)}
              className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
                activeTab === c.cohortId
                  ? "bg-white text-foreground shadow-sm dark:bg-surface-dark"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.cohortName}
            </button>
          ))}
        </div>

        <CardContent className="pt-2">
          {query.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 rounded-xl skeleton-shimmer-soft/70 dark:bg-surface-elevated-dark"
                />
              ))}
            </div>
          ) : query.error ? (
            <p className="py-10 text-center text-sm text-danger">
              {(query.error as Error).message}
            </p>
          ) : !query.data?.toppers.length ? (
            <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center dark:border-border-dark dark:bg-surface-dark">
              <p className="text-sm font-medium text-foreground">
                No toppers yet
              </p>
              <p className="mt-1 text-xs text-muted">
                Students need at least 2 submitted exams to qualify.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
                    <th className="pb-3 pr-4">Rank</th>
                    <th className="pb-3 pr-4">Student</th>
                    <th className="hidden pb-3 pr-4 md:table-cell">Batch</th>
                    <th className="hidden pb-3 pr-4 lg:table-cell">Branch</th>
                    <th className="pb-3 pr-4 text-right">Avg %</th>
                    <th className="pb-3 text-right">Exams</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.toppers.map((t) => (
                    <tr
                      key={t.studentId}
                      className="border-b border-border/30 hover:bg-primary/5 dark:border-border-dark/30 dark:hover:bg-surface-elevated-dark/30"
                    >
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                            RANK_BADGE[t.rank] ??
                            "bg-slate-50/70 text-muted dark:bg-surface-elevated-dark"
                          }`}
                        >
                          {t.rank <= 3 ? (
                            <Medal weight="fill" className="h-3.5 w-3.5" />
                          ) : (
                            `#${t.rank}`
                          )}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/analytics/student/${t.studentId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {t.studentName}
                        </Link>
                      </td>
                      <td className="hidden py-3 pr-4 text-muted md:table-cell">
                        {t.batchName ?? "—"}
                      </td>
                      <td className="hidden py-3 pr-4 text-muted lg:table-cell">
                        {t.branchName ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="font-mono font-semibold text-success">
                          {t.avgPercentage}%
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono text-muted">
                        {t.examCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
