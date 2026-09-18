"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Exam,
  TrendUp,
  Stack,
  UsersFour,
  Warning,
  ArrowRight,
  ChartBar,
} from "@phosphor-icons/react";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useBranchContext } from "@/lib/branch-context";
import { usePermission } from "@/lib/permissions";
// Batch drill-down moved to /analytics/batch/[id] — these are no longer used here
// import { SectionSelector } from "@/components/section-selector";
// import { ExamTypeFilter } from "./_components/exam-type-filter";
// import { CrossBatchStudentPicker } from "./_components/cross-batch-student-picker";
import { DateRangePicker } from "./_components/date-range-picker";
import { rangeForPreset as rangeForDateRangePreset, type DateRange } from "@/lib/date-ranges";

import {
  stagger,
  fadeUp,
  sectionFade,
  type InstitutionData,
  type TrendPoint,
  type AttendanceSummary,
  type BatchOption,
  type BloomsRow,
} from "./_components/shared";
import { KpiCard, KpiSkeleton } from "./_components/kpi-card";
import { PerformanceTrendChart, PerformanceTrendSkeleton } from "./_components/performance-trend-chart";
import { BranchComparisonChart } from "./_components/branch-comparison-chart";
import { AttendanceDonut } from "./_components/attendance-donut";
import { TopBatchesLeaderboard } from "./_components/top-batches-leaderboard";
import { TopPerformers } from "./_components/top-performers";
// Removed per product decision — no faculty ranking
// import { FacultyEffectivenessPanel } from "./_components/faculty-effectiveness-panel";
import { AtRiskStudentsPanel } from "./_components/at-risk-students-panel";
// import { BloomsHeatmap } from "./_components/blooms-heatmap";

