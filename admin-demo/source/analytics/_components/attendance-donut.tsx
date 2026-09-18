"use client";

import { motion } from "framer-motion";
import { UsersFour } from "@phosphor-icons/react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { sectionFade, ATTENDANCE_COLORS, type AttendanceSummary } from "./shared";

interface Props {
  data: AttendanceSummary;
}

export function AttendanceDonut({ data }: Props) {
  const segments = [
    { name: "Present", value: data.present, color: ATTENDANCE_COLORS.present },
    { name: "Absent", value: data.absent, color: ATTENDANCE_COLORS.absent },
    { name: "Late", value: data.late, color: ATTENDANCE_COLORS.late },
    { name: "Excused", value: data.excused, color: ATTENDANCE_COLORS.excused },
  ].filter((s) => s.value > 0);

  const pct = data.totalStudents > 0
    ? Math.round((data.present / data.totalStudents) * 100)
    : 0;

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
          <UsersFour weight="duotone" className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Today&apos;s attendance</h2>
          <p className="text-xs text-muted">{data.totalStudents} students tracked</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-6">
        {/* Donut chart */}
        <div className="relative h-[180px] w-[180px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={segments}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                strokeWidth={0}
              >
                {segments.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-bold text-foreground dark:text-foreground-dark">
              {pct}%
            </span>
            <span className="text-[10px] text-muted">present</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-1 flex-col gap-3">
          {segments.map((s) => (
            <div key={s.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-xs text-muted">{s.name}</span>
              </div>
              <span className="font-mono text-sm font-semibold">{s.value}</span>
            </div>
          ))}
          {data.facultyTotal > 0 && (
            <div className="mt-1 border-t border-border pt-2 dark:border-border-dark">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Faculty present</span>
                <span className="font-mono font-semibold text-foreground dark:text-foreground-dark">
                  {data.facultyPresent}/{data.facultyTotal}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
