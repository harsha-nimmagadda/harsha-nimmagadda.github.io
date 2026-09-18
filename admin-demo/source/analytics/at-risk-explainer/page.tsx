"use client";

/**
 * At-Risk Explainer — a visual walkthrough of the classifier that
 * powers /analytics/batch/[id]/at-risk. Designed as an editorial
 * briefing, not a wiki — every concept has a custom SVG diagram.
 * Source of truth: packages/api/src/routes/analytics-v3.ts at
 * GET /batch/:id/at-risk.
 */

import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  TrendDown,
  Minus,
} from "@phosphor-icons/react";
import { BackLink } from "@/components/back-link";

// ============================================================
// MOTION
// ============================================================

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
      delay: i * 0.04,
    },
  }),
};

// ============================================================
// SVG DIAGRAMS
// ============================================================

/**
 * Mini score-history chart. Highlights the triggering point in red
 * and optionally draws a dashed threshold line.
 */
function Sparkline({
  points,
  alertIndex,
  threshold,
  width = 180,
  height = 72,
}: {
  points: number[];
  alertIndex: number;
  threshold?: number;
  width?: number;
  height?: number;
}) {
  const max = 100;
  const padX = 10;
  const padY = 10;
  const stepX = (width - padX * 2) / Math.max(1, points.length - 1);
  const scaleY = (v: number) =>
    height - padY - (v / max) * (height - padY * 2);

  const linePath = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${padX + i * stepX} ${scaleY(v)}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${padX + (points.length - 1) * stepX} ${height - padY}` +
    ` L ${padX} ${height - padY} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full overflow-visible text-zinc-500 dark:text-zinc-400"
    >
      {/* baseline */}
      <line
        x1={padX}
        x2={width - padX}
        y1={height - padY}
        y2={height - padY}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={1}
      />
      {threshold !== undefined && (
        <g>
          <line
            x1={padX}
            x2={width - padX}
            y1={scaleY(threshold)}
            y2={scaleY(threshold)}
            stroke="rgb(244 63 94)"
            strokeOpacity={0.4}
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <text
            x={width - padX}
            y={scaleY(threshold) - 4}
            textAnchor="end"
            className="fill-rose-500 font-mono text-[9px]"
          >
            {threshold}%
          </text>
        </g>
      )}
      <path d={areaPath} fill="currentColor" fillOpacity={0.06} />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.55}
      />
      {points.map((v, i) => {
        const alert = i === alertIndex;
        return (
          <g key={i}>
            <circle
              cx={padX + i * stepX}
              cy={scaleY(v)}
              r={alert ? 5 : 3}
              fill={alert ? "rgb(244 63 94)" : "currentColor"}
              fillOpacity={alert ? 1 : 0.35}
            />
            {alert && (
              <circle
                cx={padX + i * stepX}
                cy={scaleY(v)}
                r={9}
                fill="rgb(244 63 94)"
                fillOpacity={0.15}
              />
            )}
            <text
              x={padX + i * stepX}
              y={scaleY(v) - (alert ? 11 : 8)}
              textAnchor="middle"
              className={
                alert
                  ? "fill-rose-500 font-mono text-[10px] font-semibold"
                  : "fill-zinc-500 font-mono text-[9px] dark:fill-zinc-400"
              }
            >
              {v}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * 0-100 severity gauge with 3 colored bands and optional marker.
 */
function SeverityGauge({ marker }: { marker?: number }) {
  const w = 600;
  const h = 40;
  const barY = 14;
  const barH = 12;

  return (
    <svg
      viewBox={`0 0 ${w} ${h + 30}`}
      className="w-full overflow-visible"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="sev" x1="0" x2="1">
          <stop offset="0%" stopColor="rgb(16 185 129)" />
          <stop offset="50%" stopColor="rgb(16 185 129)" />
          <stop offset="50%" stopColor="rgb(245 158 11)" />
          <stop offset="70%" stopColor="rgb(245 158 11)" />
          <stop offset="70%" stopColor="rgb(244 63 94)" />
          <stop offset="100%" stopColor="rgb(244 63 94)" />
        </linearGradient>
      </defs>
      {/* gauge bar */}
      <rect x={0} y={barY} width={w} height={barH} fill="url(#sev)" rx={6} />
      {/* tick labels */}
      {[0, 50, 70, 100].map((tick) => {
        const x = (tick / 100) * w;
        return (
          <g key={tick}>
            <line
              x1={x}
              x2={x}
              y1={barY - 4}
              y2={barY + barH + 4}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
            <text
              x={x}
              y={barY + barH + 16}
              textAnchor={tick === 0 ? "start" : tick === 100 ? "end" : "middle"}
              className="fill-zinc-600 font-mono text-[10px] dark:fill-zinc-400"
            >
              {tick}
            </text>
          </g>
        );
      })}
      {/* band labels */}
      <text
        x={25}
        y={barY - 6}
        className="fill-emerald-600 text-[10px] font-semibold uppercase tracking-wider dark:fill-emerald-400"
      >
        Low
      </text>
      <text
        x={(60 / 100) * w}
        y={barY - 6}
        textAnchor="middle"
        className="fill-amber-600 text-[10px] font-semibold uppercase tracking-wider dark:fill-amber-400"
      >
        Warning
      </text>
      <text
        x={(85 / 100) * w}
        y={barY - 6}
        textAnchor="middle"
        className="fill-rose-500 text-[10px] font-semibold uppercase tracking-wider"
      >
        Critical
      </text>
      {/* marker */}
      {marker !== undefined && (
        <g>
          <polygon
            points={`${(marker / 100) * w - 5},${barY + barH + 4} ${
              (marker / 100) * w + 5
            },${barY + barH + 4} ${(marker / 100) * w},${barY + barH - 2}`}
            fill="rgb(24 24 27)"
            className="dark:fill-zinc-100"
          />
        </g>
      )}
    </svg>
  );
}

/**
 * Stacked score composition (decline + shortfall) stacked bar for a
 * worked example of the risk-score formula.
 */
function FormulaBar({
  decline,
  shortfall,
  total,
}: {
  decline: number;
  shortfall: number;
  total: number;
}) {
  const w = 600;
  const h = 36;
  const scale = (v: number) => (v / 100) * w;

  return (
    <svg viewBox={`0 0 ${w} ${h + 42}`} className="w-full overflow-visible">
      {/* track */}
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={8}
        className="fill-zinc-100 dark:fill-zinc-900"
      />
      {/* decline segment */}
      {decline > 0 && (
        <g>
          <rect
            x={0}
            y={0}
            width={scale(decline)}
            height={h}
            className="fill-rose-500/90"
            rx={8}
          />
          <text
            x={scale(decline) / 2}
            y={h / 2 + 4}
            textAnchor="middle"
            className="fill-white font-mono text-[11px] font-semibold"
          >
            decline {decline}
          </text>
        </g>
      )}
      {/* shortfall segment */}
      {shortfall > 0 && (
        <g>
          <rect
            x={scale(decline)}
            y={0}
            width={scale(shortfall)}
            height={h}
            className="fill-amber-500/90"
          />
          <text
            x={scale(decline) + scale(shortfall) / 2}
            y={h / 2 + 4}
            textAnchor="middle"
            className="fill-white font-mono text-[11px] font-semibold"
          >
            shortfall {shortfall}
          </text>
        </g>
      )}
      {/* total marker */}
      <line
        x1={scale(total)}
        x2={scale(total)}
        y1={-2}
        y2={h + 10}
        stroke="currentColor"
        strokeOpacity={0.8}
        strokeWidth={2}
      />
      <text
        x={scale(total)}
        y={h + 26}
        textAnchor="middle"
        className="fill-zinc-900 font-mono text-[11px] font-bold dark:fill-zinc-100"
      >
        {total} / 100
      </text>
    </svg>
  );
}

/**
 * Side-by-side bars comparing two chapters' weakness scores with
 * computed values and attempt counts.
 */
function WeaknessCompare({
  left,
  right,
}: {
  left: { name: string; accuracy: number; attempts: number; score: number };
  right: { name: string; accuracy: number; attempts: number; score: number };
}) {
  const max = Math.max(left.score, right.score, 2);
  const h = 180;
  const barH = 28;
  const barTop = 60;

  const Col = ({
    data,
    x,
    width,
    highlight,
  }: {
    data: typeof left;
    x: number;
    width: number;
    highlight: boolean;
  }) => {
    const pct = Math.round(data.accuracy * 100);
    const barW = (data.score / max) * width;
    return (
      <g>
        {/* chapter label */}
        <text
          x={x + width / 2}
          y={18}
          textAnchor="middle"
          className="fill-zinc-900 text-[12px] font-semibold dark:fill-zinc-100"
        >
          {data.name}
        </text>
        <text
          x={x + width / 2}
          y={34}
          textAnchor="middle"
          className="fill-zinc-500 font-mono text-[10px] dark:fill-zinc-400"
        >
          {pct}% accuracy · {data.attempts} attempts
        </text>
        {/* bar */}
        <rect
          x={x + (width - barW) / 2}
          y={barTop}
          width={barW}
          height={barH}
          rx={6}
          className={highlight ? "fill-rose-500/90" : "fill-zinc-400/50"}
        />
        <text
          x={x + width / 2}
          y={barTop + barH + 18}
          textAnchor="middle"
          className="fill-zinc-900 font-mono text-[11px] font-bold dark:fill-zinc-100"
        >
          score = {data.score.toFixed(2)}
        </text>
        {/* formula */}
        <text
          x={x + width / 2}
          y={barTop + barH + 36}
          textAnchor="middle"
          className="fill-zinc-500 font-mono text-[9px] dark:fill-zinc-400"
        >
          (1 − {data.accuracy.toFixed(2)}) × ln(1 + {data.attempts})
        </text>
      </g>
    );
  };

  const w = 600;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible">
      <Col data={left} x={0} width={w / 2 - 10} highlight />
      <Col data={right} x={w / 2 + 10} width={w / 2 - 10} highlight={false} />
      {/* divider */}
      <line
        x1={w / 2}
        x2={w / 2}
        y1={48}
        y2={h - 8}
        stroke="currentColor"
        strokeOpacity={0.1}
        strokeWidth={1}
        strokeDasharray="2 4"
      />
    </svg>
  );
}

// ============================================================
// CONTENT
// ============================================================

const SIGNALS = [
  {
    label: "Failed recent exam",
    rule: "latest < 40",
    copy: "One hard drop on the latest exam puts a student on the list regardless of prior history — even if their average is still respectable.",
    points: [68, 72, 35],
    alertIndex: 2,
    threshold: 40,
  },
  {
    label: "Consistently struggling",
    rule: "avg < 50",
    copy: "Rolling average across the last three exams stays under 50%. Catches quiet under-performers whose scores never crash but never climb either.",
    points: [46, 42, 44],
    alertIndex: 2,
    threshold: 50,
  },
  {
    label: "Short-term decline",
    rule: "latest < second",
    copy: "Latest score is lower than the exam before it. Surfaces turning points before the student falls below absolute thresholds.",
    points: [70, 68, 55],
    alertIndex: 2,
  },
  {
    label: "Medium-term decline",
    rule: "second < third",
    copy: "The slide started an exam earlier. Useful for catching fading students whose latest score hasn't dropped yet.",
    points: [80, 68, 72],
    alertIndex: 1,
  },
] as const;

const ACTIONS = [
  {
    tag: "one_on_one",
    title: "Schedule 1-on-1",
    when: "when avg < 40%",
    copy: "The student needs personal faculty time, not more homework. Drops the urgency into the meetings queue.",
    tint: "rose",
  },
  {
    tag: "assign_dpp",
    title: "Assign DPP — weak chapter",
    when: "when a chapter has 3+ attempts and low accuracy",
    copy: "Targeted remedial practice. Deep-links to the assignment creator pre-scoped to the weak chapter.",
    tint: "sky",
  },
  {
    tag: "diagnostic_practice",
    title: "Diagnostic practice",
    when: "fallback when chapter data is thin",
    copy: "Broad mixed set to surface where the gaps actually are before we prescribe anything specific.",
    tint: "zinc",
  },
] as const;

const TIPS = [
  "Start with Critical. Clear red-band students before touching Warning or Low.",
  "Trust the confidence badge. A low-confidence weak chapter needs diagnostic data before you remediate.",
  "Pair declining trends with 1-on-1s. A downward slope often points at motivation, not content.",
  "Don't stack assignments. One targeted DPP beats three generic ones — students disengage when they see a queue.",
  "Revisit weekly. Classifier re-runs every time an exam's results release — Critical can become Warning in seven days.",
  "Loop parents in early. A meeting held before a student slips into Critical is cheaper than one after.",
] as const;

// ============================================================
// LAYOUT
// ============================================================

function SectionMarker({
  n,
  label,
}: {
  n: string;
  label: string;
}) {
  return (
    <div className="mb-10 flex items-baseline gap-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
      <span className="font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-600">
        {n}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
}

function Figure({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <figure className="my-2">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {children}
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-[11px] italic text-zinc-500 dark:text-zinc-400">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function AtRiskExplainerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/40 via-white to-slate-50/40 dark:from-zinc-950 dark:via-black dark:to-zinc-950">
      {/* Background grain */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.015] mix-blend-overlay dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative mx-auto max-w-3xl px-6 py-16 lg:px-8 lg:py-24">
        {/* Back link */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={0}
          variants={fadeIn}
        >
          <BackLink
            href="/analytics"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeft size={14} /> Back
          </BackLink>
        </motion.div>

        {/* Hero */}
        <motion.header
          className="mt-10"
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeIn}
        >
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Classifier reference
          </p>
          <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight text-zinc-900 md:text-6xl dark:text-zinc-50">
            How at-risk students are identified.
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            The at-risk list isn't a gut call. It's computed from each
            student's last three exam results using four independent signals,
            a combined risk score, a trend classifier, and a weakness ranking.
            This page walks through the rules end-to-end so you know exactly
            why each student surfaces.
          </p>
        </motion.header>

        {/* 01 · Signals */}
        <motion.section
          className="mt-20"
          initial="hidden"
          animate="visible"
          custom={2}
          variants={fadeIn}
        >
          <SectionMarker n="01" label="Who qualifies" />
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Four signals. Any one of them flags a student.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            The four conditions are <em>OR'd</em> — a student only needs to
            match one. The charts below show what each trigger looks like in
            the student's last three exams.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {SIGNALS.map((s, i) => (
              <motion.div
                key={s.rule}
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                custom={3 + i * 0.2}
                className="group rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
                      Signal {i + 1}
                    </p>
                    <h3 className="mt-1 text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                      {s.label}
                    </h3>
                  </div>
                  <code className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                    {s.rule}
                  </code>
                </div>
                <div className="my-5">
                  <Sparkline
                    points={[...s.points]}
                    alertIndex={s.alertIndex}
                    threshold={"threshold" in s ? s.threshold : undefined}
                  />
                </div>
                <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {s.copy}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* 02 · Risk score */}
        <motion.section
          className="mt-24"
          initial="hidden"
          animate="visible"
          custom={4}
          variants={fadeIn}
        >
          <SectionMarker n="02" label="Risk score" />
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Two components. Whichever is bigger dominates.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Once flagged, every student receives a score from 0 to 100. Higher
            means act sooner. The score sums a{" "}
            <strong className="text-zinc-900 dark:text-zinc-50">
              decline penalty
            </strong>{" "}
            (how far their last exam fell vs an earlier one) and an{" "}
            <strong className="text-zinc-900 dark:text-zinc-50">
              absolute shortfall
            </strong>{" "}
            (how far their rolling average sits below 60%). Either one alone
            can carry the score.
          </p>

          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="rounded-lg bg-slate-50/70 px-4 py-3 text-center font-mono text-[13px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              score = min(100, max(0, max(decline, 0) + max(0, 60 − avgPct)))
            </div>

            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
              Worked example
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Scores{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[12px] dark:bg-zinc-900">
                80 → 60 → 45
              </code>
              . Average is 62%.
            </p>

            <ul className="mt-3 space-y-1 text-[13px] font-mono text-zinc-600 dark:text-zinc-400">
              <li>
                decline = (80 − 45) / 80 × 100 ={" "}
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  43.75
                </span>
              </li>
              <li>
                shortfall = max(0, 60 − 62) ={" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  0
                </span>{" "}
                <span className="text-zinc-400">(avg above 60%)</span>
              </li>
              <li>
                score ={" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  44
                </span>{" "}
                — Low severity
              </li>
            </ul>

            <div className="mt-8">
              <FormulaBar decline={44} shortfall={0} total={44} />
            </div>
          </div>
        </motion.section>

        {/* 03 · Severity */}
        <motion.section
          className="mt-24"
          initial="hidden"
          animate="visible"
          custom={5}
          variants={fadeIn}
        >
          <SectionMarker n="03" label="Severity" />
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Three bands, one scale.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            The numeric score is bucketed into Low, Warning, and Critical
            bands. The color on every badge and chip comes straight from this
            scale.
          </p>

          <Figure caption="Score thresholds: Low (<50) · Warning (50–70) · Critical (>70)">
            <SeverityGauge marker={78} />
            <div className="mt-6 grid gap-3 text-[13px] sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                  Low
                </p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Mildly off-track. Monitor next exam cycle.
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                <p className="font-semibold text-amber-700 dark:text-amber-400">
                  Warning
                </p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Intervene this week — DPP or focused practice.
                </p>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/40 dark:bg-rose-950/30">
                <p className="font-semibold text-rose-700 dark:text-rose-400">
                  Critical
                </p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Act immediately. 1-on-1 or parent meeting.
                </p>
              </div>
            </div>
          </Figure>
        </motion.section>

        {/* 04 · Trend */}
        <motion.section
          className="mt-24"
          initial="hidden"
          animate="visible"
          custom={6}
          variants={fadeIn}
        >
          <SectionMarker n="04" label="Trend" />
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Declining. Or stagnant.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Each flagged student gets a trend label. The classifier only emits
            two values — if we see evidence of a drop, it's{" "}
            <em>declining</em>, otherwise it's <em>stagnant</em>. No
            &quot;improving&quot; here because improving students don't show up
            on this list.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-rose-200 bg-white p-5 dark:border-rose-900/40 dark:bg-zinc-950">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                  <TrendDown size={14} weight="bold" />
                </span>
                <h3 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">
                  Declining
                </h3>
              </div>
              <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                At least one drop in the last two or three exams.
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-zinc-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <Sparkline points={[72, 58]} alertIndex={1} />
                </div>
                <div className="rounded-lg border border-zinc-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <Sparkline points={[80, 72, 65]} alertIndex={2} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-white p-5 dark:border-amber-900/40 dark:bg-zinc-950">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                  <Minus size={14} weight="bold" />
                </span>
                <h3 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">
                  Stagnant
                </h3>
              </div>
              <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Flat scores. Qualified via absolute thresholds, not a decline.
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-zinc-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <Sparkline points={[42, 44, 41]} alertIndex={2} />
                </div>
                <div className="rounded-lg border border-zinc-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <Sparkline points={[36, 38, 35]} alertIndex={2} />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* 05 · Weakest chapter */}
        <motion.section
          className="mt-24"
          initial="hidden"
          animate="visible"
          custom={7}
          variants={fadeIn}
        >
          <SectionMarker n="05" label="Weakest chapter" />
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Accuracy, weighted by attempts.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            We rank each student's chapters by a score that combines wrong
            rate with how much they've actually tried. The log-scale factor
            stops a single-question chapter with 0% accuracy from outranking
            a heavily-attempted chapter that's merely weak.
          </p>

          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="rounded-lg bg-slate-50/70 px-4 py-3 text-center font-mono text-[13px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              score = (1 − accuracy) × ln(1 + attempts)
            </div>
            <div className="mt-8">
              <WeaknessCompare
                left={{
                  name: "Thermodynamics",
                  accuracy: 0.2,
                  attempts: 8,
                  score: 1.76,
                }}
                right={{
                  name: "Optics",
                  accuracy: 0,
                  attempts: 2,
                  score: 1.1,
                }}
              />
            </div>
            <p className="mt-4 text-center text-[12px] italic text-zinc-500 dark:text-zinc-400">
              Thermodynamics wins even though Optics has 0% — the log factor
              rewards enough data to act on.
            </p>
          </div>

          {/* Confidence */}
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              { label: "High · 8+ attempts", tint: "emerald" },
              { label: "Medium · 3–7 attempts", tint: "amber" },
              { label: "Low · <3 attempts", tint: "zinc" },
            ].map((c) => (
              <span
                key={c.label}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium ${
                  c.tint === "emerald"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : c.tint === "amber"
                      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    c.tint === "emerald"
                      ? "bg-emerald-500"
                      : c.tint === "amber"
                        ? "bg-amber-500"
                        : "bg-zinc-400"
                  }`}
                />
                {c.label}
              </span>
            ))}
          </div>
        </motion.section>

        {/* 06 · Actions */}
        <motion.section
          className="mt-24"
          initial="hidden"
          animate="visible"
          custom={8}
          variants={fadeIn}
        >
          <SectionMarker n="06" label="Recommended action" />
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Three actions. First match wins.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            The dashboard suggests one action per student, evaluated top to
            bottom. The suggestion deep-links to the tool that performs it so
            you can act in a single click.
          </p>

          <div className="mt-10 space-y-4">
            {ACTIONS.map((a, i) => {
              const tint = a.tint;
              const border =
                tint === "rose"
                  ? "border-rose-200 dark:border-rose-900/60"
                  : tint === "sky"
                    ? "border-sky-200 dark:border-sky-900/60"
                    : "border-zinc-200 dark:border-zinc-800";
              const pill =
                tint === "rose"
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  : tint === "sky"
                    ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                    : "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";

              return (
                <div
                  key={a.tag}
                  className={`flex items-start gap-4 rounded-xl border bg-white p-5 dark:bg-zinc-950 ${border}`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-mono text-[12px] font-bold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                        {a.title}
                      </h3>
                      <code
                        className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ${pill}`}
                      >
                        {a.tag}
                      </code>
                    </div>
                    <p className="mt-0.5 text-[12px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {a.when}
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {a.copy}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* 07 · Tips */}
        <motion.section
          className="mt-24"
          initial="hidden"
          animate="visible"
          custom={9}
          variants={fadeIn}
        >
          <SectionMarker n="07" label="Field notes" />
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            How faculty actually use it.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Six practical rules collected from coaches who run this list
            weekly.
          </p>
          <ol className="mt-10 space-y-8">
            {TIPS.map((t, i) => (
              <li key={i} className="flex gap-6">
                <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-600">
                  0{i + 1}
                </span>
                <p className="text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {t}
                </p>
              </li>
            ))}
          </ol>
        </motion.section>

        <div className="h-16" />
      </div>
    </div>
  );
}
