// ============================================================
// BRILLIANCE — Analytics V3 Schema
// Persona analytics + Ask Analytics + Insight Engine tables.
// Isolated file to keep the diff reviewable and the migration
// rollback clean. Guardrail: nothing outside analytics-v3.ts
// and the new migration should change.
// ============================================================

import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  numeric,
  integer,
  boolean,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users, institutions, students, faculty } from "./core";
import { batches, subjects } from "./academic";
import { exams } from "./exams";
import { questions } from "./questions";

// ── Enums ─────────────────────────────────────────────────────

export const cohortMilestoneEnum = pgEnum("cohort_milestone", [
  "month_1",
  "month_3",
  "month_6",
  "month_9",
  "month_12",
  "final_mock",
]);

export const ptaReportStatusEnum = pgEnum("pta_report_status", [
  "draft",
  "generated",
  "shared",
  "expired",
]);

export const analyticsScopeTypeEnum = pgEnum("analytics_scope_type", [
  "student",
  "batch",
  "branch",
  "institution",
]);

export const insightKindEnum = pgEnum("insight_kind", [
  // student
  "velocity_up",
  "velocity_down",
  "inefficient_study",
  "weakness_resolved",
  "weakness_introduced",
  "time_pressure",
  "topic_hotspot",
  "attendance_drop",
  "predicted_dip",
  "cohort_outlier",
  "peer_outperforming",
  "comeback_plan",
  // batch / faculty
  "class_drifting",
  "flawed_question_suspect",
  "at_risk_cluster",
  "syllabus_behind_plan",
  // branch / admin
  "branch_underperforming",
  "faculty_impact_anomaly",
  "cohort_divergence",
]);

export const insightSeverityEnum = pgEnum("insight_severity", [
  "info",
  "warning",
  "critical",
  "celebrate",
]);

export const trendEnum = pgEnum("analytics_trend", [
  "improving",
  "plateau",
  "declining",
  "volatile",
]);

export const askMessageRoleEnum = pgEnum("ask_message_role", [
  "user",
  "assistant",
  "system",
]);

export const askFeedbackVerdictEnum = pgEnum("ask_feedback_verdict", [
  "up",
  "down",
  "flag",
]);

// ── Faculty Impact Metrics ────────────────────────────────────
// Value-added model: how much a student's score/mastery improved
// under a specific faculty member during a teaching period.

