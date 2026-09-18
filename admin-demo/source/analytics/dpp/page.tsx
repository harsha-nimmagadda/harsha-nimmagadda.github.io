"use client";

// ============================================================
// Daily Practice (DPP) — staff view
// ============================================================
//
// Its own surface, deliberately. DPP rows are excluded from the exam
// analytics aggregates on purpose (practice rows inflated totalExams and
// dragged average score — see analytics-handlers.ts:196), so these numbers
// must never be folded into the exam engine.
//
// Until now DPP was invisible to staff entirely: the four /api/v1/dpp routes
// gate on student/parent permissions, and the `dpp:read` permission that
// super_admin / branch_admin / faculty already hold was enforced by no route
// at all. GET /api/v1/dpp/staff/rollup is what makes it real.
//
// The question this page answers is adherence, not score: DPP is a habit.
// Everything sorts worst-first by default so the batch (or student) that
// stopped practising is the first thing on screen.
//
// The rollup returns the whole scope in one payload — the aggregates have to
// be computed over all of it anyway — so search/sort/paging run client-side
// and stay instant. Only a scope or window change costs a request.

import { Suspense, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { t as tr } from "@brilliance/i18n";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  Lightning,
  Users,
  Fire,
  Target,
  CheckCircle,
  MagnifyingGlass,
  CaretDown,
  CaretLeft,
  CaretRight,
  X as XIcon,
} from "@phosphor-icons/react";
import { Skeleton, DateRangeFilter } from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";
import { InfoTip } from "@/components/info-tip";
import { SectionSelector } from "@/components/section-selector";

/** Filter-bar control styling — matches /analytics/students so the two
 *  analytics pages read as one system. */
const SELECT_CONTROL =
  "appearance-none rounded-xl border border-border bg-surface px-4 py-2.5 pr-10 text-sm font-medium shadow-xs outline-none transition-colors hover:border-primary focus:border-primary dark:border-border-dark dark:bg-surface-dark";

/* eslint-disable @typescript-eslint/no-explicit-any */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const PAGE_SIZE = 25;
/** Adherence at or below this reads as "fallen off the habit". */
const AT_RISK = 0.4;

// ── Range ───────────────────────────────────────────────────
// Habit windows, not the list-page presets (30d/90d/6m/1y in
// lib/created-range): adherence over a year says nothing about whether a
// student is practising this week. The calendar covers anything else.

type RangeKey = "7d" | "14d" | "30d" | "custom";

const RANGE_PRESETS: Array<{ key: RangeKey; label: string; days: number }> = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "14d", label: "Last 14 days", days: 14 },
  { key: "30d", label: "Last 30 days", days: 30 },
];

const MAX_SPAN_DAYS = 90; // the API caps the window here too

/** Local-parts yyyy-mm-dd — matches what the calendar emits (and the IST
 *  day the API buckets on). toISOString() would shift the day before 05:30. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtHuman(iso: string): string {
  if (!iso) return "…";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function resolveRange(
  key: RangeKey,
  customFrom: string,
  customTo: string,
): { from: string; to: string } {
  if (key === "custom") return { from: customFrom, to: customTo };
  const days = RANGE_PRESETS.find((p) => p.key === key)?.days ?? 7;
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  return { from: ymd(from), to: ymd(to) };
}
function rangeLabel(key: RangeKey, customFrom: string, customTo: string): string {
  if (key !== "custom") {
    return RANGE_PRESETS.find((p) => p.key === key)?.label ?? "Last 7 days";
  }
  if (!customFrom && !customTo) return "Custom range";
  return `${fmtHuman(customFrom)} → ${customTo ? fmtHuman(customTo) : "today"}`;
}

// ── Types ───────────────────────────────────────────────────

interface RollupStudent {
  studentId: string;
  name: string | null;
  batchId: string | null;
  batchName: string | null;
  branchId: string | null;
  section: string | null;
  daysDone: number;
  adherence: number;
  avgAccuracy: number | null;
  streak: number;
  lastCompleted: string | null;
}

interface RollupBatch {
  batchId: string | null;
  batchName: string | null;
  branchId: string | null;
  students: number;
  adherence: number;
  avgAccuracy: number | null;
  onStreak: number;
}

interface Rollup {
  window: { days: number; from: string; to: string };
  totals: {
    students: number;
    activeStudents: number;
    completions: number;
    adherence: number | null;
    avgAccuracy: number | null;
    onStreak: number;
  };
  byBatch: RollupBatch[];
  students: RollupStudent[];
}

/**
 * Rosters this page can show. Keys match GET /api/v1/practice/staff/rollup
 * `?type=`; `all` folds every self-directed surface into one adherence
 * number. Assigned work (assignment / placement) is excluded server-side.
 *
 * Copy comes from @brilliance/i18n so a rename is one edit — the short forms
 * are used because these render as chips.
 */
