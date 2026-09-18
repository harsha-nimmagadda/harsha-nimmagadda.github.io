"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Medal, Crown } from "@phosphor-icons/react";
import { apiClient } from "@/lib/api-client";
import { sectionFade, fadeUp } from "./shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface BatchOption {
  batchId: string;
  name: string;
}

interface InstitutionTopper {
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

interface BatchTopper {
  rank: number;
  studentId: string;
  studentName: string;
  avgPercentage: number;
  examCount: number;
}

interface Props {
  /** Batches to show as tabs (in addition to the institution-wide tab). */
  batches: BatchOption[];
}

const RANK_BADGE: Record<number, string> = {
  1: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  2: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  3: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
};

export function TopPerformers({ batches }: Props) {
  // Tab state — "institution" or a batchId
  const [tab, setTab] = useState<string>("institution");

  const institutionQuery = useQuery({
    queryKey: ["toppers", "institution"],
    enabled: tab === "institution",
    queryFn: async () => {
      const res = await apiClient.get<{
        toppers: InstitutionTopper[];
        recentN: number;
      }>("/api/v1/analytics/v3/institution/toppers?limit=10");
      if (!res.success) throw new Error(res.error || "Failed to load toppers");
      return res.data;
    },
  });

  const batchQuery = useQuery({
    queryKey: ["toppers", "batch", tab],
    enabled: tab !== "institution",
    queryFn: async () => {
      const res = await apiClient.get<{
        batchId: string;
        batchName: string;
        toppers: BatchTopper[];
        recentN: number;
      }>(`/api/v1/analytics/v3/batch/${tab}/toppers?limit=5`);
      if (!res.success) throw new Error(res.error || "Failed to load toppers");
      return res.data;
    },
  });

  const isInstitution = tab === "institution";
  const loading = isInstitution ? institutionQuery.isLoading : batchQuery.isLoading;
  const error = isInstitution
    ? institutionQuery.error
    : batchQuery.error;
  const recentN =
    (isInstitution ? institutionQuery.data?.recentN : batchQuery.data?.recentN) ?? 5;

  return (
    <motion.div
      variants={sectionFade}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
    >
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/10">
            <Crown weight="duotone" className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Top Performers</h2>
            <p className="text-xs text-muted">
              Ranked by average percentage of last {recentN} exams
            </p>
          </div>
        </div>
      </div>

      {/* Tabs — institution + per-batch. CLAUDE.md rule: white bg, no muted.
          Wraps when there's room, scrolls horizontally when it doesn't, so
          every batch stays reachable instead of being silently truncated. */}
      <div className="mb-5 flex flex-wrap gap-1 overflow-x-auto rounded-lg border border-border bg-white p-1 dark:border-border-dark dark:bg-surface-dark">
        <button
          onClick={() => setTab("institution")}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
            tab === "institution"
              ? "bg-white text-foreground shadow-sm dark:bg-surface-dark"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Institution-wide
        </button>
        {batches.map((b) => (
          <button
            key={b.batchId}
            onClick={() => setTab(b.batchId)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
              tab === b.batchId
                ? "bg-white text-foreground shadow-sm dark:bg-surface-dark"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-xl skeleton-shimmer-soft/70 dark:bg-surface-elevated-dark"
            />
          ))}
        </div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-danger">
          {(error as Error).message}
        </p>
      ) : isInstitution ? (
        <InstitutionTable rows={institutionQuery.data?.toppers ?? []} />
      ) : (
        <BatchTable rows={batchQuery.data?.toppers ?? []} />
      )}
    </motion.div>
  );
}

function rankBadge(rank: number) {
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
        RANK_BADGE[rank] ??
        "bg-slate-50/70 text-muted dark:bg-surface-elevated-dark"
      }`}
    >
      {rank <= 3 ? <Medal weight="fill" className="h-3.5 w-3.5" /> : `#${rank}`}
    </span>
  );
}

function InstitutionTable({ rows }: { rows: InstitutionTopper[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        No toppers yet — students need at least 2 submitted exams.
      </p>
    );
  }
  return (
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
          {rows.map((r, i) => (
            <motion.tr
              key={r.studentId}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ delay: i * 0.03 }}
              data-testid={`analytics.list.row.${r.studentId}`}
              className="border-b border-border/30 hover:bg-primary/5 dark:border-border-dark/30 dark:hover:bg-surface-elevated-dark/30"
            >
              <td className="py-3 pr-4">{rankBadge(r.rank)}</td>
              <td className="py-3 pr-4">
                <Link
                  href={`/analytics/student/${r.studentId}`}
                  data-testid={`analytics.list.row.${r.studentId}.name`}
                  className="font-medium text-primary hover:underline"
                >
                  {r.studentName}
                </Link>
              </td>
              <td
                data-testid={`analytics.list.row.${r.studentId}.meta`}
                className="hidden py-3 pr-4 text-muted md:table-cell"
              >
                {r.batchName ?? "—"}
              </td>
              <td className="hidden py-3 pr-4 text-muted lg:table-cell">
                {r.branchName ?? "—"}
              </td>
              <td className="py-3 pr-4 text-right">
                <span
                  data-testid={`analytics.list.row.${r.studentId}.score`}
                  className="font-mono font-semibold text-success"
                >
                  {r.avgPercentage.toFixed(1)}%
                </span>
              </td>
              <td className="py-3 text-right font-mono text-muted">{r.examCount}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatchTable({ rows }: { rows: BatchTopper[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        No toppers in this batch yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
            <th className="pb-3 pr-4">Rank</th>
            <th className="pb-3 pr-4">Student</th>
            <th className="pb-3 pr-4 text-right">Avg %</th>
            <th className="pb-3 text-right">Exams</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <motion.tr
              key={r.studentId}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ delay: i * 0.03 }}
              className="border-b border-border/30 hover:bg-primary/5 dark:border-border-dark/30 dark:hover:bg-surface-elevated-dark/30"
            >
              <td className="py-3 pr-4">{rankBadge(r.rank)}</td>
              <td className="py-3 pr-4">
                <Link
                  href={`/analytics/student/${r.studentId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {r.studentName}
                </Link>
              </td>
              <td className="py-3 pr-4 text-right">
                <span className="font-mono font-semibold text-success">
                  {r.avgPercentage}%
                </span>
              </td>
              <td className="py-3 text-right font-mono text-muted">{r.examCount}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
