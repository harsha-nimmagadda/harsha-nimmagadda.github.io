"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkle,
  PaperPlaneTilt,
  Lightning,
  ChartBar,
  Table,
  Clock,
  ArrowsClockwise,
  ChatCircleDots,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  Skeleton,
  Badge,
  motionVariants,
  VoiceInput,
  analyticsTokens,
} from "@brilliance/ui";
import { apiClient } from "../../../lib/api-client";
import { useAuthStore } from "@/lib/auth-store";

const { chartColors, color } = analyticsTokens;

type AskResponse = {
  threadId: string;
  messageId: string;
  plan: {
    intent: string;
    metrics: string[];
    chart: { type: string; xAxis?: string; yAxis?: string };
    narrative: string;
    followUpSuggestions: string[];
    unsupportedReason?: string;
  };
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  narrative: string;
  meta: { latencyMs: number; cacheHit: boolean; tokensIn: number; tokensOut: number };
};

type Thread = {
  question: string;
  response: AskResponse | null;
  loading: boolean;
  error?: string;
};

const EXAMPLE_CATEGORIES = [
  {
    label: "Performance",
    icon: ChartBar,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    questions: [
      "Show average score trend for all batches this quarter",
      "Which batch has the highest improvement rate?",
    ],
  },
  {
    label: "Students",
    icon: MagnifyingGlass,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-500/10",
    questions: [
      "Top 5 faculty by student impact this quarter",
      "Which students are at risk of failing?",
    ],
  },
  {
    label: "Attendance",
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    questions: [
      "Which branch has the lowest attendance trend?",
      "Compare attendance across all batches this month",
    ],
  },
];

/**
 * Check if rows contain numeric columns suitable for charting.
 * Used by the parent to decide whether to render the chart container at all.
 */
function hasNumericColumns(rows: AskResponse["rows"], xKey?: string): boolean {
  if (!rows.length) return false;
  const keys = Object.keys(rows[0]!);
  const x = xKey || keys[0]!;
  return keys.some((k) => k !== x && typeof rows[0]![k] === "number");
}