const PRACTICE_TYPE_KEYS = [
  "dpp",
  "daily5",
  "mock",
  "error_revision",
  "weekly_clash",
  "custom",
  "peer",
  "all",
] as const;

/** Mixed practice dossier accepts these as ?type=; peer/all omit it. */
const DRILLABLE_TYPES = new Set<string>([
  "dpp",
  "daily5",
  "mock",
  "error_revision",
  "weekly_clash",
  "custom",
]);

const PRACTICE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PRACTICE_TYPE_KEYS.map((k) => [k, tr(`practice.typesShort.${k}`)]),
);

type Tab = "batches" | "students";
type StudentSort =
  | "adherence"
  | "adherence_desc"
  | "accuracy"
  | "streak"
  | "name";
type BatchSort = "adherence" | "adherence_desc" | "accuracy" | "size" | "name";
type StudentFacet = "all" | "at_risk" | "never" | "on_streak";

const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${Math.round(v * 100)}%`;
const pctOf100 = (v: number | null | undefined) =>
  v == null ? "—" : `${Math.round(v)}%`;

/** Adherence colour — this is a habit metric, so the bands are strict. */
function adherenceTone(v: number | null): string {
  if (v == null) return "text-muted";
  if (v >= 0.7) return "text-success";
  if (v >= AT_RISK) return "text-warning";
  return "text-danger";
}

function DppAnalyticsInner() {
  const router = useRouter();
  // Scope + view live in the URL. Without this, drilling into a student and
  // pressing Back returned to a RESET page — right route, wrong view, which
  // reads as "back is broken". It also makes the page linkable.
  const searchParams = useSearchParams();
  const initial = {
    branchId: searchParams.get("branchId") ?? "",
    batchId: searchParams.get("batchId") ?? "",
    section: searchParams.get("section") ?? "",
    tab: (searchParams.get("tab") === "students" ? "students" : "batches") as Tab,
    range: (["7d", "14d", "30d", "custom"] as const).includes(
      searchParams.get("range") as RangeKey,
    )
      ? (searchParams.get("range") as RangeKey)
      : ("7d" as RangeKey),
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
    // Which practice product this roster covers. Defaults to dpp, so the
    // page behaves exactly as before for every existing link; ?type=daily5
    // (and the rest) is what gives Daily 5 the roster it never had.
    type: searchParams.get("type") ?? "dpp",
  };
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Rollup | null>(null);

  // Scope (costs a request)
  const [branchId, setBranchId] = useState(initial.branchId);
  const [batchId, setBatchId] = useState(initial.batchId);
  const [section, setSection] = useState(initial.section);
  const [practiceType, setPracticeType] = useState(initial.type);
  const [rangeKey, setRangeKey] = useState<RangeKey>(initial.range);
  const [customFrom, setCustomFrom] = useState(initial.from);
  const [customTo, setCustomTo] = useState(initial.to);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");

  // View (client-side)
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [search, setSearch] = useState("");
  const [studentSort, setStudentSort] = useState<StudentSort>("adherence");
  const [batchSort, setBatchSort] = useState<BatchSort>("adherence");
  const [facet, setFacet] = useState<StudentFacet>("all");
  const [page, setPage] = useState(0);

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [batches, setBatches] = useState<
    { id: string; name: string; branchId: string | null }[]
  >([]);

  const { from, to } = resolveRange(rangeKey, customFrom, customTo);

  // Scope options — same sources the rest of the dashboard uses.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [brRes, baRes] = await Promise.allSettled([
        apiClient.get<any>("/api/v1/branches"),
        apiClient.get<any>("/api/v1/batches?limit=200"),
      ]);
      if (cancelled) return;
      if (brRes.status === "fulfilled" && brRes.value.success) {
        const list = Array.isArray(brRes.value.data)
          ? brRes.value.data
          : (brRes.value.data?.branches ?? []);
        setBranches(list.map((b: any) => ({ id: b.id, name: b.name })));
      }
      if (baRes.status === "fulfilled" && baRes.value.success) {
        const list = Array.isArray(baRes.value.data)
          ? baRes.value.data
          : (baRes.value.data?.batches ?? []);
        setBatches(
          list.map((b: any) => ({
            id: b.id,
            name: b.name,
            branchId: b.branchId ?? null,
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // A custom range with no start yet is not fetchable — wait for Apply.
    if (rangeKey === "custom" && !customFrom) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (branchId) params.set("branchId", branchId);
        if (batchId) params.set("batchId", batchId);
        if (section) params.set("section", section);
        params.set("type", practiceType);
        // Generalised rollup — /dpp/staff/rollup still exists and returns
        // the same shape, but only ever answers for dpp.
        const res = await apiClient.get<any>(
          `/api/v1/practice/staff/rollup?${params.toString()}`,
        );
        if (cancelled) return;
        setData(res.success && res.data ? res.data : null);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to, branchId, batchId, section, rangeKey, customFrom, practiceType]);

  // Any change to what's being listed resets paging.
  useEffect(() => {
    setPage(0);
  }, [tab, search, studentSort, batchSort, facet, branchId, batchId, section, from, to]);

  const batchOptions = useMemo(
    () => batches.filter((b) => !branchId || b.branchId === branchId),
    [batches, branchId],
  );

  // The current view as a query string — written back to the URL (replace, so
  // scope changes don't stack history entries) and handed to drill-ins as
  // `?from=`, so a deep-linked child still has somewhere real to go back to.
  const viewQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (branchId) p.set("branchId", branchId);
    if (batchId) p.set("batchId", batchId);
    if (section) p.set("section", section);
    if (practiceType !== "dpp") p.set("type", practiceType);
    if (tab !== "batches") p.set("tab", tab);
    if (rangeKey !== "7d") p.set("range", rangeKey);
    if (rangeKey === "custom") {
      if (customFrom) p.set("from", customFrom);
      if (customTo) p.set("to", customTo);
    }
    return p.toString();
  }, [branchId, batchId, section, practiceType, tab, rangeKey, customFrom, customTo]);

  useEffect(() => {
    router.replace(viewQuery ? `/analytics/dpp?${viewQuery}` : "/analytics/dpp", {
      scroll: false,
    });
  }, [viewQuery, router]);

  // ── Derived rows ──────────────────────────────────────────
  const q = search.trim().toLowerCase();

  const batchRows = useMemo(() => {
    let rows = [...(data?.byBatch ?? [])];
    if (q) {
      rows = rows.filter((b) => (b.batchName ?? "").toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      switch (batchSort) {
        case "adherence_desc":
          return b.adherence - a.adherence;
        case "accuracy":
          return (b.avgAccuracy ?? -1) - (a.avgAccuracy ?? -1);
        case "size":
          return b.students - a.students;
        case "name":
          return (a.batchName ?? "").localeCompare(b.batchName ?? "");
        default:
          return a.adherence - b.adherence; // worst first
      }
    });
    return rows;
  }, [data, q, batchSort]);

  const studentRows = useMemo(() => {
    let rows = [...(data?.students ?? [])];
    if (facet === "at_risk") rows = rows.filter((s) => s.adherence < AT_RISK);
    else if (facet === "never") rows = rows.filter((s) => s.daysDone === 0);
    else if (facet === "on_streak") rows = rows.filter((s) => s.streak > 0);
    if (q) {
      rows = rows.filter((s) =>
        `${s.name ?? ""} ${s.batchName ?? ""} ${s.section ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    rows.sort((a, b) => {
      switch (studentSort) {
        case "adherence_desc":
          return b.adherence - a.adherence;
        case "accuracy":
          return (b.avgAccuracy ?? -1) - (a.avgAccuracy ?? -1);
        case "streak":
          return b.streak - a.streak;
        case "name":
          return (a.name ?? "").localeCompare(b.name ?? "");
        default:
          return a.adherence - b.adherence; // worst first
      }
    });
    return rows;
  }, [data, q, studentSort, facet]);

  const rowCount = tab === "batches" ? batchRows.length : studentRows.length;
  const pageCount = Math.max(1, Math.ceil(rowCount / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = <T,>(rows: T[]) =>
    rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // Drill: a batch row scopes the whole page to that batch and lands on the
  // student tab. Scoping (rather than filtering client-side) means the KPI
  // band narrows too, so the tiles always describe the rows underneath them.
  function drillIntoBatch(b: RollupBatch) {
    if (!b.batchId) return; // the synthetic "No batch" bucket isn't a scope
    if (b.branchId) setBranchId(b.branchId);
    setBatchId(b.batchId);
    setSection("");
    setTab("students");
    setSearch("");
    setFacet("all");
  }

  // Students drill into their PRACTICE analytics, not the general dossier:
  // that page is where DPP streak, cadence and the error-correction loop
  // live, so it answers the question this page raises.
  function openStudent(studentId: string) {
    const back = encodeURIComponent(
      viewQuery ? `/analytics/dpp?${viewQuery}` : "/analytics/dpp",
    );
    // DPP-only dossier stays on /analytics/dpp/student/:id. Other practice
    // products (Daily 5, mock, …) have no dedicated page — they open the
    // mixed practice analytics with the matching type filter (mobile parity).
    if (practiceType === "dpp") {
      router.push(`/analytics/dpp/student/${studentId}?from=${back}`);
      return;
    }
    const typeQ = DRILLABLE_TYPES.has(practiceType)
      ? `&type=${encodeURIComponent(practiceType)}`
      : "";
    router.push(`/analytics/student/${studentId}/practice?from=${back}${typeQ}`);
  }

  const facetCounts = useMemo(() => {
    const all = data?.students ?? [];
    return {
      all: all.length,
      at_risk: all.filter((s) => s.adherence < AT_RISK).length,
      never: all.filter((s) => s.daysDone === 0).length,
      on_streak: all.filter((s) => s.streak > 0).length,
    };
  }, [data]);

  const tiles = data
    ? [
        {
          icon: <Users size={16} weight="duotone" className="text-primary" />,
          label: "Students",
          value: String(data.totals.students),
          sub: `${data.totals.activeStudents} practised at least once`,
          info: "Everyone in the selected scope, whether or not they have ever opened a DPP.",
          tone: undefined as string | undefined,
        },
        {
          icon: <Target size={16} weight="duotone" className="text-primary" />,
          label: "Adherence",
          value: pct(data.totals.adherence),
          sub: `${data.totals.completions} of ${data.totals.students * data.window.days} student-days`,
          info: "Share of possible student-days that were actually practised. 100% would mean every student did a DPP every day in the window.",
          tone: adherenceTone(data.totals.adherence),
        },
        {
          icon: <CheckCircle size={16} weight="duotone" className="text-success" />,
          label: "Avg accuracy",
          value: pctOf100(data.totals.avgAccuracy),
          sub: "on submitted sets",
          info: "Mean score across submitted DPPs. Read it next to adherence — a high average over two sets says little.",
          tone: undefined,
        },
        {
          icon: <Fire size={16} weight="duotone" className="text-warning" />,
          label: "On a streak",
          value: String(data.totals.onStreak),
          sub: "practised today or yesterday",
          info: "Students whose streak is still alive. A streak breaks the moment a day is skipped.",
          tone: undefined,
        },
      ]
    : [];

  const draftApplied =
    rangeKey === "custom" && draftFrom === customFrom && draftTo === customTo;

  return (
    <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeUp}>
          <BackLink
            href="/analytics"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} /> Back
          </BackLink>
        </motion.div>

        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Lightning size={22} weight="duotone" className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {PRACTICE_TYPE_LABEL[practiceType] ?? "Practice"} adherence
            </h1>
            <p className="mt-1 text-sm text-muted">
              Who is keeping up the habit. Students generate their own sets, so
              this measures adherence, not marks. Size and make-up are set in{" "}
              <Link href="/settings/practice" className="underline">
                Settings → Daily Practice &amp; Daily 5
              </Link>
              .
            </p>
          </div>
        </motion.div>

        {/* Which practice product this roster covers. Daily 5 and the rest had
            no staff roster at all before this; the endpoint is the same one,
            parameterised, so every type reads identically. */}
        <motion.div variants={fadeUp} className="mt-5 flex flex-wrap items-center gap-2">
          {Object.entries(PRACTICE_TYPE_LABEL).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPracticeType(key)}
              aria-pressed={practiceType === key}
              data-testid={`analytics.dpp.type.${key}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                practiceType === key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </motion.div>

        {/* Filter bar — same control design as /analytics/students so the two
            analytics pages read as one system. Branch precedes batch because
            batches are scoped to it; section precedes nothing because sections
            only exist inside a batch (the selector stays disabled until one is
            chosen). Every control here refetches. */}
        <motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center gap-3">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              data-testid={`analytics.dpp.window.${p.days}`}
              onClick={() => {
                setRangeKey(p.key);
                setCustomFrom("");
                setCustomTo("");
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                rangeKey === p.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted hover:border-primary/40 dark:border-border-dark"
              }`}
            >
              {p.days}d
            </button>
          ))}
          <div className="relative">
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setBatchId("");
                setSection("");
              }}
              data-testid="analytics.dpp.filter.branch"
              aria-label="Filter by branch"
              className={SELECT_CONTROL}
            >
              <option value="">All branches</option>
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
          <div className="relative">
            <select
              value={batchId}
              onChange={(e) => {
                setBatchId(e.target.value);
                setSection("");
              }}
              data-testid="analytics.dpp.filter.batch"
              aria-label="Filter by batch"
              className={SELECT_CONTROL}
            >
              <option value="">All batches</option>
              {batchOptions.map((b) => (
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
          <SectionSelector
            batchId={batchId || null}
            value={section}
            onChange={setSection}
            controlClassName={SELECT_CONTROL}
            testID="analytics.dpp.filter.section"
          />
          <DateRangeFilter
            label={rangeLabel(rangeKey, customFrom, customTo)}
            options={RANGE_PRESETS.map((p) => ({
              key: p.key,
              label: p.label,
              title: (() => {
                const r = resolveRange(p.key, "", "");
                return `${fmtHuman(r.from)} → ${fmtHuman(r.to)}`;
              })(),
            }))}
            activeKey={rangeKey}
            onSelect={(key) => {
              setRangeKey(key as RangeKey);
              setCustomFrom("");
              setCustomTo("");
            }}
            draftFrom={draftFrom}
            draftTo={draftTo}
            onDraftChange={(f, t) => {
              setDraftFrom(f);
              setDraftTo(t);
            }}
            maxSpanDays={MAX_SPAN_DAYS}
            onApplyCustom={() => {
              setRangeKey("custom");
              setCustomFrom(draftFrom);
              setCustomTo(draftTo);
            }}
            applyDisabled={(!draftFrom && !draftTo) || draftApplied}
            applyHint={`Up to ${MAX_SPAN_DAYS} days`}
          />
        </motion.div>

        {loading ? (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} variant="rectangular" className="h-24 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton variant="rectangular" className="h-80 w-full rounded-2xl" />
          </div>
        ) : !data ? (
          <motion.div
            variants={fadeUp}
            className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted dark:border-border-dark"
          >
            Daily practice data is unavailable for this scope.
          </motion.div>
        ) : data.totals.students === 0 ? (
          <motion.div
            variants={fadeUp}
            className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted dark:border-border-dark"
          >
            No students in this scope.
          </motion.div>
        ) : (
          <>
            {/* KPI band */}
            <motion.div
              variants={fadeUp}
              className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
            >
              {tiles.map((t) => {
                const slug =
                  t.label === "Students"
                    ? "students"
                    : t.label === "Adherence"
                      ? "adherence"
                      : t.label === "Avg accuracy"
                        ? "accuracy"
                        : "on_streak";
                return (
                <div
                  key={t.label}
                  data-testid={`analytics.dpp.kpi.${slug}`}
                  className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    {t.icon}
                    {t.label}
                    <InfoTip content={t.info} side="bottom" />
                  </div>
                  <div
                    data-testid={`analytics.dpp.kpi.${slug}.value`}
                    className={`mt-2 font-mono text-2xl font-bold tabular-nums ${t.tone ?? "text-foreground"}`}
                  >
                    {t.value}
                  </div>
                  <p
                    data-testid={`analytics.dpp.kpi.${slug}.hint`}
                    className="mt-1 text-[11px] text-muted"
                  >
                    {t.sub}
                  </p>
                </div>
                );
              })}
            </motion.div>

            {/* Tabs + toolbar */}
            <motion.div variants={fadeUp} className="mt-6">
              <nav
                className="flex items-center gap-1 border-b border-border dark:border-border-dark"
                role="tablist"
              >
                {(
                  [
                    ["batches", "By batch", data.byBatch.length],
                    ["students", "By student", data.students.length],
                  ] as Array<[Tab, string, number]>
                ).map(([key, label, count]) => {
                  const active = tab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      data-testid={`analytics.dpp.tab.${key}`}
                      onClick={() => setTab(key)}
                      className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 ${
                        active
                          ? "text-foreground after:bg-primary"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {label}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                          active
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-muted"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {/* The batch tab's rows drill in, so say so — hover alone is
                    not an affordance a scanning reader will notice. */}
                {tab === "batches" && !batchId && (
                  <span className="text-xs text-muted">
                    Select a batch to see its students
                  </span>
                )}
                {/* Once scoped to one batch, offer the FULL batch analytics
                    rather than rebuilding it here — /analytics/batch/[id]
                    already owns scores, topics and at-risk. */}
                {batchId && (
                  <button
                    type="button"
                    onClick={() => router.push(`/analytics/batch/${batchId}`)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted transition hover:border-primary hover:text-primary"
                  >
                    Full batch analytics
                    <CaretRight size={11} weight="bold" />
                  </button>
                )}
                {/* Facets — student tab only; they answer "who do I chase". */}
                {tab === "students" &&
                  (
                    [
                      ["all", "All"],
                      ["at_risk", "At risk"],
                      ["never", "Never practised"],
                      ["on_streak", "On a streak"],
                    ] as Array<[StudentFacet, string]>
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      data-testid={`analytics.dpp.facet.${key}`}
                      onClick={() => setFacet(key)}
                      title={
                        key === "at_risk"
                          ? `Adherence below ${Math.round(AT_RISK * 100)}%`
                          : undefined
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                        facet === key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {label} {facetCounts[key]}
                    </button>
                  ))}

                <div className="relative ml-auto">
                  <MagnifyingGlass
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={
                      tab === "batches" ? "Search batches…" : "Search name, batch, section…"
                    }
                    aria-label="Search"
                    data-testid="analytics.dpp.search"
                    className="w-64 rounded-lg border border-border bg-surface py-2 pl-8 pr-8 text-sm text-foreground focus:border-primary focus:outline-none dark:border-border-dark dark:bg-surface-dark"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    >
                      <XIcon size={13} weight="bold" />
                    </button>
                  )}
                </div>

                {tab === "batches" ? (
                  <select
                    value={batchSort}
                    onChange={(e) => setBatchSort(e.target.value as BatchSort)}
                    aria-label="Sort batches"
                    className={SELECT_CONTROL}
                  >
                    <option value="adherence">Lowest adherence</option>
                    <option value="adherence_desc">Highest adherence</option>
                    <option value="accuracy">Highest accuracy</option>
                    <option value="size">Most students</option>
                    <option value="name">Name (A–Z)</option>
                  </select>
                ) : (
                  <select
                    value={studentSort}
                    onChange={(e) => setStudentSort(e.target.value as StudentSort)}
                    aria-label="Sort students"
                    className={SELECT_CONTROL}
                  >
                    <option value="adherence">Lowest adherence</option>
                    <option value="adherence_desc">Highest adherence</option>
                    <option value="accuracy">Highest accuracy</option>
                    <option value="streak">Longest streak</option>
                    <option value="name">Name (A–Z)</option>
                  </select>
                )}
              </div>
            </motion.div>

            {/* Table */}
            <motion.div
              variants={fadeUp}
              className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface shadow-xs dark:border-border-dark dark:bg-surface-dark"
            >
              {rowCount === 0 ? (
                <div className="p-10 text-center text-sm text-muted">
                  Nothing matches this search or filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted dark:border-border-dark">
                        {tab === "batches" ? (
                          <>
                            <th className="px-5 py-2.5 font-semibold">Batch</th>
                            <th className="px-5 py-2.5 text-right font-semibold">Students</th>
                            <th className="px-5 py-2.5 text-right font-semibold">Adherence</th>
                            <th className="px-5 py-2.5 text-right font-semibold">Avg accuracy</th>
                            <th className="px-5 py-2.5 text-right font-semibold">On streak</th>
                          </>
                        ) : (
                          <>
                            <th className="px-5 py-2.5 font-semibold">Student</th>
                            <th className="px-5 py-2.5 font-semibold">Batch</th>
                            <th className="px-5 py-2.5 text-right font-semibold">Days done</th>
                            <th className="px-5 py-2.5 text-right font-semibold">Adherence</th>
                            <th className="px-5 py-2.5 text-right font-semibold">Avg accuracy</th>
                            <th className="px-5 py-2.5 text-right font-semibold">Streak</th>
                            <th className="px-5 py-2.5 text-right font-semibold">Last</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                        {tab === "batches" ? slice(batchRows).map((b) => {
                            const id = b.batchId ?? "none";
                            return (
                            <tr
                              key={id}
                              role={b.batchId ? "button" : undefined}
                              tabIndex={b.batchId ? 0 : undefined}
                              data-testid={`analytics.dpp.list.row.${id}`}
                              aria-label={
                                b.batchId
                                  ? `Show students in ${b.batchName ?? "batch"}`
                                  : undefined
                              }
                              onClick={() => drillIntoBatch(b)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  drillIntoBatch(b);
                                }
                              }}
                              className={`border-b border-border/60 last:border-0 dark:border-border-dark/60 ${
                                b.batchId
                                  ? "cursor-pointer transition-colors hover:bg-secondary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                                  : ""
                              }`}
                            >
                              <td
                                data-testid={`analytics.dpp.list.row.${id}.name`}
                                className="px-5 py-3 font-medium text-foreground"
                              >
                                {b.batchName ?? "No batch"}
                              </td>
                              <td
                                data-testid={`analytics.dpp.list.row.${id}.students`}
                                className="px-5 py-3 text-right tabular-nums text-muted"
                              >
                                {b.students}
                              </td>
                              <td
                                data-testid={`analytics.dpp.list.row.${id}.adherence`}
                                className={`px-5 py-3 text-right font-mono font-semibold tabular-nums ${adherenceTone(b.adherence)}`}
                              >
                                {pct(b.adherence)}
                              </td>
                              <td
                                data-testid={`analytics.dpp.list.row.${id}.accuracy`}
                                className="px-5 py-3 text-right tabular-nums text-muted"
                              >
                                {pctOf100(b.avgAccuracy)}
                              </td>
                              <td
                                data-testid={`analytics.dpp.list.row.${id}.on_streak`}
                                className="px-5 py-3 text-right tabular-nums text-muted"
                              >
                                {b.onStreak}/{b.students}
                              </td>
                            </tr>
                            );
                          })
                        : slice(studentRows).map((s) => (
                            <tr
                              key={s.studentId}
                              role="button"
                              tabIndex={0}
                              data-testid={`analytics.dpp.students.row.${s.studentId}`}
                              aria-label={`Open ${s.name ?? "student"}'s practice analytics`}
                              onClick={() => openStudent(s.studentId)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openStudent(s.studentId);
                                }
                              }}
                              className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:border-border-dark/60"
                            >
                              <td className="px-5 py-3 font-medium text-foreground">
                                <span data-testid={`analytics.dpp.students.row.${s.studentId}.name`}>
                                  {s.name ?? "Unnamed"}
                                </span>
                                {s.section ? (
                                  <span className="ml-1.5 text-xs text-muted">
                                    · {s.section}
                                  </span>
                                ) : null}
                              </td>
                              <td
                                data-testid={`analytics.dpp.students.row.${s.studentId}.batch`}
                                className="px-5 py-3 text-muted"
                              >
                                {s.batchName ?? "—"}
                              </td>
                              <td
                                data-testid={`analytics.dpp.students.row.${s.studentId}.days`}
                                className="px-5 py-3 text-right tabular-nums text-muted"
                              >
                                {s.daysDone}/{data.window.days}
                              </td>
                              <td
                                data-testid={`analytics.dpp.students.row.${s.studentId}.adherence`}
                                className={`px-5 py-3 text-right font-mono font-semibold tabular-nums ${adherenceTone(s.adherence)}`}
                              >
                                {pct(s.adherence)}
                              </td>
                              <td
                                data-testid={`analytics.dpp.students.row.${s.studentId}.accuracy`}
                                className="px-5 py-3 text-right tabular-nums text-muted"
                              >
                                {pctOf100(s.avgAccuracy)}
                              </td>
                              <td
                                data-testid={`analytics.dpp.students.row.${s.studentId}.streak`}
                                className="px-5 py-3 text-right tabular-nums text-muted"
                              >
                                {s.streak > 0 ? `${s.streak}d` : "—"}
                              </td>
                              <td
                                data-testid={`analytics.dpp.students.row.${s.studentId}.last`}
                                className="px-5 py-3 text-right text-xs text-muted"
                              >
                                {s.lastCompleted ? fmtHuman(s.lastCompleted) : "never"}
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {rowCount > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3 dark:border-border-dark">
                  <span className="text-xs text-muted">
                    {safePage * PAGE_SIZE + 1}–
                    {Math.min((safePage + 1) * PAGE_SIZE, rowCount)} of {rowCount}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      aria-label="Previous page"
                      className="rounded-lg border border-border p-1.5 text-muted transition hover:text-foreground disabled:opacity-40 dark:border-border-dark"
                    >
                      <CaretLeft size={14} weight="bold" />
                    </button>
                    <span className="px-2 text-xs tabular-nums text-muted">
                      {safePage + 1} / {pageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                      disabled={safePage >= pageCount - 1}
                      aria-label="Next page"
                      className="rounded-lg border border-border p-1.5 text-muted transition hover:text-foreground disabled:opacity-40 dark:border-border-dark"
                    >
                      <CaretRight size={14} weight="bold" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}

// `useSearchParams()` opts a client page out of static prerendering unless it
// sits under a Suspense boundary — without one `next build` fails outright
// rather than degrading. Same wrapper as /error-analysis and /assignments.
export default function DppAnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <DppAnalyticsInner />
    </Suspense>
  );
}
