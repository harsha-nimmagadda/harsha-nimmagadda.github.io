"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  MagnifyingGlass,
  CaretDown,
  Users,
  ArrowRight,
  CaretLeft,
  Warning,
  ArrowCounterClockwise,
  Student,
} from "@phosphor-icons/react";
import { Skeleton } from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { BackLink } from "@/components/back-link";
import { SectionSelector } from "@/components/section-selector";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Animation Variants ──────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};

// ── Types ───────────────────────────────────────────────────────

interface BatchOption {
  id: string;
  name: string;
  branchId?: string;
}

interface BranchOption {
  id: string;
  name: string;
}

interface StudentRow {
  studentId: string;
  name: string;
  rollNumber: string;
  batchId: string;
  batchName: string;
  branchName: string;
  avgScore: number;
  percentile: number;
  rank: number;
  examCount: number;
  trend: "improving" | "declining" | "plateau" | "volatile" | "unknown";
}

// ── Skeleton rows ───────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface shadow-xs dark:border-border-dark dark:bg-surface-dark">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border dark:border-border-dark">
              {["#", "Name", "Roll", "Batch", "Branch", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  <Skeleton className="h-3 w-16 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-border/50 dark:border-border-dark/50">
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-6 rounded" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-36 rounded" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-20 rounded" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-32 rounded" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-24 rounded" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-4 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ── Main Page ───────────────────────────────────────────────────

export default function AnalyticsStudentsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuthStore();
  // Branch filter is only meaningful for super_admins, who can see across
  // every branch. branch_admin / faculty are already scoped server-side
  // (see packages/api/src/routes/users.ts:54-58 — `scopedBranchId`), so
  // showing them a Branch dropdown would be misleading.
  const isSuperAdmin = user?.role === "super_admin";

  // Data state
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [selectedBatchId, setSelectedBatchId] = useState("all");
  const [selectedSection, setSelectedSection] = useState("");
  const [atRiskOnly, setAtRiskOnly] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Debounced search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAtRiskOnly(new URLSearchParams(window.location.search).get("filter") === "at-risk");
  }, []);

  // Reset page when batch / branch / section changes
  useEffect(() => {
    setPage(1);
  }, [selectedBatchId, selectedBranchId, selectedSection]);

  // Reset batch selection when branch changes — the previously-picked
  // batch may not exist in the new branch, so always clear.
  useEffect(() => {
    setSelectedBatchId("all");
  }, [selectedBranchId]);

  // Fetch branches — only super_admin needs the picker (others are
  // already scoped server-side). Branch dropdown stays hidden for them.
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (!isSuperAdmin) return;
    apiClient
      .get<any>("/api/v1/branches?limit=200")
      .then((res) => {
        if (res.success) {
          const data = res.data;
          const list = Array.isArray(data)
            ? data
            : data?.branches || data?.items || [];
          setBranches(
            list.map((b: any) => ({
              id: b.id || b._id,
              name: b.name || b.title || "Unnamed",
            })),
          );
        }
      })
      .catch(() => {});
  }, [authLoading, isAuthenticated, isSuperAdmin]);

  // Fetch batches — refetch whenever the branch filter changes so the
  // batch dropdown only shows batches that belong to the selected branch.
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    const branchParam =
      isSuperAdmin && selectedBranchId !== "all"
        ? `&branchId=${selectedBranchId}`
        : "";
    apiClient
      .get<any>(`/api/v1/batches?limit=200${branchParam}`)
      .then((res) => {
        if (res.success) {
          const data = res.data;
          const list = Array.isArray(data)
            ? data
            : data?.batches || data?.items || [];
          setBatches(
            list.map((b: any) => ({
              id: b.id || b._id,
              name: b.name || b.title || "Unnamed",
              branchId: b.branchId || b.branch_id || undefined,
            })),
          );
        }
      })
      .catch(() => {});
  }, [authLoading, isAuthenticated, isSuperAdmin, selectedBranchId]);

  // Fetch students with real ranking metrics from analytics v3.
  // Additive endpoint — GET /api/v1/users is unchanged for Users CRUD.
  const fetchStudents = useCallback(async () => {
    if (authLoading || !isAuthenticated) return;
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(page),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedBatchId !== "all") params.set("batchId", selectedBatchId);
      if (selectedSection) params.set("section", selectedSection);
      // Only super_admin can filter by branch — others are JWT-scoped.
      if (isSuperAdmin && selectedBranchId !== "all") {
        params.set("branchId", selectedBranchId);
      }

      const res = await apiClient.get<
        Array<{
          studentId: string;
          name: string;
          rollNumber: string;
          batchId: string;
          batchName: string;
          branchName: string;
          averagePercentage: number;
          percentile: number;
          rank: number;
          trend: StudentRow["trend"];
          examCount?: number;
          recentPercentiles?: number[];
        }>
      >(`/api/v1/analytics/v3/institution/students?${params.toString()}`);

      if (res.success) {
        const users = Array.isArray(res.data) ? res.data : [];
        const mapped: StudentRow[] = users.map((s) => ({
          studentId: s.studentId,
          name: s.name || "Unknown",
          rollNumber: s.rollNumber || "",
          batchId: s.batchId || "",
          batchName: s.batchName || "Not assigned",
          branchName: s.branchName || "",
          avgScore: s.averagePercentage ?? 0,
          percentile: s.percentile ?? 0,
          rank: s.rank,
          examCount: s.examCount ?? 0,
          trend: deriveTrend(s),
        }));
        const visible = atRiskOnly
          ? mapped.filter((s) => s.trend === "declining" || s.avgScore < 50)
          : mapped;

        setStudents(visible);
        setTotalCount(res.meta?.total ?? visible.length);
      } else {
        setError(res.error || "Failed to fetch students");
        setStudents([]);
        setTotalCount(0);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error";
      setError(message);
      setStudents([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [
    authLoading,
    isAuthenticated,
    selectedBatchId,
    selectedBranchId,
    selectedSection,
    isSuperAdmin,
    debouncedSearch,
    page,
    atRiskOnly,
  ]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen overflow-y-auto bg-bg p-8 dark:bg-bg-dark">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <TableSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-bg dark:bg-bg-dark">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* ── Header ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-start gap-4"
        >
          <BackLink
            href="/analytics"
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border transition-colors hover:bg-primary/5 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
          >
            <ArrowLeft size={18} />
          </BackLink>
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Student size={22} weight="duotone" className="text-primary" />
              </div>
              <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Student Analytics
            </h1>
            <p className="mt-1 text-sm text-muted">
              Search and browse student performance across batches
              {totalCount > 0 && !loading && (
                <span className="ml-1.5 font-mono text-xs text-primary">
                  ({totalCount} students)
                </span>
              )}
            </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Search & Filter Bar ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-6 flex flex-wrap items-center gap-3"
        >
          {/* Search */}
          <div className="relative min-w-[280px] flex-1">
            <MagnifyingGlass
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students by name..."
              data-testid="analytics.students.search"
              className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:focus:border-primary"
            />
          </div>

          {/* Branch Filter (super_admin only) — comes before Batch
              because batches are scoped to the selected branch. */}
          {isSuperAdmin && (
            <div className="relative">
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                data-testid="analytics.students.filter.branch"
                className="appearance-none rounded-xl border border-border bg-surface px-4 py-2.5 pr-10 text-sm font-medium shadow-xs outline-none transition-colors hover:border-primary focus:border-primary dark:border-border-dark dark:bg-surface-dark"
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <CaretDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              />
            </div>
          )}

          {/* Batch Filter — narrowed to selected branch when one is set. */}
          <div className="relative">
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              data-testid="analytics.students.filter.batch"
              className="appearance-none rounded-xl border border-border bg-surface px-4 py-2.5 pr-10 text-sm font-medium shadow-xs outline-none transition-colors hover:border-primary focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            >
              <option value="all">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <CaretDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>

          {/* Section Filter — sections only exist within a batch, so the
              selector stays disabled until a specific batch is chosen. */}
          <SectionSelector
            batchId={selectedBatchId !== "all" ? selectedBatchId : null}
            value={selectedSection}
            onChange={setSelectedSection}
            testID="analytics.students.filter.section"
          />
        </motion.div>

        {/* ── Error State ────────────────────────────────────── */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-center justify-between rounded-xl border border-danger/30 bg-danger/5 p-4"
          >
            <div className="flex items-center gap-2">
              <Warning size={18} weight="duotone" className="text-danger" />
              <p className="text-sm text-danger">{error}</p>
            </div>
            <button
              onClick={fetchStudents}
              className="flex items-center gap-1.5 rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/20"
            >
              <ArrowCounterClockwise weight="bold" className="h-3.5 w-3.5" />
              Retry
            </button>
          </motion.div>
        )}

        {/* ── Loading State ──────────────────────────────────── */}
        {loading && <TableSkeleton />}

        {/* ── Student Table ──────────────────────────────────── */}
        {!loading && students.length > 0 && (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="mt-6 rounded-2xl border border-border bg-surface shadow-xs dark:border-border-dark dark:bg-surface-dark"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border dark:border-border-dark">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                      #
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                      Name
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                      Roll
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                      Batch
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                      Avg
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                      Percentile
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                      Exams
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                      Trend
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => (
                    <motion.tr
                      key={s.studentId}
                      variants={fadeUp}
                      data-testid={`analytics.students.list.row.${s.studentId}`}
                      className="group border-b border-border/50 transition-colors hover:bg-primary/[0.03] dark:border-border-dark/50 dark:hover:bg-primary/[0.06]"
                    >
                      <td
                        data-testid={`analytics.students.list.row.${s.studentId}.rank`}
                        className="px-4 py-3.5 font-mono text-xs text-muted"
                      >
                        #{s.rank}
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/analytics/student/${s.studentId}`}
                          className="flex items-center gap-3"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {s.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <span
                            data-testid={`analytics.students.list.row.${s.studentId}.name`}
                            className="font-medium text-gray-900 group-hover:text-primary dark:text-gray-100"
                          >
                            {s.name}
                          </span>
                        </Link>
                      </td>
                      <td
                        data-testid={`analytics.students.list.row.${s.studentId}.roll`}
                        className="px-4 py-3.5 font-mono text-xs text-muted"
                      >
                        {s.rollNumber || "—"}
                      </td>
                      <td
                        data-testid={`analytics.students.list.row.${s.studentId}.batch`}
                        className="px-4 py-3.5 text-muted"
                      >
                        {s.batchName}
                      </td>
                      <td
                        data-testid={`analytics.students.list.row.${s.studentId}.branch`}
                        className="px-4 py-3.5 text-muted"
                      >
                        {s.branchName || "—"}
                      </td>
                      <td
                        data-testid={`analytics.students.list.row.${s.studentId}.avg`}
                        className="px-4 py-3.5 font-mono text-sm"
                      >
                        {s.avgScore.toFixed(1)}%
                      </td>
                      <td
                        data-testid={`analytics.students.list.row.${s.studentId}.percentile`}
                        className="px-4 py-3.5 font-mono text-sm"
                      >
                        {s.percentile.toFixed(1)}
                      </td>
                      <td
                        data-testid={`analytics.students.list.row.${s.studentId}.exams`}
                        className="px-4 py-3.5 font-mono text-sm"
                      >
                        {s.examCount}
                      </td>
                      <td
                        data-testid={`analytics.students.list.row.${s.studentId}.trend`}
                        className="px-4 py-3.5 text-xs font-medium"
                      >
                        {trendLabel(s.trend)}
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/analytics/student/${s.studentId}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 transition-all hover:bg-primary/10 hover:text-primary group-hover:opacity-100"
                        >
                          <ArrowRight size={14} weight="bold" />
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ──────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 dark:border-border-dark">
                <p className="text-xs text-muted">
                  Showing{" "}
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                    {(page - 1) * PAGE_SIZE + 1}
                  </span>
                  {" - "}
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                    {Math.min(page * PAGE_SIZE, totalCount)}
                  </span>{" "}
                  of{" "}
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                    {totalCount}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    data-testid="analytics.students.pager.prev"
                    aria-label="Previous page"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                  >
                    <CaretLeft size={14} weight="bold" />
                  </button>
                  <span
                    data-testid="analytics.students.pager.page"
                    className="min-w-[60px] text-center text-xs font-medium text-gray-700 dark:text-gray-300"
                  >
                    Page{" "}
                    <span className="font-mono">{page}</span> /{" "}
                    <span className="font-mono">{totalPages}</span>
                  </span>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page >= totalPages}
                    data-testid="analytics.students.pager.next"
                    aria-label="Next page"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                  >
                    <ArrowRight size={14} weight="bold" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Empty State ────────────────────────────────────── */}
        {!loading && students.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-16 flex flex-col items-center justify-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Users size={32} weight="duotone" className="text-primary" />
            </div>
            <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              No students found
            </p>
            <p className="mt-1 text-xs text-muted">
              {debouncedSearch
                ? "Try a different search term or change the batch filter"
                : "Select a batch or search to find students"}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Derive trend from API data ──────────────────────────────────

function trendLabel(trend: StudentRow["trend"]): string {
  switch (trend) {
    case "improving":
      return "Up";
    case "declining":
      return "Down";
    case "plateau":
      return "Flat";
    case "volatile":
      return "Volatile";
    case "unknown":
      return "—";
    default: {
      const _exhaustive: never = trend;
      return _exhaustive;
    }
  }
}

function deriveTrend(s: any): StudentRow["trend"] {
  if (s.trend) {
    const t = String(s.trend).toLowerCase();
    if (t === "up" || t === "improving") return "improving";
    if (t === "down" || t === "declining") return "declining";
    if (t === "plateau" || t === "flat" || t === "stable") return "plateau";
    if (t === "volatile" || t === "erratic") return "volatile";
  }
  // Infer from recentPercentiles if available
  if (Array.isArray(s.recentPercentiles) && s.recentPercentiles.length >= 2) {
    const recent = s.recentPercentiles;
    const last = recent[recent.length - 1];
    const prev = recent[recent.length - 2];
    const diff = last - prev;
    if (diff > 5) return "improving";
    if (diff < -5) return "declining";
    return "plateau";
  }
  return "unknown";
}
