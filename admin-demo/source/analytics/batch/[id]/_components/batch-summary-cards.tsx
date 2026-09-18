"use client";

// ============================================================
// Batch Summary Cards — top-of-page KPIs for one batch
// ============================================================
// Four small cards in a row: size, latest avg, top scorer, at-risk
// count. Hits the /api/v1/analytics/v3/batch/:id/summary endpoint.

import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  TrendUp,
  Crown,
  Warning,
  ArrowRight,
} from "@phosphor-icons/react";
import {
  Card,
  CardContent,
  Skeleton,
  motionVariants,
  analyticsTokens,
} from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";
import { InfoTip } from "@/components/info-tip";

const { type: typeTokens } = analyticsTokens;

const TOOLTIPS = {
  students:
    "Total active students in this batch. Counts students currently assigned to the batch (excludes transferred / graduated).",
  avg30d:
    "Average exam percentage across all submissions in the last 30 days. Uses the `percentage` column on exam_submissions (auto-scored at submit time). Shows `—` when no exams have been taken in the window.",
  topScorer:
    "Student with the highest rolling average across the last 5 exams. Links to their profile. A single great exam can't game the ranking — must be consistent across multiple.",
  atRisk:
    "Count of students flagged by the at-risk classifier. Click to see the full list. A student qualifies if their latest exam is <40%, rolling avg is <50%, or a declining trend is detected across their last 2–3 exams.",
} as const;


function LabelWithTip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <InfoTip content={tooltip} />
    </div>
  );
}

interface BatchSummary {
  batchId: string;
  batchName: string;
  targetExam: string | null;
  academicYear: string | null;
  currentSize: number;
  latestAvgPct: number | null;
  priorAvgPct: number | null;
  velocity: number | null;
  last30SampleSize: number;
  topScorer: { studentId: string; name: string; avgPct: number } | null;
  atRiskCount: number;
}

export function BatchSummaryCards({ batchId }: { batchId: string }) {
  const query = useQuery({
    queryKey: ["batch-summary", batchId],
    queryFn: async () => {
      const res = await apiClient.get<BatchSummary>(
        `/api/v1/analytics/v3/batch/${batchId}/summary`,
      );
      if (!res.success) throw new Error(res.error || "Failed to load summary");
      return res.data as BatchSummary;
    },
  });

  if (query.isLoading) {
    return (
      <motion.div
        variants={motionVariants.fadeUp}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </motion.div>
    );
  }
  if (query.error) {
    return null;
  }
  const data = query.data;
  if (!data) return null;

  return (
    <motion.div
      variants={motionVariants.fadeUp}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <Tile
        icon={Users}
        iconColor="text-sky-600 dark:text-sky-400"
        label="Students"
        tooltip={TOOLTIPS.students}
        value={data.currentSize.toString()}
        sub={
          [data.targetExam, data.academicYear].filter(Boolean).join(" · ") ||
          "Active"
        }
      />
      <Tile
        icon={TrendUp}
        iconColor="text-primary"
        label="Avg (last 30d)"
        tooltip={TOOLTIPS.avg30d}
        value={data.latestAvgPct !== null ? `${data.latestAvgPct}%` : "—"}
        sub={
          data.last30SampleSize > 0
            ? `${data.last30SampleSize} submission${data.last30SampleSize === 1 ? "" : "s"}`
            : "No recent submissions"
        }
      />
      <TileTopScorer top={data.topScorer} />
      <TileAtRisk batchId={batchId} count={data.atRiskCount} />
    </motion.div>
  );
}

function Tile({
  icon: Icon,
  iconColor,
  label,
  tooltip,
  value,
  sub,
  valueClass,
}: {
  icon: any;
  iconColor: string;
  label: string;
  tooltip: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <Card hoverable={false} padding="md">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <LabelWithTip label={label} tooltip={tooltip} />
          <Icon weight="duotone" className={`h-4 w-4 ${iconColor}`} />
        </div>
        <p
          className={`mt-2 text-2xl font-bold ${valueClass ?? "text-foreground"}`}
          style={{ fontFamily: typeTokens.number }}
        >
          {value}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted">{sub}</p>
      </CardContent>
    </Card>
  );
}

function TileTopScorer({
  top,
}: {
  top: { studentId: string; name: string; avgPct: number } | null;
}) {
  return (
    <Card hoverable={false} padding="md">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <LabelWithTip label="Top scorer" tooltip={TOOLTIPS.topScorer} />
          <Crown weight="duotone" className="h-4 w-4 text-amber-500" />
        </div>
        {top ? (
          <Link
            href={`/analytics/student/${top.studentId}`}
            className="group mt-2 block"
          >
            <p
              className="text-base font-semibold text-foreground group-hover:text-primary"
              title={top.name}
            >
              {top.name}
            </p>
            <p
              className="mt-0.5 font-mono text-xs text-amber-600 dark:text-amber-400"
              style={{ fontFamily: typeTokens.number }}
            >
              {top.avgPct}% avg
            </p>
          </Link>
        ) : (
          <>
            <p
              className="mt-2 text-base font-semibold text-muted"
              style={{ fontFamily: typeTokens.number }}
            >
              —
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              Need 2+ submitted exams
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TileAtRisk({ batchId, count }: { batchId: string; count: number }) {
  const tone =
    count === 0
      ? "text-emerald-600 dark:text-emerald-400"
      : count < 5
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";
  return (
    <Card hoverable={false} padding="md">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <LabelWithTip label="At-risk" tooltip={TOOLTIPS.atRisk} />
          <Warning weight="duotone" className="h-4 w-4 text-red-500" />
        </div>
        <p
          className={`mt-2 text-2xl font-bold ${tone}`}
          style={{ fontFamily: typeTokens.number }}
        >
          {count}
        </p>
        {count > 0 ? (
          <Link
            href={`/analytics/batch/${batchId}/at-risk`}
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            Review students
            <ArrowRight size={10} weight="bold" />
          </Link>
        ) : (
          <p className="mt-0.5 text-[11px] text-muted">All clear</p>
        )}
      </CardContent>
    </Card>
  );
}
