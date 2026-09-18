"use client";

import { motion } from "framer-motion";
import { CaretUp, CaretDown, type IconProps } from "@phosphor-icons/react";
import { useAnimatedCounter, fadeUp } from "./shared";
import type { ComponentType } from "react";

interface KpiCardProps {
  label: string;
  value: number;
  suffix?: string;
  icon: ComponentType<IconProps>;
  color: string;
  bg: string;
  trend?: { value: number; direction: "up" | "down" };
  format?: "number" | "percent";
  testId?: string;
}

export function KpiCard({
  label,
  value,
  suffix = "",
  icon: Icon,
  color,
  bg,
  trend,
  format = "number",
  testId,
}: KpiCardProps) {
  const count = useAnimatedCounter(value);
  const displayValue = format === "percent" ? `${count}%` : count.toLocaleString();

  return (
    <motion.div
      variants={fadeUp}
      data-testid={testId}
      className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark"
    >
      {/* Decorative background icon */}
      <Icon
        weight="duotone"
        className={`pointer-events-none absolute -right-3 -top-3 h-24 w-24 ${color} opacity-[0.04]`}
      />

      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
        <Icon weight="duotone" className={`h-5 w-5 ${color}`} />
      </div>

      <div className="mt-3 flex items-end gap-2">
        <span
          data-testid={testId ? `${testId}.value` : undefined}
          className="font-mono text-2xl font-bold tracking-tight"
        >
          {displayValue}
          {suffix}
        </span>
        {trend && (
          <span
            className={`mb-0.5 flex items-center gap-0.5 text-[11px] font-semibold ${
              trend.direction === "up" ? "text-success" : "text-danger"
            }`}
          >
            {trend.direction === "up" ? (
              <CaretUp weight="fill" size={10} />
            ) : (
              <CaretDown weight="fill" size={10} />
            )}
            {Math.abs(trend.value).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </motion.div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark">
      <div className="h-10 w-10 rounded-xl skeleton-shimmer bg-slate-50/70 dark:bg-surface-elevated-dark" />
      <div className="mt-3 h-8 w-24 rounded-lg skeleton-shimmer bg-slate-50/70 dark:bg-surface-elevated-dark" />
      <div className="mt-2 h-3 w-20 rounded skeleton-shimmer bg-slate-50/70 dark:bg-surface-elevated-dark" />
    </div>
  );
}
