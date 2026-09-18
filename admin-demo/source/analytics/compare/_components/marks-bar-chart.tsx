"use client";

// Marks chart for /analytics/compare: the x-axis carries the plotted rows
// (students or batches) BY NAME ONLY. Under each name stands one bar per
// included test — and the COLORS encode SUBJECTS, not tests: every bar is
// a stack of subject segments (the legend names them), so the same colors
// mean the same subjects in every bar. The test's total is written on top
// of the bar (the subject's marks instead when a single subject is shown),
// and hovering a bar shows its full breakdown (test name and date first,
// then earned/max per subject, then the total). Heights are
// RAW MARKS from a zero baseline, sign-split: positive subject segments
// stack upward, negative ones stack downward, so a segment's height is
// always its magnitude. The net total labels above the positive extent
// (below the negative extent when the whole bar is under zero). An Average GROUP sits at the far right: one bar per
// plotted row, in plot order — that row's average across the included
// tests (marks ÷ tests with results — the grid's average logic).
//
// A test whose subject split isn't frozen yet (results not released)
// still gets a bar: one neutral full-height Total segment, so the bar
// and its top label never silently vanish.
//
// Recharts needs a UNIQUE category per bar — two students sitting the
// same test would otherwise merge — so the x dataKey is
// `${rowId}|${examId}` and a custom tick renders each row's name once,
// centered under its bars. No exam names appear on the axis.
//
// Width grows with the bar count inside an overflow-x scroller: 10 rows ×
// 20 tests stays readable instead of mashed into the panel width.

import type { ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { analyticsTokens } from "@brilliance/ui";

const { chartColors, color } = analyticsTokens;
/** The no-split fallback segment is context, so it takes the neutral. */
const TOTAL_COLOR = color.insight.flat;
const AVG_KEY = "__avg__";

export interface MarksPoint {
  examId: string;
  /** Short name (kept for future use); `title` carries the full exam name for the tooltip. */
  label: string;
  title: string;
  /** Short conducted date, shown in the tooltip next to the row name. */
  date?: string | null;
  total: number | null;
  totalMax: number | null;
  /** Aligned to the `subjects` prop. */
  subjects: (number | null)[];
  subjectMax: (number | null)[];
}

export interface MarksSeries {
  id: string;
  name: string;
  /** Second axis-label line — the batch's BRANCH in batches grain, where
   *  two branches often run identically-named batches (SR MPC…). */
  sub?: string | null;
  /** Present/absent counts over the included tests — renders as a
   *  "14P · 2A" line under the student's name. Students grain only. */
  stat?: { present: number; absent: number } | null;
  /** Included exams, chronological — same order for every series. */
  points: MarksPoint[];
}

/** What the x-axis tick renders for a group. */
interface RowTickEntry {
  label: string;
  sub?: string | null;
  stat?: { present: number; absent: number } | null;
}

type Datum = Record<string, string | number | null>;

/** Mean of the non-null values; null when nothing is there to average. */
const meanOrNull = (values: (number | null)[]) => {
  const present = values.filter((v): v is number => v != null);
  return present.length
    ? Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 10) / 10
    : null;
};

/** One shared max when every paper agrees, else null (no honest denominator). */
const commonMax = (values: (number | null)[]) => {
  const present = [...new Set(values.filter((v): v is number => v != null))];
  return present.length === 1 ? present[0]! : null;
};

const fmtMarks = (v: number) => (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1));

/**
 * One category = one bar, so the default (shared) tooltip already carries
 * exactly the hovered bar's segments: subject rows in their own colors,
 * then the authoritative Total line.
 */
function MarksTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    dataKey?: string | number;
    name?: string;
    value?: number;
    color?: string;
    payload?: Datum;
  }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  // Spacer columns carry no title (and no marks) — nothing to show.
  if (!d || typeof d.title !== "string") return null;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
      {/* Test name leads; the row and date sit beneath it. */}
      <p className="text-xs font-semibold text-foreground">{d.title}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">{d.row}</span>
        {d.rowSub ? ` (${d.rowSub})` : ""}
        {d.date ? ` · ${d.date}` : ""}
      </p>
      {payload.map((entry) => {
        // The no-split fallback segment IS the total — the Total line below
        // already covers it.
        if (entry.value == null || entry.dataKey === "tOnly") return null;
        // s3 → _sm3: the paper max riding along in the datum.
        const max = d[`_sm${String(entry.dataKey).slice(1)}`];
        return (
          <p
            key={String(entry.dataKey)}
            className="mt-1 font-mono text-sm font-bold"
            style={{ color: entry.color }}
          >
            {fmtMarks(entry.value)}
            {typeof max === "number" ? (
              <span className="font-sans text-xs font-normal text-muted-foreground">
                /{fmtMarks(max)}
              </span>
            ) : null}
            <span className="ml-1.5 font-sans text-[11px] font-normal text-muted-foreground">
              {entry.name}
            </span>
          </p>
        );
      })}
      {(typeof d.t === "number" || d._zero === 1) && (
        <p className="mt-1 font-mono text-sm font-bold text-foreground">
          {fmtMarks(typeof d.t === "number" ? d.t : 0)}
          {typeof d._tm === "number" ? (
            <span className="font-sans text-xs font-normal text-muted-foreground">
              /{fmtMarks(d._tm)}
            </span>
          ) : null}
          <span className="ml-1.5 font-sans text-[11px] font-normal text-muted-foreground">
            Total
          </span>
        </p>
      )}
      {d._zero === 1 && (
        <p className="mt-1 text-[10px] text-muted-foreground">No marks recorded for this test</p>
      )}
    </div>
  );
}

/** Split a name at the word boundary closest to its middle — long student
 *  names overlap as one line, so the tick renders them as two. */
