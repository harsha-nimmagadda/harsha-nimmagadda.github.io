"use client";

// ============================================================
// BRILLIANCE — Admin: Student Knowledge Gap Heatmap
// Topic x Difficulty mastery matrix with colored cells.
// Thin wrapper for admin/faculty to view a specific student.
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { useUrlSegment } from "@/lib/use-url-segment";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X } from "@phosphor-icons/react";
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

const { color } = analyticsTokens;

// --------------- types ---------------

type MasteryLevel = "mastered" | "developing" | "weak" | "untested";

interface CellData {
  subject: string;
  topic: string;
  difficulty: string;
  mastery: MasteryLevel;
  accuracy: number;
  attempted: number;
  total: number;
}

interface SubjectGroup {
  name: string;
  topics: string[];
}

interface HeatmapData {
  subjects: SubjectGroup[];
  difficulties: string[];
  cells: CellData[];
}

const MASTERY_STATES: MasteryLevel[] = [
  "mastered",
  "developing",
  "weak",
  "untested",
];

// --------------- v3 → page-shape transformer ---------------

/** Capitalize a single word ("easy" → "Easy"). */
function capitalize(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** Map an accuracy % (0-100) to one of the four mastery buckets. */
function masteryFromAccuracy(accuracy: number, attempted: number): MasteryLevel {
  if (attempted === 0) return "untested";
  if (accuracy >= 80) return "mastered";
  if (accuracy >= 50) return "developing";
  return "weak";
}

/**
 * Adapt the v3 heatmap response (`{ subjects: [{ name, topics: [{ name,
 * difficulties: [{ level, mastery, attempted }] }] }] }`) into the grouped
 * shape this page renders. Subjects become section headers; topics live
 * unprefixed under their subject. Returns null when the response shape
 * doesn't look right.
 */
function transformV3Heatmap(raw: any): HeatmapData | null {
  if (!raw || !Array.isArray(raw.subjects)) return null;

  const cells: CellData[] = [];
  const diffSet = new Set<string>();
  const subjectMap = new Map<string, Set<string>>(); // subject → set of topic names

  for (const subject of raw.subjects) {
    if (!subject || !Array.isArray(subject.topics)) continue;
    const subjName = subject.name ?? "Subject";
    if (!subjectMap.has(subjName)) subjectMap.set(subjName, new Set());
    const topicSet = subjectMap.get(subjName)!;
    for (const topic of subject.topics) {
      if (!topic || !Array.isArray(topic.difficulties)) continue;
      const topicName = topic.name ?? "General";
      topicSet.add(topicName);
      for (const cell of topic.difficulties) {
        if (!cell) continue;
        const diffLabel = capitalize(String(cell.level ?? "unknown"));
        const attempted = Number(cell.attempted ?? 0);
        const accuracy = Number(cell.mastery ?? 0); // backend's "mastery" is already 0-100 accuracy %
        diffSet.add(diffLabel);
        cells.push({
          subject: subjName,
          topic: topicName,
          difficulty: diffLabel,
          mastery: masteryFromAccuracy(accuracy, attempted),
          accuracy: Math.round(accuracy),
          attempted,
          total: attempted, // we don't have a separate total — show attempted
        });
      }
    }
  }

  if (cells.length === 0) {
    return { subjects: [], difficulties: [], cells: [] };
  }

  // Stable difficulty order — push easy/medium/hard/advanced/olympiad first,
  // then any extras alphabetically.
  const DIFF_ORDER = ["Easy", "Medium", "Hard", "Advanced", "Olympiad"];
  const difficulties = [
    ...DIFF_ORDER.filter((d) => diffSet.has(d)),
    ...[...diffSet].filter((d) => !DIFF_ORDER.includes(d)).sort(),
  ];

  // Sort subjects by name; topics inside each subject also alphabetically.
  const subjects: SubjectGroup[] = [...subjectMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, topicSet]) => ({
      name,
      topics: [...topicSet].sort((a, b) => a.localeCompare(b)),
    }));

  return { subjects, difficulties, cells };
}

// --------------- color map ---------------

const masteryConfig: Record<
  MasteryLevel,
  { bg: string; text: string; label: string; border: string }
> = {
  mastered: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    label: "Mastered",
    border: "border-emerald-500/30",
  },
  developing: {
    bg: "bg-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    label: "Developing",
    border: "border-amber-500/30",
  },
  weak: {
    bg: "bg-red-500/20",
    text: "text-red-600 dark:text-red-400",
    label: "Weak",
    border: "border-red-500/30",
  },
  untested: {
    bg: "bg-slate-500/10",
    text: "text-slate-400 dark:text-slate-500",
    label: "Untested",
    border: "border-slate-500/20",
  },
};

// --------------- component ---------------

