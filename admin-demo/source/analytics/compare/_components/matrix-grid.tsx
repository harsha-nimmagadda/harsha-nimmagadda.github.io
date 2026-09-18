"use client";

// The Excel-like grid behind /analytics/compare: a frozen left pane —
// Name, then the computed Avg / Fluctuation / Trend / Rank — with the
// exam columns (total mark + subject split) scrolling beside it.
//
// Deliberately NOT built on ExplorerTable — that is a server-paginated
// list shell shared by four rosters; frozen panes and per-column
// checkboxes would triple its prop surface for one consumer. The header
// button / aria-sort / first-click-desc idiom is copied from it so the
// two still read as one family.
//
// Frozen-pane mechanics: stacking several sticky-left columns needs every
// frozen column to have a FIXED width so each one's `left` offset is the
// sum of the widths before it — an auto-width cell would silently
// misalign every pane after it. Widths live in buildFrozenCols only.
//
// Perf: pagination is the render budget (≤100 rows × ~60 columns per
// page). Rows are fixed-height so the sticky pane never reflows.

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { analyticsTokens } from "@brilliance/ui";
import { accuracyColor } from "@/components/analytics/status-badges";

const { color } = analyticsTokens;

export interface MatrixColumn {
  id: string;
  /** Short header label; `title` carries the full text for the tooltip. */
  label: string;
  title: string;
  /** Second header line — the exam date. Absent for subject columns. */
  sub?: string;
  /** Scores mode only: unchecked columns are excluded from every average. */
  included?: boolean;
  /** Academic-year tag ("AY 24–25") — set only on columns OUTSIDE the current AY. */
  ay?: string;
  /** First column of a new academic year — draws the year-break rule. */
  ayBoundary?: boolean;
}

export interface MatrixDisplayRow {
  id: string;
  name: string;
  sub: string | null;
  href: string;
  /** Percentages — they drive the performance color and the hover title. */
  cells: (number | null)[];
  /** Raw total MARKS — the number each cell displays. */
  markCells: (number | null)[];
  /** [examIdx][displayedSubjectIdx] — subject MARKS split under each cell. */
  cellSubs?: (number | null)[][];
  avg: number | null;
  sigma: number | null;
  trend: number | null;
  rank: number | null;
  /** Per-academic-year averages (chronological) — set only when the
   *  included tests span more than one AY. Aligned to the grid's
   *  `ayAvgLabels`, which swaps the single Avg column for one per AY. */
  ayAvgs?: { label: string; avg: number | null }[];
  /** Tests the row sat / missed, over the included tests. Students grain
   *  only — batches grain leaves them unset and the column shows a dash. */
  present?: number | null;
  absent?: number | null;
  selected: boolean;
}

export type MatrixSortDir = "asc" | "desc";

type ComputedKey = "avg" | "sigma" | "trend" | "rank";

/** The frozen pane, in order. Widths in px — see the file header. A
 *  multi-AY selection swaps the single Avg column for one per academic
 *  year (sort keys `ayavg:<i>`, aligned to each row's `ayAvgs`). */
type FrozenCol = { key: string; label: string; title?: string; width: number };
const buildFrozenCols = (ayAvgLabels?: string[] | null): FrozenCol[] => [
  { key: "rank", label: "Rank", title: "Standing by average, across the whole scope", width: 60 },
  { key: "name", label: "Name", width: 240 },
  ...(ayAvgLabels?.length
    ? ayAvgLabels.map((label, i) => ({
        key: `ayavg:${i}`,
        label: `Avg ${label}`,
        title: `Average marks over the included AY ${label} tests`,
        width: 84,
      }))
    : [{ key: "avg", label: "Avg", title: "Average marks over the included exams", width: 64 }]),
  {
    key: "sigma",
    label: "Fluctuation",
    title: "How much scores swing around the average — std dev over the included exams, in percentage points",
    width: 96,
  },
  { key: "trend", label: "Trend", title: "Mean of the last 3 included results minus the prior 3", width: 64 },
  {
    key: "tests",
    label: "Tests",
    title: "Present · absent, over the included tests",
    width: 76,
  },
];

const headerBtn =
  "inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

