"use client";

// Multi-row trajectory overlay for /analytics/compare: one line per
// selected row (student or batch) across the included exams, oldest
// first. This is client requirement #2 at cohort level — whether someone
// is trending up or down should be visible at a glance, not read off a
// table row.

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { analyticsTokens } from "@brilliance/ui";
import { ChartTooltip } from "../../_components/chart-tooltip";

const { chartColors } = analyticsTokens;

export interface TrajectorySeries {
  id: string;
  name: string;
  /** Aligned to `labels` — null gaps connect across (absent ≠ zero). */
  values: (number | null)[];
}

export function TrajectoryChart({
  labels,
  series,
}: {
  /** Included exams, chronological — short labels; index-aligned to values. */
  labels: string[];
  series: TrajectorySeries[];
}) {
  const data = labels.map((label, i) => {
    const point: Record<string, string | number | null> = { label };
    for (const s of series) point[s.id] = s.values[i];
    return point;
  });

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, i) => (
            <Line
              key={s.id}
              dataKey={s.id}
              name={s.name}
              type="monotone"
              stroke={chartColors[i % chartColors.length]}
              strokeWidth={2}
              dot={{ r: 2.5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
