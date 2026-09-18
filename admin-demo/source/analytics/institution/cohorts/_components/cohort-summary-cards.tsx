"use client";

// ============================================================
// Cohort Summary Cards — one card per cohort with live KPIs
// ============================================================

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  TrendUp,
  TrendDown,
  Minus,
  Crown,
  Warning,
  ArrowRight,
} from "@phosphor-icons/react";
import {
  Card,
  CardContent,
  Badge,
  motionVariants,
  analyticsTokens,
} from "@brilliance/ui";

const { type: typeTokens } = analyticsTokens;

export interface CohortSummary {
  cohortId: string;
  cohortName: string;
  academicYear: string;
  targetExam: string;
  currentSize: number;
  latestAvgPct: number | null;
  velocity: number | null;
  topScorer: { studentId: string; name: string; avgPct: number } | null;
  atRiskCount: number;
}

export function CohortSummaryCards({ cohorts }: { cohorts: CohortSummary[] }) {
  if (cohorts.length === 0) {
    return null;
  }
  return (
    <motion.div
      variants={motionVariants.fadeUp}
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {cohorts.map((c) => (
        <CohortCard key={c.cohortId} cohort={c} />
      ))}
    </motion.div>
  );
}

function CohortCard({ cohort }: { cohort: CohortSummary }) {
  const VelocityIcon =
    cohort.velocity === null ? Minus : cohort.velocity > 0 ? TrendUp : cohort.velocity < 0 ? TrendDown : Minus;
  const velocityColor =
    cohort.velocity === null
      ? "text-muted"
      : cohort.velocity > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : cohort.velocity < 0
          ? "text-red-600 dark:text-red-400"
          : "text-muted";

  return (
    <Card hoverable={false} padding="md" data-testid={`analytics-cohorts.list.row.${cohort.cohortId}`}>
      <CardContent className="space-y-4 pt-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              data-testid={`analytics-cohorts.list.row.${cohort.cohortId}.name`}
              className="truncate text-base font-semibold text-foreground"
            >
              {cohort.cohortName}
            </p>
            <p
              data-testid={`analytics-cohorts.list.row.${cohort.cohortId}.meta`}
              className="mt-0.5 text-[11px] uppercase tracking-wider text-muted"
            >
              {cohort.targetExam} · {cohort.academicYear}
            </p>
          </div>
          <Badge variant="info" size="sm">
            <Users size={12} weight="bold" />
            <span data-testid={`analytics-cohorts.list.row.${cohort.cohortId}.size`}>
              {cohort.currentSize}
            </span>
          </Badge>
        </div>

        {/* Latest avg + velocity */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">
              Latest avg
            </p>
            <p
              data-testid={`analytics-cohorts.list.row.${cohort.cohortId}.avg`}
              className="mt-0.5 text-3xl font-bold text-foreground"
              style={{ fontFamily: typeTokens.number }}
            >
              {cohort.latestAvgPct !== null
                ? `${cohort.latestAvgPct}%`
                : "—"}
            </p>
          </div>
          <div className={`flex items-center gap-1 text-sm font-semibold ${velocityColor}`}>
            <VelocityIcon size={14} weight="bold" />
            <span
              data-testid={`analytics-cohorts.list.row.${cohort.cohortId}.velocity`}
              style={{ fontFamily: typeTokens.number }}
            >
              {cohort.velocity === null
                ? "—"
                : `${cohort.velocity > 0 ? "+" : ""}${cohort.velocity} pts`}
            </span>
          </div>
        </div>

        {/* Top scorer + at-risk row */}
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 dark:border-border-dark">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted">
              <Crown size={11} weight="duotone" className="text-amber-500" />
              Top scorer
            </p>
            {cohort.topScorer ? (
              <Link
                href={`/analytics/student/${cohort.topScorer.studentId}`}
                data-testid={`analytics-cohorts.list.row.${cohort.cohortId}.top_scorer`}
                className="mt-1 block truncate text-sm font-medium text-primary hover:underline"
                title={`${cohort.topScorer.name} · ${cohort.topScorer.avgPct}%`}
              >
                {cohort.topScorer.name}{" "}
                <span className="font-mono text-xs text-muted">
                  {cohort.topScorer.avgPct}%
                </span>
              </Link>
            ) : (
              <p
                data-testid={`analytics-cohorts.list.row.${cohort.cohortId}.top_scorer`}
                className="mt-1 text-sm text-muted"
              >
                —
              </p>
            )}
          </div>
          <div>
            <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted">
              <Warning size={11} weight="duotone" className="text-red-500" />
              At-risk
            </p>
            <p
              data-testid={`analytics-cohorts.list.row.${cohort.cohortId}.at_risk`}
              className="mt-1 text-sm font-semibold"
              style={{ fontFamily: typeTokens.number }}
            >
              {cohort.atRiskCount > 0 ? (
                <span className="text-red-600 dark:text-red-400">
                  {cohort.atRiskCount}
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">
                  0
                </span>
              )}
              <span className="ml-1 text-xs font-normal text-muted">
                {cohort.atRiskCount === 1 ? "student" : "students"}
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
