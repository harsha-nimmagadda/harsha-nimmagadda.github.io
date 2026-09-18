"use client";

import { motion } from "framer-motion";
import { TreeStructure } from "@phosphor-icons/react";
import { sectionFade, type BloomsRow } from "./shared";

interface Props {
  rows: BloomsRow[];
}

const BLOOM_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

function accuracyColor(acc: number): string {
  if (acc >= 80) return "bg-success/20 text-success";
  if (acc >= 60) return "bg-primary/15 text-primary";
  if (acc >= 40) return "bg-warning/20 text-warning";
  return "bg-danger/15 text-danger";
}

function accuracyBgOnly(acc: number): string {
  if (acc >= 80) return "bg-success/25";
  if (acc >= 60) return "bg-primary/20";
  if (acc >= 40) return "bg-warning/25";
  return "bg-danger/20";
}

export function BloomsHeatmap({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <motion.div
        variants={sectionFade}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
            <TreeStructure weight="duotone" className="h-5 w-5 text-success" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Bloom &times; Topic</h2>
            <p className="text-xs text-muted">Accuracy by cognitive level and syllabus node</p>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-muted">No attempts in this range.</p>
      </motion.div>
    );
  }

  // Build heatmap matrix: blooms (rows) x topics (columns)
  const topics = [...new Set(rows.map((r) => r.topicName))].slice(0, 10);
  const bloomsPresent = [...new Set(rows.map((r) => r.bloomsLevel.toLowerCase()))];
  const bloomOrder = BLOOM_ORDER.filter((b) => bloomsPresent.includes(b));

  // If we have enough data for a proper grid
  const isGridViable = bloomOrder.length >= 2 && topics.length >= 2;

  // Create lookup map
  const lookup = new Map<string, BloomsRow>();
  for (const r of rows) {
    lookup.set(`${r.bloomsLevel.toLowerCase()}-${r.topicName}`, r);
  }

  return (
    <motion.div
      variants={sectionFade}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
          <TreeStructure weight="duotone" className="h-5 w-5 text-success" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Bloom &times; Topic</h2>
          <p className="text-xs text-muted">Accuracy by cognitive level and syllabus node</p>
        </div>
      </div>

      {isGridViable ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="pb-2 pr-3 text-left font-medium text-muted">Bloom Level</th>
                {topics.map((t) => (
                  <th
                    key={t}
                    className="max-w-[100px] truncate pb-2 px-1.5 text-center font-medium text-muted"
                    title={t}
                  >
                    {t.length > 12 ? t.slice(0, 12) + "..." : t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloomOrder.map((bloom) => (
                <tr key={bloom}>
                  <td className="py-1.5 pr-3 capitalize font-medium text-foreground dark:text-foreground-dark">
                    {bloom}
                  </td>
                  {topics.map((topic) => {
                    const cell = lookup.get(`${bloom}-${topic}`);
                    if (!cell) {
                      return (
                        <td key={topic} className="px-1.5 py-1.5 text-center">
                          <span className="inline-block rounded-lg bg-slate-50/70 px-2 py-1 text-[10px] text-muted dark:bg-surface-elevated-dark">
                            --
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={topic} className="px-1.5 py-1.5 text-center">
                        <span
                          className={`inline-block rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold ${accuracyColor(cell.accuracy)}`}
                          title={`${cell.correctAnswers}/${cell.totalQuestions} correct`}
                        >
                          {cell.accuracy}%
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Color legend */}
          <div className="mt-3 flex items-center gap-3 text-[10px] text-muted">
            <span>Accuracy:</span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded bg-danger/20" /> &lt;40%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded bg-warning/25" /> 40-60%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded bg-primary/20" /> 60-80%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded bg-success/25" /> &gt;80%
            </span>
          </div>
        </div>
      ) : (
        /* Fallback: simple table for sparse data */
        <div className="mt-5 max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted dark:border-border-dark">
                <th className="pb-2 pr-2">Bloom</th>
                <th className="pb-2 pr-2">Topic</th>
                <th className="pb-2 pr-2">Subject</th>
                <th className="pb-2 text-right">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 15).map((r, i) => (
                <tr
                  key={`${r.bloomsLevel}-${r.topicName}-${i}`}
                  className="border-b border-border/40 dark:border-border-dark/40"
                >
                  <td className="py-2 pr-2 capitalize">{r.bloomsLevel}</td>
                  <td className="max-w-[140px] truncate py-2 pr-2">{r.topicName}</td>
                  <td className="py-2 pr-2 text-muted">{r.subjectName}</td>
                  <td className="py-2 text-right">
                    <span className={`rounded-md px-1.5 py-0.5 font-mono font-bold ${accuracyColor(r.accuracy)}`}>
                      {r.accuracy}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
