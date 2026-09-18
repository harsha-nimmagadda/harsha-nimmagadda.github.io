"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  List,
  CheckCircle,
  Circle,
  Database,
  Lightning,
  ChartBar,
  Shield,
  Users,
  Student,
  ChalkboardTeacher,
  UsersFour,
  Brain,
  Rocket,
  Warning,
  Eye,
  Target,
  GraduationCap,
  Sparkle,
  ArrowLeft,
  CaretRight,
  X,
} from "@phosphor-icons/react";
import { BackLink } from "@/components/back-link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Section = {
  id: string;
  title: string;
  icon: React.ReactNode;
  status?: "done" | "planned";
};

/* ------------------------------------------------------------------ */
/*  Sections registry                                                  */
/* ------------------------------------------------------------------ */

const SECTIONS: Section[] = [
  { id: "context", title: "Context & Decisions", icon: <Eye weight="duotone" size={18} /> },
  { id: "architecture", title: "Architecture", icon: <Database weight="duotone" size={18} /> },
  { id: "schema-flow", title: "Schema Relationships", icon: <Database weight="duotone" size={18} /> },
  { id: "nightly-jobs", title: "Nightly Jobs", icon: <Lightning weight="duotone" size={18} /> },
  { id: "scalability", title: "Scalability", icon: <Rocket weight="duotone" size={18} /> },
  { id: "chart-inventory", title: "Chart Inventory", icon: <ChartBar weight="duotone" size={18} /> },
  { id: "files", title: "Files Created / Modified", icon: <List weight="duotone" size={18} /> },
  { id: "verification", title: "Verification Pipeline", icon: <Shield weight="duotone" size={18} /> },
  { id: "ask-brilliance", title: "Ask Excellencia AI (Text-to-Analytics)", icon: <Sparkle weight="duotone" size={18} /> },
  { id: "use-cases", title: "Real-World Use Cases", icon: <Target weight="duotone" size={18} /> },
  { id: "acceptance", title: "Acceptance Matrix", icon: <CheckCircle weight="duotone" size={18} /> },
  { id: "phases", title: "Execution Phases", icon: <Rocket weight="duotone" size={18} />, status: "done" },
  { id: "guardrail", title: "Guardrail Enforcement", icon: <Shield weight="duotone" size={18} /> },
  { id: "risk", title: "Risk Register", icon: <Warning weight="duotone" size={18} /> },
  { id: "product-refinements", title: "Product Refinements", icon: <Brain weight="duotone" size={18} /> },
  { id: "schema-driven", title: "Schema-Driven Analytics", icon: <Database weight="duotone" size={18} /> },
  { id: "experience", title: "Experience Layer", icon: <Eye weight="duotone" size={18} /> },
  { id: "cross-persona", title: "Cross-Persona Flows", icon: <Users weight="duotone" size={18} /> },
  { id: "investor-demo", title: "Investor Demo Script", icon: <GraduationCap weight="duotone" size={18} /> },
  { id: "seed-data", title: "Seed Data", icon: <Database weight="duotone" size={18} /> },
  { id: "implementation", title: "Implementation Status", icon: <CheckCircle weight="duotone" size={18} />, status: "done" },
  { id: "master-flow", title: "Master System Diagram", icon: <ChartBar weight="duotone" size={18} /> },
  { id: "student-dossier", title: "Student Dossier", icon: <Student weight="duotone" size={18} /> },
  { id: "rank-prediction", title: "Phase 6 -- Rank & College Predictor", icon: <Target weight="duotone" size={18} />, status: "planned" },
  { id: "missing-analytics", title: "Phase 7 -- Missing Gaps", icon: <Warning weight="duotone" size={18} />, status: "planned" },
  { id: "ux-improvements", title: "UX Improvements", icon: <Sparkle weight="duotone" size={18} />, status: "done" },
];

/* ------------------------------------------------------------------ */
/*  Shared Components                                                  */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.2, 0, 0, 1] as [number, number, number, number] } },
};

function FlowChart({ children, title }: { children: string; title?: string }) {
  return (
    <div className="my-6 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-gradient-to-br from-slate-50/70 to-slate-100/40 dark:from-zinc-900 dark:to-zinc-800/60 overflow-hidden">
      {title && (
        <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-700/60 bg-white/50 dark:bg-zinc-900/50">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{title}</span>
        </div>
      )}
      <pre className="p-5 text-[11px] leading-[1.6] font-[JetBrains_Mono,monospace] text-zinc-700 dark:text-zinc-300 overflow-x-auto">{children}</pre>
    </div>
  );
}

function StatusBadge({ status }: { status: "done" | "planned" }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
        <CheckCircle weight="fill" size={12} /> Done
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
      <Circle weight="fill" size={10} /> Planned
    </span>
  );
}

