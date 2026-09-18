"use client";

import { useState, useEffect, useRef } from "react";
import type { Variants } from "framer-motion";

// ── Motion Variants ────────────────────────────────────────
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export const sectionFade: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

// ── Animated Counter Hook ──────────────────────────────────
export function useAnimatedCounter(end: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setCount(0);
    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end, duration]);

  return count;
}

// ── Types ──────────────────────────────────────────────────
export type DatePreset = "all" | "month" | "quarter" | "half_year" | "year";

export const presetLabel: Record<DatePreset, string> = {
  all: "All time",
  month: "Last month",
  quarter: "Last quarter",
  half_year: "Last 6 months",
  year: "Last year",
};

export function rangeForPreset(preset: DatePreset): { from: string | null; to: string | null } {
  if (preset === "all") return { from: null, to: null };
  const to = new Date();
  const from = new Date(to);
  if (preset === "month") from.setMonth(from.getMonth() - 1);
  else if (preset === "quarter") from.setMonth(from.getMonth() - 3);
  else if (preset === "half_year") from.setMonth(from.getMonth() - 6);
  else from.setFullYear(from.getFullYear() - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export interface InstitutionData {
  totalStudents: number;
  totalExams: number;
  avgPercentile: number;
  activeBatches: number;
  branches: Array<{ branchId?: string; name: string; percentile: number; students: number; examsConducted?: number }>;
  topBatches: Array<{
    rank: number;
    batchId: string;
    name: string;
    branch: string;
    avgPercentile: number;
    students: number;
  }>;
  facultyEffectiveness: Array<{ name: string; subject: string; delta: string; batches: number }>;
  atRiskStudents: Array<{
    id: string;
    name: string;
    branch: string;
    batch: string;
    percentile: number;
    scores: number[];
    daysSinceLogin: number;
    severity: string;
  }>;
}

export interface TrendPoint {
  month: string;
  avgScore: number;
  totalExams: number;
  totalSubmissions: number;
}

export interface AttendanceSummary {
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number;
  facultyPresent: number;
  facultyTotal: number;
}

export interface BatchOption {
  batchId: string;
  batchName: string;
  branchId?: string;
  targetExam?: string | null;
}

export interface BloomsRow {
  bloomsLevel: string;
  topicName: string;
  subjectName: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
}

// ── Chart color constants ──────────────────────────────────
export const CHART_COLORS = {
  primary: "#2563EB",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  muted: "#9CA3AF",
} as const;

export const ATTENDANCE_COLORS: Record<string, string> = {
  present: "#10B981",
  absent: "#EF4444",
  late: "#F59E0B",
  excused: "#9CA3AF",
};
