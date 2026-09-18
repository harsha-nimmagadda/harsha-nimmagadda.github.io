"use client";

// The section shell for every analytics page.
//
// Promoted verbatim from the local `Panel` in analytics/home/page.tsx, which
// six sections there already used, plus the three slots the dossiers need:
// `subtitle`, `loading` and `empty`.
//
// The slots are the point, not the border. A chart without its window ("last
// 30 days") and its derivation rule is a number nobody can defend in a
// meeting — the failure the redesign exists to fix. So `subtitle` carries
// what is measured and over what window, and `info` carries how it is
// derived, in plain words.
//
// `empty` is a first-class slot rather than a caller-side `&&` because the
// sub-pages being folded into dossier tabs each wrote a good "No readiness
// data yet — here is what will populate it" state, and those sentences have
// to survive the fold. A collapsed-to-nothing section reads as a failed
// fetch; a sentence explaining what must happen does not.

import type { ReactNode } from "react";
import { Skeleton, cn } from "@brilliance/ui";
import { InfoTooltip } from "@/components/info-tooltip";

export interface PanelProps {
  title: string;
  /** One line: what this measures and over what window. */
  subtitle?: string;
  icon?: ReactNode;
  /** How the number is derived. Rendered in a hover tooltip beside the title. */
  info?: ReactNode;
  /** Right side of the header: a "View all" link, an export, a filter select. */
  action?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  /**
   * Rendered instead of `children`. Pass the sentence explaining what has to
   * happen for data to appear — not a blank div, and not a spinner.
   */
  empty?: ReactNode;
  /**
   * Skeleton height while loading. Size it to the real content so the page
   * does not reflow when the query lands.
   */
  loadingHeight?: string;
  className?: string;
  bodyClassName?: string;
}

export function Panel({
  title,
  subtitle,
  icon,
  info,
  action,
  children,
  loading = false,
  empty,
  loadingHeight = "h-48",
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <section className={cn("rounded-(--radius) border border-border bg-card", className)}>
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icon}
            {title}
            {info && <InfoTooltip term={title} content={info} trigger="hover" />}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>

      <div className={cn("p-4", bodyClassName)}>
        {loading ? (
          <Skeleton className={cn("w-full rounded-(--radius)", loadingHeight)} />
        ) : empty ? (
          // Dashed, muted, and never coloured: "nothing here yet" is not a
          // warning, and tinting it amber invents a problem that does not exist.
          <div className="rounded-(--radius) border border-dashed border-border p-5 text-sm text-muted-foreground">
            {empty}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