export const facultyImpactMetrics = pgTable(
  "faculty_impact_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facultyId: uuid("faculty_id")
      .notNull()
      .references(() => faculty.userId, { onDelete: "cascade" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    periodLabel: varchar("period_label", { length: 40 }).notNull(), // "rolling_90d" | "2026-04" | "2026-Q2" | "ytd"
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    avgMasteryDelta: numeric("avg_mastery_delta"),
    avgScoreDelta: numeric("avg_score_delta"),
    studentCount: integer("student_count").notNull().default(0),
    percentileVsPeers: numeric("percentile_vs_peers"),
    // Plain-language "why this faculty ranks here"
    // [{topicId, topicName, masteryGain, studentCount, narrative}]
    topDrivers: jsonb("top_drivers"),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("faculty_impact_unique_idx").on(
      t.facultyId,
      t.batchId,
      t.subjectId,
      t.periodLabel,
    ),
    index("faculty_impact_faculty_idx").on(t.facultyId),
    index("faculty_impact_batch_idx").on(t.batchId),
    index("faculty_impact_period_idx").on(t.periodLabel, t.updatedAt),
  ],
);

export const facultyImpactMetricsRelations = relations(
  facultyImpactMetrics,
  ({ one }) => ({
    faculty: one(faculty, {
      fields: [facultyImpactMetrics.facultyId],
      references: [faculty.userId],
    }),
    batch: one(batches, {
      fields: [facultyImpactMetrics.batchId],
      references: [batches.id],
    }),
    subject: one(subjects, {
      fields: [facultyImpactMetrics.subjectId],
      references: [subjects.id],
    }),
  }),
);

// ── Cohort Snapshots ──────────────────────────────────────────
// Point-in-time cohort aggregates for cohort-vs-cohort comparison
// (e.g., "Class of 2024 vs Class of 2025 at month 6").

export const cohortSnapshots = pgTable(
  "cohort_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    cohortKey: varchar("cohort_key", { length: 100 }).notNull(),
    academicYear: varchar("academic_year", { length: 20 }).notNull(),
    targetExam: varchar("target_exam", { length: 50 }).notNull(),
    milestone: cohortMilestoneEnum("milestone").notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull(),
    avgScore: numeric("avg_score"),
    avgMastery: numeric("avg_mastery"),
    avgAttendance: numeric("avg_attendance"),
    studentCount: integer("student_count").notNull().default(0),
    percentileDistribution: jsonb("percentile_distribution"),
    subjectBreakdown: jsonb("subject_breakdown"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("cohort_snapshot_unique_idx").on(
      t.institutionId,
      t.cohortKey,
      t.milestone,
    ),
    index("cohort_snapshot_key_idx").on(t.cohortKey),
    index("cohort_snapshot_year_idx").on(t.academicYear),
  ],
);

export const cohortSnapshotsRelations = relations(cohortSnapshots, ({ one }) => ({
  institution: one(institutions, {
    fields: [cohortSnapshots.institutionId],
    references: [institutions.id],
  }),
}));

// ── Student Baselines ─────────────────────────────────────────
// Anchor point for "growth velocity vs own baseline" (parent view).

export const studentBaselines = pgTable(
  "student_baselines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.userId, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    academicYear: varchar("academic_year", { length: 20 }).notNull(),
    baselinePercentage: numeric("baseline_percentage").notNull(),
    baselineMastery: numeric("baseline_mastery"),
    baselineCapturedAt: timestamp("baseline_captured_at", {
      withTimezone: true,
    }).notNull(),
    currentPercentage: numeric("current_percentage"),
    currentMastery: numeric("current_mastery"),
    deltaPercentage: numeric("delta_percentage"),
    deltaMastery: numeric("delta_mastery"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("student_baseline_unique_idx").on(
      t.studentId,
      t.subjectId,
      t.academicYear,
    ),
    index("student_baseline_student_idx").on(t.studentId),
  ],
);

export const studentBaselinesRelations = relations(studentBaselines, ({ one }) => ({
  student: one(students, {
    fields: [studentBaselines.studentId],
    references: [students.userId],
  }),
  subject: one(subjects, {
    fields: [studentBaselines.subjectId],
    references: [subjects.id],
  }),
}));

// ── Attendance Histogram Cache ────────────────────────────────

export const attendanceHistogramCache = pgTable(
  "attendance_histogram_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeType: analyticsScopeTypeEnum("scope_type").notNull(),
    scopeId: uuid("scope_id").notNull(),
    periodKey: varchar("period_key", { length: 50 }).notNull(),
    buckets: jsonb("buckets").notNull(),
    totalSessions: integer("total_sessions").notNull().default(0),
    averageAttendance: numeric("average_attendance"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("attendance_histogram_unique_idx").on(
      t.scopeType,
      t.scopeId,
      t.periodKey,
    ),
    index("attendance_histogram_scope_idx").on(t.scopeType, t.scopeId),
  ],
);

// ── Question Discrimination Cache ─────────────────────────────

export const questionDiscriminationCache = pgTable(
  "question_discrimination_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    discriminationIndex: numeric("discrimination_index"),
    topQuartileCorrect: numeric("top_quartile_correct"),
    bottomQuartileCorrect: numeric("bottom_quartile_correct"),
    overallCorrect: numeric("overall_correct"),
    totalAttempts: integer("total_attempts").notNull().default(0),
    flagAsFlawed: boolean("flag_as_flawed").notNull().default(false),
    flawReason: text("flaw_reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("question_discrimination_unique_idx").on(t.examId, t.questionId),
    index("question_discrimination_exam_idx").on(t.examId),
    index("question_discrimination_flawed_idx").on(t.flagAsFlawed),
  ],
);

export const questionDiscriminationCacheRelations = relations(
  questionDiscriminationCache,
  ({ one }) => ({
    exam: one(exams, {
      fields: [questionDiscriminationCache.examId],
      references: [exams.id],
    }),
    question: one(questions, {
      fields: [questionDiscriminationCache.questionId],
      references: [questions.id],
    }),
  }),
);

// ── PTA Reports ───────────────────────────────────────────────

export const ptaReports = pgTable(
  "pta_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.userId, { onDelete: "cascade" }),
    generatedBy: uuid("generated_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    status: ptaReportStatusEnum("status").notNull().default("draft"),
    snapshotJson: jsonb("snapshot_json").notNull(),
    pdfS3Key: text("pdf_s3_key"),
    ogImageS3Key: text("og_image_s3_key"),
    shareToken: varchar("share_token", { length: 64 }).notNull().unique(),
    sharedWith: jsonb("shared_with"),
    facultyNotes: text("faculty_notes"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("pta_reports_student_idx").on(t.studentId),
    index("pta_reports_generated_by_idx").on(t.generatedBy),
    uniqueIndex("pta_reports_share_token_idx").on(t.shareToken),
    index("pta_reports_generated_at_idx").on(t.generatedAt),
  ],
);

export const ptaReportsRelations = relations(ptaReports, ({ one }) => ({
  student: one(students, {
    fields: [ptaReports.studentId],
    references: [students.userId],
  }),
  generatedByUser: one(users, {
    fields: [ptaReports.generatedBy],
    references: [users.id],
  }),
}));

// ── Analytics Pageviews (feature-level tracking) ──────────────
// eventType/eventTarget powers the "what gets used" adoption dashboard.

export const analyticsPageviews = pgTable(
  "analytics_pageviews",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 30 }).notNull(),
    route: varchar("route", { length: 255 }).notNull(),
    eventType: varchar("event_type", { length: 40 }).notNull().default("page_view"),
    eventTarget: varchar("event_target", { length: 255 }),
    scopeType: analyticsScopeTypeEnum("scope_type"),
    scopeId: uuid("scope_id"),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    durationMs: integer("duration_ms"),
    metadata: jsonb("metadata"),
  },
  (t) => [
    index("analytics_pageviews_user_idx").on(t.userId, t.viewedAt),
    index("analytics_pageviews_route_idx").on(t.route, t.viewedAt),
    index("analytics_pageviews_event_type_idx").on(t.eventType, t.viewedAt),
    index("analytics_pageviews_viewed_at_idx").on(t.viewedAt),
  ],
);

