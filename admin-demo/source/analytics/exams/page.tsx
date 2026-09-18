"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  CaretLeft,
  Exam,
  Users,
  ChartBar,
  Clock,
  CheckCircle,
  Warning,
  ArrowCounterClockwise,
  Scan,
  CalendarBlank,
  X,
} from "@phosphor-icons/react";
import { Skeleton } from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { BackLink } from "@/components/back-link";

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

interface BranchOption {
  id: string;
  name: string;
}

interface BatchOption {
  id: string;
  name: string;
  branchId: string;
}

interface ExamRow {
  id: string;
  title: string;
  scheduledStart: string | null;
  purpose: string;
  status: string;
  assignedBatches: { id: string; name: string }[];
  totalAssigned: number;
  totalSubmissions: number;
  appearanceRate: number;
  averageScore: number;
  passRate: number;
  omrEnabled: boolean;
  omrProcessed: boolean;
}

// ── Purpose / Status labels ─────────────────────────────────────

const PURPOSE_LABELS: Record<string, string> = {
  mock_test: "Mock Test",
  unit_test: "Unit Test",
  chapter_test: "Chapter Test",
  practice: "Practice",
  assignment: "Assignment",
  dpp: "DPP",
  jee_mains: "JEE Mains",
  jee_advanced: "JEE Advanced",
  neet: "NEET",
  clat: "CLAT",
  ipmat_indore: "IPMAT Indore",
  ipmat_rohtak: "IPMAT Rohtak",
  bitsat: "BITSAT",
  custom: "Custom",
};

