"use client";

import { motion } from "framer-motion";
import { Buildings } from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { sectionFade, CHART_COLORS } from "./shared";

interface BranchData {
  name: string;
  percentile: number;
  students: number;
  examsConducted?: number;
}

interface Props {
  branches: BranchData[];
}

const BAR_COLORS = [
  CHART_COLORS.primary,
  "#3B82F6",
  "#60A5FA",
  "#93C5FD",
  "#BFDBFE",
];

export function BranchComparisonChart({ branches }: Props) {
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
          <Buildings weight="duotone" className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Branch comparison</h2>
          <p className="text-xs text-muted">Average percentile by branch</p>
        </div>
      </div>

      <div className="mt-6 h-[280px]">
        {branches.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border dark:border-border-dark">
            <p className="text-sm text-muted">No branch data available</p>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={branches}
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border, #e5e7eb)"
              horizontal={false}
            />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "var(--color-muted, #6B7280)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 12, fill: "var(--color-muted, #6B7280)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar
              dataKey="percentile"
              name="Percentile"
              radius={[0, 8, 8, 0]}
              barSize={28}
            >
              {branches.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Legend row */}
      <div className="mt-4 flex flex-wrap gap-4">
        {branches.map((b, i) => (
          <div key={`${b.name}-${i}`} className="flex items-center gap-2 text-xs text-muted">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
            />
            {b.name}
            <span className="font-mono font-semibold text-foreground dark:text-foreground-dark">
              {b.percentile}%ile
            </span>
            <span>({b.students} students)</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