export const analyticsPageviewsRelations = relations(
  analyticsPageviews,
  ({ one }) => ({
    user: one(users, {
      fields: [analyticsPageviews.userId],
      references: [users.id],
    }),
  }),
);

// ── Insight Engine tables ─────────────────────────────────────
// Deterministic, rule-generated insights per scope. Drives persona
// home pages + <RecommendedActions /> footer on every analytics page.

export const studentInsights = pgTable(
  "student_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.userId, { onDelete: "cascade" }),
    kind: insightKindEnum("kind").notNull(),
    severity: insightSeverityEnum("severity").notNull().default("info"),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    // [{label, href, actionType, params}]
    recommendedActions: jsonb("recommended_actions"),
    // Typed payload used by the UI for mini-charts, deltas, etc.
    payload: jsonb("payload"),
    subjectId: uuid("subject_id").references(() => subjects.id, {
      onDelete: "set null",
    }),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    actedOnAt: timestamp("acted_on_at", { withTimezone: true }),
  },
  (t) => [
    index("student_insights_student_idx").on(t.studentId, t.generatedAt),
    index("student_insights_kind_idx").on(t.kind),
    index("student_insights_severity_idx").on(t.severity),
    index("student_insights_active_idx").on(t.studentId, t.dismissedAt),
  ],
);