export default function AdminStudentHeatmapPage() {
  const studentId = useUrlSegment(-2);

  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CellData | null>(null);

  useEffect(() => {
    let alive = true;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(
          `/api/v1/analytics/v3/student/${studentId}/heatmap`,
        );
        // The v3 endpoint returns `{ subjects: [{ name, topics: [{ name,
        // difficulties: [{ level, mastery, attempted }] }] }] }`. This page
        // renders a flat `{ topics, difficulties, cells }` grid, so we
        // adapt: flatten + derive mastery level from accuracy. When the
        // student genuinely has no exam responses we render an explicit
        // empty state below — no fake demo data per user feedback.
        const transformed = transformV3Heatmap(res?.data);
        if (transformed) {
          setData(transformed);
        } else {
          setData({ subjects: [], difficulties: [], cells: [] });
        }
      } catch {
        // Network error → render empty state so users see "no data" not
        // a misleading fake heatmap.
        setData({ subjects: [], difficulties: [], cells: [] });
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchData();
    return () => {
      alive = false;
    };
  }, [studentId]);

  const getCell = useCallback(
    (subject: string, topic: string, diff: string) =>
      data?.cells.find(
        (c) =>
          c.subject === subject &&
          c.topic === topic &&
          c.difficulty === diff,
      ),
    [data],
  );

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
          Knowledge Map
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Mastery Heatmap
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Topic vs difficulty — find knowledge gaps at a glance.
        </p>
      </motion.header>


      {/* Legend */}
      <motion.div
        variants={motionVariants.fadeUp}
        className="mb-5 flex flex-wrap gap-3"
      >
        {MASTERY_STATES.map((level) => (
          <div key={level} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-3 w-3 rounded-sm ${masteryConfig[level].bg} ${masteryConfig[level].border} border`}
            />
            <span className="text-xs text-muted-foreground">
              {masteryConfig[level].label}
            </span>
          </div>
        ))}
      </motion.div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state — no exam responses yet for this student */}
      {!loading && data && data.cells.length === 0 && (
        <motion.div
          variants={motionVariants.fadeUp}
          className="rounded-2xl border border-dashed border-border bg-white p-10 text-center dark:border-border-dark dark:bg-surface-dark"
        >
          <p className="text-sm font-medium text-foreground">
            No mastery data yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The heatmap fills in once this student submits an exam with
            classified responses. Try again after the next test.
          </p>
        </motion.div>
      )}

      {/* Heatmap grid — grouped by subject */}
      {!loading && data && data.cells.length > 0 && (
        <motion.div
          variants={motionVariants.staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {data.subjects.map((subject) => (
            <motion.section
              key={subject.name}
              variants={motionVariants.fadeUp}
              className="space-y-1.5"
            >
              {/* Subject heading */}
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-foreground">
                {subject.name}
                <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                  {subject.topics.length}{" "}
                  {subject.topics.length === 1 ? "topic" : "topics"}
                </span>
              </h2>

              {/* Column headers — repeat per subject section */}
              <div
                className="grid gap-1.5 mb-1.5"
                style={{
                  gridTemplateColumns: `minmax(120px, 1fr) repeat(${data.difficulties.length}, 1fr)`,
                }}
              >
                <div />
                {data.difficulties.map((d) => (
                  <div
                    key={d}
                    className="text-[11px] font-medium text-muted-foreground text-center truncate"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Topic rows */}
              <div className="space-y-1.5">
                {subject.topics.map((topic) => (
                  <div
                    key={`${subject.name}-${topic}`}
                    className="grid gap-1.5"
                    style={{
                      gridTemplateColumns: `minmax(120px, 1fr) repeat(${data.difficulties.length}, 1fr)`,
                    }}
                  >
                    <div className="flex items-center text-xs font-medium truncate pr-2">
                      {topic}
                    </div>
                    {data.difficulties.map((diff) => {
                      const cell = getCell(subject.name, topic, diff);
                      const cfg =
                        masteryConfig[cell?.mastery ?? "untested"];
                      return (
                        <button
                          key={diff}
                          onClick={() => cell && setSelected(cell)}
                          className={`
                            h-10 rounded-lg border transition-all duration-150
                            ${cfg.bg} ${cfg.border}
                            hover:scale-105 hover:shadow-sm active:scale-95
                            flex items-center justify-center
                          `}
                        >
                          {cell?.mastery !== "untested" && (
                            <span
                              className={`text-xs font-mono font-semibold ${cfg.text}`}
                              style={{
                                fontFamily: analyticsTokens.type.number,
                              }}
                            >
                              {cell?.accuracy}%
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </motion.section>
          ))}
        </motion.div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card>
                <CardHeader className="flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {selected.topic}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selected.subject} · {selected.difficulty} difficulty
                    </p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={18} />
                  </button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        selected.mastery === "mastered"
                          ? "success"
                          : selected.mastery === "developing"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {masteryConfig[selected.mastery].label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p
                        className="text-lg font-semibold"
                        style={{ fontFamily: analyticsTokens.type.number }}
                      >
                        {selected.accuracy}%
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Accuracy
                      </p>
                    </div>
                    <div className="text-center">
                      <p
                        className="text-lg font-semibold"
                        style={{ fontFamily: analyticsTokens.type.number }}
                      >
                        {selected.attempted}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Attempted
                      </p>
                    </div>
                    <div className="text-center">
                      <p
                        className="text-lg font-semibold"
                        style={{ fontFamily: analyticsTokens.type.number }}
                      >
                        {selected.total}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Total Qs
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