function formatPurpose(purpose: string): string {
  return PURPOSE_LABELS[purpose] || purpose.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatusBadge(status: string) {
  switch (status) {
    case "results_released":
      return { label: "Released", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" };
    case "completed":
      return { label: "Completed", color: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" };
    case "in_progress":
      return { label: "In Progress", color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" };
    case "scheduled":
      return { label: "Scheduled", color: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400" };
    case "draft":
      return { label: "Draft", color: "bg-gray-50 text-gray-500 dark:bg-gray-500/10 dark:text-gray-400" };
    case "grading":
      return { label: "Grading", color: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" };
    default:
      return { label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), color: "bg-gray-50 text-gray-500 dark:bg-gray-500/10 dark:text-gray-400" };
  }
}

function getAppearanceColor(rate: number): string {
  if (rate >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

// ── Date helpers ────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type DatePresetKey = "all" | "today" | "7d" | "30d" | "90d" | "month" | "year" | "custom";

const DATE_PRESETS: { key: DatePresetKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
];

function rangeForPreset(key: DatePresetKey): { from: string; to: string } {
  const today = new Date();
  const to = toIsoDate(today);
  const back = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return toIsoDate(d);
  };
  switch (key) {
    case "today": return { from: to, to };
    case "7d": return { from: back(6), to };
    case "30d": return { from: back(29), to };
    case "90d": return { from: back(89), to };
    case "month": return { from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
    case "year": return { from: toIsoDate(new Date(today.getFullYear(), 0, 1)), to };
    default: return { from: "", to: "" };
  }
}

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function detectPreset(from: string, to: string): DatePresetKey {
  if (!from && !to) return "all";
  for (const { key } of DATE_PRESETS) {
    if (key === "all") continue;
    const r = rangeForPreset(key);
    if (r.from === from && r.to === to) return key;
  }
  return "custom";
}

// ── KPI Card ────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color, bg, testId }: {
  label: string;
  value: string;
  icon: any;
  color: string;
  bg: string;
  testId?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      data-testid={testId}
      className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark"
    >
      <Icon
        weight="duotone"
        className={`pointer-events-none absolute -right-3 -top-3 h-24 w-24 ${color} opacity-[0.04]`}
      />
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
        <Icon weight="duotone" className={`h-5 w-5 ${color}`} />
      </div>
      <div className="mt-3">
        <span
          data-testid={testId ? `${testId}.value` : undefined}
          className="font-mono text-2xl font-bold tracking-tight"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {value}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </motion.div>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark">
      <div className="h-10 w-10 rounded-xl skeleton-shimmer bg-slate-50/70 dark:bg-surface-elevated-dark" />
      <div className="mt-3 h-8 w-24 rounded-lg skeleton-shimmer bg-slate-50/70 dark:bg-surface-elevated-dark" />
      <div className="mt-2 h-3 w-20 rounded skeleton-shimmer bg-slate-50/70 dark:bg-surface-elevated-dark" />
    </div>
  );
}

// ── Table Skeleton ──────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface shadow-xs dark:border-border-dark dark:bg-surface-dark">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border dark:border-border-dark">
              {["Exam", "Date", "Type", "Batches", "Appeared", "Rate", "Avg Score", "Pass Rate", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  <Skeleton className="h-3 w-16 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-border/50 dark:border-border-dark/50">
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-40 rounded" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-20 rounded" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-5 w-20 rounded-full" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-24 rounded" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-16 rounded" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-12 rounded" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-12 rounded" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-12 rounded" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-5 w-20 rounded-full" /></td>
                <td className="px-4 py-3.5"><Skeleton className="h-4 w-4 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Date Range Filter (popover) ─────────────────────────────────

function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = !!(from || to);
  const preset = detectPreset(from, to);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerLabel = !active
    ? "All time"
    : preset !== "custom"
      ? DATE_PRESETS.find((p) => p.key === preset)?.label ?? "Custom"
      : from && to
        ? `${formatDateLabel(from)} – ${formatDateLabel(to)}`
        : from
          ? `From ${formatDateLabel(from)}`
          : `Until ${formatDateLabel(to)}`;

  const applyPreset = (key: DatePresetKey) => {
    if (key === "all") onChange("", "");
    else {
      const r = rangeForPreset(key);
      onChange(r.from, r.to);
    }
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="analytics.exams.filter.date"
        className={`flex h-[42px] items-center gap-2 rounded-xl border px-3.5 text-sm font-medium shadow-xs outline-none transition-all ${
          active
            ? "border-primary/50 bg-primary/[0.04] text-primary dark:border-primary/40 dark:bg-primary/[0.08]"
            : "border-border bg-surface text-foreground hover:border-primary/60 dark:border-border-dark dark:bg-surface-dark"
        }`}
      >
        <CalendarBlank
          size={16}
          weight="duotone"
          className={active ? "text-primary" : "text-muted"}
        />
        <span className="max-w-[180px] truncate">{triggerLabel}</span>
        {active && (
          <button
            type="button"
            aria-label="Clear date range"
            onClick={(e) => { e.stopPropagation(); onChange("", ""); }}
            className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-md text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <X size={11} weight="bold" />
          </button>
        )}
        <CaretDown
          size={13}
          weight="bold"
          className={`ml-auto text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-30 mt-2 w-[320px] origin-top-left overflow-hidden rounded-2xl border border-border bg-surface shadow-lg ring-1 ring-black/[0.03] dark:border-border-dark dark:bg-surface-dark dark:ring-white/[0.04]"
            role="dialog"
          >
            {/* Presets */}
            <div className="grid grid-cols-2 gap-1 p-1.5">
              {DATE_PRESETS.map((p) => {
                const selected = preset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p.key)}
                    className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                      selected
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-primary/5 dark:hover:bg-surface-elevated-dark"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Custom range */}
            <div className="border-t border-border bg-slate-50/40 px-3.5 pb-3.5 pt-3 dark:border-border-dark dark:bg-surface-elevated-dark/40">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Custom range
                </p>
                {preset === "custom" && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted">
                    From
                  </label>
                  <input
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => onChange(e.target.value, to)}
                    className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-border-dark dark:bg-surface-dark"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted">
                    To
                  </label>
                  <input
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => onChange(from, e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-border-dark dark:bg-surface-dark"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────

export default function AnalyticsExamsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  // Data state
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [selectedBatchId, setSelectedBatchId] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Reset page on filter changes
  useEffect(() => { setPage(1); }, [selectedBranchId, selectedBatchId, selectedType, selectedStatus, dateFrom, dateTo]);

  // Fetch branch + batch options — institution-wide (skipBranchHeader) so
  // the dropdowns always offer everything the caller may read, same as the
  // exams-page filter bar.
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    apiClient
      .get<any>("/api/v1/branches?limit=2000", { skipBranchHeader: true })
      .then((res) => {
        if (res.success) {
          const raw = res.data;
          const list = Array.isArray(raw) ? raw : raw?.items ?? raw?.branches ?? raw?.data ?? [];
          setBranches(list.map((b: any) => ({ id: b.id || b._id, name: b.name || "Unnamed" })));
        }
      })
      .catch(() => {});
    apiClient
      .get<any>("/api/v1/batches?limit=200", { skipBranchHeader: true })
      .then((res) => {
        if (res.success) {
          const data = res.data;
          const list = Array.isArray(data) ? data : data?.batches || data?.items || [];
          setBatches(
            list.map((b: any) => ({
              id: b.id || b._id,
              name: b.name || b.title || "Unnamed",
              branchId: b.branchId || b.branch?.id || "",
            })),
          );
        }
      })
      .catch(() => {});
  }, [authLoading, isAuthenticated]);

  // Batch options follow the picked branch.
  const visibleBatches = useMemo(
    () =>
      selectedBranchId === "all"
        ? batches
        : batches.filter((b) => b.branchId === selectedBranchId),
    [batches, selectedBranchId],
  );

  // Fetch exams
  const fetchExams = useCallback(async () => {
    if (authLoading || !isAuthenticated) return;
    setLoading(true);
    setError("");

    try {
      // Branch/batch narrow SERVER-side (the list is capped at 100 rows, and
      // the API's batchId is roster-aware — it catches slot-scheduled exams
      // with empty assigned_batches that a client-side filter would drop).
      // A picked branch overrides the ambient sidebar header; "all" skips it
      // so the dropdown always tells the truth.
      const qs = new URLSearchParams({ limit: "100", sort: "scheduledStart:desc" });
      if (selectedBranchId !== "all") qs.set("branchId", selectedBranchId);
      if (selectedBatchId !== "all") qs.set("batchId", selectedBatchId);
      const res = await apiClient.get<any>(
        `/api/v1/exams?${qs.toString()}`,
        selectedBranchId !== "all"
          ? { headers: { "X-Branch-Id": selectedBranchId } }
          : { skipBranchHeader: true },
      );
      if (!res.success) {
        setError(res.error || "Failed to fetch exams");
        setExams([]);
        return;
      }

      const data = res.data;
      const rawExams: any[] = Array.isArray(data) ? data : data?.exams || data?.items || [];

      // The API list defaults to exams.category='exam' — practice and
      // mock rows can no longer slip past it, so no client-side
      // defensive filtering is needed here.
      const mapped: ExamRow[] = rawExams.map((e: any) => {
        const assignedBatches = (e.assignedBatches || e.batches || []).map((b: any) =>
          typeof b === "string" ? { id: b, name: batches.find((bo) => bo.id === b)?.name || b } : { id: b.id || b._id, name: b.name || "Unnamed" }
        );

        const totalAssigned = e.totalAssigned ?? e.assignedStudents ?? e.totalStudents ?? 0;
        const totalSubmissions = e.totalSubmissions ?? e.submissions ?? e.submissionCount ?? 0;
        const appearanceRate = totalAssigned > 0 ? Math.round((totalSubmissions / totalAssigned) * 100) : 0;
        const averageScore = e.averageScore ?? e.avgScore ?? e.averagePercentage ?? 0;
        const passRate = e.passRate ?? e.passPercentage ?? 0;

        return {
          id: e.id || e._id,
          title: e.title || e.name || "Untitled Exam",
          scheduledStart: e.scheduledStart || e.startTime || e.date || null,
          purpose: e.purpose || e.type || e.examType || "custom",
          status: e.status || "draft",
          assignedBatches,
          totalAssigned,
          totalSubmissions,
          appearanceRate,
          averageScore: Math.round(averageScore * 10) / 10,
          passRate: Math.round(passRate * 10) / 10,
          omrEnabled: !!e.omrEnabled,
          omrProcessed: !!e.omrProcessed,
        };
      });

      setExams(mapped);
    } catch (err: any) {
      setError(err?.message || "Network error");
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, batches, selectedBranchId, selectedBatchId]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Client-side filtering. Branch/batch are NOT filtered here — the server
  // already narrowed the fetch (roster-aware), and re-filtering on
  // assignedBatches would wrongly drop slot-scheduled exams.
  const filteredExams = useMemo(() => {
    let result = exams;

    if (selectedType !== "all") {
      result = result.filter((e) => e.purpose === selectedType);
    }

    if (selectedStatus !== "all") {
      result = result.filter((e) => e.status === selectedStatus);
    }

    if (dateFrom) {
      const fromMs = new Date(`${dateFrom}T00:00:00`).getTime();
      result = result.filter((e) => {
        if (!e.scheduledStart) return false;
        const t = new Date(e.scheduledStart).getTime();
        return Number.isFinite(t) && t >= fromMs;
      });
    }

    if (dateTo) {
      const toMs = new Date(`${dateTo}T23:59:59.999`).getTime();
      result = result.filter((e) => {
        if (!e.scheduledStart) return false;
        const t = new Date(e.scheduledStart).getTime();
        return Number.isFinite(t) && t <= toMs;
      });
    }

    return result;
  }, [exams, selectedType, selectedStatus, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredExams.length / PAGE_SIZE));
  const paginatedExams = filteredExams.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPI computations
  const kpis = useMemo(() => {
    const conducted = filteredExams.filter((e) => e.status !== "draft" && e.status !== "scheduled");
    const totalExams = conducted.length;
    const avgAppearance = totalExams > 0
      ? Math.round(conducted.reduce((s, e) => s + e.appearanceRate, 0) / totalExams)
      : 0;
    const withScores = conducted.filter((e) => e.averageScore > 0);
    const avgScore = withScores.length > 0
      ? Math.round((withScores.reduce((s, e) => s + e.averageScore, 0) / withScores.length) * 10) / 10
      : 0;
    const pending = filteredExams.filter((e) =>
      e.status === "completed" || e.status === "grading" || e.status === "in_progress"
    ).length;

    return { totalExams, avgAppearance, avgScore, pending };
  }, [filteredExams]);

  // Unique purposes/statuses for filter dropdowns
  const uniquePurposes = useMemo(() => {
    const set = new Set(exams.map((e) => e.purpose));
    return Array.from(set).sort();
  }, [exams]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set(exams.map((e) => e.status));
    return Array.from(set).sort();
  }, [exams]);

  if (authLoading) {
    return (
      <div className="min-h-screen overflow-y-auto bg-bg p-8 dark:bg-bg-dark">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
          </div>
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
                <Exam size={22} weight="duotone" className="text-primary" />
              </div>
              <div>
            <h1 className="text-2xl font-bold tracking-tight">Exam Analytics</h1>
            <p className="mt-1 text-sm text-muted">
              Aggregate exam performance across all batches
              {filteredExams.length > 0 && !loading && (
                <span className="ml-1.5 font-mono text-xs text-primary" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                  ({filteredExams.length} exams)
                </span>
              )}
            </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── KPI Cards ─────────────────────────────────────── */}
        {!loading && !error && (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <KpiCard
              label="Exams Conducted"
              value={String(kpis.totalExams)}
              icon={Exam}
              color="text-primary"
              bg="bg-primary/10"
              testId="analytics.exams.kpi.conducted"
            />
            <KpiCard
              label="Avg Appearance Rate"
              value={`${kpis.avgAppearance}%`}
              icon={Users}
              color="text-emerald-600"
              bg="bg-emerald-50 dark:bg-emerald-500/10"
              testId="analytics.exams.kpi.appearance"
            />
            <KpiCard
              label="Avg Score Across Exams"
              value={`${kpis.avgScore}%`}
              icon={ChartBar}
              color="text-purple-600"
              bg="bg-purple-50 dark:bg-purple-500/10"
              testId="analytics.exams.kpi.avg_score"
            />
            <KpiCard
              label="Results Pending"
              value={String(kpis.pending)}
              icon={Clock}
              color="text-amber-600"
              bg="bg-amber-50 dark:bg-amber-500/10"
              testId="analytics.exams.kpi.pending"
            />
          </motion.div>
        )}

        {/* ── Filters ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-6 flex flex-wrap items-center gap-3"
        >
          {/* Branch Filter */}
          <div className="relative">
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                // The picked batch may belong to the old branch.
                setSelectedBatchId("all");
              }}
              data-testid="analytics.exams.filter.branch"
              aria-label="Filter by branch"
              className="max-w-[200px] appearance-none rounded-xl border border-border bg-surface px-4 py-2.5 pr-10 text-sm font-medium shadow-xs outline-none transition-colors hover:border-primary focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <CaretDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>

          {/* Batch Filter */}
          <div className="relative">
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              data-testid="analytics.exams.filter.batch"
              aria-label="Filter by batch"
              className="max-w-[200px] appearance-none rounded-xl border border-border bg-surface px-4 py-2.5 pr-10 text-sm font-medium shadow-xs outline-none transition-colors hover:border-primary focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            >
              <option value="all">All Batches</option>
              {visibleBatches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <CaretDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              data-testid="analytics.exams.filter.type"
              className="appearance-none rounded-xl border border-border bg-surface px-4 py-2.5 pr-10 text-sm font-medium shadow-xs outline-none transition-colors hover:border-primary focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            >
              <option value="all">All Types</option>
              {uniquePurposes.map((p) => (
                <option key={p} value={p}>{formatPurpose(p)}</option>
              ))}
            </select>
            <CaretDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              data-testid="analytics.exams.filter.status"
              className="appearance-none rounded-xl border border-border bg-surface px-4 py-2.5 pr-10 text-sm font-medium shadow-xs outline-none transition-colors hover:border-primary focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            >
              <option value="all">All Statuses</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>{getStatusBadge(s).label}</option>
              ))}
            </select>
            <CaretDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>

          {/* Date Range */}
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
          />
          <input
            type="date"
            value={dateFrom}
            data-testid="analytics.exams.filter.from"
            aria-label="From date"
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-[42px] rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors hover:border-primary/60 focus:border-primary dark:border-border-dark dark:bg-surface-dark"
          />
          <input
            type="date"
            value={dateTo}
            data-testid="analytics.exams.filter.to"
            aria-label="To date"
            onChange={(e) => setDateTo(e.target.value)}
            className="h-[42px] rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors hover:border-primary/60 focus:border-primary dark:border-border-dark dark:bg-surface-dark"
          />
        </motion.div>

        {/* ── Error State ───────────────────────────────────── */}
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
              onClick={fetchExams}
              className="flex items-center gap-1.5 rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/20"
            >
              <ArrowCounterClockwise weight="bold" className="h-3.5 w-3.5" />
              Retry
            </button>
          </motion.div>
        )}

        {/* ── Loading State ─────────────────────────────────── */}
        {loading && <TableSkeleton />}

        {/* ── Exam Table ────────────────────────────────────── */}
        {!loading && paginatedExams.length > 0 && (
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
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Exam</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Type</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Batches</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Appeared</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Rate</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Avg Score</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Pass Rate</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedExams.map((exam) => {
                    const statusInfo = getStatusBadge(exam.status);
                    return (
                      <motion.tr
                        key={exam.id}
                        variants={fadeUp}
                        data-testid={`analytics.exams.list.row.${exam.id}`}
                        className="group border-b border-border/50 transition-colors hover:bg-primary/[0.03] dark:border-border-dark/50 dark:hover:bg-primary/[0.06]"
                      >
                        {/* Title */}
                        <td className="max-w-[260px] px-4 py-3.5">
                          <Link
                            href={`/analytics/exam/${exam.id}`}
                            data-testid={`analytics.exams.list.row.${exam.id}.title`}
                            className="block truncate font-medium text-gray-900 group-hover:text-primary dark:text-gray-100"
                          >
                            {exam.title}
                          </Link>
                          {exam.omrEnabled && (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted">
                              <Scan size={10} weight="duotone" />
                              OMR {exam.omrProcessed ? <CheckCircle size={10} weight="fill" className="text-emerald-500" /> : <Clock size={10} className="text-amber-500" />}
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td
                          data-testid={`analytics.exams.list.row.${exam.id}.date`}
                          className="whitespace-nowrap px-4 py-3.5 text-muted"
                        >
                          {exam.scheduledStart
                            ? new Date(exam.scheduledStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                            : "\u2014"}
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3.5">
                          <span
                            data-testid={`analytics.exams.list.row.${exam.id}.type`}
                            className="inline-flex rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary"
                          >
                            {formatPurpose(exam.purpose)}
                          </span>
                        </td>

                        {/* Batches */}
                        <td
                          data-testid={`analytics.exams.list.row.${exam.id}.batches`}
                          className="px-4 py-3.5 align-middle"
                        >
                          {exam.assignedBatches.length > 0 ? (
                            <div
                              className="block max-w-[200px] truncate text-muted"
                              title={exam.assignedBatches.map((b) => b.name).join(", ")}
                            >
                              {exam.assignedBatches.length === 1
                                ? exam.assignedBatches[0].name
                                : `${exam.assignedBatches[0].name} +${exam.assignedBatches.length - 1}`}
                            </div>
                          ) : (
                            <span className="text-muted">No batches</span>
                          )}
                        </td>

                        {/* Appeared */}
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span
                            data-testid={`analytics.exams.list.row.${exam.id}.appeared`}
                            className="font-mono text-sm"
                            style={{ fontFamily: "JetBrains Mono, monospace" }}
                          >
                            {exam.totalSubmissions}/{exam.totalAssigned}
                          </span>
                        </td>

                        {/* Appearance Rate */}
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span
                            data-testid={`analytics.exams.list.row.${exam.id}.rate`}
                            className={`font-mono text-sm font-semibold ${getAppearanceColor(exam.appearanceRate)}`}
                            style={{ fontFamily: "JetBrains Mono, monospace" }}
                          >
                            {exam.totalAssigned > 0 ? `${exam.appearanceRate}%` : "\u2014"}
                          </span>
                        </td>

                        {/* Avg Score */}
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span
                            data-testid={`analytics.exams.list.row.${exam.id}.avg`}
                            className="font-mono text-sm font-semibold"
                            style={{ fontFamily: "JetBrains Mono, monospace" }}
                          >
                            {exam.averageScore > 0 ? `${exam.averageScore}%` : "\u2014"}
                          </span>
                        </td>

                        {/* Pass Rate */}
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span className="font-mono text-sm" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                            {exam.passRate > 0 ? `${exam.passRate}%` : "\u2014"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <span
                            data-testid={`analytics.exams.list.row.${exam.id}.status`}
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Arrow */}
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/analytics/exam/${exam.id}`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 transition-all hover:bg-primary/10 hover:text-primary group-hover:opacity-100"
                          >
                            <ArrowRight size={14} weight="bold" />
                          </Link>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ──────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 dark:border-border-dark">
                <p className="text-xs text-muted">
                  Showing{" "}
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {(page - 1) * PAGE_SIZE + 1}
                  </span>
                  {" - "}
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {Math.min(page * PAGE_SIZE, filteredExams.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {filteredExams.length}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                  >
                    <CaretLeft size={14} weight="bold" />
                  </button>
                  <span className="min-w-[60px] text-center text-xs font-medium text-gray-700 dark:text-gray-300">
                    Page{" "}
                    <span className="font-mono" style={{ fontFamily: "JetBrains Mono, monospace" }}>{page}</span> /{" "}
                    <span className="font-mono" style={{ fontFamily: "JetBrains Mono, monospace" }}>{totalPages}</span>
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-elevated-dark"
                  >
                    <ArrowRight size={14} weight="bold" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Empty State ───────────────────────────────────── */}
        {!loading && paginatedExams.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-16 flex flex-col items-center justify-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Exam size={32} weight="duotone" className="text-primary" />
            </div>
            <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              No exams found
            </p>
            <p className="mt-1 text-xs text-muted">
              {selectedBranchId !== "all" || selectedBatchId !== "all" || selectedType !== "all" || selectedStatus !== "all" || dateFrom || dateTo
                ? "Try changing the filters to see more results"
                : "Exams will appear here once they are created"}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