export const studentInsightsRelations = relations(studentInsights, ({ one }) => ({
  student: one(students, {
    fields: [studentInsights.studentId],
    references: [students.userId],
  }),
  subject: one(subjects, {
    fields: [studentInsights.subjectId],
    references: [subjects.id],
  }),
}));

export const batchInsights = pgTable(
  "batch_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    kind: insightKindEnum("kind").notNull(),
    severity: insightSeverityEnum("severity").notNull().default("info"),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    recommendedActions: jsonb("recommended_actions"),
    payload: jsonb("payload"),
    subjectId: uuid("subject_id").references(() => subjects.id, {
      onDelete: "set null",
    }),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  },
  (t) => [
    index("batch_insights_batch_idx").on(t.batchId, t.generatedAt),
    index("batch_insights_kind_idx").on(t.kind),
    index("batch_insights_severity_idx").on(t.severity),
  ],
);

export const batchInsightsRelations = relations(batchInsights, ({ one }) => ({
  batch: one(batches, {
    fields: [batchInsights.batchId],
    references: [batches.id],
  }),
}));

export const branchInsights = pgTable(
  "branch_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id").notNull(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    kind: insightKindEnum("kind").notNull(),
    severity: insightSeverityEnum("severity").notNull().default("info"),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    recommendedActions: jsonb("recommended_actions"),
    payload: jsonb("payload"),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  },
  (t) => [
    index("branch_insights_branch_idx").on(t.branchId, t.generatedAt),
    index("branch_insights_institution_idx").on(t.institutionId),
    index("branch_insights_severity_idx").on(t.severity),
  ],
);

// ── Ask Analytics tables ──────────────────────────────────────

export const askThreads = pgTable(
  "ask_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 30 }).notNull(),
    title: varchar("title", { length: 200 }),
    // Scope frozen at thread creation, used for every follow-up.
    scopeJson: jsonb("scope_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("ask_threads_user_idx").on(t.userId, t.updatedAt),
  ],
);

export const askMessages = pgTable(
  "ask_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => askThreads.id, { onDelete: "cascade" }),
    role: askMessageRoleEnum("role").notNull(),
    question: text("question"),
    // Claude's structured plan (null for user messages)
    planJson: jsonb("plan_json"),
    // Compiled result preview (first rows + meta)
    resultPreview: jsonb("result_preview"),
    narrative: text("narrative"),
    chartType: varchar("chart_type", { length: 40 }),
    rowCount: integer("row_count"),
    latencyMs: integer("latency_ms"),
    claudeTokensIn: integer("claude_tokens_in"),
    claudeTokensOut: integer("claude_tokens_out"),
    cacheHit: boolean("cache_hit").default(false),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("ask_messages_thread_idx").on(t.threadId, t.createdAt),
  ],
);

export const askSavedCards = pgTable(
  "ask_saved_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").references(() => askThreads.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 200 }).notNull(),
    planJson: jsonb("plan_json").notNull(),
    refreshIntervalMinutes: integer("refresh_interval_minutes"),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("ask_saved_cards_user_idx").on(t.userId, t.position),
  ],
);

export const askFeedback = pgTable(
  "ask_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => askMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verdict: askFeedbackVerdictEnum("verdict").notNull(),
    correctionText: text("correction_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("ask_feedback_message_idx").on(t.messageId),
    index("ask_feedback_verdict_idx").on(t.verdict),
  ],
);

export const askPlanCache = pgTable(
  "ask_plan_cache",
  {
    hash: varchar("hash", { length: 64 }).primaryKey(),
    planJson: jsonb("plan_json").notNull(),
    role: varchar("role", { length: 30 }).notNull(),
    hitCount: integer("hit_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("ask_plan_cache_expires_idx").on(t.expiresAt),
  ],
);

// Context-aware Ask suggestions keyed by (route, scope, role).
// Cached 24h, refreshed on cache miss via Claude.
export const askSuggestionsCache = pgTable(
  "ask_suggestions_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hash: varchar("hash", { length: 64 }).notNull().unique(),
    route: varchar("route", { length: 255 }).notNull(),
    role: varchar("role", { length: 30 }).notNull(),
    scopeJson: jsonb("scope_json"),
    suggestions: jsonb("suggestions").notNull(), // [{question, icon}]
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("ask_suggestions_hash_idx").on(t.hash),
    index("ask_suggestions_expires_idx").on(t.expiresAt),
  ],
);

