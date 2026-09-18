"use client";

import type { TooltipProps } from "recharts";

export function ChartTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-lg dark:border-border-dark dark:bg-surface-dark">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="mt-1 font-mono text-sm font-bold"
          style={{ color: entry.color }}
        >
          {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
          <span className="ml-1.5 font-sans text-[11px] font-normal text-muted">
            {entry.name}
          </span>
        </p>
      ))}
    </div>
  );
}