function ResponseChart({ plan, rows }: { plan: AskResponse["plan"]; rows: AskResponse["rows"] }) {
  if (!rows.length) return null;

  const keys = Object.keys(rows[0]!);
  const xKey = plan.chart.xAxis || keys[0]!;
  const yKeys = keys.filter((k) => k !== xKey && typeof rows[0]![k] === "number");
  if (!yKeys.length) return null;

  const chartType = plan.chart.type;

  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={rows as any[]}
            dataKey={yKeys[0]!}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={chartColors[i % chartColors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line" || chartType === "area") {
    const Chart = chartType === "area" ? AreaChart : LineChart;
    return (
      <ResponsiveContainer width="100%" height={280}>
        <Chart data={rows as any[]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
          <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              fontSize: 12,
              border: "1px solid var(--border)",
              background: "var(--popover, #fff)",
              color: "var(--popover-foreground, #111)",
            }}
          />
          <Legend />
          {yKeys.map((key, i) =>
            chartType === "area" ? (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={chartColors[i % chartColors.length]}
                fill={chartColors[i % chartColors.length]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ) : (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={chartColors[i % chartColors.length]}
                strokeWidth={2.5}
                dot={{ r: 4, fill: chartColors[i % chartColors.length] }}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows as any[]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
        <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            fontSize: 12,
            border: "1px solid var(--border)",
            background: "var(--popover, #fff)",
            color: "var(--popover-foreground, #111)",
          }}
        />
        <Legend />
        {yKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={chartColors[i % chartColors.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function AskAnalyticsPage() {
  const { user } = useAuthStore();
  const userName = user?.name || user?.email || "You";
  const [threads, setThreads] = useState<Thread[]>([]);
  const [input, setInput] = useState("");
  const [examples, setExamples] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiClient.get<{ examples: string[] }>("/api/v1/analytics/ask/ask/examples").then((res) => {
      if (res.success && res.data) setExamples(res.data.examples);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threads]);

  async function ask(question: string) {
    if (!question.trim()) return;
    setInput("");
    const idx = threads.length;
    setThreads((prev) => [...prev, { question, response: null, loading: true }]);

    try {
      const res = await apiClient.post<AskResponse>("/api/v1/analytics/ask/ask", { question });
      setThreads((prev) => {
        const copy = [...prev];
        copy[idx] = {
          question,
          response: res.success ? res.data! : null,
          loading: false,
          error: res.success ? undefined : (res as any).error?.message,
        };
        return copy;
      });
    } catch (e: any) {
      setThreads((prev) => {
        const copy = [...prev];
        copy[idx] = { question, response: null, loading: false, error: e?.message ?? "Network error" };
        return copy;
      });
    }
  }

  const hasThreads = threads.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-bg dark:bg-bg-dark">
      {/* Scrollable thread area */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="mx-auto max-w-3xl px-6">
          {/* Empty state */}
          {!hasThreads && (
            <motion.div
              className="flex flex-col items-center justify-center pt-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
                <Sparkle size={32} weight="duotone" className="text-white" />
              </div>
              <h1 className="mt-6 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                Ask Excellencia AI
              </h1>
              <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
                Ask questions in plain English about your institution's analytics.
                Get instant charts, tables, and insights powered by AI.
              </p>

              {/* Category cards */}
              <div className="mt-10 grid w-full max-w-2xl gap-4 sm:grid-cols-3">
                {EXAMPLE_CATEGORIES.map((cat) => (
                  <motion.div
                    key={cat.label}
                    className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${cat.bg}`}>
                      <cat.icon size={18} weight="duotone" className={cat.color} />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {cat.label}
                    </p>
                    <div className="mt-3 space-y-2">
                      {cat.questions.map((q, qi) => (
                        <button
                          key={qi}
                          type="button"
                          onClick={() => ask(q)}
                          className="block w-full rounded-xl border border-border/50 px-3 py-2.5 text-left text-[13px] leading-snug text-foreground transition-all hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* API examples fallback */}
              {examples.length > 0 && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {examples.map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => ask(ex)}
                      className="rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-foreground dark:hover:bg-blue-500/10"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Thread messages */}
          {hasThreads && (
            <div className="space-y-6 pt-8">
              <AnimatePresence mode="popLayout">
                {threads.map((t, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                  >
                    {/* User message */}
                    <div className="mb-3 flex items-end justify-end gap-2">
                      <div className="max-w-[80%]">
                        <p className="mb-1 text-right text-[11px] font-medium text-muted-foreground">{userName}</p>
                        <div className="rounded-2xl rounded-br-md bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-medium text-white shadow-sm shadow-blue-600/20">
                          {t.question}
                        </div>
                      </div>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {userName.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()}
                      </div>
                    </div>

                    {/* Loading */}
                    {t.loading && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                          <Sparkle size={14} weight="fill" className="text-white" />
                        </div>
                        <div className="flex-1 space-y-2 pt-1">
                          <p className="text-[11px] font-medium text-muted-foreground">Excellencia AI</p>
                          <Skeleton className="h-4 w-3/4 rounded" />
                          <Skeleton className="h-4 w-1/2 rounded" />
                          <Skeleton className="mt-3 h-48 w-full rounded-xl" />
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {t.error && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/10">
                          <Lightning size={14} weight="fill" className="text-red-600" />
                        </div>
                        <div className="flex-1 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800/40 dark:bg-red-500/5">
                          <p className="text-sm text-red-700 dark:text-red-400">{t.error}</p>
                          <button
                            type="button"
                            onClick={() => ask(t.question)}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700"
                          >
                            <ArrowsClockwise size={12} weight="bold" />
                            Retry
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Response */}
                    {t.response && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                          <Sparkle size={14} weight="fill" className="text-white" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <p className="text-[11px] font-medium text-muted-foreground">Excellencia AI</p>
                          {/* Narrative */}
                          <p className="text-sm leading-relaxed text-foreground">
                            {t.response.narrative}
                          </p>

                          {/* Chart — only render container if data has numeric columns */}
                          {t.response.rowCount > 0 &&
                            hasNumericColumns(t.response.rows, t.response.plan.chart.xAxis) && (
                            <div className="overflow-hidden rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
                              <div className="mb-3 flex items-center gap-2">
                                <ChartBar size={14} weight="duotone" className="text-blue-600" />
                                <span className="text-xs font-medium text-muted-foreground">
                                  {t.response.plan.chart.type.replace(/_/g, " ")} chart
                                </span>
                              </div>
                              <ResponseChart plan={t.response.plan} rows={t.response.rows} />
                            </div>
                          )}

                          {/* Data table */}
                          {t.response.rowCount > 0 && (
                            <details className="group">
                              <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                                <Table size={14} weight="duotone" />
                                View data ({t.response.rowCount} rows)
                              </summary>
                              <div className="mt-2 overflow-x-auto rounded-xl border border-border">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50/30 text-xs font-medium uppercase text-muted-foreground">
                                    <tr>
                                      {Object.keys(t.response.rows[0]!).map((col) => (
                                        <th key={col} className="px-3 py-2 text-left">
                                          {col.replace(/_/g, " ")}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {t.response.rows.slice(0, 10).map((row, ri) => (
                                      <tr key={ri} className="border-t border-border/50">
                                        {Object.values(row).map((val, ci) => (
                                          <td key={ci} className="px-3 py-2 font-mono text-xs">
                                            {String(val ?? "—")}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {t.response.rowCount > 10 && (
                                  <p className="px-3 py-2 text-xs text-muted-foreground">
                                    Showing 10 of {t.response.rowCount} rows
                                  </p>
                                )}
                              </div>
                            </details>
                          )}

                          {/* Meta */}
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="font-mono">{t.response.meta.latencyMs}ms</span>
                            {t.response.meta.cacheHit && (
                              <Badge variant="success" className="text-[10px] px-1.5 py-0">
                                cached
                              </Badge>
                            )}
                            <span className="capitalize">{t.response.plan.intent}</span>
                          </div>

                          {/* Follow-ups */}
                          {t.response.plan.followUpSuggestions.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {t.response.plan.followUpSuggestions.map((s, si) => (
                                <button
                                  key={si}
                                  type="button"
                                  onClick={() => ask(s)}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-blue-300 hover:bg-blue-50 dark:bg-surface-dark dark:hover:bg-blue-500/10"
                                >
                                  <ChatCircleDots size={12} weight="duotone" className="text-blue-500" />
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Fixed input bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/80 px-6 py-4 backdrop-blur-xl dark:bg-background/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="mx-auto flex max-w-3xl items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your analytics..."
              className="w-full rounded-2xl border border-border bg-surface py-3 pl-4 pr-12 text-sm outline-none transition-all placeholder:text-muted-foreground/50 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:bg-surface-dark dark:focus:ring-blue-500/20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <VoiceInput
                onTranscript={(text) => {
                  setInput(text);
                  ask(text);
                }}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:opacity-40 disabled:shadow-none"
          >
            <PaperPlaneTilt size={20} weight="fill" />
          </button>
        </form>
      </div>
    </div>
  );
}
