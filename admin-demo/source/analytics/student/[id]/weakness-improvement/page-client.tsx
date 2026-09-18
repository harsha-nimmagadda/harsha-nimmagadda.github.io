"use client";

// ============================================================
// BRILLIANCE — Admin: Student Weakness Improvement Timeline
// Before/after cards showing topics that improved over 30 days.
// ============================================================

import { useEffect, useState } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, TrendUp, Target } from "@phosphor-icons/react";
import {
  Card,
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

type Level = "weak" | "developing" | "proficient" | "mastered";

interface ImprovementTopic {
  topic: string;
  subject: string;
  before: { level: Level; accuracy: number };
  after: { level: Level; accuracy: number };
  questionsAttempted: number;
  daysActive: number;
}

interface WeaknessData {
  topics: ImprovementTopic[];
}

// --------------- level config ---------------

const levelConfig: Record<
  Level,
  { bg: string; text: string; dot: string; label: string }
> = {
  weak: {
    bg: "bg-red-500/15",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
    label: "Weak",
  },
  developing: {
    bg: "bg-amber-500/15",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    label: "Developing",
  },
  proficient: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    label: "Proficient",
  },
  mastered: {
    bg: "bg-emerald-600/20",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-600",
    label: "Mastered",
  },
};

// --------------- component ---------------

export default function AdminStudentWeaknessImprovementPage() {
  const studentId = useUrlSegment(-2);

  const [data, setData] = useState<WeaknessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/student/${studentId}/weakness-improvement`,
        );
        if (alive && res.success && res.data) {
          setData(res.data);
        } else if (alive) {
          setData(null);
        }
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
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">
          Progress
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Topic Progress
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For each topic with at least two attempts, we compare the student&apos;s
          early attempts to their recent attempts. Sorted by biggest gain first.
        </p>
      </motion.header>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && (!data || data.topics.length === 0) && (
        <motion.div
          variants={motionVariants.fadeUp}
          className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white p-10 text-center dark:border-border-dark dark:bg-surface-dark"
        >
          <Target size={40} weight="duotone" className="text-blue-400 mb-3" />
          <h3 className="text-base font-semibold">Not enough attempts yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Topic-level progress appears once the student has attempted the same
            topic at least twice. Populates as they work through more exams and
            practice sets.
          </p>
        </motion.div>
      )}

      {/* Topic cards */}
      {!loading && data && data.topics.length > 0 && (
        <motion.div
          variants={motionVariants.staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {data.topics.map((topic) => {
            const beforeCfg = levelConfig[topic.before.level];
            const afterCfg = levelConfig[topic.after.level];
            const delta = topic.after.accuracy - topic.before.accuracy;

            return (
              <motion.div key={topic.topic} variants={motionVariants.fadeUp}>
                <Card>
                  <CardContent className="p-4">
                    {/* Topic name + subject badge */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-sm">{topic.topic}</h3>
                        <Badge variant="neutral" className="mt-1 text-[10px]">
                          {topic.subject}
                        </Badge>
                      </div>
                      <div
                        className={`flex items-center gap-1 ${
                          delta > 0
                            ? "text-emerald-600"
                            : delta < 0
                              ? "text-red-600"
                              : "text-muted-foreground"
                        }`}
                      >
                        <TrendUp
                          size={14}
                          weight="bold"
                          className={delta < 0 ? "rotate-180" : ""}
                        />
                        <span
                          className="text-sm font-bold"
                          style={{ fontFamily: analyticsTokens.type.number }}
                        >
                          {delta > 0 ? "+" : ""}
                          {Math.round(delta)}%
                        </span>
                      </div>
                    </div>

                    {/* Before -> After */}
                    <div className="flex items-center gap-3">
                      <div className={`flex-1 rounded-lg p-2.5 ${beforeCfg.bg}`}>
                        <p className="text-[10px] text-muted-foreground mb-0.5">
                          Early attempts
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${beforeCfg.dot}`} />
                          <span className={`text-xs font-medium ${beforeCfg.text}`}>
                            {beforeCfg.label}
                          </span>
                        </div>
                        <p
                          className={`text-lg font-bold mt-0.5 ${beforeCfg.text}`}
                          style={{ fontFamily: analyticsTokens.type.number }}
                        >
                          {topic.before.accuracy}%
                        </p>
                      </div>

                      <div className="flex-shrink-0">
                        <ArrowRight
                          size={20}
                          weight="bold"
                          className="text-muted-foreground"
                        />
                      </div>

                      <div className={`flex-1 rounded-lg p-2.5 ${afterCfg.bg}`}>
                        <p className="text-[10px] text-muted-foreground mb-0.5">
                          Recent attempts
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${afterCfg.dot}`} />
                          <span className={`text-xs font-medium ${afterCfg.text}`}>
                            {afterCfg.label}
                          </span>
                        </div>
                        <p
                          className={`text-lg font-bold mt-0.5 ${afterCfg.text}`}
                          style={{ fontFamily: analyticsTokens.type.number }}
                        >
                          {topic.after.accuracy}%
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="h-1.5 w-full rounded-full bg-slate-50/70 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${topic.after.accuracy}%` }}
                          transition={{
                            duration: 0.8,
                            delay: 0.2,
                            ease: [0.2, 0, 0, 1],
                          }}
                          className="h-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${color.danger}80, ${color.success})`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground">
                      <span>
                        <span
                          className="font-medium text-foreground"
                          style={{ fontFamily: analyticsTokens.type.number }}
                        >
                          {topic.questionsAttempted}
                        </span>{" "}
                        questions
                      </span>
                      <span>
                        <span
                          className="font-medium text-foreground"
                          style={{ fontFamily: analyticsTokens.type.number }}
                        >
                          {topic.daysActive}
                        </span>{" "}
                        active days
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.main>
  );
}
