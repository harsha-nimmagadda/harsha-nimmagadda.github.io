"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Brain, FunnelSimple } from "@phosphor-icons/react";

export interface BloomCell {
  attempts: number;
  correct: number;
  accuracy: number;
  avgTimeSeconds: number;
}

export interface BloomTopicRow {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  parentChapterId: string | null;
  parentChapterName: string | null;
  totalAttempts: number;
  totalCorrect: number;
  accuracy: number;
  blooms: Record<string, BloomCell>;
}

export interface BloomTopicMatrixData {
  bloomsLevels: string[];
  topics: BloomTopicRow[];
  bloomsTotals: Record<string, { attempts: number; correct: number; accuracy: number }>;
  totals: { attempts: number; correct: number; accuracy: number };
  cohortSize: number;
}

interface Props {
  data: BloomTopicMatrixData | null;
  loading?: boolean;
}

// Heat color from accuracy % (0-100). Low = danger red, high = success green.
function cellColor(accuracy: number, attempts: number): string {
  if (attempts === 0) return "bg-slate-50/30 text-muted dark:bg-surface-elevated-dark/30";
  if (accuracy >= 80) return "bg-success/20 text-success-fg dark:bg-success/25";
  if (accuracy >= 65) return "bg-success/10 text-success-fg dark:bg-success/15";
  if (accuracy >= 50) return "bg-warning/15 text-warning-fg dark:bg-warning/20";
  if (accuracy >= 35) return "bg-warning/25 text-warning-fg dark:bg-warning/30";
  return "bg-danger/20 text-danger dark:bg-danger/25";
}

const BLOOM_LABEL: Record<string, string> = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyse: "Analyse",
  evaluate: "Evaluate",
  create: "Create",
};

export function BatchBloomTopicMatrix({ data, loading }: Props) {
  const [subjectFilter, setSubjectFilter] = useState<string | "all">("all");

  const subjects = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, string>();
    for (const t of data.topics) map.set(t.subjectId, t.subjectName);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const filteredTopics = useMemo(() => {
    if (!data) return [];
    if (subjectFilter === "all") return data.topics;
    return data.topics.filter((t) => t.subjectId === subjectFilter);
  }, [data, subjectFilter]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark">
        <div className="h-5 w-48 rounded skeleton-shimmer-soft/50 dark:bg-surface-elevated-dark/50" />
        <div className="mt-4 h-64 rounded-xl skeleton-shimmer-soft/30 dark:bg-surface-elevated-dark/30" />
      </div>
    );
  }

  if (!data || data.topics.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Brain weight="duotone" className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Topic × Bloom&apos;s Taxonomy
            </h2>
            <p className="text-xs text-muted">
              No attempt data for the selected range
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Brain weight="duotone" className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Topic × Bloom&apos;s Taxonomy
            </h2>
            <p className="text-xs text-muted">
              {data.cohortSize} student{data.cohortSize === 1 ? "" : "s"} ·{" "}
              {data.totals.attempts.toLocaleString()} attempts ·{" "}
              {data.totals.accuracy}% overall accuracy
            </p>
          </div>
        </div>

        {subjects.length > 1 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-2 py-1 text-xs dark:border-border-dark dark:bg-surface-elevated-dark">
            <FunnelSimple size={12} className="text-muted" />
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="bg-transparent outline-none"
            >
              <option value="all">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface pb-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted dark:bg-surface-dark">
                Topic
              </th>
              {data.bloomsLevels.map((b) => (
                <th
                  key={b}
                  className="pb-2 px-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted"
                >
                  {BLOOM_LABEL[b] ?? b}
                </th>
              ))}
              <th className="pb-2 px-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
                Topic Avg
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTopics.map((t) => (
              <tr
                key={t.topicId}
                className="transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark/20"
              >
                <td className="sticky left-0 z-10 max-w-[240px] border-b border-border/30 bg-surface py-2 pr-3 dark:border-border-dark/30 dark:bg-surface-dark">
                  <div className="truncate font-medium text-gray-900 dark:text-white">
                    {t.topicName}
                  </div>
                  <div className="truncate text-[11px] text-muted">
                    {t.subjectName}
                    {t.parentChapterName ? ` · ${t.parentChapterName}` : ""}
                  </div>
                </td>
                {data.bloomsLevels.map((b) => {
                  const cell = t.blooms[b] ?? { attempts: 0, correct: 0, accuracy: 0, avgTimeSeconds: 0 };
                  return (
                    <td
                      key={b}
                      className="border-b border-border/30 px-1 py-1.5 text-center dark:border-border-dark/30"
                    >
                      <div
                        title={
                          cell.attempts
                            ? `${cell.correct}/${cell.attempts} correct · ${Math.round(cell.avgTimeSeconds)}s avg`
                            : "No attempts"
                        }
                        className={`mx-auto flex h-10 min-w-[48px] items-center justify-center rounded-md font-mono text-xs font-bold ${cellColor(cell.accuracy, cell.attempts)}`}
                      >
                        {cell.attempts ? `${Math.round(cell.accuracy)}%` : "—"}
                      </div>
                    </td>
                  );
                })}
                <td className="border-b border-border/30 px-1 py-1.5 text-center dark:border-border-dark/30">
                  <span
                    className={`font-mono text-xs font-bold ${
                      t.accuracy >= 70
                        ? "text-success"
                        : t.accuracy >= 50
                          ? "text-warning-fg"
                          : "text-danger"
                    }`}
                  >
                    {t.accuracy}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky left-0 bg-surface pt-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted dark:bg-surface-dark">
                Bloom Totals
              </td>
              {data.bloomsLevels.map((b) => {
                const t = data.bloomsTotals[b];
                return (
                  <td key={b} className="px-1 pt-3 text-center">
                    <div className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">
                      {t ? `${t.accuracy}%` : "—"}
                    </div>
                    <div className="text-[10px] text-muted">{t?.attempts ?? 0}</div>
                  </td>
                );
              })}
              <td className="px-1 pt-3 text-center">
                <div className="font-mono text-xs font-bold text-primary">
                  {data.totals.accuracy}%
                </div>
                <div className="text-[10px] text-muted">{data.totals.attempts}</div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </motion.div>
  );
}
