"use client";

// /analytics/compare — the Excel-like score matrix explorer.
//
// ONE fetch per scope (GET /v3/matrix); every interaction after that —
// include/exclude exams, search, sort, pagination, the chart overlay
// (marks bars by default, trajectory lines via `chart=lines`) — is a
// useMemo over the cached payload. Toggling a test recomputes the
// averages instantly and costs the DB nothing; that is the page's whole
// architecture, and why `ex`/`sel`/`sort` are NOT in the query key.
//
// State contract: everything lives in the URL. Scope (branch/batch/
// pattern/dates) goes through useAnalyticsScope and is edited ONLY on
// the setup screen — the grid view has no scope bar; Back is the way to
// change what's loaded. sort/search/page go through setParams
// (router.replace); the high-frequency checkbox toggles (`ex` = excluded
// exam ids, `sel` = plotted rows — absent means "default top 3", "" means
// none) write through history.replaceState so rapid clicking never
// issues a server round-trip. Back from a dossier restores all of it
// from the URL — the established back-button contract.
//
// Entry is a 3-step wizard on one route (`?step=1|2|3`, no `view`):
// Who (grain + AudienceTreePicker), Tests (date window + exam type +
// test checklist), Review & build. The wizard's only fetches are tiny
// name lists — branches/batches for the tree (rosters lazy-load per
// batch INSIDE the picker, on expand) and an exams-only candidates
// call (`candidates=1&grain=batches` — exam columns are grain-
// independent, so the row half stays small no matter how many
// thousands of students exist). "Build the grid" pushes `view=1`,
// which is what turns the heavy matrix query on — narrowed via
// examIds + the audience params. Push, not replace, so the grid's
// Back control lands on the wizard. A shared deep link with view=1
// skips setup entirely.
//
// Audience params `bats`/`plus`/`minus` (batch ids, hand-added and
// hand-excluded student ids) mirror AudienceTreePicker's value —
// ABSENT = none picked, and Build stays gated until something is:
// "everyone in a 10k-student institute" is exactly the fetch this
// wizard exists to prevent. Test picks keep the old contract:
// `exams` ABSENT = all-in-window (short URLs, future tests included),
// "" = none, else a comma list. Legacy `rows`/`batchId` deep links
// still render the grid via a passthrough in apiParams.
//
// Subjects are not a separate mode: every exam cell DISPLAYS raw total
// marks with the subject-marks split beneath it (always fetched with
// subjects=1) — the percentage still colors the number, shows on hover,
// and drives every computed figure. The `subj` param swaps the WHOLE grid onto that
// subject's percentages — cells, Avg, Fluctuation, Trend, Rank and the
// chart all recompute from the subject values already in the payload —
// still a pure client-side recompute, never a refetch.
//
// Aggregation rule (deliberate): Rank is computed over the WHOLE scope,
// before search — a student's standing doesn't change because you
// searched for them.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, ChartBar, ChartLineUp, GridNine, MagnifyingGlass } from "@phosphor-icons/react";
import { DateRangeFilter, Skeleton, analyticsTokens } from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useAnalyticsScope } from "@/hooks/analytics/use-analytics-scope";
import { ScopeBar } from "@/components/analytics/scope-bar";
import { Panel } from "@/components/analytics/panel";
import { BackLink } from "@/components/back-link";
import { WizardNavigation, WizardStepper } from "@/components/wizard-stepper";
import {
  AudienceTreePicker,
  type AudienceValue,
} from "@/components/exams/audience-tree-picker";
import { EXAM_TYPE_LABELS, type CanonicalExamType } from "@/lib/exam-type";
import {
  RANGE_OPTIONS,
  fmtHuman,
  rangeButtonLabel,
  rangeOptionLabel,
  resolveRange,
  type RangePreset,
} from "@/lib/created-range";
import {
  compareRows,
  meanOf,
  rankRows,
  stddevPop,
  trendDelta,
} from "@/lib/matrix-math";
import {
  MatrixGrid,
  type MatrixColumn,
  type MatrixDisplayRow,
  type MatrixSortDir,
} from "./_components/matrix-grid";
import { TrajectoryChart } from "./_components/trajectory-chart";
import { MarksBarChart } from "./_components/marks-bar-chart";
import { PickerList } from "./_components/picker-list";

interface MatrixResponse {
  grain: "students" | "batches";
  examType: string | null;
  subjects?: string[];
  exams: { id: string; title: string; examType: string | null; date: string | null }[];
  /** Paper total max per exam — aligned to `exams`. */
  examMax?: (number | null)[];
  /** [examIdx][subjIdx] — each paper's per-subject max marks. */
  subjectMax?: (number | null)[][];
  rows: {
    id: string;
    name: string;
    meta: {
      rollNumber?: string | null;
      batchId?: string | null;
      batchName?: string | null;
      branchName?: string | null;
      targetExam?: string | null;
      size?: number;
    };
    cells: (number | null)[];
    /** Total marks earned per exam (batch grain: the batch mean). */
    markCells?: (number | null)[];
    subjectCells?: (number | null)[][];
    /** [examIdx][subjIdx] — subject marks earned (batch grain: mean). */
    subjectMarkCells?: (number | null)[][];
    /** Students grain: whether the student was assigned each exam
     *  (audience predicate incl. schedule slots & exclusions). */
    assigned?: boolean[];
  }[];
}

/** candidates=1 payload: the same exams/rows, minus cells. */
interface CandidatesResponse {
  grain: "students" | "batches";
  examType: string | null;
  exams: MatrixResponse["exams"];
  rows: { id: string; name: string; meta: MatrixResponse["rows"][number]["meta"] }[];
}

/** Cap on trajectory lines — many more than this is spaghetti, not comparison. */
const MAX_PLOTTED = 10;
const PAGE_SIZES = [25, 50, 100];
/** Mirrors the server's MATRIX_SUBJECT_CELL_BUDGET / MATRIX_ID_LIST_CAP —
 * the wizard's step-3 gate is the polite version of the 400 they'd get. */
const CELL_BUDGET = 12_000;
const ID_CAP = 200;
const WIZARD_STEPS = ["Who", "Tests", "Review & build"];

const EMPTY_AUDIENCE: AudienceValue = {
  distributions: [],
  extraStudents: [],
  excludedStudentIds: [],
};

interface BatchOption {
  id: string;
  name: string;
  branchId: string;
  studentCount?: number;
}

/** Comma list → sorted deduped comma list ("" when empty) — matches the
 * server's parseIdList so the Redis cache key is order-insensitive. */
const sortIds = (raw: string | null) =>
  raw ? [...new Set(raw.split(",").filter(Boolean))].sort().join(",") : "";

