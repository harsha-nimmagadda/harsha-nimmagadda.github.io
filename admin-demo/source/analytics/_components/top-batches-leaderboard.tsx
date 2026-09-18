"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy } from "@phosphor-icons/react";
import { sectionFade, fadeUp } from "./shared";

interface Batch {
  rank: number;
  batchId: string;
  name: string;
  branch: string;
  avgPercentile: number;
  students: number;
}

interface Props {
  batches: Batch[];
  dateQs?: string;
}

const RANK_STYLE: Record<number, { bg: string; text: string; ring: string }> = {
  1: { bg: "bg-amber-100 dark:bg-amber-500/15", text: "text-amber-700 dark:text-amber-400", ring: "ring-amber-200" },
  2: { bg: "bg-slate-100 dark:bg-slate-500/15", text: "text-slate-600 dark:text-slate-300", ring: "ring-slate-200" },
  3: { bg: "bg-orange-100 dark:bg-orange-500/15", text: "text-orange-700 dark:text-orange-400", ring: "ring-orange-200" },
};

export function TopBatchesLeaderboard({ batches, dateQs }: Props) {

  return (
    <motion.div
      variants={sectionFade}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/10">
          <Trophy weight="duotone" className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Top batches</h2>
          <p className="text-xs text-muted">Ranked by average percentile</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {batches.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">No batch data available</p>
        )}
        {batches.slice(0, 8).map((batch) => {
          const rs = RANK_STYLE[batch.rank];
          const href = dateQs
            ? `/analytics/batch/${batch.batchId}?${dateQs}`
            : `/analytics/batch/${batch.batchId}`;

          return (
            <motion.div key={batch.batchId} variants={fadeUp}>
              <Link
                href={href}
                data-testid={`analytics.overview.batches.row.${batch.batchId}`}
                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark"
              >
                {/* Rank badge */}
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                    rs
                      ? `${rs.bg} ${rs.text}`
                      : "bg-slate-50/70 text-muted dark:bg-surface-elevated-dark"
                  }`}
                >
                  {batch.rank}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      data-testid={`analytics.overview.batches.row.${batch.batchId}.name`}
                      className="truncate text-sm font-medium group-hover:text-primary"
                    >
                      {batch.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">{batch.branch}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-50/70 dark:bg-surface-elevated-dark">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, batch.avgPercentile)}%` }}
                      transition={{ duration: 0.8, delay: batch.rank * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span
                    data-testid={`analytics.overview.batches.row.${batch.batchId}.avg`}
                    className="font-mono text-sm font-bold text-primary"
                  >
                    {batch.avgPercentile}%ile
                  </span>
                  <p
                    data-testid={`analytics.overview.batches.row.${batch.batchId}.students`}
                    className="text-[10px] text-muted"
                  >
                    {batch.students} students
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
