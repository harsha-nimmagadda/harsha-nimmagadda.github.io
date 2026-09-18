"use client";

import { motion } from "framer-motion";
import { Warning } from "@phosphor-icons/react";
import { sectionFade, fadeUp, CHART_COLORS } from "./shared";

interface AtRiskStudent {
  id: string;
  name: string;
  branch: string;
  batch: string;
  percentile: number;
  scores: number[];
  daysSinceLogin: number;
  severity: string;
}

interface Props {
  students: AtRiskStudent[];
}

function MiniSparkline({ values, width = 64, height = 24 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  const trending = values[values.length - 1] >= values[0];
  const color = trending ? CHART_COLORS.success : CHART_COLORS.danger;

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {values.length > 0 && (
        <circle
          cx={(values.length - 1) / Math.max(values.length - 1, 1) * width}
          cy={height - ((values[values.length - 1] - min) / range) * (height - 4) - 2}
          r={2.5}
          fill={color}
        />
      )}
    </svg>
  );
}

export function AtRiskStudentsPanel({ students }: Props) {

  return (
    <motion.div
      variants={sectionFade}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger/10">
          <Warning weight="duotone" className="h-5 w-5 text-danger" />
        </div>
        <div>
          <h2 className="text-base font-semibold">At-risk students</h2>
          <p className="text-xs text-muted">
            {students.length} student{students.length !== 1 ? "s" : ""} need attention
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {students.length === 0 && (
          <p
            data-testid="analytics.overview.atrisk.empty"
            className="col-span-full py-8 text-center text-sm text-muted"
          >
            No at-risk students detected
          </p>
        )}
        {students.slice(0, 9).map((s, i) => {
          const isCritical = s.severity === "critical";
          const rowId = s.id || `at-risk-${i}`;
          return (
            <motion.div
              key={rowId}
              variants={fadeUp}
              data-testid={`analytics.overview.atrisk.row.${rowId}`}
              className={`rounded-xl border bg-surface p-4 shadow-xs dark:bg-surface-dark ${
                isCritical
                  ? "border-l-4 border-l-danger border-t-border border-r-border border-b-border dark:border-t-border-dark dark:border-r-border-dark dark:border-b-border-dark"
                  : "border-l-4 border-l-warning border-t-border border-r-border border-b-border dark:border-t-border-dark dark:border-r-border-dark dark:border-b-border-dark"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p
                    data-testid={`analytics.overview.atrisk.row.${rowId}.name`}
                    className="truncate text-sm font-semibold"
                  >
                    {s.name}
                  </p>
                  <p
                    data-testid={`analytics.overview.atrisk.row.${rowId}.meta`}
                    className="text-[11px] text-muted"
                  >
                    {s.branch} &middot; {s.batch}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    isCritical
                      ? "bg-danger/10 text-danger"
                      : "bg-warning/10 text-warning"
                  }`}
                >
                  {s.severity}
                </span>
              </div>

              <div className="mt-3 flex items-end justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-[10px] text-muted">Percentile</p>
                    <span
                      data-testid={`analytics.overview.atrisk.row.${rowId}.score`}
                      className="font-mono text-lg font-bold text-danger"
                    >
                      {s.percentile}
                    </span>
                  </div>
                  {s.scores.length >= 2 && (
                    <MiniSparkline values={s.scores} />
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted">Last login</p>
                  <span
                    className={`font-mono text-sm font-semibold ${
                      s.daysSinceLogin > 10
                        ? "text-danger"
                        : s.daysSinceLogin > 5
                          ? "text-warning"
                          : "text-muted"
                    }`}
                  >
                    {s.daysSinceLogin}d ago
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