/* eslint-disable @typescript-eslint/no-explicit-any */

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl skeleton-shimmer bg-slate-50/70 dark:bg-surface-elevated-dark ${className}`}
    />
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuthStore();
  const role = user?.role ?? "";
  const contextBranchId = useBranchContext((s) => s.selectedBranchId);
  const selectedBranch = useBranchContext((s) => s.selectedBranch);
  const branches = useBranchContext((s) => s.branches);
  const selectBranch = useBranchContext((s) => s.selectBranch);
  // Branch admin is always scoped to their own branch
  const selectedBranchId = contextBranchId || (role === "branch_admin" ? user?.branchId ?? "" : "");

  // Hydrate the branch context from a `?branchId=` URL param so that
  // deep links from /analytics/branches show the branch's name in the
  // title + scope every chart to that branch. Re-runs when branches
  // finish loading in case the context didn't have them on first render.
  // `window.location.search` is used (not useSearchParams) so the
  // page can still be statically prerendered without a Suspense
  // boundary at the route root.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlBranchId = new URLSearchParams(window.location.search).get(
      "branchId",
    );
    if (!urlBranchId) return;
    if (contextBranchId === urlBranchId && selectedBranch) return;
    if (branches.length > 0) {
      selectBranch(urlBranchId);
    }
  }, [branches, contextBranchId, selectedBranch, selectBranch]);

  const [loadingInst, setLoadingInst] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>(() =>
    rangeForDateRangePreset("month"),
  );

  const rangeFrom = dateRange.from;
  const rangeTo = dateRange.to;

  // Batch selection state
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [examTypeFilter, setExamTypeFilter] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const dateQs = [
    rangeFrom && rangeTo ? `from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}` : "",
    examTypeFilter ? `examType=${encodeURIComponent(examTypeFilter)}` : "",
    selectedStudentIds.length > 0 ? `studentIds=${selectedStudentIds.join(",")}` : "",
  ].filter(Boolean).join("&");

  // Data state
  const [instData, setInstData] = useState<InstitutionData | null>(null);
  const instDataRef = useRef<InstitutionData | null>(null);
  instDataRef.current = instData;
  const instFetchGen = useRef(0);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [batchSummary, setBatchSummary] = useState<{
    batchName: string;
    averageScore: number;
    cohortSize: number;
    studentCount: number;
    dateFrom: string | null;
    dateTo: string | null;
  } | null>(null);
  const [bloomsRows, setBloomsRows] = useState<BloomsRow[]>([]);

  const canInstitution = usePermission("analytics:institution");
  const canBranch = usePermission("analytics:branch");
  const canDashboard = canInstitution || canBranch;
  const isFaculty = role === "faculty";

  // ── Data loaders ─────────────────────────────────────────

  const loadBatches = useCallback(async () => {
    if (isFaculty) {
      const res = await apiClient.get<BatchOption[]>("/api/v1/analytics/assigned-batches");
      if (res.success && Array.isArray(res.data)) {
        const mapped = (res.data as any[]).map((r: any) => ({
          batchId: r.batchId,
          batchName: r.batchName,
          branchId: r.branchId,
          targetExam: r.targetExam,
        }));
        setBatchOptions(mapped);
        setSelectedBatchId((prev) => prev || mapped[0]?.batchId || "");
      }
    } else {
      // Pass branchId to API so we only get batches for the selected branch
      const branchParam = selectedBranchId ? `&branchId=${selectedBranchId}` : "";
      const res = await apiClient.get<any[]>(`/api/v1/batches?limit=200${branchParam}`);
      if (res.success && Array.isArray(res.data)) {
        const mapped = res.data.map((b: any) => ({
          batchId: b.id,
          batchName: b.name,
          branchId: b.branchId,
          targetExam: b.targetExam,
        }));
        setBatchOptions(mapped);
        // Auto-select the first batch
        if (mapped.length > 0) {
          setSelectedBatchId(mapped[0]!.batchId);
        } else {
          setSelectedBatchId("");
        }
      }
    }
  }, [isFaculty, selectedBranchId]);

  const loadInstitution = useCallback(async () => {
    if (!canDashboard) return;
    const gen = ++instFetchGen.current;
    // Keep the last good snapshot on screen — flipping to skeleton on every
    // in-flight request is what made a refetch loop look "stuck loading".
    if (!instDataRef.current) setLoadingInst(true);
    setErrorMsg("");
    try {
      const q = dateQs ? `?${dateQs}` : "";

      const trendQs = `months=12${selectedBranchId ? `&branchId=${selectedBranchId}` : ""}${dateQs ? `&${dateQs}` : ""}`;

      if (selectedBranchId) {
        // ── Branch-specific view ──────────────────────────
        const [branchRes, trendRes, attRes] = await Promise.all([
          apiClient.get<any>(`/api/v1/analytics/branch/${selectedBranchId}`),
          apiClient.get<any>(`/api/v1/analytics/institution/trends?${trendQs}`),
          apiClient.get<any>(
            `/api/v1/attendance-analytics/today-summary?branchId=${selectedBranchId}`,
          ),
        ]);

        if (branchRes.success && branchRes.data) {
          const d = branchRes.data;
          setInstData({
            totalStudents: d.totalStudents ?? 0,
            totalExams: d.totalExams ?? 0,
            avgPercentile: d.overallAvgPercentile ?? 0,
            activeBatches: d.totalBatches ?? 0,
            branches: [], // no branch comparison when viewing a single branch
            topBatches: (d.batchComparison || []).map((b: any, i: number) => ({
              rank: i + 1,
              batchId: b.batchId || b.id || "",
              name: b.batchName || b.name,
              branch: d.branchName || "--",
              avgPercentile: b.avgPercentile ?? 0,
              students: b.studentCount ?? 0,
            })),
            facultyEffectiveness: (d.facultyEffectiveness || []).map(
              (f: any) => ({
                name: f.facultyName || f.name,
                subject: f.subject || "--",
                delta:
                  f.avgStudentPercentile > 0
                    ? `+${f.avgStudentPercentile}%`
                    : f.delta || "--",
                batches: f.examsCreated ?? f.batches ?? 0,
              }),
            ),
            atRiskStudents: [],
          });
        } else {
          const msg =
            typeof branchRes.error === "string"
              ? branchRes.error
              : "Failed to load branch analytics";
          if (msg.includes("401") || msg.includes("Unauthorized"))
            router.push("/login");
          else setErrorMsg(msg);
        }

        if (attRes.success && attRes.data) setAttendance(attRes.data);
        if (trendRes.success && trendRes.data?.trends)
          setTrendData(trendRes.data.trends);
      } else {
        // ── Institution-wide view ─────────────────────────
        const [instRes, trendRes] = await Promise.all([
          apiClient.get<any>(`/api/v1/analytics/institution${q}`),
          apiClient.get<any>(`/api/v1/analytics/institution/trends?${trendQs}`),
        ]);

        if (instRes.success && instRes.data) {
          const d = instRes.data;

          // Fetch attendance with the first branchId (required for super_admin).
          // This depends on instRes so it can't be parallelized above.
          const firstBranchId =
            (d.branchComparison || d.branches || [])[0]?.branchId ??
            (d.branchComparison || d.branches || [])[0]?.id;
          if (firstBranchId) {
            apiClient
              .get<any>(`/api/v1/attendance-analytics/today-summary?branchId=${firstBranchId}`)
              .then((attRes) => {
                if (attRes.success && attRes.data) setAttendance(attRes.data);
              });
          }

          setInstData({
            totalStudents: d.totalStudents ?? d.students ?? 0,
            totalExams: d.totalExams ?? d.exams ?? 0,
            avgPercentile: d.avgPercentile ?? d.averagePercentile ?? 0,
            activeBatches: (d.topBatches || d.batches || []).length,
            branches: (d.branches || d.branchComparison || []).map(
              (b: any) => ({
                branchId: b.branchId ?? b.id,
                name: b.branchName || b.name,
                percentile: b.avgPercentile ?? b.percentile ?? 0,
                students: b.studentCount ?? b.students ?? 0,
                examsConducted: b.examsConducted ?? 0,
              }),
            ),
            topBatches: (d.topBatches || d.batches || []).map(
              (b: any, i: number) => ({
                rank: i + 1,
                batchId: b.batchId || b.id || "",
                name: b.batchName || b.name,
                branch: b.branch || b.branchName || "--",
                avgPercentile: b.avgPercentile ?? b.percentile ?? 0,
                students: b.students ?? b.studentCount ?? 0,
              }),
            ),
            facultyEffectiveness: (
              d.facultyEffectiveness ||
              d.faculty ||
              []
            ).map((f: any) => ({
              name: f.name,
              subject: f.subject || "--",
              delta:
                typeof f.delta === "number"
                  ? `+${f.delta}%`
                  : f.delta || "--",
              batches: f.batches ?? f.batchCount ?? 0,
            })),
            atRiskStudents: (d.atRiskStudents || d.atRisk || []).map(
              (s: any, i: number) => ({
                id: String(s.studentId || s.id || `at-risk-${i}`),
                name: s.name,
                branch: s.branch || s.branchName || "--",
                batch: s.batch || s.batchName || "--",
                percentile: s.percentile ?? 0,
                scores: s.scores || s.recentScores || [],
                daysSinceLogin: s.daysSinceLogin ?? s.lastLoginDays ?? 0,
                severity:
                  s.severity ||
                  (s.percentile < 30 ? "critical" : "warning"),
              }),
            ),
          });
        } else {
          const msg =
            typeof instRes.error === "string"
              ? instRes.error
              : "Failed to load institution analytics";
          if (msg.includes("401") || msg.includes("Unauthorized"))
            router.push("/login");
          else setErrorMsg(msg);
        }

        if (trendRes.success && trendRes.data?.trends)
          setTrendData(trendRes.data.trends);
      }
    } catch (e: any) {
      if (gen !== instFetchGen.current) return;
      setErrorMsg(e.message || "Failed to load analytics");
    } finally {
      if (gen === instFetchGen.current) setLoadingInst(false);
    }
  }, [canDashboard, dateQs, router, selectedBranchId]);

  const loadBatchAnalytics = useCallback(async () => {
    if (!selectedBatchId) {
      setBatchSummary(null);
      setBloomsRows([]);
      return;
    }
    setLoadingBatch(true);
    setErrorMsg("");
    const params = new URLSearchParams();
    if (rangeFrom) params.set("from", rangeFrom);
    if (rangeTo) params.set("to", rangeTo);
    if (sectionFilter) params.set("section", sectionFilter);
    const q = params.toString();
    const batchUrl = `/api/v1/analytics/batch/${selectedBatchId}${q ? `?${q}` : ""}`;
    const bloomsUrl = `/api/v1/analytics/batch/${selectedBatchId}/blooms-topics${q ? `?${q}` : ""}`;

    try {
      const [bRes, blRes] = await Promise.all([
        apiClient.get<any>(batchUrl),
        apiClient.get<{ rows: BloomsRow[] }>(bloomsUrl),
      ]);

      if (bRes.success && bRes.data) {
        const b = bRes.data;
        setBatchSummary({
          batchName: b.batchName ?? "Batch",
          averageScore: b.averageScore ?? 0,
          cohortSize: b.cohortSize ?? b.studentCount ?? 0,
          studentCount: b.studentCount ?? 0,
          dateFrom: b.dateFrom ?? null,
          dateTo: b.dateTo ?? null,
        });
      } else {
        const msg =
          typeof bRes.error === "string"
            ? bRes.error
            : "Batch analytics failed";
        if (msg.includes("401") || msg.includes("Unauthorized"))
          router.push("/login");
        else if (msg.includes("403"))
          setErrorMsg("You do not have access to this batch.");
        else setErrorMsg(msg);
      }

      if (blRes.success && blRes.data && Array.isArray((blRes.data as any).rows)) {
        setBloomsRows((blRes.data as any).rows);
      } else {
        setBloomsRows([]);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to load batch analytics");
    } finally {
      setLoadingBatch(false);
    }
  }, [selectedBatchId, rangeFrom, rangeTo, sectionFilter, router]);

  // ── Effects ──────────────────────────────────────────────

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    loadBatches();
  }, [authLoading, isAuthenticated, loadBatches]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (canDashboard) loadInstitution();
    else setInstData(null);
  }, [authLoading, isAuthenticated, canDashboard, loadInstitution]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    loadBatchAnalytics();
  }, [authLoading, isAuthenticated, loadBatchAnalytics]);

  // ── Loading state ────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg p-8 dark:bg-bg-dark">
        <div className="mx-auto max-w-7xl space-y-6">
          <SkeletonBlock className="h-10 w-64" />
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
          <PerformanceTrendSkeleton />
          <div className="grid gap-6 lg:grid-cols-5">
            <SkeletonBlock className="h-[340px] lg:col-span-3" />
            <SkeletonBlock className="h-[340px] lg:col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push("/login");
    return null;
  }

  const data = instData;

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="min-h-screen overflow-y-auto bg-bg p-8 dark:bg-bg-dark">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <motion.div
          className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <ChartBar size={22} weight="duotone" className="text-primary" />
            </div>
            <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {canDashboard
                ? canInstitution
                  ? selectedBranch
                    ? `${selectedBranch.name} Analytics`
                    : "Institution Analytics"
                  : "Branch Analytics"
                : "Batch Analytics"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {canDashboard
                ? canInstitution && !selectedBranch
                  ? "Overview of all branches, batches, faculty, and student performance."
                  : "Branch performance, batches, and student analytics."
                : "Your assigned batches — filter by date and student cohort."}
            </p>

            {/* Branch breadcrumb context */}
            {canInstitution && selectedBranch && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <button
                  type="button"
                  onClick={() => useBranchContext.getState().clearBranch()}
                  className="hover:text-primary transition-colors"
                >
                  All Branches
                </button>
                <ArrowRight size={10} weight="bold" className="text-muted/60" />
                <span className="font-medium text-foreground">{selectedBranch.name}</span>
              </div>
            )}
          </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              data-testid="analytics.overview.filter.batch"
              aria-label="Filter by batch"
              className="appearance-none rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-gray-900 dark:border-border-dark dark:bg-surface-dark dark:text-white"
            >
              <option value="">All batches</option>
              {batchOptions.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.batchName}
                </option>
              ))}
            </select>
            {selectedBatchId ? (
              <Link
                href={`/analytics/batch/${selectedBatchId}`}
                data-testid="analytics.overview.cta.batch_hub"
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-gray-900 hover:border-primary/40 dark:border-border-dark dark:bg-surface-dark dark:text-white"
              >
                Open batch hub
              </Link>
            ) : null}
            <Link
              href="/analytics/ask"
              data-testid="analytics.overview.cta.ask"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-gray-900 hover:border-primary/40 dark:border-border-dark dark:bg-surface-dark dark:text-white"
            >
              Ask Analytics
            </Link>
            {canInstitution ? (
              <Link
                href="/analytics/institution/faculty-impact"
                data-testid="analytics.overview.cta.faculty_impact"
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-gray-900 hover:border-primary/40 dark:border-border-dark dark:bg-surface-dark dark:text-white"
              >
                Faculty impact
              </Link>
            ) : null}
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </motion.div>

        {isFaculty && batchOptions.length === 0 && !errorMsg && (
          <p className="text-sm text-muted">
            No batch assignments found for your account.
          </p>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {errorMsg}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            DASHBOARD VIEW (super_admin + branch_admin)
            ═══════════════════════════════════════════════════ */}
        {canDashboard && (
          <>
            {/* Row 1: KPI Cards */}
            {loadingInst && !data ? (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <KpiSkeleton key={i} />
                ))}
              </div>
            ) : data ? (
              <motion.div
                className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                variants={stagger}
                initial="hidden"
                animate="show"
              >
                <KpiCard
                  label="Total students"
                  value={data.totalStudents}
                  icon={GraduationCap}
                  color="text-primary"
                  bg="bg-primary/10"
                  testId="analytics.overview.kpi.students"
                />
                <KpiCard
                  label="Exams conducted"
                  value={data.totalExams}
                  icon={Exam}
                  color="text-purple-600"
                  bg="bg-purple-100 dark:bg-purple-500/10"
                  testId="analytics.overview.kpi.exams"
                />
                <KpiCard
                  label="Avg score"
                  value={Math.round(data.avgPercentile)}
                  suffix="%"
                  icon={TrendUp}
                  color="text-success"
                  bg="bg-success/10"
                  testId="analytics.overview.kpi.avg_score"
                />
                <KpiCard
                  label="Today's attendance"
                  value={attendance ? Math.round((attendance.present / Math.max(attendance.totalStudents, 1)) * 100) : 0}
                  suffix="%"
                  icon={UsersFour}
                  color="text-amber-600"
                  bg="bg-amber-100 dark:bg-amber-500/10"
                  format="number"
                  testId="analytics.overview.kpi.attendance"
                />
                <KpiCard
                  label="Active batches"
                  value={data.activeBatches}
                  icon={Stack}
                  color="text-cyan-600"
                  bg="bg-cyan-100 dark:bg-cyan-500/10"
                  testId="analytics.overview.kpi.batches"
                />
                <KpiCard
                  label="At risk"
                  value={data.atRiskStudents.length}
                  icon={Warning}
                  color="text-red-600"
                  bg="bg-red-100 dark:bg-red-500/10"
                  testId="analytics.overview.kpi.at_risk"
                />
                <div
                  data-testid="analytics.overview.kpi.scope"
                  className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark"
                >
                  <span
                    data-testid="analytics.overview.kpi.scope.value"
                    className="font-mono text-2xl font-bold tracking-tight"
                  >
                    {selectedBranch?.name ?? (canInstitution ? "Institution" : "Branch")}
                  </span>
                  <p className="mt-1 text-xs text-muted">Scope</p>
                </div>
              </motion.div>
            ) : null}

            {/* Below Threshold Alert Card */}
            {!loadingInst && data && data.atRiskStudents && data.atRiskStudents.length > 0 && (
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-800/40 dark:bg-red-950/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
                      <Warning size={20} weight="duotone" className="text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
                        {data.atRiskStudents.length} Student{data.atRiskStudents.length !== 1 ? "s" : ""} At Risk
                      </h3>
                      <p className="text-xs text-red-600/70 dark:text-red-400/70">
                        Students with declining performance or low attendance
                      </p>
                    </div>
                  </div>
                  <Link
                    href={batchOptions[0]?.batchId ? `/analytics/batch/${batchOptions[0].batchId}/at-risk` : "#"}
                    data-testid="analytics.overview.cta.at_risk"
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                  >
                    View All &rarr;
                  </Link>
                </div>
              </motion.div>
            )}

            {/* Row 3: Performance Trend (only when we have 2+ data points) */}
            {loadingInst && trendData.length < 2 ? (
              <PerformanceTrendSkeleton />
            ) : trendData.length >= 2 ? (
              <PerformanceTrendChart data={trendData} daysTestID="analytics.overview.trend.days" />
            ) : null}

            {selectedBranchId ? (
              /* ── Branch-specific layout ─────────────────── */
              <>
                {/* Row: Top Batches + Faculty (equal columns) */}
                {!loadingInst && data && (
                  <TopBatchesLeaderboard
                    batches={data.topBatches}
                    dateQs={dateQs}
                  />
                )}

                {/* Top Performers — institution-wide + per-batch tabs */}
                {!loadingInst && data && (
                  <TopPerformers
                    batches={data.topBatches.map((b) => ({
                      batchId: b.batchId,
                      name: b.name,
                    }))}
                  />
                )}

                {/* Batch Performance Table (branch view) */}
                {!loadingInst && data && data.topBatches.length > 0 && (
                  <motion.div
                    variants={sectionFade}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "-40px" }}
                    className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Stack weight="duotone" className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold">Batch Performance Overview</h2>
                        <p className="text-xs text-muted">Score distribution across batches</p>
                      </div>
                    </div>

                    <div className="hidden sm:grid sm:grid-cols-[1fr_80px_1fr_100px] gap-4 px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                      <span>Batch</span>
                      <span className="text-center">Students</span>
                      <span>Avg Score</span>
                      <span className="text-center">Status</span>
                    </div>

                    <div className="space-y-2">
                      {data.topBatches.map((batch, i) => {
                        const pct = Math.min(100, batch.avgPercentile);
                        const status = pct >= 70 ? "Healthy" : pct >= 50 ? "Warning" : "Critical";
                        const barColor = pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
                        const statusStyle = pct >= 70
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : pct >= 50
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                            : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";

                        return (
                          <motion.div key={batch.batchId} variants={fadeUp}>
                            <Link
                              href={dateQs ? `/analytics/batch/${batch.batchId}?${dateQs}` : `/analytics/batch/${batch.batchId}`}
                              className="group grid grid-cols-1 sm:grid-cols-[1fr_80px_1fr_100px] items-center gap-2 sm:gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium group-hover:text-primary">{batch.name}</p>
                                <p className="text-[10px] text-muted sm:hidden">{batch.students} students</p>
                              </div>
                              <span className="hidden sm:block text-center font-mono text-sm text-muted">{batch.students}</span>
                              <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-50/70 dark:bg-surface-elevated-dark">
                                  <motion.div
                                    className={`h-full rounded-full ${barColor}`}
                                    initial={{ width: 0 }}
                                    whileInView={{ width: `${pct}%` }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.7, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                                  />
                                </div>
                                <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">{batch.avgPercentile}%</span>
                              </div>
                              <div className="hidden sm:flex justify-center">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusStyle}`}>
                                  {status}
                                </span>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </>
            ) : (
              /* ── Institution-wide layout ────────────────── */
              <>
                {/* Row 3: Branch Comparison + Attendance Donut */}
                {!loadingInst && data && (
                  <div className="grid gap-6 lg:grid-cols-5">
                    <div className="lg:col-span-3">
                      <BranchComparisonChart branches={data.branches} />
                    </div>
                    <div className="lg:col-span-2">
                      {attendance ? (
                        <AttendanceDonut data={attendance} />
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
                          <p className="text-sm text-muted">
                            No attendance data available
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Row 4: Top Batches */}
                {!loadingInst && data && (
                  <TopBatchesLeaderboard
                    batches={data.topBatches}
                    dateQs={dateQs}
                  />
                )}

                {/* Row 4.5: Top Performers — institution-wide + per-batch tabs */}
                {!loadingInst && data && (
                  <TopPerformers
                    batches={data.topBatches.map((b) => ({
                      batchId: b.batchId,
                      name: b.name,
                    }))}
                  />
                )}

                {/* Row 5: Batch Performance Table */}
                {!loadingInst && data && data.topBatches.length > 0 && (
                  <motion.div
                    variants={sectionFade}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "-40px" }}
                    className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark"
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Stack weight="duotone" className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold">Batch Performance Overview</h2>
                        <p className="text-xs text-muted">Score distribution across all batches</p>
                      </div>
                    </div>

                    {/* Table header */}
                    <div className="hidden sm:grid sm:grid-cols-[1fr_80px_1fr_100px] gap-4 px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                      <span>Batch</span>
                      <span className="text-center">Students</span>
                      <span>Avg Score</span>
                      <span className="text-center">Status</span>
                    </div>

                    <div className="space-y-2">
                      {data.topBatches.map((batch, i) => {
                        const pct = Math.min(100, batch.avgPercentile);
                        const status = pct >= 70 ? "Healthy" : pct >= 50 ? "Warning" : "Critical";
                        const barColor = pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
                        const statusStyle = pct >= 70
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : pct >= 50
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                            : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";

                        return (
                          <motion.div key={batch.batchId} variants={fadeUp}>
                            <Link
                              href={dateQs ? `/analytics/batch/${batch.batchId}?${dateQs}` : `/analytics/batch/${batch.batchId}`}
                              className="group grid grid-cols-1 sm:grid-cols-[1fr_80px_1fr_100px] items-center gap-2 sm:gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark"
                            >
                              {/* Batch name */}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium group-hover:text-primary">
                                  {batch.name}
                                </p>
                                <p className="text-[10px] text-muted sm:hidden">
                                  {batch.students} students &middot; {batch.branch}
                                </p>
                              </div>

                              {/* Student count */}
                              <span className="hidden sm:block text-center font-mono text-sm text-muted">
                                {batch.students}
                              </span>

                              {/* Progress bar */}
                              <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-50/70 dark:bg-surface-elevated-dark">
                                  <motion.div
                                    className={`h-full rounded-full ${barColor}`}
                                    initial={{ width: 0 }}
                                    whileInView={{ width: `${pct}%` }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.7, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                                  />
                                </div>
                                <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">
                                  {batch.avgPercentile}%
                                </span>
                              </div>

                              {/* Status badge */}
                              <div className="hidden sm:flex justify-center">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusStyle}`}>
                                  {status}
                                </span>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Row 6: At-Risk Students (institution-wide only) */}
                {!loadingInst && data && data.atRiskStudents.length === 0 && (
                  <p
                    data-testid="analytics.overview.atrisk.empty"
                    className="py-4 text-center text-sm text-muted"
                  >
                    No at-risk students
                  </p>
                )}
                {!loadingInst && data && data.atRiskStudents.length > 0 && (
                  <AtRiskStudentsPanel students={data.atRiskStudents} />
                )}
              </>
            )}
          </>
        )}

        {/* Batch list — each batch in the top batches leaderboard is already clickable.
            No need for a separate drill-down section here — users click a batch from the
            leaderboard above or navigate via sidebar. */}
      </div>
    </div>
  );
}