function SectionCard({ id, title, icon, status, children }: Section & { children: React.ReactNode }) {
  return (
    <motion.section
      id={id}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_rgb(0_0_0/0.06)] overflow-hidden scroll-mt-24"
    >
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-blue-600 dark:text-blue-400">{icon}</span>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 font-[Satoshi,Inter,sans-serif]">{title}</h2>
        {status && <StatusBadge status={status} />}
      </div>
      <div className="px-6 py-5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{children}</div>
    </motion.section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-4 rounded-lg border border-zinc-200 dark:border-zinc-700/60">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-800/60">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2.5 text-left font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider text-[10px]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-primary/5/50 dark:hover:bg-primary/15/30 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2.5 text-zinc-700 dark:text-zinc-400 font-[JetBrains_Mono,monospace] text-[11px]">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AnalyticsPlanPage() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveId(e.target.id);
            break;
          }
        }
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0.1 }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observerRef.current.observe(el);
    }
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* ---- Mobile top bar ---- */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-primary/5 dark:hover:bg-primary/15 transition-colors">
          <List size={20} className="text-zinc-600 dark:text-zinc-400" />
        </button>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Analytics Plan</span>
        <BackLink href="/analytics" className="p-1.5 rounded-lg hover:bg-primary/5 dark:hover:bg-primary/15 transition-colors">
          <ArrowLeft size={20} className="text-zinc-600 dark:text-zinc-400" />
        </BackLink>
      </div>

      {/* ---- Mobile sidebar overlay ---- */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30 dark:bg-black/50" onClick={() => setSidebarOpen(false)} />
          <motion.nav
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] as [number, number, number, number] }}
            className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto"
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Sections</span>
              <button onClick={() => setSidebarOpen(false)}><X size={18} className="text-zinc-400" /></button>
            </div>
            <SidebarNav sections={SECTIONS} activeId={activeId} onSelect={scrollTo} />
          </motion.nav>
        </div>
      )}

      {/* ---- Desktop sidebar ---- */}
      <nav className="hidden lg:block fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto z-40">
        <div className="px-5 py-5 border-b border-zinc-100 dark:border-zinc-800">
          <BackLink href="/analytics" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-blue-600 transition-colors mb-3">
            <ArrowLeft size={14} /> Back
          </BackLink>
          <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-[Satoshi,Inter,sans-serif]">Analytics Plan</h1>
          <p className="text-[10px] text-zinc-400 mt-1">26 sections -- ~2,400 lines</p>
        </div>
        <SidebarNav sections={SECTIONS} activeId={activeId} onSelect={scrollTo} />
      </nav>

      {/* ---- Main content ---- */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        {/* Hero */}
        <header className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:from-blue-800 dark:via-indigo-900 dark:to-zinc-900">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.15),transparent)]" />
          <div className="relative max-w-4xl mx-auto px-6 py-14 lg:py-20">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-3">End-to-End Plan</p>
              <h1 className="text-3xl lg:text-4xl font-bold text-white font-[Satoshi,Inter,sans-serif] leading-tight">
                Excellencia AI Analytics
              </h1>
              <p className="text-blue-100/80 mt-3 max-w-2xl text-sm leading-relaxed">
                One coherent analytics layer for every persona -- admin, faculty, student, parent. Paginated to 10k users, powered by Ask Excellencia AI (Claude Sonnet 4.6), with insight engine, rank prediction, and PTA reports.
              </p>
              <div className="flex flex-wrap gap-2 mt-6">
                <StatusPill label="50+ files" />
                <StatusPill label="~15,000 lines" />
                <StatusPill label="40+ pages" />
                <StatusPill label="17 DB tables" />
                <StatusPill label="Phases 1-5 complete" variant="success" />
                <StatusPill label="Phase 6-7 planned" variant="blue" />
              </div>
            </motion.div>
          </div>
        </header>

        {/* Sections */}
        <div className="max-w-4xl mx-auto px-4 lg:px-6 py-8 space-y-6">
          {/* 1. Context */}
          <SectionCard {...SECTIONS[0]}>
            <p className="mb-3">The analytics surface spans four apps with ~45 endpoints, three JSONB cache tables, Recharts visualizations, and TanStack Query fetching. Six concrete gaps were identified:</p>
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li><strong>Incomplete persona coverage</strong> -- admin can't drill cleanly; faculty lacks a full student report for PTA; parent lacks growth-velocity.</li>
              <li><strong>Missing chart types</strong> -- box plots, bell curve with sigma, discrimination index, Sankey, cumulative flow, attendance histogram.</li>
              <li><strong>No PTA report pipeline</strong> -- faculty cannot generate a shareable individual student report.</li>
              <li><strong>No pagination</strong> -- will break at 10k users.</li>
              <li><strong>Underpowered schema</strong> -- no cohort snapshot, teacher impact, session log.</li>
              <li><strong>Half-implemented UX</strong> -- navigation paths unclear across personas.</li>
            </ol>
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <strong>Decisions:</strong> Extend in place, schema additions in analytics-v3.ts only, PTA via branded PDF + share link, deterministic stats (no Claude in hot path), Ask Excellencia AI uses Claude Sonnet 4.6 with semantic layer (LLM never writes SQL).
            </p>
          </SectionCard>

          {/* 2. Architecture */}
          <SectionCard {...SECTIONS[1]}>
            <p className="mb-3">New isolated schema file <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono">analytics-v3.ts</code> with persona tables + ask tables. Single migration <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono">0024_analytics_v3.sql</code>.</p>
            <Table
              headers={["Table", "Purpose", "Key Columns"]}
              rows={[
                ["facultyImpactMetrics", "Value-added model per faculty", "facultyId, batchId, avgMasteryDelta, percentileVsPeers"],
                ["cohortSnapshots", "Point-in-time cohort aggregates", "cohortKey, milestone, avgScore, avgMastery"],
                ["studentBaselines", "Growth-vs-own-baseline (parent)", "studentId, subjectId, baselinePercentage, deltaPercentage"],
                ["attendanceHistogramCache", "Pre-bucketed attendance distributions", "scopeType, scopeId, periodKey, buckets jsonb"],
                ["questionDiscriminationCache", "Per-exam discrimination index", "examId, questionId, discriminationIndex"],
                ["ptaReports", "Faculty->parent reports", "studentId, generatedBy, pdfS3Key, shareToken"],
                ["analyticsPageviews", "Feature adoption tracking", "userId, route, eventType, durationMs"],
              ]}
            />
          </SectionCard>

          {/* 3. Schema Flow */}
          <SectionCard {...SECTIONS[2]}>
            <FlowChart title="Analytics V3 Schema Relationships">{`ANALYTICS V3 SCHEMA

 PERSONA TABLES
  facultyImpactMetrics  <-- faculty x batch x subject
  cohortSnapshots       <-- institution x cohortKey x milestone
  studentBaselines      <-- student x subject (growth tracking)
  studentInsights       <-- student (7 insight rules)
  studentPredictionsV3  <-- student (trend + score forecast)
  batchInsights / branchInsights  <-- batch/branch aggregates

 CACHE TABLES
  attendanceHistogramCache   <-- scope (student/batch/branch)
  questionDiscriminationCache <-- exam x question

 ASK ANALYTICS TABLES
  askThreads -> askMessages (1:many)
  askSavedCards   <-- pinned questions on hub
  askFeedback     <-- thumbs up/down per message
  askPlanCache    <-- SHA-256 hash -> plan (24h TTL)

 REPORTS
  ptaReports         <-- student x faculty (share token + S3 PDF)
  analyticsPageviews <-- user x route (feature adoption)

 RANK PREDICTION (Phase 6)
  scoreRankCurves         <-- examType x year x category (NTA data)
  collegeCutoffs          <-- JoSAA/NEET counselling data
  studentRankPredictions  <-- student x examType (AIR + colleges)`}</FlowChart>
          </SectionCard>

          {/* 4. Nightly Jobs */}
          <SectionCard {...SECTIONS[3]}>
            <p className="mb-3">All jobs are idempotent and cursored (batch size 200) to scale to 10k students.</p>
            <FlowChart title="CRON 2 AM IST">{`CRON 2 AM IST
    |
    +-->  refreshCohortSnapshots
    |     batches -> group by (academic_year, target_exam)
    |     -> AVG(exam_submissions.percentage) per milestone
    |     -> UPSERT cohort_snapshots
    |
    +-->  refreshFacultyImpactMetrics
    |     faculty_batch_assignments -> for each faculty x batch x subject
    |     -> first exam avg vs last exam avg per student -> delta
    |     -> UPSERT faculty_impact_metrics
    |
    +-->  refreshStudentBaselines
    |     students without baseline this academic year
    |     -> first exam score per subject -> INSERT student_baselines
    |
    +-->  refreshAttendanceHistogram
    |     per batch -> attendance rates -> width_bucket(pct, 0, 100, 5)
    |     -> UPSERT attendance_histogram_cache
    |
    +-->  refreshQuestionDiscrimination
    |     per exam -> NTILE(4) quartiles -> top% - bottom% per question
    |     -> UPSERT question_discrimination_cache
    |
    +-->  refreshRankPredictions (Phase 6)
          per student -> latest score -> interpolate curve -> AIR
          -> match colleges -> UPSERT student_rank_predictions`}</FlowChart>
          </SectionCard>

          {/* 5. Scalability */}
          <SectionCard {...SECTIONS[4]}>
            <FlowChart title="Request & Write Paths">{`REQUEST FLOW (read path)
    |
    v
 Browser       ->  Next.js ISR        ->  API (Hono)
 TanStack Q         institution:60s        cursor pag.
 staleTime          batch: dynamic         limit 50
                                            |
                         +------------------+
                         v                  v
                  Cache tables        Source tables
                  (pre-agg'd)         (live query)
                  histogram,          submissions,
                  discrimination      attendance
                  cohort snap         mastery

WRITE PATH (nightly jobs)
    |
    v
 analyticsBus   ->  Job runner   ->   Cache table
 event              batch 200         UPSERT
 "exam_done"        idempotent`}</FlowChart>
            <ul className="list-disc list-inside space-y-1 mt-3 text-xs">
              <li>All list endpoints cursor-paginated (default 50, max 200)</li>
              <li>Histogram/box-plot bucket computation done SQL-side (width_bucket, percentile_cont)</li>
              <li>PTA PDF rendered async to S3 -- never blocks request</li>
              <li>TanStack Query keyed by cursor + filters; infinite scroll on rosters</li>
            </ul>
          </SectionCard>

          {/* 6. Chart Inventory */}
          <SectionCard {...SECTIONS[5]}>
            <Table
              headers={["Chart", "Library", "Used In"]}
              rows={[
                ["Knowledge gap heatmap", "Recharts + custom SVG", "student/analytics/heatmap, dashboard/student/[id]"],
                ["Bell curve + sigma bands", "Recharts AreaChart", "dashboard/batch/[id]/bell-curve/[examId]"],
                ["Box & whisker", "Recharts ComposedChart", "dashboard/batch/[id]/box-plot"],
                ["Sankey (syllabus flow)", "@nivo/sankey", "dashboard/batch/[id]/syllabus-flow"],
                ["Cumulative flow", "Recharts AreaChart stacked", "dashboard/batch/[id]/syllabus-flow"],
                ["Radar (sentiment)", "Recharts RadarChart", "parent/performance/sentiment-radar"],
                ["Scatter (time vs perf)", "Recharts ScatterChart", "student/analytics/time-vs-performance"],
                ["Histogram (attendance)", "Recharts BarChart", "dashboard, parent/performance"],
                ["Predictive path", "Recharts LineChart + ReferenceArea", "student/analytics/predictive-path"],
                ["Discrimination index", "Recharts BarChart", "dashboard/batch/*/discrimination"],
                ["Weakness improvement", "Recharts LineChart", "student/analytics/weakness-improvement"],
              ]}
            />
          </SectionCard>

          {/* 7. Files */}
          <SectionCard {...SECTIONS[6]}>
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">New -- Schema & Backend (~15 files)</h3>
                <p className="text-xs text-zinc-500">analytics-v3.ts, migration, cursor util, 5 nightly jobs, semantic layer, compiler, scope builder, Claude client, PTA PDF builder, S3 upload helper, ask-analytics routes, reports routes.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">New -- Shared UI (~14 files)</h3>
                <p className="text-xs text-zinc-500">AskInput, AskThread, AskChartRenderer, SaveToHub, BoxPlot, BellCurve, SankeyFlow, DiscriminationChart, AttendanceHistogram, RadarSentiment, HeatmapGrid, PredictivePathChart, CumulativeFlow.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">New -- Dashboard Pages (~17 files)</h3>
                <p className="text-xs text-zinc-500">PersonaSwitcher, AskFAB, Ask page, institution/ (cohorts, faculty-impact, resources), branch/[id], batch/[id]/ (box-plot, bell-curve, discrimination, syllabus-flow, at-risk, attendance-histogram), student/[id]/pta-report, faculty/[id], parents overview.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">New -- Student PWA (~10 files)</h3>
                <p className="text-xs text-zinc-500">heatmap, predictive-path, time-vs-performance, weakness-improvement, success-gap, relative-diff, test-analysis, subject postmortem, Ask page + FAB.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">New -- Parent PWA (~7 files)</h3>
                <p className="text-xs text-zinc-500">growth-velocity, sentiment-radar, benchmark, attendance, PTA shared view, Ask page + FAB.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">New -- Mobile (~3 files)</h3>
                <p className="text-xs text-zinc-500">KnowledgeHeatmapScreen, PredictivePathScreen, AskAnalyticsScreen.</p>
              </div>
            </div>
          </SectionCard>

          {/* 8. Verification */}
          <SectionCard {...SECTIONS[7]}>
            <FlowChart title="Verification Pipeline">{`1. Unit / integration tests
   pnpm test -- packages/api/src/routes/__tests__/analytics-v3.test.ts
   +- Each cursor-paginated endpoint
   +- Boundary: cursor=null, cursor=end
   +- Scope-leak: forged cross-tenant plan -> rejected

2. Manual E2E per persona (4 logins)
   +- admin@sample.com  -> /analytics -> drill -> PTA -> PDF -> share
   +- faculty@sample.com -> batch -> at-risk -> student -> PTA
   +- student@sample.com -> heatmap -> predictive -> weakness
   +- parent@sample.com -> growth -> radar -> benchmark -> PTA link

3. Scale smoke test
   pnpm tsx scripts/seed-analytics-scale.ts
   -> 10k students -> p50 query < 500ms

4. Guardrail check
   bash scripts/check-analytics-guardrail.sh
   -> 0 files outside allow-list

5. Build check
   pnpm build -> 12/12 tasks pass

6. Rollback plan
   Single branch, single migration, reversible`}</FlowChart>
          </SectionCard>

          {/* 9. Ask Excellencia AI */}
          <SectionCard {...SECTIONS[8]}>
            <p className="mb-2"><strong>Non-negotiable: LLM never writes SQL.</strong> Claude emits a structured JSON query plan against a semantic layer, which the server compiles to Drizzle. Tenant scope is injected from the authenticated session.</p>
            <FlowChart title="Ask Excellencia AI -- Full Architecture">{`USER types: "Which batch has the lowest attendance this month?"
    |
    v
POST /api/v1/analytics/ask/ask

 1. PLAN CACHE CHECK
    hash = SHA-256(normalizedQuestion + role + institutionId)
    cache hit (24h TTL) --> skip to step 4 (122ms)
    cache miss --> continue to step 2

 2. CLAUDE SONNET 4.6
    System prompt: semantic layer catalog + role scope matrix
    Output: JSON QueryPlan (~4s)
    {
      intent: "ranking",
      metrics: ["attendance_rate"],
      dimensions: ["batch"],
      filters: [{ dim: "month", op: "eq", val: "current" }],
      chart: { type: "bar", xAxis: "batch", yAxis: "attendance_rate" },
      narrative: "Here's the attendance ranking...",
      followUpSuggestions: ["Compare with last month", ...]
    }

 3. VALIDATE plan against semantic layer
    unknown metric key? -> 400 error
    role not allowed?   -> 403

 4. COMPILE plan -> Drizzle query
    INJECT tenant scope: institutionId, branchId from session
    Map metrics to pre-built query builders (no dynamic SQL)
    Apply LIMIT 1000, statement_timeout 5s
    Execute -> rows[]

 5. PERSIST thread + message to askThreads / askMessages

 6. RETURN { plan, rows, narrative, meta, followUpSuggestions }
    |
    v
UI RENDERER (ResponseChart component)
    plan.chart.type -> Recharts: bar/line/area/pie
    + Narrative text
    + Collapsible data table
    + Follow-up suggestion chips`}</FlowChart>

            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mt-6 mb-2">Scope Enforcement</h3>
            <FlowChart>{`buildScope(session):
    |
    +- role = super_admin  -> scope = { institutionId }
    +- role = branch_admin -> scope = { institutionId, branchId }
    +- role = faculty      -> scope = { institutionId, branchId, batchIds: assigned[] }
    +- role = student      -> scope = { studentId }
    +- role = parent       -> scope = { studentIds: linkedChildren[] }

Every compiled query has WHERE institution_id = $scope injected.
Claude CANNOT bypass this -- it emits metric/dimension keys, not table names.`}</FlowChart>
          </SectionCard>

          {/* 10. Use Cases */}
          <SectionCard {...SECTIONS[9]}>
            <Table
              headers={["Use Case", "Page", "Chart"]}
              rows={[
                ["Test analysis sheet for revision", "student/analytics/test-analysis/[examId]", "Table + heatmap + per-question status"],
                ["Subject-wise postmortem", "student/analytics/subject/[id]/postmortem", "Chapter x mastery bar + missed concepts"],
                ["Success gap (weak/strong)", "student/analytics/success-gap", "Two-column list with mastery delta"],
                ["Blooms analysis", "Added to dossier header across personas", "Stacked bar + line progression"],
                ["Attendance histogram", "dashboard/batch/:id/attendance-histogram", "Histogram + box plot"],
                ["Relative diff", "student/analytics/relative-diff", "Split bar showing delta per subject"],
                ["Weakness improvement", "student/analytics/weakness-improvement", "Before/after timeline"],
                ["Faculty generates PTA report", "dashboard/student/:id/pta-report", "PDF + share link"],
              ]}
            />
          </SectionCard>

          {/* 11. Acceptance Matrix */}
          <SectionCard {...SECTIONS[10]}>
            <div className="space-y-5">
              {[
                { role: "Admin (super_admin)", icon: <UsersFour weight="duotone" size={16} />, items: [
                  "Switch personas and see faculty/student/parent lens",
                  "Compare 'Class of 2024' vs 'Class of 2025' cohort at month 6",
                  "Rank faculty by impact score this term",
                  "Ask 'Which branch had the biggest attendance drop?' via Ask",
                  "Drill institution -> branch -> batch -> at-risk list (cursor-paginated)",
                  "Generate PTA report -> download PDF -> share link",
                ]},
                { role: "Faculty", icon: <ChalkboardTeacher weight="duotone" size={16} />, items: [
                  "Open assigned batch -> bell curve with sigma bands",
                  "See top-10 at-risk students sorted by fail probability",
                  "Identify 3 likely-flawed questions via discrimination index",
                  "Generate PTA report for one student, share with parent",
                  "Ask 'Which topic needs a re-teach for Batch A?'",
                ]},
                { role: "Student", icon: <Student weight="duotone" size={16} />, items: [
                  "Open heatmap -> chapter mastery by difficulty",
                  "See predictive grade path with confidence band",
                  "Time-on-task vs score scatter",
                  "Weakness-improvement timeline",
                  "Ask 'Where should I focus this week?'",
                  "Open test-analysis sheet for most recent exam",
                ]},
                { role: "Parent", icon: <Users weight="duotone" size={16} />, items: [
                  "Growth velocity vs own baseline per subject",
                  "Sentiment radar (academics, attendance, engagement)",
                  "Anonymized percentile benchmark",
                  "Open PTA report shared by faculty via read-only link",
                  "Ask 'How is my child improving this year?'",
                ]},
              ].map((group) => (
                <div key={group.role}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-600 dark:text-blue-400">{group.icon}</span>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{group.role}</span>
                  </div>
                  <ul className="space-y-1 ml-6">
                    {group.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <CheckCircle weight="duotone" size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 12. Execution Phases */}
          <SectionCard {...SECTIONS[11]}>
            <div className="space-y-3">
              {[
                { phase: "1A", title: "Schema + Seed + Insight Engine + Home", status: "done" as const, desc: "Schema additions, migration, cursor util, insight-engine, trend classifier, seed script, persona home pages, RecommendedActions." },
                { phase: "1B", title: "Ask Analytics Foundation", status: "done" as const, desc: "Claude client, semantic layer + compiler + scope, ask tables, POST /ask, context-aware suggestions." },
                { phase: "2", title: "Dashboard Drill-Downs + Adoption", status: "done" as const, desc: "Sidebar sub-tree, persona switcher, all admin/faculty drill-down pages, Cmd+K palette, ISR caching." },
                { phase: "3", title: "Student App Drill-Downs", status: "done" as const, desc: "Heatmap, predictive-path, time-vs-performance, weakness-improvement, success-gap, test-analysis, postmortem, Ask FAB." },
                { phase: "4", title: "Parent + PTA Pipeline + Voice", status: "done" as const, desc: "Parent home, growth-velocity, sentiment-radar, benchmark, PTA share, WhatsApp + OG image, voice input." },
                { phase: "5", title: "Mobile + Scale + Guardrail", status: "done" as const, desc: "Mobile screens, 10k-student smoke test, guardrail enforcement script, feature-flag removal." },
                { phase: "6", title: "Rank Prediction & College Predictor", status: "planned" as const, desc: "AIR prediction from NTA curves, JoSAA/NEET college cutoffs, category-wise rank, what-if simulator." },
                { phase: "7", title: "Missing Analytics Gaps", status: "planned" as const, desc: "Practice cadence, second-guess analytics, syllabus adherence, doubt SLA, fee analytics, wellness trend." },
              ].map((p) => (
                <div key={p.phase} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/70 dark:bg-zinc-800/40">
                  <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${p.status === "done" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"}`}>{p.phase}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{p.title}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-500 mt-0.5">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 13. Guardrail */}
          <SectionCard {...SECTIONS[12]}>
            <p className="mb-3">Edits limited to <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono">*/analytics/*</code>, <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono">*/progress/*</code>, <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono">*/performance/*</code>, plus three one-liners in sidebar, AppNavigator, and package index files. CI enforced.</p>
            <FlowChart title="scripts/check-analytics-guardrail.sh">{`#!/usr/bin/env bash
# Fails if any changed file is outside the analytics allow-list.
ALLOW='^(apps/(dashboard|student|parent|mobile)/src/...analytics patterns...)'
git diff --name-only origin/main... | grep -v -E "$ALLOW" \\
  && { echo "Guardrail violated"; exit 1; } \\
  || echo "Guardrail ok"`}</FlowChart>
          </SectionCard>

          {/* 14. Risk Register */}
          <SectionCard {...SECTIONS[13]}>
            <Table
              headers={["Risk", "Likelihood", "Mitigation"]}
              rows={[
                ["LLM emits invalid plan with unknown metric", "High", "Strict JSON schema validation; semantic-layer.test.ts"],
                ["Compiler leaks across tenants", "Low (catastrophic)", "buildScope is the ONLY way; unit test suite forges cross-tenant plans"],
                ["PTA PDF generation OOMs", "Medium", "Worker-pool, 20-page cap, HTML fallback"],
                ["Cohort snapshot jobs duplicate", "Low", "UNIQUE(cohortKey, milestone) constraint"],
                ["Claude prompt cache invalidated -> cost spike", "Medium", "System prompt versioned; cost dashboard daily"],
                ["Nivo Sankey large bundle weight", "Medium", "Code-split via dynamic import; lazy-loaded"],
                ["Migration collision with parallel branches", "Low", "Single migration 0024; merge conflict forces rebase"],
              ]}
            />
          </SectionCard>

          {/* 15. Product Refinements */}
          <SectionCard {...SECTIONS[14]}>
            <div className="space-y-4">
              {[
                { title: "Persona Home Pages", desc: "Every persona lands on 3-5 auto-generated text insights, not charts. Charts are secondary." },
                { title: "Insight Engine (7 student rules + faculty + admin)", desc: "Deterministic rules, no LLM. velocity_up/down, inefficient_study, weakness_resolved/introduced, time_pressure, topic_hotspot, attendance_drop." },
                { title: "Actionability -- Every Page Footer", desc: "Top 3 actionable insights scoped to the page. Click -> deep link to practice/revision flow." },
                { title: "Role-Gated Chart Allow-List", desc: "Parents see line/bar/radar/kpi_card/table. Students add heatmap/scatter/area. Faculty gets everything except sankey on non-cohort." },
                { title: "Trend Classifier", desc: "improving | plateau | declining | volatile based on slope and R-squared of score trajectory." },
                { title: "Context-Aware Ask Suggestions", desc: "FAB reads (route, scope, lastInsight) and shows 3 cached contextual questions." },
                { title: "Viral PTA Report", desc: "WhatsApp share, OG summary image (1200x630), QR code on PDF last page." },
                { title: "Global Cmd+K Palette", desc: "Jump to student, batch, faculty, exam, any analytics page. 18 routes indexed." },
                { title: "Weekly Brief (Habit Loop)", desc: "7-day insight digest: wins / losses / focus. Sunday 8 AM push + Monday morning card." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-2">
                  <CaretRight size={14} className="text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{item.title}</span>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 16. Schema-Driven Analytics */}
          <SectionCard {...SECTIONS[15]}>
            <p className="mb-3">Mined all 28 schema files for data we could surface with zero new schema cost -- just new endpoints + views.</p>
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Student-Facing</h3>
                <p className="text-[11px] text-zinc-500">Lecture watch heatmap, doubt resolution timeline, time-per-question by difficulty.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Faculty-Facing</h3>
                <p className="text-[11px] text-zinc-500">Syllabus gap report, doubt SLA per faculty, question bank hygiene, assignment swap rationale.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Admin-Facing</h3>
                <p className="text-[11px] text-zinc-500">Adoption dashboard, faculty workload fairness, dispute resolution patterns, support ticket SLA, peer pairing ROI, live class recording adoption, PTM engagement, fee transaction health, notification channel effectiveness.</p>
              </div>
            </div>
          </SectionCard>

          {/* 17. Experience Layer */}
          <SectionCard {...SECTIONS[16]}>
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Design Tokens</h3>
                <p className="text-[11px] text-zinc-500">JetBrains Mono for numbers, Inter body, Satoshi display. Color: #2563EB primary, #10B981 success, #EF4444 danger. Radius: 8/12/16/24. Shadow: hairline/card/float.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Motion System</h3>
                <p className="text-[11px] text-zinc-500">Entrance 240ms max, exit 180ms. Lists use staggerContainer (40ms). Numbers animate via useAnimatedNumber. Charts: line draws 400ms, bars grow with 30ms stagger. prefers-reduced-motion respected.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Page State Machine (all 6 states)</h3>
                <FlowChart>{`IDLE -> LOADING (skeleton within 200ms)
  -> SUCCESS | EMPTY | ERROR | PARTIAL
     ERROR -> retry -> LOADING

OFFLINE (mobile/PWA):
  Shows cached snapshot + "Showing data from 4 min ago" banner.`}</FlowChart>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Performance Budget</h3>
                <Table
                  headers={["Metric", "Target"]}
                  rows={[
                    ["Time-to-skeleton", "150ms"],
                    ["First meaningful paint", "600ms on 4G"],
                    ["First chart paint", "900ms"],
                    ["Route change latency", "80ms to skeleton"],
                    ["Ask first token", "800ms"],
                    ["Scroll jank", "0 frames > 16ms"],
                    ["Bundle per route", "180KB gzip"],
                  ]}
                />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Accessibility (WCAG 2.1 AA)</h3>
                <p className="text-[11px] text-zinc-500">Contrast 4.5:1+, keyboard nav, focus management on route change, ARIA live regions for Ask streaming, charts have hidden data tables, color-blind safe icons + text, 44x44 hit targets on mobile.</p>
              </div>
            </div>
          </SectionCard>

          {/* 18. Cross-Persona Flows */}
          <SectionCard {...SECTIONS[17]}>
            <FlowChart title="5 Investor Moments">{`FLOW 1: Faculty spots flaw -> Student gets nudge
  Faculty opens discrimination chart -> flags Q14
  -> Creates dispute -> Student gets "pending review" badge
  -> Dispute resolved -> Score adjusted -> Student notified

FLOW 2: PTA Report via WhatsApp
  Faculty generates report -> PDF to S3 -> share token
  -> WhatsApp pre-filled link -> Parent opens /pta-report/:token
  -> Parent replies -> Creates doubt for faculty

FLOW 3: Student Ask -> Actionable chip
  Student sees red cell on heatmap -> taps -> postmortem
  -> Ask FAB: "Why am I losing marks?" -> Claude streams plan
  -> Chart renders -> "Start 15-min revision" chip -> practice flow

FLOW 4: Admin drills to root cause (3 clicks)
  Home insight: "Class of 2027 trailing by 8%"
  -> Cohort comparison -> Physics divergence
  -> Faculty impact -> lowest-impact faculty -> action

FLOW 5: Student comeback after absence
  5 days offline -> insight: attendance_drop + topic_hotspot
  -> Monday push: "20-minute comeback plan"
  -> Student opens -> hero card -> targeted practice
  -> Complete -> celebration -> insight flips to "resolving"`}</FlowChart>
          </SectionCard>

          {/* 19. Investor Demo Script */}
          <SectionCard {...SECTIONS[18]}>
            <div className="space-y-3">
              {[
                { time: "0:00", title: "Open dashboard as admin", desc: "Land on /analytics/home. '4 persona lenses, 2 branches, 6 batches, 150 students.' Hero insight: 'Class of 2027 trailing by 8%.'" },
                { time: "0:45", title: "Drill to root cause", desc: "Click insight -> cohort comparison -> Sankey divergence -> faculty impact. 'Three clicks from home to root cause.'" },
                { time: "1:30", title: "Faculty lens", desc: "Persona switcher -> bell curve page -> discrimination chart flags 3 flawed questions. 'Faculty would never catch this manually.'" },
                { time: "2:00", title: "Generate PTA report", desc: "Student dossier -> Generate -> 2s render -> Share with parent -> WhatsApp. 'Zero friction.'" },
                { time: "2:30", title: "Student app", desc: "Heatmap -> Organic Chemistry red -> Ask 'Why am I losing marks?' -> Chart + narrative + 'Start 15-min revision' chip. 'Insight -> action in 10 seconds.'" },
                { time: "3:30", title: "Parent PWA", desc: "Hero: 'Your child improved 12% but dropped in Physics.' PTA report card. 'WhatsApp-simple view of a complex system.'" },
                { time: "4:00", title: "Adoption dashboard", desc: "/analytics/institution/adoption. 'We track which features get used.'" },
              ].map((step) => (
                <div key={step.time} className="flex items-start gap-3">
                  <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded shrink-0">{step.time}</span>
                  <div>
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{step.title}</span>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 20. Seed Data */}
          <SectionCard {...SECTIONS[19]}>
            <FlowChart title="Demo Institute Shape">{`Institution: "Excellencia AI Demo Institute"
+-- 2 Branches: "Demo North", "Demo South"
|   +-- 3 Batches each = 6 total (JEE 2026/NEET 2026/JEE 2027)
|   +-- 6 Faculty (2 per subject x 3 subjects)
|   +-- 3 Subjects per batch (Physics, Chemistry, Maths/Biology)
+-- 150 students + 150 parents
+-- Academic: 10 PYQ + 5 mock + 20 DPP + 50 assignments per batch
+-- Behavioral: 90 days attendance, 30 live class sessions
+-- ERI/mastery: student_cell_mastery + 30 days of snapshots
+-- Analytics v3: cohort snapshots, faculty impact, baselines,
    histogram cache, discrimination cache, 3 sample PTA reports`}</FlowChart>
          </SectionCard>

          {/* 21. Implementation Status */}
          <SectionCard {...SECTIONS[20]}>
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 mb-4">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">All Phases 1A through 5 complete. 24 commits. Full pnpm build passes (12/12 tasks).</p>
            </div>
            <Table
              headers={["Phase", "Status", "Key Commits"]}
              rows={[
                ["1A -- Schema + seed + insight + home", "Done", "a87f489, dec0af6, d3a24cb"],
                ["1B -- Ask Analytics foundation", "Done", "9f37d19"],
                ["2 -- Dashboard drill-downs", "Done", "95ee33d, 06387ee, 6adfa2b"],
                ["3 -- Student app drill-downs", "Done", "a72f499, 6adfa2b"],
                ["4 -- Parent app pages", "Done", "e13ba64, 6adfa2b"],
                ["5 -- Mobile + guardrail", "Done", "6adfa2b, 3503484"],
                ["Deferred items", "Done", "Voice, Cmd+K, ISR, S3, exam seed, scale test"], // user-error-ok: internal build-status table, not an error surface
                ["Build fixes", "Done", "Framer Motion types, Badge variants, color tokens"],
                ["UX improvements", "Done", "Ask redesign, insights icons, page restructure"],
                ["Real v3 endpoints", "Done", "faculty-impact + cohorts query real DB tables"],
              ]}
            />
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Files", value: "50+" },
                { label: "Lines of Code", value: "~15,000" },
                { label: "Analytics Pages", value: "40+" },
                { label: "DB Tables", value: "17" },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-lg bg-slate-50/70 dark:bg-zinc-800/40 text-center">
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-[JetBrains_Mono,monospace]">{stat.value}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 22. Master System Diagram */}
          <SectionCard {...SECTIONS[21]}>
            <FlowChart title="Master Analytics Flow -- Complete System">{`DATA SOURCES (existing tables)
  exam_submissions, exam_responses, practice_error_log,
  lectureWatchProgress, classSessions, teachingDayPlan,
  attendance, doubts, ptmBookings, feeTransactions,
  liveClassParticipants, notifications, student_cell_mastery,
  practice_sessions, wellnessSignals, peerHistory,
  supportTickets, knowledgeGraphEdges
         |              |              |              |
  INSIGHT ENGINE   NIGHTLY JOBS   ASK BRILLIANCE   RANK ENGINE
   (hourly)         (2 AM)        (on-demand)      (post-exam)
         |              |              |              |
  student_insights  cache tables   askThreads     student_rank
  student_pred_v3   (cohort,       askMessages    _predictions
  batchInsights     faculty,       askPlanCache   college_cutoffs
  branchInsights    attendance,                   score_rank_curves
                    discrim.,
                    baselines)
         |              |              |              |
         +--------+-----+------+------+------+------+
                  |            |            |
           DASHBOARD     STUDENT APP   PARENT APP
           (admin +      (PWA)         (PWA)
            faculty)

 ADMIN SEES:           STUDENT SEES:        PARENT SEES:
 Institution overview  Knowledge heatmap    Growth velocity
 Branch comparison     Predictive path+AIR  Sentiment radar
 Batch drill-down      Time vs perf         Percentile benchmark
 Faculty impact rank   Weakness improvement Attendance
 Cohort comparison     Success gap          PTA report (shared)
 At-risk students      Test analysis        Rank predictor
 PTA report gen.       Rank predictor       College predictor
 Attendance histogram  College predictor    Ask Excellencia AI
 Syllabus coverage     Practice cadence
 Fee analytics         Error correction
 Ask Excellencia AI        Ask Excellencia AI
 Cmd+K search`}</FlowChart>
          </SectionCard>

          {/* 23. Student Dossier */}
          <SectionCard {...SECTIONS[22]}>
            <FlowChart title="Student Dossier Page Layout">{`STUDENT DOSSIER PAGE

 PROFILE HEADER
  Name | Batch | Roll | Target Exam
  Predicted AIR: ~10,570 (Phase 6) | Trend: Improving

 KPI ROW (5 cards)
  Total Exams: 12 | Avg Score: 67% | Avg Percentile: 72nd
  Highest Score: 85% | Consistency: 74/100

 EXAM HISTORY          -- Score trajectory LineChart (last 12)
 SUBJECT PERFORMANCE   -- RadarChart: accuracy per subject
 MASTERY / SKILL MAP   -- Topic x mastery heatmap grid
 ERROR PATTERNS        -- Error type distribution + trend
 ASSIGNMENTS           -- Completion rate, late %, score trend
 ATTENDANCE            -- 30d rate, calendar heatmap, streaks
 TOPICS COVERED vs ASSESSED -- Taught vs tested gap
 PRACTICE BEHAVIOR     -- Cadence, DPP streak, self-study ratio
 RANK PREDICTION       -- AIR ~10,570 | Category Rank: ~2,854
 RECENT EXAMS TABLE    -- Drill-down per exam

 ACTIONS: [Generate PTA Report] [Share with Parent] [Ask AI]`}</FlowChart>
            <p className="mt-3 text-xs text-zinc-500">Existing endpoints (12 total) power most sections. New additions: assignment completion, attendance calendar, topics covered vs assessed, practice behavior (Phase 7), rank prediction (Phase 6).</p>
          </SectionCard>

          {/* 24. Rank Prediction & College Predictor */}
          <SectionCard {...SECTIONS[23]}>
            <p className="mb-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">"Rank is the entire product. Parents care that 245 marks = AIR ~12,000, which = NIT Trichy CSE possible, IIT Bombay CSE not."</p>
            <FlowChart title="Score -> AIR Prediction Flow">{`Student takes mock test -> score: 245/300
    |
    v
NORMALIZE to actual exam scale
    |
    v
LOAD score_rank_curves for jee_mains, years [2023, 2024, 2025]
    |
    v
INTERPOLATE each year's curve:
    Year 2025: score 245 -> rank ~10,500
    Year 2024: score 245 -> rank ~11,200
    Year 2023: score 245 -> rank ~9,800
    |
    v
BLEND: 10,500 x 0.5 + 11,200 x 0.3 + 9,800 x 0.2 = 10,570
    |
    v
CONFIDENCE BAND (+/-15%):
    rank_low = 8,985 (optimistic)
    rank_high = 12,156 (conservative)
    |
    v
CATEGORY RANK (if OBC-NCL):
    generalRank x 0.27 = ~2,854
    |
    v
COLLEGE MATCH:
    SELECT FROM college_cutoffs WHERE closing_rank >= 2854 x 0.67
    |
    v
CLASSIFY:
    safe (rank < closing x 0.8):     NIT Trichy CSE, BITS Pilani EEE
    moderate (rank < closing x 1.1): IIT Guwahati ME, NIT Warangal CSE
    ambitious (rank < closing x 1.5): IIT Bombay CSE, IIT Delhi EE`}</FlowChart>

            <Table
              headers={["Score (out of 300)", "Percentile", "Approx AIR"]}
              rows={[
                ["300", "100.00", "1"],
                ["280", "99.997", "~50"],
                ["250", "99.87", "~1,500"],
                ["220", "99.5", "~5,000"],
                ["200", "98.7", "~15,000"],
                ["180", "97.5", "~30,000"],
                ["150", "94.2", "~70,000"],
                ["120", "88.0", "~150,000"],
                ["100", "75.0", "~300,000"],
              ]}
            />
          </SectionCard>

          {/* 25. Phase 7 -- Missing Analytics */}
          <SectionCard {...SECTIONS[24]}>
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Tier 1 -- High Impact, Data Exists</h3>
                <Table
                  headers={["Feature", "Data Source", "Persona"]}
                  rows={[
                    ["Practice cadence", "practice_sessions", "Student, Faculty"],
                    ["Second-guess analytics", "exam_responses.answerChangeHistory", "Student"],
                    ["Time pressure fingerprint", "exam_responses.visitCount + revisitTimestamps", "Student, Faculty"],
                    ["Syllabus adherence", "teachingDayPlan planned vs covered", "Admin, Faculty"],
                    ["Doubt resolution SLA", "doubts.createdAt vs facultyAnsweredAt", "Admin"],
                    ["Error correction cycle", "practice_error_log.revisionCount", "Student"],
                    ["Lecture completion rate", "lectureWatchProgress.progress", "Admin"],
                    ["Login gap detection", "users.lastLoginAt", "Faculty, Admin"],
                  ]}
                />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Tier 2 -- Medium Impact</h3>
                <p className="text-[11px] text-zinc-500">Fee analytics, wellness trend, PTM engagement, peer teaching score, prerequisite chain risk, batch migration impact, faculty punctuality.</p>
              </div>
            </div>
          </SectionCard>

          {/* 26. UX Improvements */}
          <SectionCard {...SECTIONS[25]}>
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Analytics Main Page Restructure</h3>
                <p className="text-[11px] text-zinc-500">Before: Institution KPIs mixed with batch dropdown. After: Clear separation with header, quick nav cards, institution KPIs, insights, performance trend, branch comparison, top batches, then batch drill-down section.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Ask Excellencia AI Redesign</h3>
                <p className="text-[11px] text-zinc-500">Gradient icon hero, 3 category cards, AI avatar on responses, chart rendering (bar/line/area/pie), collapsible data table, retry on errors, follow-up chips, dark mode fix.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Insights Home Page Icons</h3>
                <p className="text-[11px] text-zinc-500">Severity-mapped icons: velocity_up (TrendUp green), topic_hotspot (Target purple), attendance_drop (Warning amber), weakness_resolved (ShieldCheck green), predicted_dip (Eye red). Kind badge pill + gradient header icon.</p>
              </div>
            </div>
          </SectionCard>

          {/* Footer */}
          <div className="text-center py-10 text-xs text-zinc-400 dark:text-zinc-600">
            Excellencia AI Analytics Plan -- Last updated April 16, 2026
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar nav (shared between mobile + desktop)                      */
/* ------------------------------------------------------------------ */

function SidebarNav({ sections, activeId, onSelect }: { sections: Section[]; activeId: string; onSelect: (id: string) => void }) {
  return (
    <ul className="py-3 px-3 space-y-0.5">
      {sections.map((s) => (
        <li key={s.id}>
          <button
            onClick={() => onSelect(s.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 text-[12px] ${
              activeId === s.id
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-primary/5 dark:hover:bg-primary/15/50"
            }`}
          >
            <span className="shrink-0">{s.icon}</span>
            <span className="truncate">{s.title}</span>
            {s.status && (
              <span className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${s.status === "done" ? "bg-emerald-500" : "bg-blue-500"}`} />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function StatusPill({ label, variant = "neutral" }: { label: string; variant?: "neutral" | "success" | "blue" }) {
  const cls =
    variant === "success"
      ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/20"
      : variant === "blue"
        ? "bg-blue-400/20 text-blue-200 border-blue-400/20"
        : "bg-white/10 text-blue-100 border-white/10";
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold border ${cls}`}>{label}</span>;
}
