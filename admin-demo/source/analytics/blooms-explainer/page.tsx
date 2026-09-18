"use client";

/**
 * Topic × Bloom's Taxonomy explainer — walks faculty through what
 * the heatmap shows, what each cognitive level means, and how to
 * act on low-accuracy cells. Designed in the same editorial style
 * as /analytics/at-risk-explainer.
 */

import { motion, type Variants } from "framer-motion";
import { ArrowLeft, Brain, Target, Lightbulb } from "@phosphor-icons/react";
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
// CONTENT
// ============================================================

const LEVELS: Array<{
  key: string;
  label: string;
  verb: string;
  example: string;
  tint: string;
}> = [
  {
    key: "remember",
    label: "Remember",
    verb: "Recall a fact or definition.",
    example:
      'e.g. "State Newton\'s second law" — the student reproduces a formula from memory.',
    tint: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  {
    key: "understand",
    label: "Understand",
    verb: "Explain meaning in your own words.",
    example:
      'e.g. "Explain what F = ma means physically." — paraphrase, classify, summarise.',
    tint: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "apply",
    label: "Apply",
    verb: "Use a concept in a familiar situation.",
    example:
      'e.g. "Find the acceleration of a 2 kg block under 10 N force." — plug and solve.',
    tint: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  {
    key: "analyse",
    label: "Analyse",
    verb: "Break the problem into parts.",
    example:
      'e.g. "Which assumption breaks if the surface is frictionless?" — decompose.',
    tint: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  },
  {
    key: "evaluate",
    label: "Evaluate",
    verb: "Judge between solutions or approaches.",
    example:
      'e.g. "Which method is more efficient for this integral — substitution or parts?"',
    tint: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  {
    key: "create",
    label: "Create",
    verb: "Design something new.",
    example:
      'e.g. "Design an experiment to measure g on Mars." — synthesise an original plan.',
    tint: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
];

const BAND_LEGEND: Array<{
  range: string;
  label: string;
  color: string;
  meaning: string;
}> = [
  {
    range: "≥ 80%",
    label: "Strong",
    color: "bg-success/40",
    meaning: "Cohort has this cognitive level locked in on this topic.",
  },
  {
    range: "65–79%",
    label: "Healthy",
    color: "bg-success/25",
    meaning: "Most students get it; a short recap is enough.",
  },
  {
    range: "50–64%",
    label: "Shaky",
    color: "bg-warning/30",
    meaning: "About half the batch is unsure — assign targeted practice.",
  },
  {
    range: "35–49%",
    label: "Weak",
    color: "bg-warning/50",
    meaning: "More wrong than right. Re-teach this level on this topic.",
  },
  {
    range: "< 35%",
    label: "Critical",
    color: "bg-danger/40",
    meaning: "The cohort is genuinely blocked. Restart from the prerequisite.",
  },
];

const HOW_TO_READ: Array<{ title: string; body: string }> = [
  {
    title: "Rows are topics",
    body: "Each row is a syllabus chapter or sub-topic the batch has attempted. Topics with zero attempts are hidden so the grid stays honest.",
  },
  {
    title: "Columns are cognitive levels",
    body: "From left to right: Remember → Understand → Apply → Analyse → Evaluate → Create. Bloom's Taxonomy ordered by cognitive demand.",
  },
  {
    title: "Cell colour = accuracy",
    body: "Green cells = cohort is strong there. Amber = shaky. Red = majority getting it wrong. An empty / grey cell means no questions at that level have been asked yet.",
  },
  {
    title: "Cell number = % correct",
    body: "Percentage of attempts at that topic × level combination that were answered correctly. The raw attempt count is shown on hover so thin data doesn't mislead.",
  },
];

const PATTERNS: Array<{ title: string; body: string; action: string }> = [
  {
    title: "Red Apply column across many topics",
    body: "The cohort understands definitions but can't plug them in. Usually points at weak problem-solving drills, not weak theory.",
    action: "Assign a mixed problem-application DPP spanning those topics.",
  },
  {
    title: "Green Remember + red Analyse on one topic",
    body: "Students memorised the content but can't break it down. Concept is shallow.",
    action: "Run a discussion class on that topic focused on why-questions.",
  },
  {
    title: "A topic row that's red at every level",
    body: "Foundational gap. Nothing higher will click until the base is fixed.",
    action: "Teach the prerequisite before the next scheduled class on this topic.",
  },
  {
    title: "Evaluate / Create columns blank",
    body: "Totally normal early in the year — those levels appear later in the course. If they're still blank at the end, question-bank coverage needs a review.",
    action: "Check the question bank for higher-order items before the next mock.",
  },
];

// ============================================================
// LAYOUT
// ============================================================

function SectionMarker({ n, label }: { n: string; label: string }) {
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

// ============================================================
// PAGE
// ============================================================

export default function BloomsExplainerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/40 via-white to-slate-50/40 dark:from-zinc-950 dark:via-black dark:to-zinc-950">
      {/* Grain overlay to match at-risk explainer */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.015] mix-blend-overlay dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative mx-auto max-w-3xl px-6 py-16 lg:px-8 lg:py-24">
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
            <Brain size={12} weight="duotone" className="text-violet-500" />
            Matrix reference
          </p>
          <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight text-zinc-900 md:text-6xl dark:text-zinc-50">
            Topic × Bloom's Taxonomy.
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            The heatmap on every batch page is a grid of topics (rows) by
            cognitive levels (columns). It shows which levels of thinking the
            cohort has actually mastered on each topic — rather than a single
            "accuracy" number that hides the shape of what students
            understand.
          </p>
        </motion.header>

        {/* 01 · How to read */}
        <motion.section
          className="mt-20"
          initial="hidden"
          animate="visible"
          custom={2}
          variants={fadeIn}
        >
          <SectionMarker n="01" label="How to read it" />
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Rows, columns, and colour.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {HOW_TO_READ.map((h) => (
              <div
                key={h.title}
                className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">
                  {h.title}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {h.body}
                </p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* 02 · Bloom's levels */}
        <motion.section
          className="mt-24"
          initial="hidden"
          animate="visible"
          custom={3}
          variants={fadeIn}
        >
          <SectionMarker n="02" label="The six cognitive levels" />
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Ordered by cognitive demand.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Each question in the bank is tagged with one level. A student can
            be strong at recall but weak at application — and the matrix
            exposes exactly that.
          </p>

          <ol className="mt-10 space-y-5">
            {LEVELS.map((lvl, i) => (
              <li
                key={lvl.key}
                className="flex gap-5 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-mono text-[12px] font-bold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                      {lvl.label}
                    </h3>
                    <span
                      className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${lvl.tint}`}
                    >
                      {lvl.key}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                    {lvl.verb}
                  </p>
                  <p className="mt-1.5 text-[12px] italic text-zinc-500 dark:text-zinc-400">
                    {lvl.example}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </motion.section>

        {/* 03 · Colour legend */}
        <motion.section
          className="mt-24"
          initial="hidden"
          animate="visible"
          custom={4}
          variants={fadeIn}
        >
          <SectionMarker n="03" label="Colour legend" />
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            What each band means.
          </h2>
          <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            {BAND_LEGEND.map((b, idx) => (
              <div
                key={b.label}
                className={`flex items-start gap-4 px-4 py-3.5 ${
                  idx !== BAND_LEGEND.length - 1
                    ? "border-b border-zinc-200 dark:border-zinc-800"
                    : ""
                }`}
              >
                <span
                  className={`inline-flex h-10 w-16 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold text-zinc-900 dark:text-zinc-100 ${b.color}`}
                >
                  {b.range}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">
                    {b.label}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {b.meaning}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* 04 · Patterns */}
        <motion.section
          className="mt-24"
          initial="hidden"
          animate="visible"
          custom={5}
          variants={fadeIn}
        >
          <SectionMarker n="04" label="Common patterns" />
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            What to look for.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Four shapes faculty should recognise immediately, plus what to
            actually do about each.
          </p>
          <div className="mt-8 space-y-4">
            {PATTERNS.map((p) => (
              <div
                key={p.title}
                className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-center gap-2">
                  <Target
                    size={16}
                    weight="duotone"
                    className="text-primary"
                  />
                  <h3 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">
                    {p.title}
                  </h3>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {p.body}
                </p>
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <span className="mt-0.5 shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                    Do
                  </span>
                  <p className="text-[12px] leading-relaxed text-foreground">
                    {p.action}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* 05 · Limits */}
        <motion.section
          className="mt-24"
          initial="hidden"
          animate="visible"
          custom={6}
          variants={fadeIn}
        >
          <SectionMarker n="05" label="Limits & caveats" />
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Where the matrix lies.
          </h2>
          <ul className="mt-8 space-y-4">
            <li className="flex gap-3">
              <Lightbulb
                size={16}
                weight="duotone"
                className="mt-1 shrink-0 text-amber-500"
              />
              <p className="text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                <strong>Cells with very few attempts are noisy.</strong>{" "}
                A topic × level cell with 2 attempts and 100% accuracy isn't
                "mastered" — it's "untested". Hover to see the attempt count.
              </p>
            </li>
            <li className="flex gap-3">
              <Lightbulb
                size={16}
                weight="duotone"
                className="mt-1 shrink-0 text-amber-500"
              />
              <p className="text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                <strong>Questions must be tagged.</strong> If the question
                bank doesn't have Bloom's levels set, those questions don't
                show up in any column — the grid reflects only what's tagged.
              </p>
            </li>
            <li className="flex gap-3">
              <Lightbulb
                size={16}
                weight="duotone"
                className="mt-1 shrink-0 text-amber-500"
              />
              <p className="text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                <strong>It's a cohort view, not a per-student view.</strong>{" "}
                Use the student dossier for individual performance — the
                matrix is for planning batch-level remediation.
              </p>
            </li>
          </ul>
        </motion.section>

        <div className="h-16" />
      </div>
    </div>
  );
}
