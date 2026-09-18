import {
  pgTable,
  uuid,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { students, institutions } from "./core";
import { batches } from "./academic";

// ── Student Analytics Cache ─────────────────────────────────────
// Pre-computed JSONB columns that mirror the output of each analytics endpoint.
// Updated asynchronously via the analytics event bus after submissions/classifications.

export const studentAnalyticsCache = pgTable(
  "student_analytics_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .unique()
      .references(() => students.userId, { onDelete: "cascade" }),

    // GET /analytics/student/:id — overview + scoreTrajectory + subjectWise + recentExams
    overview: jsonb("overview"),
    scoreTrajectory: jsonb("score_trajectory"),
    subjectWise: jsonb("subject_wise"),

    // GET /analytics/student/:id/skill-map
    skillMap: jsonb("skill_map"),

    // GET /analytics/student/:id/error-patterns
    errorPatterns: jsonb("error_patterns"),

    // GET /analytics/student/:id/predictions
    predictions: jsonb("predictions"),

    // GET /analytics/student/:id/blooms-profile
    bloomsProfile: jsonb("blooms_profile"),

    // GET /analytics/student/:id/velocity
    velocity: jsonb("velocity"),

    // GET /analytics/student/:id/priority-queue
    priorityQueue: jsonb("priority_queue"),

    // GET /analytics/student/:id/improvement-projection
    improvementProjection: jsonb("improvement_projection"),

    // Mastery points per topic (computed by mastery engine)
    masteryPoints: jsonb("mastery_points").$type<Record<string, any>>().default({}),

    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("student_analytics_cache_student_id_idx").on(t.studentId),
    index("student_analytics_cache_updated_at_idx").on(t.updatedAt),
  ],
);

export const studentAnalyticsCacheRelations = relations(studentAnalyticsCache, ({ one }) => ({
  student: one(students, {
    fields: [studentAnalyticsCache.studentId],
    references: [students.userId],
  }),
}));

// ── Batch Analytics Cache ──────────────────────────────────────
// Pre-computed per-batch analytics. Updated when any student in the batch submits.

export const batchAnalyticsCache = pgTable(
  "batch_analytics_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .unique()
      .references(() => batches.id, { onDelete: "cascade" }),

    // Aggregate scores
    avgScore: jsonb("avg_score"), // { mean, median, stdDev, min, max }
    avgPercentile: jsonb("avg_percentile"),
    scoreDistribution: jsonb("score_distribution"), // histogram buckets
    topicPerformance: jsonb("topic_performance"), // per-topic averages
    studentRanking: jsonb("student_ranking"), // sorted student list with scores
    atRiskStudents: jsonb("at_risk_students"), // students below threshold
    bloomsHeatmap: jsonb("blooms_heatmap"), // blooms × topic matrix
    examWisePerformance: jsonb("exam_wise_performance"), // per-exam batch averages
    dppCompletionRates: jsonb("dpp_completion_rates"), // DPP/Daily5 per student
    assignmentCompletion: jsonb("assignment_completion"), // assignment tracking

    // Time-range presets (optional, for fast reads)
    overview30d: jsonb("overview_30d"),
    overview90d: jsonb("overview_90d"),

    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("batch_analytics_cache_batch_id_idx").on(t.batchId),
    index("batch_analytics_cache_updated_at_idx").on(t.updatedAt),
  ],
);

export const batchAnalyticsCacheRelations = relations(batchAnalyticsCache, ({ one }) => ({
  batch: one(batches, {
    fields: [batchAnalyticsCache.batchId],
    references: [batches.id],
  }),
}));

// ── Institution Analytics Cache ────────────────────────────────
// Pre-computed institution-wide analytics. Updated every 15 min via cron.

export const institutionAnalyticsCache = pgTable(
  "institution_analytics_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .unique()
      .references(() => institutions.id, { onDelete: "cascade" }),

    // Aggregate data
    totals: jsonb("totals"), // { totalStudents, totalExams, totalSubmissions, avgScore }
    branchComparison: jsonb("branch_comparison"), // per-branch averages
    topBatches: jsonb("top_batches"), // ranked batches by performance
    facultyEffectiveness: jsonb("faculty_effectiveness"), // per-faculty metrics
    trends: jsonb("trends"), // monthly trend data
    examTypeBreakdown: jsonb("exam_type_breakdown"), // JEE/NEET/CLAT performance
    attendanceOverview: jsonb("attendance_overview"), // institution-wide attendance

    // Time-range presets
    overview30d: jsonb("overview_30d"),
    overview90d: jsonb("overview_90d"),

    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("institution_analytics_cache_institution_id_idx").on(t.institutionId),
    index("institution_analytics_cache_updated_at_idx").on(t.updatedAt),
  ],
);

export const institutionAnalyticsCacheRelations = relations(institutionAnalyticsCache, ({ one }) => ({
  institution: one(institutions, {
    fields: [institutionAnalyticsCache.institutionId],
    references: [institutions.id],
  }),
}));

// ── Exam RWL (Right/Wrong/Left) Cache ──────────────────────────
// Pre-computed per-exam R/W/L breakdown at various scopes.
// Updated on exam submission, student batch/section changes, alumni conversion.

import { exams } from "./exams";
import { varchar, unique } from "drizzle-orm/pg-core";

export const examRwlCache = pgTable(
  "exam_rwl_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    scope: varchar("scope", { length: 20 }).notNull(), // "exam", "batch", "branch", "section"
    scopeId: varchar("scope_id", { length: 100 }).notNull(), // the batch/branch/section ID, or "all"
    summary: jsonb("summary"), // { R, W, L, P, totalStudents, totalQuestions }
    bySubject: jsonb("by_subject"), // [{ subject, R, W, L }]
    byQuestion: jsonb("by_question"), // [{ questionNumber, questionId, section, R, W, L, rPct, wPct, lPct }]
    bySubtopic: jsonb("by_subtopic"), // [{ subtopicId, subtopic, subject, level, R, W, L, P, rPct, wPct, lPct, total }]
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("exam_rwl_cache_scope_unique").on(t.examId, t.scope, t.scopeId),
    index("exam_rwl_cache_exam_idx").on(t.examId),
    index("exam_rwl_cache_scope_idx").on(t.scope, t.scopeId),
  ],
);

export const examRwlCacheRelations = relations(examRwlCache, ({ one }) => ({
  exam: one(exams, {
    fields: [examRwlCache.examId],
    references: [exams.id],
  }),
}));
