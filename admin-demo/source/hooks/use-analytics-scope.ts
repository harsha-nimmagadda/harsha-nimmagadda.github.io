"use client";

// Single source of truth for analytics page scope.
//
// Two different lifetimes are deliberately kept apart:
//   • Branch  — global, owned by the sidebar switcher (useBranchContext),
//               persisted to localStorage, and auto-attached to every
//               request as `X-Branch-Id` by lib/api-fetch. Pages must NOT
//               render their own branch picker or send ?branchId=.
//   • Batch / section / date — per-page, encoded in the URL so a filtered
//               view is shareable and survives back/forward.
//
// `queryKey` folds both together. Including the global branch id in every
// analytics React Query key is what makes a sidebar branch switch actually
// refetch — before this, the analytics pages never subscribed to the
// branch store, so switching branches left stale data on screen.

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useBranchContext } from "@/lib/branch-context";

export interface AnalyticsScope {
  /** From the global sidebar switcher. null = all branches. */
  branchId: string | null;
  /**
   * Page-local branch narrowing, meaningful ONLY while `branchId` is null.
   *
   * This is not a second branch picker competing with the sidebar. When the
   * sidebar names a branch, `lib/api-fetch` sends X-Branch-Id and
   * `tenantScope` resolves `header || query`, so the header wins and a query
   * value would be silently ignored — that is the double-scoping bug the
   * ScopeBar was built to remove. When the sidebar is on "all branches" no
   * header is sent at all, so this becomes the only scope in play and there
   * is nothing to conflict with. ScopeBar therefore renders the control only
   * in that case.
   *
   * The URL key stays `branchId` because inbound links (the branch dossier's
   * "view students") already use it.
   */
  filterBranchId: string | null;
  batchId: string | null;
  section: string | null;
  /**
   * Canonical exam type (jee_mains, jee_advanced, …) — see lib/exam-type.ts.
   * null = all types blended. The API expands it to every known DB spelling.
   */
  examType: string | null;
  /** Preset key driving from/to. null = all time. */
  preset: string | null;
  /** YYYY-MM-DD, inclusive. */
  from: string | null;
  to: string | null;
}

type ScopeParam = keyof Omit<AnalyticsScope, "branchId">;

const SCOPE_PARAMS: ScopeParam[] = [
  "filterBranchId",
  "batchId",
  "section",
  "examType",
  "preset",
  "from",
  "to",
];

/** Scope field → URL key. Only `filterBranchId` differs; see above. */
const URL_KEY: Record<ScopeParam, string> = {
  filterBranchId: "branchId",
  batchId: "batchId",
  section: "section",
  examType: "examType",
  preset: "preset",
  from: "from",
  to: "to",
};

export function useAnalyticsScope() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const branchId = useBranchContext((s) => s.selectedBranchId);

  const scope: AnalyticsScope = useMemo(
    () => ({
      branchId,
      filterBranchId: searchParams.get("branchId"),
      batchId: searchParams.get("batchId"),
      section: searchParams.get("section"),
      examType: searchParams.get("examType"),
      preset: searchParams.get("preset"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    }),
    [branchId, searchParams],
  );

  /**
   * Merge params into the URL. `null` removes a param. Any scope change
   * resets pagination — page 3 of the old filter is meaningless under a
   * new one.
   */
  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      if (Object.keys(next).some((k) => k !== "page")) params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setScope = useCallback(
    (next: Partial<Omit<AnalyticsScope, "branchId">>) => {
      const patch: Record<string, string | null> = {};
      for (const [key, value] of Object.entries(next)) {
        patch[URL_KEY[key as ScopeParam] ?? key] = value as string | null;
      }
      // Changing the branch ALWAYS drops the batch and section beneath it —
      // not just when clearing. A batch belongs to exactly one branch, so
      // carrying the old selection into a new branch filters to nothing and
      // reads as "this branch has no students".
      if ("filterBranchId" in next) {
        patch.batchId = null;
        patch.section = null;
      }
      // Same reasoning one level down: sections only exist within a batch.
      if ("batchId" in next && !next.batchId) patch.section = null;
      setParams(patch);
    },
    [setParams],
  );

  const resetScope = useCallback(() => {
    setParams(Object.fromEntries(SCOPE_PARAMS.map((p) => [URL_KEY[p], null])));
  }, [setParams]);

  const isFiltered = SCOPE_PARAMS.some((p) => searchParams.get(URL_KEY[p]) != null);

  /** Stable fragment for React Query keys — both branch scopes included. */
  const queryKey = useMemo(
    () => [
      scope.branchId,
      scope.filterBranchId,
      scope.batchId,
      scope.section,
      scope.examType,
      scope.from,
      scope.to,
    ],
    [scope],
  );
  // `preset` is intentionally absent from queryKey: it only ever derives
  // from/to, so including it would refetch identical data when someone
  // picks the preset that matches the custom range they already had.

  return { scope, setScope, setParams, resetScope, isFiltered, queryKey };
}
