"use client";

// Shared scope control for analytics pages: Branch → Batch → Section.
//
// Branch is normally global — owned by the sidebar switcher
// (useBranchContext) and attached to every request as X-Branch-Id by
// lib/api-fetch. Rendering a second picker *while that header is being sent*
// is the double-scoping bug this component was built to remove, because
// tenantScope resolves `header || query` and silently ignores the query.
//
// The one case where that reasoning does not apply is "All branches": no
// header is sent at all, so a ?branchId= is the only scope in play and has
// nothing to conflict with. That is also the case where the batch list is
// unusable without it — batch names repeat across branches ("SR BIPC" exists
// in eight), so a flat cross-branch list asks you to pick between eight
// identical labels. Hence `showBranch`, gated on scope.branchId === null.

import { useEffect, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { Button } from "@brilliance/ui/shadcn";
import { apiClient } from "@/lib/api-client";
import { SectionSelector } from "@/components/section-selector";
import { useBranchContext } from "@/lib/branch-context";
import { useAnalyticsScope } from "@/hooks/analytics/use-analytics-scope";
import {
  PRESET_LABELS,
  rangeForPreset,
  type DateRangePreset,
} from "@/lib/date-ranges";
import { CANONICAL_EXAM_TYPES, EXAM_TYPE_LABELS } from "@/lib/exam-type";

interface BatchOption {
  id: string;
  name: string;
}

/**
 * Which presets the analytics toolbars offer. Deliberately shorter than
 * PRESET_ORDER — "last quarter" and "last 6 months" read as the same
 * thing to most people and just make the list harder to scan.
 */
const SCOPE_PRESETS: DateRangePreset[] = [
  "all-time",
  "week",
  "month",
  "quarter",
  "year",
  "custom",
];

/** Date-only, so URLs stay readable and the API can cast straight to ::date. */
const toDateOnly = (iso: string) => iso.slice(0, 10);

const selectClass = (active: boolean) =>
  `h-9 cursor-pointer appearance-none rounded-(--radius) border bg-card px-2.5 pr-9 text-sm text-foreground outline-none transition hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/30 ${
    active ? "border-primary/60" : "border-border"
  }`;

const dateInputClass =
  "h-9 rounded-(--radius) border border-border bg-card px-2 text-sm text-foreground outline-none transition hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/30";

export function ScopeBar({
  className = "",
  showBranch = false,
  showBatch = true,
  showSection = true,
  showExamType = false,
  examTypeLabel = "All exam types",
  showDates = false,
  presets = SCOPE_PRESETS,
  defaultPreset = "all-time",
}: {
  className?: string;
  /**
   * Offer a branch narrowing control — rendered ONLY while the sidebar is on
   * "All branches", because that is the only time no X-Branch-Id header is
   * sent and a ?branchId= can take effect. Opt-in: pages that compare
   * branches (or that cannot act on one) must leave it off.
   */
  showBranch?: boolean;
  /**
   * A batch belongs to exactly one branch, so filtering a *comparison of
   * branches* by batch would leave one row with data and every other row
   * empty — which is not a comparison. Pages that can't act on the batch
   * must hide the control rather than render one that does nothing.
   */
  showBatch?: boolean;
  /** Exams are assigned to batches, not sections — hide it there. */
  showSection?: boolean;
  /**
   * Exam pattern filter (JEE Mains vs Advanced, …) — canonical values from
   * lib/exam-type.ts; the API expands legacy spellings. This is the control
   * that keeps Mains and Advanced averages from ever blending.
   */
  showExamType?: boolean;
  /**
   * The empty option's label. /analytics/exams overrides it to "All
   * patterns" because that page has a second, purpose-based type facet.
   */
  examTypeLabel?: string;
  showDates?: boolean;
  /**
   * Which presets this page offers. The explorers share one list; Home wants
   * short operational windows (Today / Yesterday) that would be noise on a
   * page comparing branches across a year.
   */
  presets?: DateRangePreset[];
  /**
   * What an unfiltered URL means. Must match what the API does with no
   * from/to, or the select will name a window the numbers aren't from.
   */
  defaultPreset?: DateRangePreset;
}) {
  const { scope, setScope, resetScope, isFiltered } = useAnalyticsScope();
  const [batches, setBatches] = useState<BatchOption[]>([]);

  // The sidebar already fetches these on mount and keeps them in the store,
  // so the picker costs no request. refreshBranches() below is only for a
  // deep link that renders before the sidebar has filled it.
  const branches = useBranchContext((s) => s.branches);
  const refreshBranches = useBranchContext((s) => s.refreshBranches);

  /** Only meaningful with no global branch — see the file header. */
  const branchPickerVisible = showBranch && !scope.branchId;

  useEffect(() => {
    if (branchPickerVisible && branches.length === 0) {
      refreshBranches().catch(() => {
        /* picker is optional — the page still works unscoped */
      });
    }
  }, [branchPickerVisible, branches.length, refreshBranches]);

  // On the explorers "All time" is the default, not "last month": an exam
  // roster that silently hides everything older than 30 days reads as data
  // loss. Home overrides it — there, an unfiltered URL means the API's own
  // trailing-30-day default, and naming a window the numbers aren't from is
  // exactly the drift this redesign exists to remove.
  const preset = (scope.preset as DateRangePreset | null) ?? defaultPreset;

  const applyPreset = (next: DateRangePreset) => {
    if (next === "all-time") {
      setScope({ preset: null, from: null, to: null });
      return;
    }
    if (next === "custom") {
      setScope({ preset: "custom" });
      return;
    }
    const range = rangeForPreset(next);
    setScope({
      preset: next,
      from: range.from ? toDateOnly(range.from) : null,
      to: range.to ? toDateOnly(range.to) : null,
    });
  };

  // Refetch when the global branch changes — the header narrows the result
  // server-side, so the batch list must not be cached across branches.
  // Skipped entirely when the selector is hidden: no sense fetching 200
  // batches to populate a control that never renders.
  useEffect(() => {
    if (!showBatch) return;
    let cancelled = false;
    // Narrow by the picked branch when there is one. Without this the list
    // is every batch in the institution, where names repeat across branches
    // and the options are indistinguishable.
    const qs = scope.filterBranchId
      ? `?limit=200&branchId=${encodeURIComponent(scope.filterBranchId)}`
      : "?limit=200";
    apiClient
      .get<unknown>(`/api/v1/batches${qs}`)
      .then((res) => {
        if (cancelled || !res.success) return;
        const data = res.data as Record<string, unknown> | unknown[];
        const list = Array.isArray(data)
          ? data
          : ((data as Record<string, unknown>)?.batches as unknown[]) ??
            ((data as Record<string, unknown>)?.items as unknown[]) ??
            [];
        setBatches(
          (list as Record<string, string>[]).map((b) => ({
            id: b.id ?? b._id,
            name: b.name ?? b.title ?? "Unnamed",
          })),
        );
      })
      .catch(() => {
        /* batch filter is optional — page still works unscoped */
      });
    return () => {
      cancelled = true;
    };
  }, [scope.branchId, scope.filterBranchId, showBatch]);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {branchPickerVisible && (
        <div className="relative">
          <select
            value={scope.filterBranchId ?? ""}
            onChange={(e) => setScope({ filterBranchId: e.target.value || null })}
            aria-label="Filter by branch"
            className={selectClass(!!scope.filterBranchId)}
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
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      )}

      {showBatch && (
        <div className="relative">
          <select
            value={scope.batchId ?? ""}
            onChange={(e) => setScope({ batchId: e.target.value || null })}
            aria-label="Filter by batch"
            className={selectClass(!!scope.batchId)}
          >
            {/* Says which "all" this is — the list narrowed to a branch a
                moment ago, and an unchanged label hides that. */}
            <option value="">
              {scope.filterBranchId ? "All batches in branch" : "All batches"}
            </option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <CaretDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      )}

      {showBatch && showSection && (
        <SectionSelector
          batchId={scope.batchId}
          value={scope.section ?? ""}
          onChange={(section) => setScope({ section: section || null })}
          label="Filter by section"
        />
      )}

      {showExamType && (
        <div className="relative">
          <select
            value={scope.examType ?? ""}
            onChange={(e) => setScope({ examType: e.target.value || null })}
            aria-label="Filter by exam pattern"
            className={selectClass(!!scope.examType)}
          >
            <option value="">{examTypeLabel}</option>
            {CANONICAL_EXAM_TYPES.map((t) => (
              <option key={t} value={t}>
                {EXAM_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <CaretDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      )}

      {showDates && (
        <>
          <div className="relative">
            <select
              value={preset}
              onChange={(e) => applyPreset(e.target.value as DateRangePreset)}
              aria-label="Filter by date range"
              className={selectClass(preset !== "all-time")}
            >
              {presets.map((p) => (
                <option key={p} value={p}>
                  {PRESET_LABELS[p]}
                </option>
              ))}
            </select>
            <CaretDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={scope.from ?? ""}
                max={scope.to ?? undefined}
                onChange={(e) => setScope({ from: e.target.value || null })}
                aria-label="From date"
                className={dateInputClass}
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={scope.to ?? ""}
                min={scope.from ?? undefined}
                onChange={(e) => setScope({ to: e.target.value || null })}
                aria-label="To date"
                className={dateInputClass}
              />
            </div>
          )}
        </>
      )}

      {isFiltered && (
        <Button variant="ghost" size="sm" onClick={resetScope}>
          Reset
        </Button>
      )}
    </div>
  );
}