function SortButton({
  label,
  sortKey,
  sort,
  dir,
  onSortChange,
  title,
}: {
  label: string;
  sortKey: string;
  sort: string;
  dir: MatrixSortDir;
  onSortChange: (key: string, dir: MatrixSortDir) => void;
  title?: string;
}) {
  const active = sort === sortKey;
  return (
    <button
      type="button"
      title={title}
      className={`${headerBtn} ${active ? "text-foreground" : ""}`}
      // First click sorts desc (top performers first); a second flips.
      onClick={() => onSortChange(sortKey, active && dir === "desc" ? "asc" : "desc")}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <span className="truncate">{label}</span>
      {active &&
        (dir === "asc" ? (
          <CaretUp size={12} weight="bold" className="shrink-0" />
        ) : (
          <CaretDown size={12} weight="bold" className="shrink-0" />
        ))}
    </button>
  );
}

const fmtCellMarks = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

function ScoreCell({
  value,
  marks,
  subs,
  subjectLabels,
}: {
  /** Percentage — colors the number and shows on hover; not displayed. */
  value: number | null;
  /** Raw total marks — the displayed number. */
  marks: number | null;
  /** Displayed-subject MARKS for this exam, aligned to subjectLabels. */
  subs?: (number | null)[];
  subjectLabels: string[];
}) {
  const subLine =
    subs && subs.some((v) => v != null) ? (
      <span className="block whitespace-nowrap text-[10px] leading-tight text-muted-foreground">
        {subjectLabels
          .map((label, i) =>
            subs[i] == null ? null : `${label.slice(0, 3)} ${fmtCellMarks(subs[i]!)}`,
          )
          .filter(Boolean)
          .join(" · ")}
      </span>
    ) : null;

  return (
    <span className="inline-flex flex-col items-end">
      {marks == null && value == null ? (
        <span className="text-muted-foreground/60">—</span>
      ) : (
        <span
          className="font-medium tabular-nums"
          style={value != null ? { color: accuracyColor(value) } : undefined}
          title={value != null ? `${value.toFixed(1)}%` : undefined}
        >
          {/* Marks are the number; a marks-less cell (stale payload) falls
              back to the percentage, suffixed so the unit stays honest. */}
          {marks != null ? fmtCellMarks(marks) : `${value!.toFixed(1)}%`}
        </span>
      )}
      {subLine}
    </span>
  );
}

function computedContent(row: MatrixDisplayRow, key: ComputedKey): ReactNode {
  const dash = <span className="text-muted-foreground/60">—</span>;
  if (key === "avg") {
    return row.avg == null ? dash : <span className="font-semibold tabular-nums">{row.avg.toFixed(1)}</span>;
  }
  if (key === "sigma") {
    return row.sigma == null ? (
      dash
    ) : (
      <span className="tabular-nums" style={row.sigma >= 12 ? { color: color.warn } : undefined}>
        {row.sigma.toFixed(1)}
      </span>
    );
  }
  if (key === "trend") {
    return row.trend == null ? (
      dash
    ) : (
      <span
        className="tabular-nums"
        style={{
          color: row.trend > 1 ? color.insight.up : row.trend < -1 ? color.insight.down : undefined,
        }}
      >
        {row.trend > 0 ? "+" : ""}
        {row.trend.toFixed(1)}
      </span>
    );
  }
  return row.rank == null ? (
    dash
  ) : (
    <span className="tabular-nums text-muted-foreground">#{row.rank}</span>
  );
}