// ── Predictions v3 (extends existing studentPredictions concept) ──
// New columns-as-table: stored here to avoid touching existing analytics.ts.
// The insight engine writes the trend label here alongside score ranges.

export const studentPredictionsV3 = pgTable(
  "student_predictions_v3",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.userId, { onDelete: "cascade" })
      .unique(),
    examType: varchar("exam_type", { length: 50 }),
    // Linear regression output
    slopePerExam: numeric("slope_per_exam"),
    rSquared: numeric("r_squared"),
    predictedNextExam: numeric("predicted_next_exam"),
    predictedFinalLow: numeric("predicted_final_low"),
    predictedFinalHigh: numeric("predicted_final_high"),
    confidence: numeric("confidence"),
    // Classifier
    trend: trendEnum("trend").notNull().default("volatile"),
    trendNarrative: text("trend_narrative"),
    modelVersion: varchar("model_version", { length: 20 }).notNull().default("v3.0"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("student_predictions_v3_student_idx").on(t.studentId),
    index("student_predictions_v3_trend_idx").on(t.trend),
  ],
);

export const studentPredictionsV3Relations = relations(
  studentPredictionsV3,
  ({ one }) => ({
    student: one(students, {
      fields: [studentPredictionsV3.studentId],
      references: [students.userId],
    }),
  }),
);

// ── Score-Rank Curves ────────────────────────────────────────
// Historical score→percentile→rank mapping per exam type per year.
// Powers the rank prediction engine.

export const scoreRankCurves = pgTable(
  "score_rank_curves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examType: varchar("exam_type", { length: 50 }).notNull(),
    year: integer("year").notNull(),
    session: varchar("session", { length: 20 }),
    category: varchar("category", { length: 30 }).notNull().default("general"),
    // [{score, percentile, rank}]
    curvePoints: jsonb("curve_points").notNull(),
    totalCandidates: integer("total_candidates"),
    maxScore: integer("max_score"),
    source: varchar("source", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("score_rank_curves_unique_idx").on(t.examType, t.year, t.category),
    index("score_rank_curves_exam_year_idx").on(t.examType, t.year),
  ],
);

// ── College Cutoffs ──────────────────────────────────────────
// JoSAA / state counselling closing ranks per college/program/category.

export const collegeCutoffs = pgTable(
  "college_cutoffs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examType: varchar("exam_type", { length: 50 }).notNull(),
    year: integer("year").notNull(),
    counsellingBody: varchar("counselling_body", { length: 30 }).notNull(),
    round: integer("round").notNull(),
    instituteCode: varchar("institute_code", { length: 20 }).notNull(),
    instituteName: varchar("institute_name", { length: 200 }).notNull(),
    programCode: varchar("program_code", { length: 20 }).notNull(),
    programName: varchar("program_name", { length: 200 }).notNull(),
    degree: varchar("degree", { length: 30 }).notNull().default("B.Tech"),
    category: varchar("category", { length: 30 }).notNull().default("general"),
    subCategory: varchar("sub_category", { length: 30 }).notNull().default("gender_neutral"),
    quota: varchar("quota", { length: 10 }).notNull().default("AI"),
    closingRank: integer("closing_rank").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("college_cutoffs_exam_year_idx").on(t.examType, t.year),
    index("college_cutoffs_institute_idx").on(t.instituteCode, t.programCode),
    index("college_cutoffs_institute_name_idx").on(
      t.instituteName,
      t.programName,
    ),
    index("college_cutoffs_category_idx").on(t.category, t.quota),
    index("college_cutoffs_closing_rank_idx").on(t.closingRank),
  ],
);