const segBtn = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
    active
      ? "border-primary/40 bg-primary/10 text-primary"
      : "border-border text-muted-foreground hover:text-foreground"
  }`;

const shortDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "";

/** The academic year turns over June 1 — the JC admissions cycle. */
const AY_START_MONTH = 5; // 0-based: June
const ayStartYear = (iso: string | null): number | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getMonth() >= AY_START_MONTH ? d.getFullYear() : d.getFullYear() - 1;
};
const ayShortLabel = (startYear: number) =>
  `AY ${String(startYear % 100).padStart(2, "0")}–${String((startYear + 1) % 100).padStart(2, "0")}`;

/** Student names are stored ALL-CAPS; render them like names. Batch names
 * (SR MPC…) are acronyms and stay untouched. */
const personName = (s: string) =>
  s.toLowerCase().replace(/(^|[\s.'-])\p{L}/gu, (c) => c.toUpperCase());

/**
 * Shallow URL write for high-frequency toggles: history.replaceState is
 * synced with useSearchParams by Next, but skips the router round-trip a
 * router.replace would make on every checkbox click.
 */
function setShallowParams(patch: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(patch)) {
    // Only null deletes: for the pick params an EMPTY value means "none
    // selected", which must survive in the URL (absent means "all").
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState(null, "", url.toString());
}

function CompareExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { scope, setScope, setParams, resetScope, isFiltered, queryKey } =
    useAnalyticsScope();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  const view = searchParams.get("view") === "1";
  const grain = searchParams.get("grain") === "students" ? "students" : "batches";
  // Chart over the plotted rows: marks bars (default) or the trajectory lines.
  const chartMode = searchParams.get("chart") === "lines" ? "lines" : "bars";
  /** Display filter: "" = every subject line, else one subject's lowercased name. */
  const subjectFilter = searchParams.get("subj") ?? "";
  // Explicit header click vs the default order: the default must NOT
  // reshuffle when a subject is picked (it orders on TOTAL avg), while a
  // deliberate column sort orders on the displayed, subject-scoped values.
  const explicitSort = searchParams.get("sort") != null;
  const sort = searchParams.get("sort") ?? "avg";
  const dir = (searchParams.get("dir") as MatrixSortDir) ?? "desc";
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const size = PAGE_SIZES.includes(Number(searchParams.get("size")))
    ? Number(searchParams.get("size"))
    : 50;
  const excluded = useMemo(
    () => new Set((searchParams.get("ex") ?? "").split(",").filter(Boolean)),
    [searchParams],
  );
  // sel: absent = default (top 3 plotted), "" = none, else ticked row ids.
  // The set itself is built after `computed`, which the default needs.
  const rawSel = searchParams.get("sel");
  // Wizard picks — what gets FETCHED (vs `ex`, which is what COUNTS in
  // averages). null = all in scope, "" = none, else a comma id list.
  const rawPickedExams = searchParams.get("exams");
  const pickedExams = useMemo(
    () =>
      rawPickedExams === null
        ? null
        : new Set(rawPickedExams.split(",").filter(Boolean)),
    [rawPickedExams],
  );
  // Audience — the wizard's who. Unlike `exams`, ABSENT means "nothing
  // picked yet": the whole institute is never an implicit default here.
  const step = Math.min(3, Math.max(1, Number(searchParams.get("step")) || 1));
  const rawBats = searchParams.get("bats");
  const rawPlus = searchParams.get("plus");
  const rawMinus = searchParams.get("minus");
  const batsSorted = useMemo(() => sortIds(rawBats), [rawBats]);
  const plusSorted = useMemo(() => sortIds(rawPlus), [rawPlus]);
  const minusSorted = useMemo(() => sortIds(rawMinus), [rawMinus]);

  // Local search mirror, debounced into the URL — the students-page idiom.
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => setSearchInput(q), [q]);
  useEffect(() => {
    if (searchInput === q) return;
    const t = setTimeout(() => setParams({ q: searchInput || null }), 300);
    return () => clearTimeout(t);
  }, [searchInput, q, setParams]);

  const scopeQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (scope.examType) p.set("examType", scope.examType);
    if (scope.from) p.set("from", scope.from);
    if (scope.to) p.set("to", scope.to);
    if (scope.filterBranchId) p.set("branchId", scope.filterBranchId);
    return p;
  }, [scope.examType, scope.from, scope.to, scope.filterBranchId]);

  // Legacy pre-wizard deep links narrowed rows via `rows`/`batchId`;
  // honoured only when the audience params are absent.
  const legacyRows = rawBats ? null : searchParams.get("rows");

  const apiParams = useMemo(() => {
    // subjects=1 always — the grid shows the subject split under every
    // exam mark, so the payload always carries it. The wizard picks narrow
    // the fetch itself (sorted, so the server cache key is stable).
    const p = new URLSearchParams(scopeQuery);
    p.set("grain", grain);
    p.set("subjects", "1");
    if (pickedExams) p.set("examIds", [...pickedExams].sort().join(","));
    if (batsSorted) {
      p.set("batchIds", batsSorted);
      if (grain === "students") {
        if (plusSorted) p.set("plusIds", plusSorted);
        if (minusSorted) p.set("minusIds", minusSorted);
      }
    } else if (grain === "students" && plusSorted) {
      // A pure hand-picked audience — no whole batches at all.
      p.set("plusIds", plusSorted);
      if (minusSorted) p.set("minusIds", minusSorted);
    } else {
      if (legacyRows) p.set("rowIds", sortIds(legacyRows));
      if (grain === "students" && scope.batchId) p.set("batchId", scope.batchId);
    }
    return p.toString();
  }, [
    scopeQuery,
    grain,
    pickedExams,
    batsSorted,
    plusSorted,
    minusSorted,
    legacyRows,
    scope.batchId,
  ]);

  const { data, isPending, isError, error, refetch } = useQuery({
    // ex/sel/sort/q/page/subj are deliberately absent: they are client-side
    // recomputes over this payload, never refetches. The picks ARE present —
    // they change what the server returns.
    queryKey: [
      "analytics-matrix",
      grain,
      rawPickedExams ?? "*",
      batsSorted,
      plusSorted,
      minusSorted,
      legacyRows ?? "*",
      ...queryKey,
    ],
    // `view` gates the fetch: the wizard never runs the heavy query.
    enabled: isAuthenticated && !authLoading && view,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await apiClient.get<MatrixResponse>(
        `/api/v1/analytics/v3/matrix?${apiParams}`,
      );
      if (!res.success) {
        throw Object.assign(new Error(res.error || "Failed to load the matrix"), {
          code: res.errorCode,
        });
      }
      return res.data;
    },
  });

  // The wizard's test checklist: ONE tiny id+name call. Always batches
  // grain — exam columns are grain-independent, and the batches-side row
  // half can never trip the 2000-row candidate budget the way a
  // 10k-student roster would. batchIds narrows the columns to tests the
  // audience actually sat.
  const candidatesQuery = useQuery({
    queryKey: ["analytics-matrix-exam-candidates", batsSorted, plusSorted, ...queryKey],
    enabled: isAuthenticated && !authLoading && !view,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const p = new URLSearchParams(scopeQuery);
      p.set("grain", "batches");
      p.set("candidates", "1");
      // The full audience — batches AND hand-picked students — narrows the
      // test list, so step 2 offers only tests someone picked actually sat.
      if (batsSorted) p.set("batchIds", batsSorted);
      if (plusSorted) p.set("plusIds", plusSorted);
      const res = await apiClient.get<CandidatesResponse>(
        `/api/v1/analytics/v3/matrix?${p.toString()}`,
      );
      if (!res.success) {
        throw Object.assign(new Error(res.error || "Failed to load the test list"), {
          code: res.errorCode,
        });
      }
      return res.data;
    },
  });
  const candExams = candidatesQuery.data?.exams ?? [];

  // ── The audience tree's props ──────────────────────────────────
  // Branches + batches (with studentCount) load once per sidebar branch;
  // rosters load INSIDE the picker, per batch, on expand — that is the
  // whole progressive-loading story. No institution-wide student list is
  // ever fetched, at 400 students or 10,000.
  const branchesQuery = useQuery({
    queryKey: ["compare-branches", scope.branchId],
    enabled: isAuthenticated && !authLoading && !view,
    staleTime: 300_000,
    queryFn: async () => {
      const res = await apiClient.get<any>("/api/v1/branches?limit=2000");
      if (!res.success) throw new Error(res.error || "Failed to load branches");
      const raw = res.data;
      return (Array.isArray(raw) ? raw : (raw?.items ?? raw?.data ?? [])) as {
        id: string;
        name: string;
      }[];
    },
  });
  const batchesQuery = useQuery({
    queryKey: ["compare-batches", scope.branchId],
    enabled: isAuthenticated && !authLoading && !view,
    staleTime: 300_000,
    queryFn: async () => {
      // Page through at the server's max — the error-analysis picker's
      // loop-until-short-page shape; one raised limit just moves the cliff.
      const all: BatchOption[] = [];
      for (let pg = 1; pg <= 25; pg++) {
        const res = await apiClient.get<any>(`/api/v1/batches?limit=200&page=${pg}`);
        if (!res.success) break;
        const raw =
          res.data?.data ||
          res.data?.batches ||
          (Array.isArray(res.data) ? res.data : []);
        all.push(...raw);
        if (raw.length < 200) break;
      }
      return all;
    },
  });

  // ── Audience (the tree picker's value) ─────────────────────────
  // URL is the source of truth (`bats`/`plus`/`minus`); this object is
  // its hydrated form. Within a session state and URL move together in
  // onAudienceChange; on a fresh mount (reload / shared link) the effect
  // below rebuilds state from the URL once the name lists arrive —
  // `plus` ids need one `users?ids=` call for their chip labels.
  const [audience, setAudience] = useState<AudienceValue>(EMPTY_AUDIENCE);
  const [hydrated, setHydrated] = useState(false);

  const plusIdsFromUrl = useMemo(
    () => (rawPlus ?? "").split(",").filter(Boolean),
    [rawPlus],
  );
  const plusNamesQuery = useQuery({
    queryKey: ["compare-plus-names", plusSorted],
    enabled:
      isAuthenticated && !authLoading && !view && !hydrated && plusIdsFromUrl.length > 0,
    queryFn: async () => {
      const res = await apiClient.get<any>(
        `/api/v1/users?role=student&status=active&limit=500&ids=${plusIdsFromUrl.join(",")}`,
      );
      if (!res.success) return [];
      return (res.data?.data ||
        res.data?.users ||
        (Array.isArray(res.data) ? res.data : [])) as any[];
    },
  });

  useEffect(() => {
    if (hydrated || view) return;
    const branches = branchesQuery.data;
    const batches = batchesQuery.data;
    if (!branches || !batches) return;
    // Wait for plus names unless that fetch failed — then hydrate without
    // extras (the stale-id drop rule) rather than never hydrating at all.
    if (
      plusIdsFromUrl.length > 0 &&
      plusNamesQuery.data === undefined &&
      !plusNamesQuery.isError
    )
      return;
    const branchName = new Map(branches.map((b) => [b.id, b.name]));
    const byId = new Map(batches.map((b) => [b.id, b]));
    setAudience({
      distributions: (rawBats ?? "")
        .split(",")
        .filter(Boolean)
        .flatMap((id) => {
          const b = byId.get(id);
          // A stale deep-linked id simply drops — same rule as the server.
          return b
            ? [
                {
                  branchId: b.branchId,
                  branchName: branchName.get(b.branchId) ?? "",
                  batchId: b.id,
                  batchName: b.name,
                },
              ]
            : [];
        }),
      extraStudents: (plusNamesQuery.data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        rollNumber: r.rollNumber,
        batchId: r.batchId,
        batchName: r.batchName || "",
        branchName: r.branchName || "",
        section: r.section ?? null,
      })),
      excludedStudentIds: (rawMinus ?? "").split(",").filter(Boolean),
    });
    setHydrated(true);
  }, [
    hydrated,
    view,
    branchesQuery.data,
    batchesQuery.data,
    plusNamesQuery.data,
    plusNamesQuery.isError,
    plusIdsFromUrl,
    rawBats,
    rawMinus,
  ]);

  const onAudienceChange = (next: AudienceValue) => {
    setAudience(next);
    setHydrated(true); // a user edit beats any in-flight hydration
    // plus/minus ride the URL in both grains (batches grain just doesn't
    // SEND them — see apiParams), so flipping grain loses nothing.
    setShallowParams({
      bats: sortIds(next.distributions.map((d) => d.batchId).join(",")) || null,
      plus: sortIds(next.extraStudents.map((s) => s.id).join(",")) || null,
      minus: sortIds(next.excludedStudentIds.join(",")) || null,
      // A different Who = a different test list (the candidates call is
      // keyed on the audience and refetches on its own) — stale explicit
      // picks would silently drop tests the new audience sat, so the
      // selector resets to its all-in-window default.
      exams: null,
    });
  };

  const exams = useMemo(() => data?.exams ?? [], [data]);
  const subjects = useMemo(() => data?.subjects ?? [], [data]);

  const includedIdx = useMemo(
    () => exams.map((e, i) => (excluded.has(e.id) ? -1 : i)).filter((i) => i >= 0),
    [exams, excluded],
  );

  // Absent = a null cell in a test the student WAS ASSIGNED (per-student
  // `assigned` flags off the payload) whose results ARE out (someone else
  // in the audience has marks): it reads as 0 and counts in every average,
  // instead of a dash the averages skip. A student never assigned the test
  // keeps the dash — neither present nor absent, out of every average. A
  // test with no marks for ANYONE (results not released) keeps its dashes,
  // and a subject split still pending for the whole column stays pending
  // per subject. Students grain only — in batches grain a null cell means
  // the batch didn't sit that test, not absence. Missing `assigned` (stale
  // cached payload) falls back to assigned.
  const filledRows = useMemo((): (MatrixResponse["rows"][number] & {
    /** true where the cell was zero-filled — the absentee marker. */
    absentFlags?: boolean[];
  })[] => {
    const raw = data?.rows ?? [];
    if (raw.length === 0 || grain !== "students") return raw;
    const nExams = data?.exams.length ?? 0;
    const colHasMarks = Array.from({ length: nExams }, (_v, ei) =>
      raw.some((r) => r.cells[ei] != null),
    );
    const colHasSubject = Array.from({ length: nExams }, (_v, ei) =>
      (data?.subjects ?? []).map((_s, si) => raw.some((r) => r.subjectCells?.[ei]?.[si] != null)),
    );
    return raw.map((r) => {
      const absent = (ei: number) =>
        r.cells[ei] == null && colHasMarks[ei] === true && (r.assigned?.[ei] ?? true);
      const fillSubjects = (grid: (number | null)[][] | undefined) =>
        grid?.map((row, ei) =>
          absent(ei) ? row.map((v, si) => (v == null && colHasSubject[ei]?.[si] ? 0 : v)) : row,
        );
      return {
        ...r,
        cells: r.cells.map((c, ei) => (absent(ei) ? 0 : c)),
        markCells: r.markCells?.map((c, ei) => (absent(ei) ? 0 : c)),
        subjectCells: fillSubjects(r.subjectCells),
        subjectMarkCells: fillSubjects(r.subjectMarkCells),
        absentFlags: r.cells.map((_c, ei) => absent(ei)),
      };
    });
  }, [data, grain]);

  // Which subject lines render under the exam marks. "" = all of them.
  const displayedSubjects = useMemo(() => {
    const all = subjects.map((name, i) => ({ name, i }));
    if (!subjectFilter) return all;
    return all.filter((s) => s.name.trim().toLowerCase() === subjectFilter);
  }, [subjects, subjectFilter]);

  // Chips offer only subjects that actually appear in the INCLUDED exams —
  // untick every test that had Botany and the Botany chip goes with them.
  // Exception: the ACTIVE filter's chip stays even when its exams are all
  // unticked, or the all-dash grid it causes would have no visible cause.
  const availableSubjects = useMemo(() => {
    const rows = filledRows;
    return subjects
      .map((name, i) => ({ name, i }))
      .filter(
        ({ name, i }) =>
          name.trim().toLowerCase() === subjectFilter ||
          rows.some((r) => includedIdx.some((ei) => r.subjectCells?.[ei]?.[i] != null)),
      );
  }, [subjects, filledRows, includedIdx, subjectFilter]);

  // ── The full computed row set (pre-search, for ranks) ──────────
  // A subject filter swaps the row's cells onto that subject's
  // percentages, so every downstream number — Avg, σ, Trend, Rank,
  // column sort, the chart — is subject-scoped with zero extra code.
  const subjIdx = useMemo(
    () =>
      subjectFilter
        ? subjects.findIndex((s) => s.trim().toLowerCase() === subjectFilter)
        : -1,
    [subjects, subjectFilter],
  );
  // Included tests bucketed by academic year, chronological. Only a
  // multi-AY selection splits the Avg column into one average per AY.
  const ayEntries = useMemo(() => {
    const buckets = new Map<number, number[]>();
    for (const ei of includedIdx) {
      const ay = ayStartYear(exams[ei]?.date ?? null);
      if (ay == null) continue;
      const bucket = buckets.get(ay);
      if (bucket) bucket.push(ei);
      else buckets.set(ay, [ei]);
    }
    return buckets.size > 1 ? [...buckets.entries()].sort((a, b) => a[0] - b[0]) : null;
  }, [includedIdx, exams]);
  // Short chip labels ("24–25") for the split Avg column headers.
  const ayLabels = useMemo(
    () => ayEntries?.map(([ay]) => ayShortLabel(ay).replace(/^AY /, "")) ?? null,
    [ayEntries],
  );

  const computed = useMemo(() => {
    const rows = filledRows;
    return rows.map((r) => {
      const cells =
        subjIdx >= 0
          ? r.cells.map((_c, ei) => r.subjectCells?.[ei]?.[subjIdx] ?? null)
          : r.cells;
      // Raw MARKS mirror of `cells` — what the grid displays, and what every
      // AVERAGE (Avg, per-AY, Rank, the avg sorts) stands on. σ, Trend and
      // the trajectory chart stay on the percentages, the comparable unit
      // across papers.
      const markCells =
        subjIdx >= 0
          ? r.cells.map((_c, ei) => r.subjectMarkCells?.[ei]?.[subjIdx] ?? null)
          : (r.markCells ?? r.cells.map((): number | null => null));
      return {
        id: r.id,
        name: grain === "students" ? personName(r.name) : r.name,
        meta: r.meta,
        scoreCells: cells,
        cells,
        markCells,
        // [examIdx][displayedSubjectIdx] — the subject-MARKS sub-line under
        // each cell. Filtered: the main number IS the subject, so no sub-line.
        cellSubs: r.cells.map((_c, ei) =>
          subjIdx >= 0
            ? []
            : displayedSubjects.map((s) => r.subjectMarkCells?.[ei]?.[s.i] ?? null),
        ),
        avg: meanOf(markCells, includedIdx),
        // Total-marks average regardless of the subject filter — the stable
        // key the default row order and default chart picks stand on.
        totalAvg: meanOf(r.markCells ?? [], includedIdx),
        sigma: stddevPop(cells, includedIdx),
        trend: trendDelta(cells, includedIdx),
        // Same marks unit as Avg (subject-scoped when a subject is picked).
        ayAvgs: ayEntries
          ? ayEntries.map(([ay, idxs]) => ({
              label: ayShortLabel(ay),
              avg: meanOf(markCells, idxs),
            }))
          : undefined,
        present: r.absentFlags
          ? includedIdx.filter((ei) => r.cells[ei] != null && !r.absentFlags![ei]).length
          : null,
        absent: r.absentFlags ? includedIdx.filter((ei) => r.absentFlags![ei]).length : null,
      };
    });
  }, [filledRows, grain, displayedSubjects, subjIdx, includedIdx, ayEntries]);

  const ranks = useMemo(() => rankRows(computed.map((r) => r.avg)), [computed]);

  // Plotted rows: no `sel` param = the top 3 by average, so the grid opens
  // with a live chart instead of an empty ask; "" = deliberately none.
  const selected = useMemo(() => {
    if (rawSel !== null) return new Set(rawSel.split(",").filter(Boolean));
    return new Set(
      [...computed]
        .sort((a, b) => (b.totalAvg ?? -1) - (a.totalAvg ?? -1))
        .slice(0, 3)
        .filter((r) => r.totalAvg != null)
        .map((r) => r.id),
    );
  }, [rawSel, computed]);

  // ── Search → footer → sort → page ──────────────────────────────
  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const withRank = computed.map((r, i) => ({ ...r, rank: ranks[i] ?? null }));
    if (!needle) return withRank;
    return withRank.filter((r) => r.name.toLowerCase().includes(needle));
  }, [computed, ranks, q]);

  const sorted = useMemo(() => {
    const cmp = compareRows(dir);
    const read = (r: (typeof searched)[number]): number | string | null => {
      if (sort === "name") return r.name.toLowerCase();
      if (sort === "avg") return explicitSort ? r.avg : r.totalAvg;
      if (sort === "sigma") return r.sigma;
      if (sort === "trend") return r.trend;
      if (sort === "rank") return r.rank;
      if (sort.startsWith("col:")) return r.cells[Number(sort.slice(4))] ?? null;
      if (sort.startsWith("ayavg:")) return r.ayAvgs?.[Number(sort.slice(6))]?.avg ?? null;
      return r.totalAvg;
    };
    return [...searched].sort((a, b) => cmp(read(a), read(b)));
  }, [searched, sort, dir, explicitSort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / size));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => sorted.slice((safePage - 1) * size, safePage * size),
    [sorted, safePage, size],
  );

  // ── Display shapes ──────────────────────────────────────────────
  // AY marking: columns are chronological, so each academic-year change gets
  // a boundary rule, and any column OUTSIDE the current AY carries its AY tag.
  const currentAy = ayStartYear(new Date().toISOString());
  const columns: MatrixColumn[] = useMemo(
    () =>
      exams.map((e, i) => {
        const ay = ayStartYear(e.date);
        return {
          id: e.id,
          label: e.title.length > 16 ? `${e.title.slice(0, 16)}…` : e.title,
          title: e.title,
          sub: shortDate(e.date),
          included: !excluded.has(e.id),
          ay: ay != null && ay !== currentAy ? ayShortLabel(ay) : undefined,
          ayBoundary: i > 0 && ayStartYear(exams[i - 1]!.date) !== ay,
        };
      }),
    [exams, excluded, currentAy],
  );

  const displayRows: MatrixDisplayRow[] = useMemo(
    () =>
      pageRows.map((r) => ({
        id: r.id,
        name: r.name,
        sub:
          grain === "students"
            ? [r.meta.batchName, r.meta.rollNumber].filter(Boolean).join(" · ") || null
            : [r.meta.branchName, r.meta.size ? `${r.meta.size} students` : null]
                .filter(Boolean)
                .join(" · ") || null,
        href: grain === "students" ? `/analytics/student/${r.id}` : `/analytics/batch/${r.id}`,
        cells: r.cells,
        markCells: r.markCells,
        cellSubs: r.cellSubs,
        avg: r.avg,
        sigma: r.sigma,
        trend: r.trend,
        rank: r.rank,
        ayAvgs: r.ayAvgs,
        present: r.present,
        absent: r.absent,
        selected: selected.has(r.id),
      })),
    [pageRows, grain, selected],
  );

  const plotted = useMemo(() => {
    const byId = new Map(computed.map((r) => [r.id, r]));
    return [...selected]
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        id: r.id,
        name: r.name,
        // scoreCells is already subject-scoped when a subject is picked.
        values: includedIdx.map((ei) => r.scoreCells[ei] ?? null),
      }));
  }, [selected, computed, includedIdx]);

  const trajectoryLabels = useMemo(
    () =>
      includedIdx.map((ei) => {
        const e = exams[ei]!;
        return e.title.length > 12 ? `${e.title.slice(0, 12)}…` : e.title;
      }),
    [includedIdx, exams],
  );

  // Marks bar chart input: the same plotted rows, but RAW marks straight
  // off the payload (markCells / subjectMarkCells) — the subject filter
  // narrows which subject bars render via displayedSubjects; Total always
  // rides along. Batch grain plots the batch means the API sends.
  const markSeries = useMemo(() => {
    const rows = filledRows;
    const byId = new Map(rows.map((r) => [r.id, r]));
    // Present/absent over the included tests — same numbers as the grid's
    // Tests column, rendered under each name on the chart axis.
    const statsById = new Map(computed.map((r) => [r.id, r]));
    return [...selected]
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        id: r.id,
        name: grain === "students" ? personName(r.name) : r.name,
        // Batches grain: two branches often run identically-named batches
        // (SR MPC…), so the branch renders under the batch name.
        sub: grain === "batches" ? (r.meta.branchName ?? null) : null,
        stat: (() => {
          const c = statsById.get(r.id);
          return c?.present != null || c?.absent != null
            ? { present: c?.present ?? 0, absent: c?.absent ?? 0 }
            : null;
        })(),
        points: includedIdx.map((ei) => {
          const e = exams[ei]!;
          return {
            examId: e.id,
            label: e.title.length > 12 ? `${e.title.slice(0, 12)}…` : e.title,
            title: e.title,
            date: shortDate(e.date),
            total: r.markCells?.[ei] ?? null,
            totalMax: data?.examMax?.[ei] ?? null,
            subjects: displayedSubjects.map((s) => r.subjectMarkCells?.[ei]?.[s.i] ?? null),
            subjectMax: displayedSubjects.map((s) => data?.subjectMax?.[ei]?.[s.i] ?? null),
          };
        }),
      }));
  }, [selected, filledRows, computed, data, grain, includedIdx, exams, displayedSubjects]);

  // ── Handlers ────────────────────────────────────────────────────
  const toggleExam = (id: string) => {
    const next = new Set(excluded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setShallowParams({ ex: next.size ? [...next].join(",") : null });
  };

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_PLOTTED) next.add(id);
    // "" (not absent) when empty — absent would resurrect the default 3.
    setShallowParams({ sel: next.size ? [...next].join(",") : "" });
  };

  // Header select-all: anything plotted → clear; nothing → fill the chart
  // with the top rows in the current order, up to the plot cap.
  const toggleAllRows = () => {
    if (selected.size > 0) {
      setShallowParams({ sel: "" });
      return;
    }
    setShallowParams({
      sel: sorted.slice(0, MAX_PLOTTED).map((r) => r.id).join(",") || "",
    });
  };
  const allState: "none" | "some" | "all" =
    selected.size === 0
      ? "none"
      : selected.size >= Math.min(MAX_PLOTTED, sorted.length)
        ? "all"
        : "some";

  const setSort = (key: string, nextDir: MatrixSortDir) =>
    setParams({ sort: key, dir: nextDir });

  const setMode = (patch: Record<string, string | null>) =>
    // Grain changes what ROW ids mean (batch vs student), so the grid
    // state — plotted rows, exam exclusions, sort — drops with it. The
    // audience (`bats` is batch ids in BOTH grains) and the test picks
    // keep their meaning and survive the flip.
    setParams({
      ...patch,
      ex: null,
      sel: null,
      sort: null,
      dir: null,
      rows: null,
    });

  const tooLarge = isError && (error as Error & { code?: string }).code === "MATRIX_TOO_LARGE";
  const excludedCount = exams.length - includedIdx.length;

  // Wizard pick toggling. Leaving the "all" state materialises the full
  // candidate set first; ticks equal to the full set collapse back to "all"
  // (param dropped) — so Select all means all-in-window, present AND future.
  const togglePick = (
    key: "exams" | "rows",
    all: string[],
    current: Set<string> | null,
    id: string,
  ) => {
    const next = new Set(current ?? all);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const isAll = all.length > 0 && all.every((x) => next.has(x));
    setShallowParams({ [key]: isAll ? null : [...next].sort().join(",") });
  };

  // Effective selection intersects the loaded candidates, so stale ids from
  // an old scope or deep link simply don't count.
  const effExamCount =
    pickedExams === null
      ? candExams.length
      : candExams.filter((e) => pickedExams.has(e.id)).length;

  // ── Wizard gating ───────────────────────────────────────────────
  const batchById = useMemo(
    () => new Map((batchesQuery.data ?? []).map((b) => [b.id, b])),
    [batchesQuery.data],
  );
  const audienceEmpty =
    audience.distributions.length === 0 &&
    (grain === "batches" || audience.extraStudents.length === 0);
  // Client-side twin of the server's cell guard — approximate (studentCount
  // drifts with enrolment), so the server's MATRIX_TOO_LARGE stays the
  // real enforcement and this stays the polite early warning.
  const estRows =
    grain === "batches"
      ? audience.distributions.length
      : Math.max(
          0,
          audience.distributions.reduce(
            (n, d) => n + (batchById.get(d.batchId)?.studentCount ?? 0),
            0,
          ) - audience.excludedStudentIds.length,
        ) + audience.extraStudents.length;
  const estCells = estRows * effExamCount;
  const overCap =
    audience.distributions.length > ID_CAP ||
    audience.extraStudents.length > ID_CAP ||
    audience.excludedStudentIds.length > ID_CAP ||
    (pickedExams !== null && pickedExams.size > ID_CAP);

  const stepGate: { disabled: boolean; hint?: string } =
    step === 1
      ? audienceEmpty
        ? {
            disabled: true,
            hint:
              grain === "students"
                ? "Pick at least one batch or student."
                : "Pick at least one batch.",
          }
        : { disabled: false }
      : step === 2
        ? candidatesQuery.isError
          ? { disabled: true, hint: "The test list failed to load — adjust the window." }
          : effExamCount === 0
            ? {
                disabled: true,
                hint:
                  candExams.length === 0 && !candidatesQuery.isPending
                    ? "No conducted tests in this window — widen the range."
                    : "Tick at least one test.",
              }
            : { disabled: false }
        : audienceEmpty || estRows === 0
          ? { disabled: true, hint: "Nothing to compare — go back and pick an audience." }
          : overCap
            ? {
                disabled: true,
                hint: `Over ${ID_CAP} hand-picked items — select or drop whole batches instead.`,
              }
            : effExamCount === 0
              ? { disabled: true, hint: "No tests picked — go back a step." }
              : estCells > CELL_BUDGET
                ? {
                    disabled: true,
                    hint: `≈${estCells.toLocaleString()} cells is over the ${CELL_BUDGET.toLocaleString()} budget — fewer rows or tests.`,
                  }
                : { disabled: false };

  const goStep = (n: number) => setParams({ step: n <= 1 ? null : String(n) });

  // ── Date window — created-range contract on top of the scope keys ──
  // Presets write from (to stays unbounded); custom is a draft committed
  // on Apply. Legacy links (preset=month etc.) keep their from/to — the
  // data stays right, only the label falls back to the custom form.
  const [draftFrom, setDraftFrom] = useState(
    scope.preset === "custom" ? (scope.from ?? "") : "",
  );
  const [draftTo, setDraftTo] = useState(
    scope.preset === "custom" ? (scope.to ?? "") : "",
  );
  const activePresetKey =
    !scope.from && !scope.to
      ? "all"
      : RANGE_OPTIONS.some((o) => o.key === scope.preset)
        ? (scope.preset as RangePreset)
        : "custom";
  const windowLabel =
    activePresetKey === "all"
      ? "All time"
      : activePresetKey !== "custom"
        ? rangeButtonLabel(activePresetKey, "", "")
        : `${scope.from ? fmtHuman(scope.from) : "…"} → ${scope.to ? fmtHuman(scope.to) : "today"}`;

  const buildGrid = () => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", "1");
    // Push, not replace: Back from the grid must land on this setup.
    router.push(`/analytics/compare?${p.toString()}`);
  };

  // The BackLink's href fallback for deep links with no history to walk —
  // the current setup, minus view.
  const setupHref = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("view");
    return p.size ? `?${p.toString()}` : "";
  }, [searchParams]);

  // ── Render ──────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="mx-auto max-w-350 space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!view) {
    return (
      <div className="mx-auto max-w-260 px-6 py-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="analytics-compare.land.title">Compare</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Three quick steps — only name lists load here; the scores load
            when you build the grid.
          </p>
        </header>

        <div className="mt-6">
          <WizardStepper
            steps={WIZARD_STEPS}
            currentStep={step - 1}
            onStepChange={(i) => goStep(i + 1)}
            testIds={[
              "analytics-compare.wizard.who",
              "analytics-compare.wizard.tests",
              "analytics-compare.wizard.review",
            ]}
          />
        </div>

        <div className="mt-6">
          {step === 1 && (
            <Panel
              title="Who is being compared"
              subtitle="Tick whole batches — rosters load per batch, only when you expand one"
              icon={<GridNine weight="duotone" className="h-4 w-4 text-primary" />}
            >
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-1.5" role="group" aria-label="Rows">
                    <button
                      type="button"
                      className={segBtn(grain === "batches")}
                      onClick={() => setMode({ grain: null })}
                      aria-pressed={grain === "batches"}
                    >
                      Batches
                    </button>
                    <button
                      type="button"
                      className={segBtn(grain === "students")}
                      onClick={() => setMode({ grain: "students" })}
                      aria-pressed={grain === "students"}
                    >
                      Students
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {grain === "batches"
                      ? "One row per selected batch — each cell is the batch's average."
                      : "One row per student — tick batches, then fine-tune individual students inside them."}
                  </p>
                </div>
                {branchesQuery.isPending || batchesQuery.isPending ? (
                  <Skeleton className="h-80 w-full rounded-(--radius)" />
                ) : branchesQuery.isError || batchesQuery.isError ? (
                  <p className="text-xs" style={{ color: analyticsTokens.color.warn }}>
                    Could not load branches and batches — check your connection.
                  </p>
                ) : (
                  <AudienceTreePicker
                    branches={branchesQuery.data ?? []}
                    batches={batchesQuery.data ?? []}
                    value={audience}
                    onChange={onAudienceChange}
                    allowStudentExclusion={grain === "students"}
                    defaultSectionsCollapsed
                  />
                )}
              </div>
            </Panel>
          )}

          {step === 2 && (
            <Panel
              title="Which tests count"
              subtitle="Select all keeps future tests in the window included"
              icon={<GridNine weight="duotone" className="h-4 w-4 text-primary" />}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <DateRangeFilter
                    label={windowLabel}
                    options={[
                      {
                        key: "all",
                        label: "All time",
                        title: "All time — every conducted test",
                      },
                      ...RANGE_OPTIONS.filter((o) => o.key !== "custom").map((o) => ({
                        key: o.key,
                        label: o.label,
                        title: rangeOptionLabel(o),
                      })),
                    ]}
                    activeKey={activePresetKey}
                    onSelect={(k) => {
                      if (k === "all") {
                        setScope({ preset: null, from: null, to: null });
                        return;
                      }
                      const { from } = resolveRange(k as RangePreset, "", "");
                      setScope({ preset: k, from, to: null });
                    }}
                    draftFrom={draftFrom}
                    draftTo={draftTo}
                    onDraftChange={(f, t) => {
                      setDraftFrom(f);
                      setDraftTo(t);
                    }}
                    onApplyCustom={() =>
                      setScope({
                        preset: "custom",
                        from: draftFrom || null,
                        to: draftTo || null,
                      })
                    }
                    applyDisabled={!draftFrom && !draftTo}
                    applyHint="Apply the selected range"
                  />
                  {/* Just the exam-type select — batch/section/dates live elsewhere now. */}
                  <ScopeBar showBatch={false} showSection={false} showExamType />
                </div>
                {candidatesQuery.isError ? (
                  <p className="text-xs" style={{ color: analyticsTokens.color.warn }}>
                    {(candidatesQuery.error as Error & { code?: string }).code ===
                    "MATRIX_TOO_LARGE"
                      ? "Too many tests to list — narrow the date range."
                      : "Could not load the test list. Check your connection and adjust a filter to retry."}
                  </p>
                ) : candidatesQuery.isPending ? (
                  <Skeleton className="h-80 w-full rounded-(--radius)" />
                ) : (
                  <PickerList
                    title="Tests"
                    searchable
                    items={candExams.map((e) => {
                      const ay = ayStartYear(e.date);
                      return {
                        id: e.id,
                        label: e.title,
                        // Previous-AY tests carry their year so old papers
                        // don't read as this year's.
                        sub: [
                          shortDate(e.date),
                          ay != null && ay !== currentAy ? ayShortLabel(ay) : null,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      };
                    })}
                    selected={pickedExams}
                    onToggle={(id) =>
                      togglePick("exams", candExams.map((e) => e.id), pickedExams, id)
                    }
                    onAll={() => setShallowParams({ exams: null })}
                    onNone={() => setShallowParams({ exams: "" })}
                  />
                )}
              </div>
            </Panel>
          )}

          {step === 3 && (
            <Panel
              title="Review & build"
              subtitle="The grid loads exactly this — nothing more"
              icon={<GridNine weight="duotone" className="h-4 w-4 text-primary" />}
            >
              <dl className="space-y-4 text-sm text-foreground">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Rows
                  </dt>
                  <dd className="mt-1">
                    {grain === "batches"
                      ? `${audience.distributions.length} batch${audience.distributions.length === 1 ? "" : "es"}`
                      : [
                          `≈${estRows} students from ${audience.distributions.length} batch${audience.distributions.length === 1 ? "" : "es"}`,
                          audience.extraStudents.length
                            ? `+${audience.extraStudents.length} added individually`
                            : null,
                          audience.excludedStudentIds.length
                            ? `−${audience.excludedStudentIds.length} excluded`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tests
                  </dt>
                  <dd className="mt-1">
                    {[
                      `${effExamCount} test${effExamCount === 1 ? "" : "s"}`,
                      windowLabel,
                      scope.examType
                        ? (EXAM_TYPE_LABELS[scope.examType as CanonicalExamType] ??
                          scope.examType)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Size
                  </dt>
                  <dd className="mt-1">
                    {estRows} rows × {effExamCount} tests ≈ {estCells.toLocaleString()}{" "}
                    cells
                    {estCells > CELL_BUDGET && (
                      <span
                        className="ml-1.5"
                        style={{ color: analyticsTokens.color.warn }}
                      >
                        — over the {CELL_BUDGET.toLocaleString()} budget
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </Panel>
          )}
        </div>

        <div className="mt-6">
          <WizardNavigation
            currentStep={step - 1}
            totalSteps={WIZARD_STEPS.length}
            onBack={() => goStep(step - 1)}
            onNext={() => (step === 3 ? buildGrid() : goStep(step + 1))}
            nextLabel={step === 3 ? "Build the grid" : "Next"}
            nextDisabled={stepGate.disabled}
            nextHint={stepGate.hint}
            nextTestId={step === 3 ? "analytics-compare.cta.build" : undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-350 px-6 py-8">
      <header className="flex items-start gap-4">
        <BackLink
          href={`/analytics/compare${setupHref}`}
          aria-label="Back to setup"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius) border border-border transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <ArrowLeft size={18} />
        </BackLink>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="analytics-compare.land.title">Compare</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every score in one grid — untick a test and the averages recompute
            on the spot; nothing refetches.
          </p>
        </div>
      </header>

      {plotted.length > 0 && (
        <div className="mt-6">
          <Panel
            title={chartMode === "bars" ? "Marks by test" : "Trajectory"}
            subtitle={
              chartMode === "bars"
                ? `${
                    subjectFilter ? `${displayedSubjects[0]?.name ?? subjectFilter} · ` : ""
                  }${plotted.length} of ${MAX_PLOTTED} rows × ${includedIdx.length} included tests, oldest first — one bar per test under each name, subject colors stacked, ${subjectFilter ? "subject marks" : "total"} on top; hover for the test name and marks; the right-hand group is the test-wise average`
                : `${
                    subjectFilter ? `${displayedSubjects[0]?.name ?? subjectFilter} · ` : ""
                  }${plotted.length} of ${MAX_PLOTTED} rows plotted across ${includedIdx.length} included exams, oldest first`
            }
            icon={
              chartMode === "bars" ? (
                <ChartBar weight="duotone" className="h-4 w-4 text-primary" />
              ) : (
                <ChartLineUp weight="duotone" className="h-4 w-4 text-primary" />
              )
            }
            action={
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5" role="group" aria-label="Chart type">
                  <button
                    type="button"
                    className={segBtn(chartMode === "bars")}
                    onClick={() => setShallowParams({ chart: null })}
                    aria-pressed={chartMode === "bars"}
                    title={`One bar per test under each student — subject colors stacked in the bar, ${subjectFilter ? "subject marks" : "total"} on top, test name and marks on hover; the test-wise average group is on the right`}
                  >
                    Marks
                  </button>
                  <button
                    type="button"
                    className={segBtn(chartMode === "lines")}
                    onClick={() => setShallowParams({ chart: "lines" })}
                    aria-pressed={chartMode === "lines"}
                    title="Line chart — score percentage across tests"
                  >
                    Trend
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShallowParams({ sel: "" })}
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            }
          >
            {chartMode === "bars" ? (
              <MarksBarChart
                series={markSeries}
                subjects={displayedSubjects.map((s) => s.name)}
                // Original indices, so a filtered subject keeps the color it
                // has in the all-subjects view.
                subjectColorIndices={displayedSubjects.map((s) => s.i)}
              />
            ) : (
              <TrajectoryChart labels={trajectoryLabels} series={plotted} />
            )}
          </Panel>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        {availableSubjects.length > 0 ? (
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Subject filter"
            // The one place the frozen-results caveat lives now:
            title="Picking a subject recomputes every number — scores, Avg, Fluctuation, Trend, Rank and the chart — on that subject's marks. Subject marks come from frozen (published) results, so unfinalised exams read as a dash."
          >
            <button
              type="button"
              className={segBtn(!subjectFilter)}
              onClick={() => setShallowParams({ subj: null })}
              aria-pressed={!subjectFilter}
            >
              All subjects
            </button>
            {availableSubjects.map(({ name }) => {
              const key = name.trim().toLowerCase();
              return (
                <button
                  key={key}
                  type="button"
                  className={segBtn(subjectFilter === key)}
                  onClick={() => setShallowParams({ subj: key })}
                  aria-pressed={subjectFilter === key}
                >
                  {name}
                </button>
              );
            })}
          </div>
        ) : (
          <span />
        )}
        <div className="relative">
          <MagnifyingGlass
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={grain === "students" ? "Search students…" : "Search batches…"}
            aria-label="Search rows"
            className="h-9 w-48 rounded-(--radius) border border-border bg-card pl-8 pr-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="mt-3">
        {isPending ? (
          <Skeleton className="h-96 w-full rounded-(--radius)" />
        ) : isError ? (
          <div className="rounded-(--radius) border border-dashed border-border p-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {tooLarge
                ? "That scope is too big for one grid"
                : (error as Error)?.message || "Could not load the matrix"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tooLarge
                ? "Go back to the setup and narrow the date range, pick fewer rows or tests, or choose a batch."
                : "Check your connection and try again."}
            </p>
            {!tooLarge && (
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-4 rounded-(--radius) border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                Retry
              </button>
            )}
          </div>
        ) : exams.length === 0 ? (
          <div className="rounded-(--radius) border border-dashed border-border p-10 text-center">
            <GridNine size={26} weight="duotone" className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No conducted exams in this scope</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isFiltered
                ? "Go back to the setup and widen the date range or clear a filter."
                : "The grid fills in as exams are conducted."}
            </p>
            {isFiltered && (
              <button
                type="button"
                onClick={resetScope}
                className="mt-4 rounded-(--radius) border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div data-testid="analytics-compare.grid.row">
            <MatrixGrid
              columns={columns}
              rows={displayRows}
              subjectLabels={subjectFilter ? [] : displayedSubjects.map((s) => s.name)}
              sort={sort}
              dir={dir}
              onSortChange={setSort}
              onToggleColumn={toggleExam}
              onToggleRow={toggleRow}
              selectionFull={selected.size >= MAX_PLOTTED}
              bandLabels={{
                rows: `${grain === "students" ? "Students" : "Batches"} — tick up to ${MAX_PLOTTED} at a time to plot on the chart`,
                tests: "Tests — tick a test to include it in the averages",
              }}
              allState={allState}
              onToggleAll={toggleAllRows}
              ayAvgLabels={ayLabels}
            />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {sorted.length === 0
                  ? "No rows match"
                  : `Showing ${(safePage - 1) * size + 1}–${Math.min(safePage * size, sorted.length)} of ${sorted.length}`}
                {excludedCount > 0 && ` · ${excludedCount} exam${excludedCount === 1 ? "" : "s"} excluded from averages`}
              </span>
              <span className="flex items-center gap-2">
                <label className="flex items-center gap-1.5">
                  Rows per page
                  <select
                    value={size}
                    onChange={(e) => setParams({ size: e.target.value, page: null })}
                    className="h-7 cursor-pointer rounded-md border border-border bg-card px-1.5 text-xs text-foreground outline-none"
                  >
                    {PAGE_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setParams({ page: String(safePage - 1) })}
                  className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
                >
                  Prev
                </button>
                <span>
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setParams({ page: String(safePage + 1) })}
                  className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CompareAnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
      <CompareExplorer />
    </Suspense>
  );
}
