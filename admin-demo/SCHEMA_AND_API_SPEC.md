# Admin Analytics — Database Schema & API Contract Specification

This document provides a self-contained reference for the **Admin Analytics Engine & Dashboard UI**. It details all database tables, columns, relations, caching mechanisms, and REST API endpoints so you never have to consult the `backend-source` repository for subsequent development.

---

## 1. Architectural Overview

The analytics system operates on a hybrid architecture:
- **Nightly & Triggered Pre-Computation**: Heavy aggregations (distributions, percentiles, Bloom's cognitive mapping, attendance histograms) are pre-calculated and stored in dedicated `*_analytics_cache` and `*_snapshots` tables.
- **On-Demand Live Slicing**: Institution and batch trend lines, date-range filters (`from`, `to`), exam type filters (`exam`, `mock`, `practice`), and student sub-selection are evaluated at request time with PostgreSQL window functions and indexed queries.
- **Tenant Hierarchy**:
  $$\text{Institution} \longrightarrow \text{Branches} \longrightarrow \text{Batches} \longrightarrow \text{Students} \longleftrightarrow \text{Exams}$$

---

## 2. Database Schema Catalog (Drizzle / PostgreSQL)

### 2.1 Analytics Caching Tables

#### `institution_analytics_cache`
Stores pre-aggregated institution-level performance indicators.
```typescript
{
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id").notNull().references(() => institutions.id),
  computedAt: timestamp("computed_at").notNull().defaultNow(),
  period: varchar("period", { length: 32 }).notNull().default("overall"), // "overall", "last_30d", etc.
  totalStudents: integer("total_students").notNull().default(0),
  totalExams: integer("total_exams").notNull().default(0),
  overallAvgPercentile: real("overall_avg_percentile").notNull().default(0),
  activeBatches: integer("active_batches").notNull().default(0),
  branchComparison: jsonb("branch_comparison").$type<Array<{
    branchId: string;
    branchName: string;
    studentCount: number;
    avgPercentile: number;
    examCount: number;
  }>>(),
  topBatches: jsonb("top_batches").$type<Array<{
    batchId: string;
    batchName: string;
    branchName: string;
    avgPercentile: number;
    studentCount: number;
    rank: number;
  }>>(),
  topPerformers: jsonb("top_performers").$type<Array<{
    studentId: string;
    name: string;
    batchName: string;
    branchName: string;
    avgPercentile: number;
    rank: number;
  }>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}
```

#### `batch_analytics_cache`
Pre-computed aggregates per batch.
```typescript
{
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull().references(() => batches.id),
  computedAt: timestamp("computed_at").notNull().defaultNow(),
  studentCount: integer("student_count").notNull().default(0),
  averageScore: real("average_score").notNull().default(0),
  scoreDistribution: jsonb("score_distribution").$type<Record<string, number>>(), // buckets: "0-20", "21-40", etc.
  subjectPerformance: jsonb("subject_performance").$type<Array<{
    subjectId: string;
    subjectName: string;
    averageScore: number;
    highestScore: number;
  }>>(),
  topicPerformance: jsonb("topic_performance").$type<Array<{
    topicId: string;
    topicName: string;
    subjectName: string;
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
  }>>(),
  atRiskCount: integer("at_risk_count").notNull().default(0)
}
```

#### `student_analytics_cache`
Granular per-student telemetry.
```typescript
{
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => users.id),
  batchId: uuid("batch_id").references(() => batches.id),
  computedAt: timestamp("computed_at").notNull().defaultNow(),
  overallPercentile: real("overall_percentile").notNull().default(0),
  batchRank: integer("batch_rank").notNull().default(0),
  highestScore: real("highest_score").default(0),
  averageScore: real("average_score").default(0),
  subjectMastery: jsonb("subject_mastery").$type<Record<string, number>>(), // e.g. { Physics: 41.2, Chemistry: 38.5, Mathematics: 38.1 }
  topicMastery: jsonb("topic_mastery"), // topic x difficulty accuracy matrix
  bloomsProfile: jsonb("blooms_profile"), // Recall, Understand, Apply, Analyze, Evaluate percentages
  velocityScore: real("velocity_score"), // OLS slope of last 5 tests
  errorDistribution: jsonb("error_distribution"), // conceptual, calculation, time_trap, unforced
  weakTopics: jsonb("weak_topics").$type<Array<{ topicId: string; name: string; accuracy: number; questions: number }>>()
}
```

#### `attendance_histogram_cache`
5-bucket attendance distribution cache.
```typescript
{
  id: uuid("id").primaryKey().defaultRandom(),
  scopeType: varchar("scope_type", { length: 32 }).notNull(), // 'institution' | 'branch' | 'batch'
  scopeId: uuid("scope_id").notNull(),
  bucket0To50: integer("bucket_0_50").notNull().default(0),
  bucket50To70: integer("bucket_50_70").notNull().default(0),
  bucket70To80: integer("bucket_70_80").notNull().default(0),
  bucket80To90: integer("bucket_80_90").notNull().default(0),
  bucket90To100: integer("bucket_90_100").notNull().default(0),
  totalTracked: integer("total_tracked").notNull().default(0),
  computedAt: timestamp("computed_at").defaultNow()
}
```

#### `cohort_snapshots`
Longitudinal cohort comparisons across years/milestones.
```typescript
{
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id").notNull().references(() => institutions.id),
  cohortKey: varchar("cohort_key", { length: 64 }).notNull(), // "JEE_2026", "NEET_2026", "JEE_2027"
  targetExam: varchar("target_exam", { length: 32 }).notNull(), // "JEE_MAIN", "NEET", "JEE_ADV"
  snapshotDate: timestamp("snapshot_date").notNull(),
  milestoneIndex: integer("milestone_index").notNull(), // 1..20
  milestoneName: varchar("milestone_name", { length: 128 }).notNull(), // "Term 1 Mid", "Electrostatics Post-Test", etc.
  averageScore: real("average_score").notNull(),
  medianScore: real("median_score").notNull(),
  topDecileScore: real("top_decile_score").notNull(),
  bottomDecileScore: real("bottom_decile_score").notNull(),
  totalStudents: integer("total_students").notNull()
}
```

#### `student_insights`
Actionable AI-synthesized behavioral coaching notifications.
```typescript
{
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => users.id),
  institutionId: uuid("institution_id").notNull(),
  type: varchar("type", { length: 32 }).notNull(), // 'velocity', 'topic_hotspot', 'attendance_leak', 'time_trap'
  severity: varchar("severity", { length: 16 }).notNull(), // 'info', 'warning', 'critical', 'positive'
  title: text("title").notNull(),
  message: text("message").notNull(),
  metricValue: varchar("metric_value", { length: 64 }),
  actionableStep: text("actionable_step"),
  isDismissed: boolean("is_dismissed").default(false),
  createdAt: timestamp("created_at").defaultNow()
}
```

#### `ask_threads` & `ask_messages`
Conversational AI Query history and generated cards.
```typescript
// ask_threads
{
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow()
}

// ask_messages
{
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull().references(() => askThreads.id),
  role: varchar("role", { length: 16 }).notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  structuredData: jsonb("structured_data"), // { chartType, data, metrics, columns }
  suggestedFollowups: jsonb("suggested_followups").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow()
}
```

---

## 3. Complete API Endpoint Reference

### 3.1 Institution & Branch Analytics

#### `GET /api/v1/analytics/institution`
Returns top-level KPIs, branch performance, top batches, and top performers.
- **Query Params**:
  - `from` *(optional ISO date)*: Start of time range
  - `to` *(optional ISO date)*: End of time range
  - `examType` *(optional string)*: Filter by `JEE_MAIN`, `NEET`, `BITSAT`, or default `exam`
- **Response Shape**:
```json
{
  "success": true,
  "data": {
    "totalStudents": 81,
    "totalExams": 20,
    "avgPercentile": 53.4,
    "activeBatches": 4,
    "branches": [
      { "branchId": "b-north", "name": "Demo North Campus", "percentile": 56.2, "students": 42 },
      { "branchId": "b-south", "name": "Demo South Campus", "percentile": 50.6, "students": 39 }
    ],
    "topBatches": [
      { "rank": 1, "batchId": "batch-jee-26", "name": "JEE 2026 Star Mains", "branch": "Demo North", "avgPercentile": 68.4, "students": 22 },
      { "rank": 2, "batchId": "batch-neet-26", "name": "NEET 2026 Achievers", "branch": "Demo South", "avgPercentile": 61.2, "students": 20 }
    ],
    "topPerformers": [
      { "rank": 1, "studentId": "s-101", "name": "Bhagam Khyathi", "batch": "JEE 2026 Star Mains", "percentile": 96.8 },
      { "rank": 2, "studentId": "s-102", "name": "Ananya Sharma", "batch": "JEE 2026 Star Mains", "percentile": 94.2 }
    ]
  }
}
```

#### `GET /api/v1/analytics/institution/trends`
Returns 12-month historical performance line chart coordinates.
- **Query Params**: `months=12`, `branchId` *(optional)*
- **Response Shape**:
```json
{
  "success": true,
  "data": {
    "trends": [
      { "month": "Oct 2025", "avgScore": 48.2, "avgPercentile": 49.0, "examsCount": 3 },
      { "month": "Nov 2025", "avgScore": 51.0, "avgPercentile": 51.5, "examsCount": 4 },
      { "month": "Dec 2025", "avgScore": 52.8, "avgPercentile": 52.1, "examsCount": 5 },
      { "month": "Jan 2026", "avgScore": 54.3, "avgPercentile": 53.8, "examsCount": 4 },
      { "month": "Feb 2026", "avgScore": 56.1, "avgPercentile": 55.4, "examsCount": 4 }
    ]
  }
}
```

#### `GET /api/v1/analytics/branch/:id`
Returns branch-specific overview KPIs, batch distribution, and faculty roster.

---

### 3.2 AI Insights & Home

#### `GET /api/v1/analytics/v3/home`
Returns behavioral coaching insights cards grouped by urgency.
- **Response Shape**:
```json
{
  "success": true,
  "data": {
    "insights": [
      {
        "id": "ins-1",
        "type": "velocity",
        "severity": "positive",
        "title": "Positive Velocity Across Star Batches",
        "message": "JEE 2026 cohort improved by +8.4 marks over the last 3 exams in Organic Chemistry.",
        "metricValue": "+8.4 Marks",
        "actionableStep": "Schedule Level-3 Advanced problem session to consolidate gains."
      },
      {
        "id": "ins-2",
        "type": "topic_hotspot",
        "severity": "critical",
        "title": "Systemic Score Leak: Rotational Dynamics",
        "message": "64% of students across 3 batches lost marks on Moment of Inertia calculations due to sign errors.",
        "metricValue": "-18 Avg Loss",
        "actionableStep": "Assign the 15-minute 2D Torque & Cross-Product remediation drill."
      },
      {
        "id": "ins-3",
        "type": "attendance_leak",
        "severity": "warning",
        "title": "Attendance Drop in Demo South",
        "message": "14 students dropped below 75% attendance threshold preceding the Electrochemistry test.",
        "metricValue": "14 At-Risk",
        "actionableStep": "Notify batch coordinator and dispatch automated parent alerts."
      }
    ]
  }
}
```

---

### 3.3 Cohort Longitudinal Tracking

#### `GET /api/v1/analytics/v3/institution/cohorts`
Compares student cohorts (e.g. JEE 2026 vs JEE 2027) across milestones.
- **Response Shape**:
```json
{
  "success": true,
  "data": {
    "cohorts": ["JEE 2026", "JEE 2027", "NEET 2026"],
    "milestones": [
      { "milestone": "M1 (Orientation)", "JEE 2026": 42.1, "JEE 2027": 46.5 },
      { "milestone": "M2 (Physics Kinematics)", "JEE 2026": 48.0, "JEE 2027": 52.4 },
      { "milestone": "M3 (Newton's Laws)", "JEE 2026": 51.5, "JEE 2027": 55.0 },
      { "milestone": "M4 (Work Energy Power)", "JEE 2026": 54.2, "JEE 2027": 58.1 },
      { "milestone": "M5 (Mid-Term Review)", "JEE 2026": 53.0, "JEE 2027": 57.8 }
    ],
    "deltaKpi": {
      "percentageImprovement": "+4.8%",
      "highestGainSubject": "Mathematics",
      "status": "Accelerating"
    }
  }
}
```

---

### 3.4 Batch Analytics Hub

#### `GET /api/v1/analytics/batch/:id`
Main batch summary with student counts, average score, pass rate, and subject breakdowns.

#### `GET /api/v1/analytics/v3/batch/:id/bell-curve`
Histogram with Gaussian normal curve overlay.
- **Response Shape**:
```json
{
  "success": true,
  "data": {
    "mean": 58.4,
    "standardDeviation": 14.2,
    "buckets": [
      { "range": "0-20", "count": 2, "gaussian": 1.1 },
      { "range": "21-40", "count": 5, "gaussian": 4.8 },
      { "range": "41-60", "count": 12, "gaussian": 11.6 },
      { "range": "61-80", "count": 8, "gaussian": 8.4 },
      { "range": "81-100", "count": 3, "gaussian": 2.2 }
    ]
  }
}
```

#### `GET /api/v1/analytics/v3/batch/:id/box-plot`
Five-number summary (Min, Q1, Median, Q3, Max) per subject.
- **Response Shape**:
```json
{
  "success": true,
  "data": [
    { "subject": "Physics", "min": 18, "q1": 36, "median": 52, "q3": 68, "max": 92 },
    { "subject": "Chemistry", "min": 22, "q1": 42, "median": 60, "q3": 74, "max": 96 },
    { "subject": "Mathematics", "min": 14, "q1": 32, "median": 48, "q3": 64, "max": 88 }
  ]
}
```

#### `GET /api/v1/analytics/v3/batch/:id/at-risk`
List of students flagged for urgent intervention.
- **Response Shape**:
```json
{
  "success": true,
  "data": [
    {
      "studentId": "s-201",
      "name": "Kiran Varma",
      "riskLevel": "critical",
      "scorePercentile": 24.5,
      "attendanceRate": 68.0,
      "unattemptedRate": 42.0,
      "primaryLeak": "Physics Time Traps (avg 3.8 min/Q)"
    },
    {
      "studentId": "s-202",
      "name": "Siddharth Rao",
      "riskLevel": "warning",
      "scorePercentile": 34.2,
      "attendanceRate": 74.5,
      "unattemptedRate": 28.0,
      "primaryLeak": "Negative marking in Organic Chemistry"
    }
  ]
}
```

#### `GET /api/v1/analytics/v3/batch/:id/attendance-histogram`
5-bucket attendance counts: `0-50%`, `50-70%`, `70-80%`, `80-90%`, `90-100%`.

#### `GET /api/v1/analytics/v3/batch/:id/syllabus-cumulative-flow`
Planned vs Covered topics over curriculum weeks.

---

### 3.5 Student Dossier (Admin / Faculty View)

#### `GET /api/v1/analytics/student/:id`
Student scorecard, batch rank, percentile, and subject accuracies.

#### `GET /api/v1/analytics/v3/student/:id/heatmap`
Topic x Difficulty mastery grid.

#### `GET /api/v1/analytics/v3/student/:id/predictive-path`
Score projection with confidence intervals.

#### `GET /api/v1/analytics/v3/student/:id/test-analysis/:examId`
Per-question forensic autopsy with choice made, correct choice, time spent, Bloom's level, and calculation rush flag.

---

### 3.6 Ask Brilliance AI

#### `POST /api/v1/analytics/ask/query`
- **Request Body**: `{ "prompt": "Show at-risk students in JEE 2026 Star Mains" }`
- **Response Shape**:
```json
{
  "success": true,
  "data": {
    "answer": "Found 4 students with critical risk indicators in JEE 2026 Star Mains based on the last 3 exams and attendance below 75%.",
    "chartType": "bar",
    "chartData": [
      { "name": "Kiran Varma", "score": 24.5, "attendance": 68 },
      { "name": "Siddharth Rao", "score": 34.2, "attendance": 74 }
    ],
    "suggestedFollowups": [
      "Send intervention notification to batch coordinator",
      "View Kiran Varma's exam question autopsy",
      "Compare JEE 2026 vs NEET 2026 pass rates"
    ]
  }
}
```
