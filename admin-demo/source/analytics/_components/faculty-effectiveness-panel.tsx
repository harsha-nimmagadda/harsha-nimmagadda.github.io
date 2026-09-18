"use client";

import { motion } from "framer-motion";
import { ChalkboardTeacher } from "@phosphor-icons/react";
import { sectionFade, fadeUp } from "./shared";

interface Faculty {
  name: string;
  subject: string;
  delta: string;
  batches: number;
}

interface Props {
  faculty: Faculty[];
}

function parseDelta(delta: string): { value: number; positive: boolean; hasData: boolean } {
  if (!delta || delta === "--" || delta === "0" || delta === "+0%") {
    return { value: 0, positive: true, hasData: false };
  }
  const n = parseFloat(delta.replace(/[^0-9.\-]/g, ""));
  if (isNaN(n) || n === 0) return { value: 0, positive: true, hasData: false };
  return { value: Math.abs(n), positive: !delta.startsWith("-"), hasData: true };
}

export function FacultyEffectivenessPanel({ faculty }: Props) {

  return (
    <motion.div
      variants={sectionFade}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-500/10">
          <ChalkboardTeacher weight="duotone" className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Faculty effectiveness</h2>
          <p className="text-xs text-muted">Score impact by teacher</p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {faculty.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">No faculty data available</p>
        )}
        {faculty.slice(0, 8).map((f, i) => {
          const d = parseDelta(f.delta);
          return (
            <motion.div
              key={`${f.name}-${f.subject}-${i}`}
              variants={fadeUp}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark"
            >
              {/* Avatar */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {f.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-[11px] text-muted">
                  {f.subject} &middot; {f.batches} batch{f.batches !== 1 ? "es" : ""}
                </p>
              </div>

              {/* Delta indicator */}
              <div className="shrink-0 text-right">
                {d.hasData ? (
                  <>
                    <div className="flex items-center gap-1">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          d.positive ? "bg-success" : "bg-danger"
                        }`}
                      />
                      <span
                        className={`font-mono text-sm font-bold ${
                          d.positive ? "text-success" : "text-danger"
                        }`}
                      >
                        {f.delta}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted">avg percentile</p>
                  </>
                ) : (
                  <span className="text-xs text-muted">No exams yet</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
