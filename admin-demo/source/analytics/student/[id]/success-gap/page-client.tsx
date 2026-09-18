"use client";

// ============================================================
// BRILLIANCE — Admin: Student Success Gap Analysis
// Top 5 strongest vs top 5 weakest topics.
// ============================================================

import { useEffect, useState } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  TrendUp,
  TrendDown,
  Trophy,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  Badge,
  motionVariants,
  analyticsTokens,
} from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";

/* eslint-disable @typescript-eslint/no-explicit-any */

const { color } = analyticsTokens;

// --------------- types ---------------

interface TopicEntry {
  topic: string;
  subject: string;
  mastery: number;
  delta: number;
}

interface SuccessGapData {
  strong: TopicEntry[];
  weak: TopicEntry[];
}

// --------------- subject color ---------------

const subjectColor: Record<string, string> = {
  Physics: "#2563EB",
  Chemistry: "#10B981",
  Mathematics: "#F59E0B",
};

// --------------- topic item ---------------

function TopicItem({
  entry,
  variant,
  index,
}: {
  entry: TopicEntry;
  variant: "strong" | "weak";
  index: number;
}) {
  const isPositive = entry.delta > 0;
  return (
    <motion.div
      variants={motionVariants.fadeUp}
      className="flex items-center gap-3 py-2.5"
    >
      <span
        className="flex-shrink-0 text-sm font-bold text-muted-foreground/50 w-5 text-center"
        style={{ fontFamily: analyticsTokens.type.number }}
      >
        {index + 1}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.topic}</p>
        <Badge
          variant="neutral"
          className="mt-0.5 text-[9px] px-1.5 py-0"
          style={{
            borderColor: `${subjectColor[entry.subject] ?? "#6B7280"}40`,
            color: subjectColor[entry.subject] ?? "#6B7280",
          }}
        >
          {entry.subject}
        </Badge>
      </div>

      <div className="flex-shrink-0 text-right">
        <p
          className="text-base font-bold"
          style={{
            fontFamily: analyticsTokens.type.number,
            color: variant === "strong" ? color.success : color.danger,
          }}
        >
          {entry.mastery}%
        </p>
        <div
          className={`flex items-center justify-end gap-0.5 text-[10px] ${
            isPositive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-500 dark:text-red-400"
          }`}
        >
          {isPositive ? (
            <TrendUp size={10} weight="bold" />
          ) : (
            <TrendDown size={10} weight="bold" />
          )}
          <span style={{ fontFamily: analyticsTokens.type.number }}>
            {isPositive ? "+" : ""}
            {entry.delta}%
          </span>
          <span className="text-muted-foreground ml-0.5">vs last mo.</span>
        </div>
      </div>
    </motion.div>
  );
}

// --------------- component ---------------

export default function AdminStudentSuccessGapPage() {
  const studentId = useUrlSegment(-2);

  const [data, setData] = useState<SuccessGapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/student/${studentId}/success-gap`,
        );
        if (alive && res.success && res.data) setData(res.data);
        else if (alive) setData(null);
      } catch {
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchData();
    return () => {
      alive = false;
    };
  }, [studentId]);

  // Defensive: API can return shapes without `strong`/`weak` arrays
  // (e.g. partial/error response). Hoist safe locals so .length /
  // .reduce never throw — see PR #690 for the broader sub-page sweep.
  const strong = data?.strong ?? [];
  const weak = data?.weak ?? [];
  const avgStrong =
    strong.length > 0
      ? Math.round(strong.reduce((a, b) => a + b.mastery, 0) / strong.length)
      : 0;
  const avgWeak =
    weak.length > 0
      ? Math.round(weak.reduce((a, b) => a + b.mastery, 0) / weak.length)
      : 0;
  const gap = avgStrong - avgWeak;

  return (
    <motion.main
      initial="hidden"
      animate="visible"
      variants={motionVariants.staggerContainer}
      className="mx-auto max-w-5xl px-6 pb-16 pt-8"
    >
      {/* Back link */}
      <motion.div variants={motionVariants.fadeUp} className="mb-6">
        <BackLink
          href={`/analytics/student/${studentId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} weight="bold" />
          Back
        </BackLink>
      </motion.div>

      {/* Header */}
      <motion.header variants={motionVariants.fadeUp} className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
          Gap Analysis
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Strengths vs Weaknesses
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Best and worst topics side by side.
        </p>
      </motion.header>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && (
        <motion.div
          variants={motionVariants.fadeUp}
          className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white p-10 text-center dark:border-border-dark dark:bg-surface-dark"
        >
          <TrendUp size={40} weight="duotone" className="text-blue-400 mb-3" />
          <h3 className="text-base font-semibold">No gap analysis yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Populates once this student has enough attempts across topics for
            the top-5 / bottom-5 split to be meaningful.
          </p>
        </motion.div>
      )}

      {!loading && data && (
        <>
          {/* Gap summary */}
          <motion.div variants={motionVariants.fadeUp} className="mb-5">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Mastery Gap</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Difference between top 5 and bottom 5
                  </p>
                </div>
                <p
                  className="text-3xl font-bold text-blue-600"
                  style={{ fontFamily: analyticsTokens.type.number }}
                >
                  {gap}
                  <span className="text-base font-normal text-muted-foreground ml-0.5">
                    pts
                  </span>
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-3">
            {/* Strong column */}
            <motion.div variants={motionVariants.fadeUp}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-1.5">
                    <Trophy size={16} weight="duotone" className="text-emerald-500" />
                    <CardTitle className="text-xs uppercase tracking-wider text-emerald-600">
                      Strongest
                    </CardTitle>
                  </div>
                  <p
                    className="text-2xl font-bold text-emerald-600 mt-1"
                    style={{ fontFamily: analyticsTokens.type.number }}
                  >
                    {avgStrong}%
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      avg
                    </span>
                  </p>
                </CardHeader>
                <CardContent className="pt-0 divide-y divide-border">
                  {strong.map((entry, i) => (
                    <TopicItem key={entry.topic} entry={entry} variant="strong" index={i} />
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* Weak column */}
            <motion.div variants={motionVariants.fadeUp}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-1.5">
                    <WarningCircle size={16} weight="duotone" className="text-red-500" />
                    <CardTitle className="text-xs uppercase tracking-wider text-red-600">
                      Weakest
                    </CardTitle>
                  </div>
                  <p
                    className="text-2xl font-bold text-red-600 mt-1"
                    style={{ fontFamily: analyticsTokens.type.number }}
                  >
                    {avgWeak}%
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      avg
                    </span>
                  </p>
                </CardHeader>
                <CardContent className="pt-0 divide-y divide-border">
                  {weak.map((entry, i) => (
                    <TopicItem key={entry.topic} entry={entry} variant="weak" index={i} />
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </motion.main>
  );
}