export function MatrixGrid({
  columns,
  rows,
  subjectLabels,
  sort,
  dir,
  onSortChange,
  onToggleColumn,
  onToggleRow,
  selectionFull,
  bandLabels,
  allState,
  onToggleAll,
  ayAvgLabels,
}: {
  columns: MatrixColumn[];
  /** The current page of rows — aggregates are computed upstream over the full set. */
  rows: MatrixDisplayRow[];
  /** Displayed subjects, aligned to each row's cellSubs. Empty = totals only. */
  subjectLabels: string[];
  sort: string;
  dir: MatrixSortDir;
  onSortChange: (key: string, dir: MatrixSortDir) => void;
  onToggleColumn?: (id: string) => void;
  onToggleRow: (id: string) => void;
  /** At the overlay cap: unchecked row boxes disable instead of piling on. */
  selectionFull: boolean;
  /** Group band over the two panes — names the frozen rows and the exam columns. */
  bandLabels?: { rows: string; tests: string };
  /** Tri-state for the header plot-all checkbox. */
  allState?: "none" | "some" | "all";
  onToggleAll?: () => void;
  /** Short AY labels ("24–25"), chronological — swaps the Avg column for
   *  one sortable average per year. Aligned to each row's `ayAvgs`. */
  ayAvgLabels?: string[] | null;
}) {
  const frozenCols = buildFrozenCols(ayAvgLabels);
  const frozenLeft = (index: number) =>
    frozenCols.slice(0, index).reduce((n, c) => n + c.width, 0);
  /** Sticky cell styling: opaque bg or scrolled cells ghost through. */
  const frozenStyle = (index: number): CSSProperties => ({
    position: "sticky",
    left: frozenLeft(index),
    width: frozenCols[index]!.width,
    minWidth: frozenCols[index]!.width,
    maxWidth: frozenCols[index]!.width,
  });
  // With the group band, the column header sticks just below it (h-7).
  const headRow = `sticky ${bandLabels ? "top-7" : "top-0"} z-20 bg-card`;
  const bandCell =
    "sticky top-0 h-7 border-b border-border bg-muted-light px-2.5 py-0 text-left align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  const lastFrozen = frozenCols.length - 1;
  // The frozen pane's right edge — one heavier border so the seam between
  // frozen and scrolling area reads as a pane split, not a random rule.
  const paneEdge = (i: number) => (i === lastFrozen ? "border-r-2" : "");

  return (
    <div className="max-h-[70vh] overflow-auto rounded-(--radius) border border-border">
      <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
        <thead>
          {bandLabels && (
            <tr>
              <th
                colSpan={frozenCols.length}
                style={{ left: 0 }}
                className={`${bandCell} z-40 border-r-2`}
              >
                {bandLabels.rows}
              </th>
              <th colSpan={Math.max(1, columns.length)} className={`${bandCell} z-20`}>
                {bandLabels.tests}
              </th>
            </tr>
          )}
          <tr>
            {frozenCols.map((col, i) => (
              <th
                key={col.key}
                style={frozenStyle(i)}
                className={`${headRow} z-30 border-b ${paneEdge(i)} border-border bg-card px-2.5 py-2 text-xs ${
                  col.key === "name" ? "text-left" : "text-right"
                }`}
              >
                {col.key === "tests" ? (
                  <span title={col.title} className="font-medium text-muted-foreground">
                    {col.label}
                  </span>
                ) : col.key === "name" && onToggleAll ? (
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allState === "all"}
                      ref={(el) => {
                        if (el) el.indeterminate = allState === "some";
                      }}
                      onChange={onToggleAll}
                      title="Plot the top rows on the chart / clear the chart"
                      aria-label="Plot the top rows on the chart"
                      className="h-3.5 w-3.5 cursor-pointer accent-primary"
                    />
                    <SortButton
                      label={col.label}
                      title={col.title}
                      sortKey={col.key}
                      sort={sort}
                      dir={dir}
                      onSortChange={onSortChange}
                    />
                  </span>
                ) : (
                  <SortButton
                    label={col.label}
                    title={col.title}
                    sortKey={col.key}
                    sort={sort}
                    dir={dir}
                    onSortChange={onSortChange}
                  />
                )}
              </th>
            ))}
            {columns.map((col, i) => (
              <th
                key={col.id}
                // min width keeps sparse columns (all dashes) from collapsing
                // into a ragged grid. The ayBoundary rule marks where one
                // academic year ends and the next begins.
                className={`${headRow} min-w-20 border-b border-border px-2 py-2 text-right align-bottom ${
                  col.included === false ? "opacity-40" : ""
                } ${col.ayBoundary ? "border-l-2" : ""}`}
                style={col.ayBoundary ? { borderLeftColor: color.warn } : undefined}
              >
                <span className="flex flex-col items-end gap-0.5">
                  <span className="flex items-center gap-1.5">
                    {onToggleColumn && (
                      <input
                        type="checkbox"
                        checked={col.included !== false}
                        onChange={() => onToggleColumn(col.id)}
                        aria-label={`Include ${col.title} in averages`}
                        className="h-3.5 w-3.5 cursor-pointer accent-primary"
                      />
                    )}
                    <SortButton
                      label={col.label}
                      title={col.title}
                      sortKey={`col:${i}`}
                      sort={sort}
                      dir={dir}
                      onSortChange={onSortChange}
                    />
                  </span>
                  <span className="flex items-center gap-1">
                    {col.ay && (
                      <span
                        className="rounded-full px-1.5 py-px text-[9px] font-bold"
                        style={{ color: color.warn, backgroundColor: `${color.warn}1A` }}
                        title={`Conducted in ${col.ay} — a previous academic year`}
                      >
                        {col.ay}
                      </span>
                    )}
                    {col.sub && (
                      <span className="text-[10px] font-normal text-muted-foreground/70">{col.sub}</span>
                    )}
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="group relative h-9 hover:bg-primary/5">
              {frozenCols.map((col, i) =>
                col.key === "name" ? (
                  <td
                    key="name"
                    style={frozenStyle(i)}
                    className="z-10 border-b border-border bg-card px-2.5 py-1.5"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        disabled={!row.selected && selectionFull}
                        onChange={() => onToggleRow(row.id)}
                        aria-label={`Plot ${row.name} on the chart`}
                        className={`h-3.5 w-3.5 shrink-0 accent-primary ${
                          !row.selected && selectionFull
                            ? "cursor-not-allowed opacity-40"
                            : "cursor-pointer"
                        }`}
                      />
                      <span className="min-w-0">
                        <Link
                          href={row.href}
                          className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {row.name}
                        </Link>
                        {row.sub && (
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {row.sub}
                          </span>
                        )}
                      </span>
                    </span>
                  </td>
                ) : col.key.startsWith("ayavg:") ? (
                  <td
                    key={col.key}
                    style={frozenStyle(i)}
                    className={`z-10 border-b ${paneEdge(i)} border-border bg-card px-2.5 py-1.5 text-right`}
                  >
                    {row.ayAvgs?.[Number(col.key.slice(6))]?.avg == null ? (
                      <span className="text-muted-foreground/60">—</span>
                    ) : (
                      <span className="font-semibold tabular-nums">
                        {row.ayAvgs[Number(col.key.slice(6))]!.avg!.toFixed(1)}
                      </span>
                    )}
                  </td>
                ) : col.key === "tests" ? (
                  <td
                    key="tests"
                    style={frozenStyle(i)}
                    className={`z-10 border-b ${paneEdge(i)} border-border bg-card px-2.5 py-1.5 text-right`}
                  >
                    {row.present == null && row.absent == null ? (
                      <span className="text-muted-foreground/60">—</span>
                    ) : (
                      <span className="whitespace-nowrap text-xs tabular-nums">
                        <span title={`Present for ${row.present ?? 0} of ${(row.present ?? 0) + (row.absent ?? 0)} included tests`}>
                          {row.present ?? 0}P
                        </span>
                        <span className="text-muted-foreground"> · </span>
                        <span
                          title={`Absent for ${row.absent ?? 0} included tests`}
                          style={row.absent ? { color: color.insight.down } : undefined}
                        >
                          {row.absent ?? 0}A
                        </span>
                      </span>
                    )}
                  </td>
                ) : (
                  <td
                    key={col.key}
                    style={frozenStyle(i)}
                    className={`z-10 border-b ${paneEdge(i)} border-border bg-card px-2.5 py-1.5 text-right`}
                  >
                    {computedContent(row, col.key as ComputedKey)}
                  </td>
                ),
              )}
              {row.cells.map((v, i) => (
                <td
                  key={columns[i]?.id ?? i}
                  // The AY-break rule runs down the whole column, not just
                  // the header, so the year split stays visible mid-scroll.
                  className={`border-b border-border px-2 py-1.5 text-right ${
                    columns[i]?.included === false ? "opacity-40" : ""
                  } ${columns[i]?.ayBoundary ? "border-l-2" : ""}`}
                  style={columns[i]?.ayBoundary ? { borderLeftColor: color.warn } : undefined}
                >
                  <ScoreCell
                    value={v}
                    marks={row.markCells[i] ?? null}
                    subs={row.cellSubs?.[i]}
                    subjectLabels={subjectLabels}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
