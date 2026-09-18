/**
 * Number formatting for analytics surfaces. Its own module rather than part of
 * `status-badges` so it can be imported (and tested) without pulling in the
 * `@brilliance/ui` barrel, whose token init runs on import.
 */

/**
 * Percentages for display, following `MetricTile`'s convention: whole numbers
 * stay whole, anything else gets one decimal. Endpoints hand back raw column
 * values (`exam_submissions.percentage` is full precision, and an AVG without
 * ROUND is worse), so `88.66666666666667%` reaches the UI unless every render
 * point formats.
 *
 * Deliberately NOT fixed in SQL: the stored precision is legitimate, and these
 * endpoints also feed the student, parent, and mobile apps.
 */
export function fmtPct(value: number): string {
  return `${fmtNum(value)}%`;
}

/**
 * The same rule without the unit, for quantities that are not percentages:
 * percentile ranks, point spreads, counts-with-decimals.
 *
 * Needed because the defect is not limited to percentages. A box plot printed
 * `24.410000000000004 pts` from a plain `q3 - q1` in JS floats — same class of
 * bug, no `%` to hang `fmtPct` on. Anything derived by arithmetic in the
 * browser goes through one of these two before it reaches a user.
 */
export function fmtNum(value: number): number {
  return Number.isInteger(value) ? value : Math.round(value * 10) / 10;
}
