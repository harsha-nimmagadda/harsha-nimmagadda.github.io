import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  pgEnum,
  index,
  numeric,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { students } from "./core";

// ── Enums ──────────────────────────────────────────────────────

export const riskLevelEnum = pgEnum("risk_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

// ── Student Predictions ────────────────────────────────────────

export const studentPredictions = pgTable(
  "student_predictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.userId, { onDelete: "cascade" }),
    predictedScoreRange: jsonb("predicted_score_range"),
    predictedPercentileRange: jsonb("predicted_percentile_range"),
    predictedRankRange: jsonb("predicted_rank_range"),
    confidence: numeric("confidence"),
    modelVersion: text("model_version"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("student_predictions_student_id_idx").on(t.studentId),
  ],
);

export const studentPredictionsRelations = relations(studentPredictions, ({ one }) => ({
  student: one(students, {
    fields: [studentPredictions.studentId],
    references: [students.userId],
  }),
}));

// ── Wellness Signals ───────────────────────────────────────────

export const wellnessSignals = pgTable(
  "wellness_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.userId, { onDelete: "cascade" }),
    signalType: varchar("signal_type", { length: 100 }).notNull(),
    signalValue: numeric("signal_value").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
    riskLevel: riskLevelEnum("risk_level").notNull(),
    facultyNotified: boolean("faculty_notified").default(false).notNull(),
    interventionNotes: text("intervention_notes"),
  },
  (t) => [
    index("wellness_signals_student_id_idx").on(t.studentId),
    index("wellness_signals_risk_level_idx").on(t.riskLevel),
    index("wellness_signals_detected_at_idx").on(t.detectedAt),
  ],
);

export const wellnessSignalsRelations = relations(wellnessSignals, ({ one }) => ({
  student: one(students, {
    fields: [wellnessSignals.studentId],
    references: [students.userId],
  }),
}));
