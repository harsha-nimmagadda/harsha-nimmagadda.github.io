"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { ChartLineUp } from "@phosphor-icons/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { sectionFade, CHART_COLORS, type TrendPoint } from "./shared";

interface Props {
  data: TrendPoint[];
  daysTestID?: string;
}

export function PerformanceTrendChart({ data, daysTestID }: Props) {
  const uid = useId();
  const gradBlueId = `gradientBlue-${uid}`;
  const gradGreenId = `gradientGreen-${uid}`;

  return (
    <motion.div
      variants={sectionFade}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <ChartLineUp weight="duotone" className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold">Performance trend</h2>
          <p className="text-xs text-muted">
            Average score and exams conducted over the last 12 months
          </p>
        </div>
        {data.length > 0 && daysTestID ? (
          <p data-testid={daysTestID} className="text-xs text-muted">
            {data.length} month{data.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      <div className="mt-6 h-[320px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border dark:border-border-dark">
            <p className="text-sm text-muted">No performance data available for this period</p>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id={gradBlueId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
                <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={gradGreenId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.1} />
                <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border, #e5e7eb)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--color-muted, #6B7280)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "var(--color-muted, #6B7280)" }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              label={{ value: "Avg Score %", angle: -90, position: "insideLeft", fontSize: 10, fill: "#9CA3AF", dx: 16 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "var(--color-muted, #6B7280)" }}
              axisLine={false}
              tickLine={false}
              label={{ value: "Exams", angle: 90, position: "insideRight", fontSize: 10, fill: "#9CA3AF", dx: -16 }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="avgScore"
              name="Avg Score %"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              fill={`url(#${gradBlueId})`}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2 }}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="totalExams"
              name="Exams"
              stroke={CHART_COLORS.success}
              strokeWidth={2}
              fill={`url(#${gradGreenId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}

export function PerformanceTrendSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg skeleton-shimmer bg-slate-50/70 dark:bg-surface-elevated-dark" />
        <div className="space-y-1.5">
          <div className="h-4 w-32 rounded skeleton-shimmer bg-slate-50/70 dark:bg-surface-elevated-dark" />
          <div className="h-3 w-56 rounded skeleton-shimmer bg-slate-50/70 dark:bg-surface-elevated-dark" />
        </div>
      </div>
      <div className="mt-6 h-[320px] rounded-xl skeleton-shimmer bg-slate-50/70 dark:bg-surface-elevated-dark" />
    </div>
  );
}
