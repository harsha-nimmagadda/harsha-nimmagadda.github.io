"use client";

// Shared status vocabulary for analytics tables and cards.
//
// Every badge pairs colour with a WORD. A bare coloured dot encodes the
// entire meaning in hue, which fails for colour-blind users and in
// greyscale print/export — so the label is never optional.

import Link from "next/link";
import { analyticsTokens, cn } from "@brilliance/ui";

const { color } = analyticsTokens;

/**
 * Accuracy → semantic colour, one ramp for every analytics surface: 70 and
 * above is celebrate, 40 and above is warning, below that is critical. Lives
 * here with the badges because it is the same vocabulary — a 38% bar and an
 * "At risk" pill should not be different shades of the same idea.
 */
export function accuracyColor(accuracy: number): string {
  if (accuracy >= 70) return color.severity.celebrate;
  if (accuracy >= 40) return color.severity.warning;
  return color.severity.critical;
}

/** Re-exported so `accuracyColor` and `fmtPct` — always used on the same
 *  number — can be imported from one place. Defined in `./fmt`. */
export { fmtPct } from "./fmt";

export type RiskBand = "at-risk" | "watch" | "on-track" | "unknown";

const RISK_META: Record<RiskBand, { label: string; tone: string }> = {
  "at-risk": { label: "At risk", tone: color.severity.critical },
  watch: { label: "Watch", tone: color.severity.warning },
  "on-track": { label: "On track", tone: color.severity.celebrate },
  unknown: { label: "No data", tone: color.insight.flat },
};

export function RiskBadge({ band, className }: { band: RiskBand; className?: string }) {
  const meta = RISK_META[band] ?? RISK_META.unknown;
  return (
    <span
      className={cn(
        // nowrap: the label must never break across lines when a neighbouring
        // column (long batch names) squeezes this one.
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        color: meta.tone,
        borderColor: `${meta.tone}40`,
        backgroundColor: `${meta.tone}1a`,
      }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: meta.tone }}
      />
      {meta.label}
    </span>
  );
}

/**
 * Exam lifecycle, as four buckets rather than the 10-value exam_status
 * enum (three of which are deprecated). The API collapses them; this is
 * the matching display side, so the two can't drift.
 */
export type ExamStatusBucket = "upcoming" | "live" | "grading" | "released";

const EXAM_STATUS_META: Record<ExamStatusBucket, { label: string; tone: string }> = {
  upcoming: { label: "Upcoming", tone: color.insight.flat },
  live: { label: "In progress", tone: color.severity.info },
  grading: { label: "Results pending", tone: color.severity.warning },
  released: { label: "Released", tone: color.severity.celebrate },
};

export function ExamStatusBadge({
  bucket,
  className,
}: {
  bucket: ExamStatusBucket;
  className?: string;
}) {
  const meta = EXAM_STATUS_META[bucket] ?? EXAM_STATUS_META.upcoming;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        color: meta.tone,
        borderColor: `${meta.tone}40`,
        backgroundColor: `${meta.tone}1a`,
      }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: meta.tone }}
      />
      {meta.label}
    </span>
  );
}

/** ERI bands mirror the readiness levels used by the ERI engine. */
export function eriLevel(value: number): { label: string; tone: string } {
  if (value >= 70) return { label: "Strong", tone: color.severity.celebrate };
  if (value >= 40) return { label: "Developing", tone: color.severity.warning };
  return { label: "Weak", tone: color.severity.critical };
}

export function EriBadge({
  value,
  href,
  className,
}: {
  value: number | null;
  href?: string;
  className?: string;
}) {
  if (value == null) {
    return <span className="font-mono text-xs text-muted-foreground">—</span>;
  }
  const { label, tone } = eriLevel(value);
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm tabular-nums",
        href && "transition-colors hover:text-primary",
        className,
      )}
    >
      <span className="font-mono font-medium text-foreground">{value.toFixed(0)}</span>
      <span className="text-xs" style={{ color: tone }}>
        {label}
      </span>
    </span>
  );

  // relative z-20 lifts this above the row-level overlay link in
  // ExplorerTable (see CELL_LINK) so it opens the ERI drill-in rather than
  // the row's own target.
  return href ? (
    <Link href={href} className="relative z-20" onClick={(e) => e.stopPropagation()}>
      {content}
    </Link>
  ) : (
    content
  );
}

export type HealthTone = "green" | "amber" | "red" | "muted";

const HEALTH_META: Record<HealthTone, { label: string; tone: string }> = {
  green: { label: "Healthy", tone: color.severity.celebrate },
  amber: { label: "Needs attention", tone: color.severity.warning },
  red: { label: "Critical", tone: color.severity.critical },
  muted: { label: "No recent activity", tone: color.insight.flat },
};

export function HealthDot({ tone, className }: { tone: HealthTone; className?: string }) {
  const meta = HEALTH_META[tone] ?? HEALTH_META.muted;
  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: meta.tone }}
      role="img"
      aria-label={meta.label}
      title={meta.label}
    />
  );
}