function splitTwoLines(label: string): [string, string | null] {
  const words = label.split(" ");
  if (words.length < 2 || label.length <= 12) return [label, null];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/** X-axis tick: the row's name, rendered once, centered under its bars.
 *  Long names wrap onto two lines; a `sub` (the batch's branch) renders
 *  as a smaller muted second line instead. */
function RowTick({
  x,
  y,
  payload,
  lookup,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  lookup: Map<string, RowTickEntry>;
}) {
  const entry = payload?.value ? lookup.get(payload.value) : undefined;
  if (!entry) return <g />;
  // With a sub line the name stays on one line; without one, long names
  // split across the two lines instead.
  const [line1, line2] = entry.sub ? [entry.label, null] : splitTwoLines(entry.label);
  // The Average group's label stands out from the student names.
  const isAvg = payload?.value?.startsWith(AVG_KEY) ?? false;
  return (
    <text
      x={x}
      y={(y ?? 0) + 10}
      textAnchor="middle"
      fontSize={10}
      fontWeight={isAvg ? 800 : 600}
      fill={isAvg ? "var(--color-foreground)" : "var(--color-muted-foreground)"}
    >
      <tspan x={x} dy="0">
        {line1}
      </tspan>
      {line2 && (
        <tspan x={x} dy="11">
          {line2}
        </tspan>
      )}
      {entry.sub && (
        <tspan x={x} dy="11" fontSize={9} fontWeight={500} fill="var(--color-muted-foreground)">
          {entry.sub}
        </tspan>
      )}
      {entry.stat && (
        <tspan x={x} dy="11" fontSize={9} fontWeight={600}>
          <tspan fill="var(--color-muted-foreground)">{entry.stat.present}P · </tspan>
          <tspan
            fill={entry.stat.absent > 0 ? color.insight.down : "var(--color-muted-foreground)"}
          >
            {entry.stat.absent}A
          </tspan>
        </tspan>
      )}
    </text>
  );
}

export function MarksBarChart({
  series,
  subjects,
  subjectColorIndices,
}: {
  series: MarksSeries[];
  /** Displayed subject names — aligned to every point's subjects array. */
  subjects: string[];
  /** Each displayed subject's index in the FULL subject list, so a
   *  subject keeps its all-subjects color when it's filtered down to
   *  alone. Defaults to the display order. */
  subjectColorIndices?: number[];
}) {
  const data: Datum[] = [];
  const rowLabelByKey = new Map<string, RowTickEntry>();

  const rowAvgBars: Datum[] = [];
  for (const s of series) {
    s.points.forEach((p, i) => {
      const key = `${s.id}|${p.examId}`;
      const d: Datum = {
        key,
        row: s.name,
        rowSub: s.sub ?? null,
        title: p.title,
        date: p.date ?? null,
        t: p.total,
        _tm: p.totalMax,
      };
      p.subjects.forEach((v, si) => {
        d[`s${si}`] = v;
        d[`_sm${si}`] = p.subjectMax[si] ?? null;
      });
      data.push(d);
      // Name each group once, under its middle bar.
      if (i === Math.floor((s.points.length - 1) / 2))
        rowLabelByKey.set(key, { label: s.name, sub: s.sub ?? null, stat: s.stat ?? null });
    });
    if (s.points.length > 0) {
      // The row's AVERAGE bar — marks ÷ tests with results (absents count
      // as 0; unreleased tests don't count), the same number the grid's
      // averages stand on. Joins the clubbed Average group at the end.
      const n = s.points.filter((p) => p.total != null).length;
      const avg: Datum = {
        key: `${AVG_KEY}|${s.id}`,
        row: s.name,
        rowSub: s.sub ?? null,
        title: `Average across ${n} tests with results`,
        t: meanOrNull(s.points.map((p) => p.total)),
        _tm: commonMax(s.points.map((p) => p.totalMax)),
      };
      subjects.forEach((_name, si) => {
        avg[`s${si}`] = meanOrNull(s.points.map((p) => p.subjects[si] ?? null));
        avg[`_sm${si}`] = commonMax(s.points.map((p) => p.subjectMax[si] ?? null));
      });
      rowAvgBars.push(avg);
      // One empty spacer column after each group: the tests inside a group
      // pack tight (small barCategoryGap) and THIS is what separates one
      // student from the next — and from the Average group at the end.
      data.push({ key: `__gap__${s.id}` });
    }
  }

  // The clubbed Average GROUP: one bar per plotted row, in plot order —
  // hover names the row. Named once, under its middle bar.
  rowAvgBars.forEach((d, i) => {
    data.push(d);
    if (i === Math.floor((rowAvgBars.length - 1) / 2))
      rowLabelByKey.set(String(d.key), { label: "Average" });
  });

  // Per-bar label bookkeeping: `_lbl` is the number written on top of the
  // stack (the test total; the subject marks when a single subject is
  // displayed; the segment sum when the total is missing);
  // `_top` names the topmost non-null segment so exactly one segment per
  // bar renders it; `tOnly` is the neutral full-height fallback segment for
  // bars whose subject split isn't frozen yet.
  const subjectScoped = subjects.length === 1;
  for (const d of data) {
    let top: string | null = null;
    let segmentSum = 0;
    let hasSegment = false;
    // Sign-split stacking: positives pile up from zero, negatives pile
    // down. The net label anchors on the OUTERMOST positive segment (the
    // last positive one in stack order); a bar with nothing above zero
    // anchors on the outermost negative segment and renders BELOW it.
    let topPos: string | null = null;
    let topNeg: string | null = null;
    subjects.forEach((_name, si) => {
      const v = d[`s${si}`];
      if (typeof v === "number") {
        top = `s${si}`;
        if (v > 0) topPos = `s${si}`;
        else if (v < 0) topNeg = `s${si}`;
        segmentSum += v;
        hasSegment = true;
      }
    });
    if (!hasSegment && typeof d.t === "number") {
      d.tOnly = d.t;
      top = "tOnly";
      if (d.t > 0) topPos = "tOnly";
      else if (d.t < 0) topNeg = "tOnly";
    } else if (!hasSegment && d.t == null && typeof d.title === "string") {
      // No marks at all (absent / not evaluated): carry a literal zero so
      // the category still triggers the tooltip, which reads it as 0.
      // Spacer columns (no title) stay untouched.
      d.tOnly = 0;
      d._zero = 1;
    }
    d._top = topPos ?? topNeg ?? top;
    if (!topPos && topNeg) d._below = 1;
    // Subject-scoped view (one displayed subject): the bar IS that subject's
    // marks, so the top label carries the subject marks, not the exam total.
    d._lbl =
      subjectScoped && hasSegment
        ? Math.round(segmentSum * 10) / 10
        : typeof d.t === "number"
          ? d.t
          : hasSegment
            ? Math.round(segmentSum * 10) / 10
            : null;
  }

  const hasAnyMarks = data.some(
    (d) => d.t != null || subjects.some((_s, si) => d[`s${si}`] != null),
  );
  if (!hasAnyMarks) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        No marks to plot yet — results for the included tests may not be released.
      </div>
    );
  }

  // One stacked bar per (row, test), plus the spacer columns — width per
  // column leaves room for the total on top. The per-group floor keeps the
  // two-line names from colliding when each group has only a bar or two.
  const minWidth = Math.max(data.length * 30, (series.length + 1) * 96) + 96;

  // The net total renders once per bar: above the positive extent, or
  // below the negative extent when the whole bar sits under zero.
  const renderTopLabel =
    (barKey: string) =>
    (props: {
      x?: number | string;
      y?: number | string;
      width?: number | string;
      height?: number | string;
      index?: number;
    }) => {
      const d = props.index != null ? data[props.index] : undefined;
      if (!d || d._top !== barKey || d._lbl == null) return null;
      // Normalize the rect: recharts may hand a negative height for
      // below-zero segments.
      const y0 = Number(props.y);
      const h = Number(props.height ?? 0);
      const topEdge = Math.min(y0, y0 + h);
      const bottomEdge = Math.max(y0, y0 + h);
      return (
        <text
          x={Number(props.x) + Number(props.width) / 2}
          y={d._below === 1 ? bottomEdge + 12 : topEdge - 4}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill="var(--color-foreground)"
        >
          {fmtMarks(Number(d._lbl))}
        </text>
      );
    };

  const bars: ReactElement[] = subjects.map((name, si) => (
    <Bar
      key={`s${si}`}
      dataKey={`s${si}`}
      name={name}
      stackId="marks"
      fill={chartColors[(subjectColorIndices?.[si] ?? si) % chartColors.length]}
      maxBarSize={24}
    >
      <LabelList content={renderTopLabel(`s${si}`)} />
    </Bar>
  ));
  bars.push(
    // Fallback segment for tests without a frozen subject split — the whole
    // bar is the total, in the neutral. Hidden from the legend on purpose.
    <Bar
      key="tOnly"
      dataKey="tOnly"
      name="Total (split pending)"
      stackId="marks"
      fill={TOTAL_COLOR}
      legendType="none"
      maxBarSize={24}
    >
      <LabelList content={renderTopLabel("tOnly")} />
    </Bar>,
  );

  return (
    <div className="overflow-x-auto">
      <div className="h-80" style={{ minWidth }}>
        <ResponsiveContainer width="100%" height="100%">
          {/* Top margin leaves headroom for the total labels above the stacks.
              barCategoryGap stays tiny so a group's tests pack tight — the
              spacer columns do the separating between groups. */}
          <BarChart
            data={data}
            // Diverging stacks: positive segments pile up from zero,
            // negative ones pile down — no segment ever crosses the
            // baseline, so heights always equal magnitudes.
            stackOffset="sign"
            margin={{ top: 18, right: 8, left: -8, bottom: 4 }}
            barGap={2}
            barCategoryGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            {/* Row names only — no exam names on the axis. Two-line height
                so long names wrap instead of overlapping the next group. */}
            <XAxis
              dataKey="key"
              interval={0}
              tickLine={false}
              height={series.some((s) => s.stat) ? 46 : 34}
              tick={<RowTick lookup={rowLabelByKey} />}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              // Bars rise from 0; negative-marking values dip below it.
              // 5% slack under the deepest bar keeps its below-bar net
              // label clear of the axis.
              domain={[(dataMin: number) => Math.min(0, Math.floor(dataMin * 1.05)), "auto"]}
              label={{
                value: "Marks",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "var(--color-muted-foreground)" },
              }}
            />
            {/* The zero baseline anchors every diverging stack — a shade
                heavier than the gridlines so it reads as the ground. */}
            <ReferenceLine y={0} stroke="var(--color-border)" strokeWidth={1.5} />
            <Tooltip
              content={<MarksTooltip />}
              cursor={{ fill: "var(--color-border)", opacity: 0.35 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {bars}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
