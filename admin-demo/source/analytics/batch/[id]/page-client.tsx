"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUrlSegment } from "@/lib/use-url-segment";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  Warning,
  TrendDown,
  CaretUp,
  CaretDown,
  Users,
} from "@phosphor-icons/react";
import { Skeleton } from "@brilliance/ui";
import { DateRangePicker } from "../../_components/date-range-picker";
import { StudentMultiSelect, type RosterStudent } from "../../_components/student-multi-select";
import { ExamTypeFilter } from "../../_components/exam-type-filter";
import {
  BatchBloomTopicMatrix,
  type BloomTopicMatrixData,
} from "../../_components/batch-bloom-topic-matrix";
import {
  type DateRange,
  rangeFromSearchParams,
  rangeForPreset,
} from "@/lib/date-ranges";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
} from "recharts";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { TierSegmentationPanel } from "@/components/tier-segmentation-panel";
import { BatchSummaryCards } from "./_components/batch-summary-cards";
import { StudentBatchRank } from "./_components/student-batch-rank";
import { useBackNavigation } from "@/components/back-link";
import { InfoTip } from "@/components/info-tip";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface BatchAnalytics {
  batchId: string;
  batchName: string;
  targetExam?: string;
  academicYear?: string;
  studentCount: number;
  averageScore: number;
  scoreDistribution: Record<string, number>;
  topicPerformance: Array<{
    topicId: string;
    topicName: string;
    subjectName: string;
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
  }>;
  studentRanking: Array<{
    rank: number;
    studentId: string;
    name: string;
    averagePercentage: number;
    averagePercentile: number;
    examsAttempted: number;
  }>;
  atRiskStudents: Array<{
    studentId: string;
    name: string;
    recentPercentiles: number[];
    trend: string;
  }>;
}

type SortField = "rank" | "name" | "averagePercentage" | "averagePercentile" | "examsAttempted";
type SortDir = "asc" | "desc";

const SCORE_BUCKETS = ["0-10", "10-20", "20-30", "30-40", "40-50", "50-60", "60-70", "70-80", "80-90", "90-100"];


function SectionTitle({ children, info }: { children: ReactNode; info: string }) {
  return (
    <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-gray-900 dark:text-white">
      {children}
      <InfoTip content={info} />
    </h2>
  );
}

/* ── Inline Tab Content ─────────────────────────────────────── */
// Per-tab explainer shown at the top of each analytics sub-tab.
// Gives faculty a one-sentence definition of the chart + what to look
// for, so nobody has to guess what a box plot or bell curve means.
const TAB_INTROS: Record<
  string,
  { title: string; body: string; lookFor: string }
> = {
  "bell-curve": {
    title: "Bell Curve",
    body:
      "Histogram of student averages across the selected date range. The shape shows how the batch is distributed — a tall centre with symmetric tails (a bell) means most students cluster near the mean.",
    lookFor:
      "Skew left = weak majority pulling the mean down. Twin peaks = two distinct performance groups that need different strategies. Flat shape = no clear typical performer.",
  },
  "box-plot": {
    title: "Box Plot",
    body:
      "Per-subject five-number summary: the box spans the 25th–75th percentile of scores, the line inside is the median, and the whiskers reach the best and worst typical scores. One box per subject.",
    lookFor:
      "A tall box = scores are all over the place in that subject (inconsistent teaching or mixed foundations). A low median with a small box = the whole batch is uniformly weak.",
  },
  "at-risk": {
    title: "At-Risk Students",
    body:
      "Students flagged by the classifier based on their last 3 exams. A student qualifies if their latest <40%, rolling avg <50%, or they show a declining trend. Risk score 0–100 combines decline and absolute shortfall.",
    lookFor:
      "Above 70 = critical — act this week. 50–70 = assign targeted DPPs. Below 50 = monitor. Use the dedicated at-risk page for the full list + recommended actions.",
  },
  attendance: {
    title: "Attendance",
    body:
      "Histogram of student attendance percentages across the selected range. Each bar is a 10-point bucket (0–10, 10–20, …, 90–100). Helps spot whether attendance is healthy or clusters at the low end.",
    lookFor:
      "Below 60% is the typical intervention threshold — students in those buckets are candidates for parent outreach. A right-skewed shape (most students ≥80%) is what you want.",
  },
  syllabus: {
    title: "Syllabus Coverage",
    body:
      "Weekly comparison of topics planned vs topics actually taught. Planned line comes from the teaching calendar; covered line is populated as classes are logged. Gap = schedule drift.",
    lookFor:
      "Covered line dipping below planned means the batch is falling behind — course-correct before gaps compound. A perfectly aligned pair of lines is the healthy state.",
  },
};

function TabIntro({ tab }: { tab: string }) {
  const intro = TAB_INTROS[tab];
  if (!intro) return null;
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-xs dark:border-border-dark dark:bg-surface-dark">
      <div className="flex items-center gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          About this view
        </p>
      </div>
      <h3 className="mt-1 text-base font-semibold text-foreground">
        {intro.title}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        {intro.body}
      </p>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
        <span className="mt-0.5 shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
          Look for
        </span>
        <p className="text-[12px] leading-relaxed text-foreground">
          {intro.lookFor}
        </p>
      </div>
    </div>
  );
}

function TabContent({ batchId, tab }: { batchId: string; tab: string }) {
  const [tabData, setTabData] = useState<any>(null);
  const [tabLoading, setTabLoading] = useState(true);
  const [tabError, setTabError] = useState<string | null>(null);

  useEffect(() => {
    setTabLoading(true);
    setTabError(null);
    const urlMap: Record<string, string> = {
      "bell-curve": `/api/v1/analytics/v3/batch/${batchId}/bell-curve`,
      "box-plot": `/api/v1/analytics/v3/batch/${batchId}/box-plot`,
      "at-risk": `/api/v1/analytics/v3/batch/${batchId}/at-risk`,
      "attendance": `/api/v1/analytics/v3/batch/${batchId}/attendance-histogram`,
      "syllabus": `/api/v1/analytics/v3/batch/${batchId}/syllabus-cumulative-flow`,
    };
    const url = urlMap[tab];
    if (!url) { setTabLoading(false); return; }

    apiClient.get<any>(url)
      .then((res) => {
        if (res.success && res.data) setTabData(res.data);
        else setTabError("Could not load data");
      })
      .catch(() => setTabError("Network error"))
      .finally(() => setTabLoading(false));
  }, [batchId, tab]);

  if (tabLoading) {
    return (
      <div className="mt-6 space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (tabError) {
    return (
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/20">
        <p className="text-sm text-amber-700 dark:text-amber-300">{tabError}</p>
        <p className="mt-1 text-xs text-amber-600/70">The API endpoint may not have data for this batch yet.</p>
      </div>
    );
  }

  if (!tabData) return null;

  // ── Bell Curve ──
  if (tab === "bell-curve") {
    const buckets = tabData.buckets ?? [];
    return (
      <>
      <TabIntro tab={tab} />
      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs font-medium text-muted">Mean</p>
            <p className="mt-1 text-2xl font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{Math.round(tabData.mean ?? 0)}%</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs font-medium text-muted">Std Dev</p>
            <p className="mt-1 text-2xl font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{Math.round(tabData.stdDev ?? 0)} pts</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs font-medium text-muted">Students</p>
            <p className="mt-1 text-2xl font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{tabData.totalStudents ?? 0}</p>
          </div>
        </div>
        {buckets.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
            <h3 className="text-base font-semibold">Score Distribution</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  // ── Box Plot ──
  if (tab === "box-plot") {
    const subjects = tabData.subjects ?? [];
    return (
      <>
      <TabIntro tab={tab} />
      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs font-medium text-muted">Median</p>
            <p className="mt-1 text-2xl font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{subjects.length > 0 ? Math.round(subjects.reduce((s: number, x: any) => s + (x.median ?? 0), 0) / subjects.length) : 0}%</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs font-medium text-muted">Subjects</p>
            <p className="mt-1 text-2xl font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{subjects.length}</p>
          </div>
        </div>
        {subjects.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
            <h3 className="text-base font-semibold">Score Spread by Subject</h3>
            <div className="mt-4 space-y-3">
              {subjects.map((s: any) => (
                <div key={s.name} className="flex items-center gap-4">
                  <span className="w-24 text-sm font-medium truncate">{s.name}</span>
                  <div className="flex-1 relative h-8 rounded-lg bg-slate-50/20">
                    <div className="absolute inset-y-0 rounded-lg bg-blue-200 dark:bg-blue-800/40" style={{ left: `${s.q1}%`, width: `${(s.q3 ?? 75) - (s.q1 ?? 25)}%` }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-blue-600" style={{ left: `${s.median}%` }} />
                  </div>
                  <span className="w-12 text-right text-xs font-mono text-muted">{Math.round(s.median ?? 0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  // ── At-Risk ──
  if (tab === "at-risk") {
    const students = tabData.students ?? [];
    return (
      <>
      <TabIntro tab={tab} />
      <div className="mt-4">
        <div className="rounded-2xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border dark:border-border-dark">
            <h3 className="text-base font-semibold">{students.length} At-Risk Students</h3>
          </div>
          {students.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">No at-risk students in this batch.</p>
          ) : (
            <div className="divide-y divide-border/50 dark:divide-border-dark/50">
              {students.slice(0, 20).map((s: any) => (
                <Link key={s.studentId} href={`/analytics/student/${s.studentId}`} className="flex items-center justify-between px-6 py-3 hover:bg-primary/5 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted">Risk: {s.riskScore} · Weak: {s.topWeakTopic}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${s.riskScore > 70 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : s.riskScore > 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                    {s.trend}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      </>
    );
  }

  // ── Attendance ──
  if (tab === "attendance") {
    const buckets = tabData.buckets ?? [];
    return (
      <>
      <TabIntro tab={tab} />
      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs font-medium text-muted">Avg Attendance</p>
            <p className="mt-1 text-2xl font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{Math.round(tabData.avgAttendance ?? 0)}%</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs font-medium text-muted">Below 60%</p>
            <p className="mt-1 text-2xl font-bold text-danger" style={{ fontFamily: "JetBrains Mono, monospace" }}>{tabData.belowThreshold ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs font-medium text-muted">Total Students</p>
            <p className="mt-1 text-2xl font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{tabData.totalStudents ?? 0}</p>
          </div>
        </div>
        {buckets.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
            <h3 className="text-base font-semibold">Attendance Distribution</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  // ── Syllabus ──
  if (tab === "syllabus") {
    const weeks = tabData.weeks ?? [];
    return (
      <>
      <TabIntro tab={tab} />
      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs font-medium text-muted">Coverage</p>
            <p className="mt-1 text-2xl font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{tabData.coveragePercent ?? 0}%</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs font-medium text-muted">Topics Covered</p>
            <p className="mt-1 text-2xl font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{tabData.totalCovered ?? 0} / {tabData.totalPlanned ?? 0}</p>
          </div>
        </div>
        {weeks.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center dark:border-border-dark dark:bg-surface-dark">
            <p className="text-sm text-muted">No teaching plan data yet. Syllabus coverage will appear once classes are logged.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
            <h3 className="text-base font-semibold">Weekly Coverage</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="planned" stroke="#94A3B8" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Planned" />
                  <Line type="monotone" dataKey="covered" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4 }} name="Covered" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  return null;
}

export default function BatchAnalyticsPage() {
  const router = useRouter();
  // Fallback only — a deep-linked tab has no history to go back to.
  const goBack = useBackNavigation("/analytics");
  const batchId = useUrlSegment(-1);
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  // Toolbar state (driven by URL query params so bookmarks + back button work)
  const range = useMemo<DateRange>(
    () => rangeFromSearchParams(searchParams),
    [searchParams],
  );
  const selectedStudentIds = useMemo<string[]>(() => {
    const raw = searchParams.get("studentIds");
    if (!raw) return [];
    return raw.split(",").map((x) => x.trim()).filter(Boolean);
  }, [searchParams]);
  const examTypeFilter = searchParams.get("examType") || "";

  const updateSearchParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  const handleRangeChange = useCallback(
    (next: DateRange) => {
      updateSearchParams((p) => {
        p.set("preset", next.preset);
        if (next.from) p.set("from", next.from);
        else p.delete("from");
        if (next.to) p.set("to", next.to);
        else p.delete("to");
      });
    },
    [updateSearchParams],
  );

  const handleStudentsChange = useCallback(
    (ids: string[]) => {
      updateSearchParams((p) => {
        if (ids.length === 0) p.delete("studentIds");
        else p.set("studentIds", ids.join(","));
      });
    },
    [updateSearchParams],
  );

  const handleExamTypeChange = useCallback(
    (val: string) => {
      updateSearchParams((p) => {
        if (val) p.set("examType", val);
        else p.delete("examType");
      });
    },
    [updateSearchParams],
  );

  // Build a query string that the backend honors
  const backendQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (range.from) p.set("from", range.from);
    if (range.to) p.set("to", range.to);
    if (selectedStudentIds.length > 0) p.set("studentIds", selectedStudentIds.join(","));
    if (examTypeFilter) p.set("examType", examTypeFilter);
    return p.toString();
  }, [range.from, range.to, selectedStudentIds, examTypeFilter]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<BatchAnalytics | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrix, setMatrix] = useState<BloomTopicMatrixData | null>(null);
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // If URL has no preset yet, default to 'month' on first mount so users
  // land on a sensible cumulative window instead of "all-time".
  useEffect(() => {
    if (!searchParams.get("preset")) {
      handleRangeChange(rangeForPreset("month"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch roster once per batch (independent of filters)
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    (async () => {
      try {
        const res = await apiClient.get<any>(`/api/v1/analytics/batch/${batchId}/roster`);
        if (res.success) setRoster((res.data as any).students ?? []);
      } catch {
        // non-fatal — multi-select just won't populate
      }
    })();
  }, [authLoading, isAuthenticated, batchId]);

  // Fetch batch analytics (reacts to filters)
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/login"); return; }

    async function fetchData() {
      setLoading(true);
      try {
        const url = `/api/v1/analytics/batch/${batchId}${backendQuery ? `?${backendQuery}` : ""}`;
        const res = await apiClient.get<any>(url);
        if (res.success) {
          setData(res.data as BatchAnalytics);
        } else {
          setError(res.error || "Failed to load batch analytics");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load batch analytics");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [authLoading, isAuthenticated, router, batchId, backendQuery]);

  // Fetch Topic × Bloom's matrix (reacts to filters)
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      setMatrixLoading(true);
      try {
        const url = `/api/v1/analytics/batch/${batchId}/blooms-by-topic${backendQuery ? `?${backendQuery}` : ""}`;
        const res = await apiClient.get<any>(url);
        if (!cancelled && res.success) setMatrix(res.data as BloomTopicMatrixData);
      } catch {
        if (!cancelled) setMatrix(null);
      } finally {
        if (!cancelled) setMatrixLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, batchId, backendQuery]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen overflow-y-auto bg-bg p-6 dark:bg-bg-dark lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg dark:bg-bg-dark">
        <div className="text-center">
          <p className="text-sm text-danger">{error || "No data"}</p>
          <button onClick={goBack} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">Back</button>
        </div>
      </div>
    );
  }

  const distributionData = SCORE_BUCKETS.map((bucket) => ({
    range: bucket,
    count: data.scoreDistribution[bucket] ?? 0,
  }));

  // Build subject-level radar data from topics
  const subjectRadarData = Object.values(
    data.topicPerformance.reduce<Record<string, { subject: string; accuracy: number; count: number }>>((acc, t) => {
      if (!acc[t.subjectName]) acc[t.subjectName] = { subject: t.subjectName, accuracy: 0, count: 0 };
      acc[t.subjectName].accuracy += t.accuracy;
      acc[t.subjectName].count += 1;
      return acc;
    }, {}),
  ).map((s) => ({ subject: s.subject, accuracy: Math.round(s.accuracy / Math.max(s.count, 1)) }));

  // Sort students
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "rank" ? "asc" : "desc");
    }
  };

  const sortedStudents = [...data.studentRanking].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortField === "name") return mul * a.name.localeCompare(b.name);
    return mul * ((a[sortField] ?? 0) - (b[sortField] ?? 0));
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <CaretUp size={10} weight="bold" /> : <CaretDown size={10} weight="bold" />;
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-bg p-6 dark:bg-bg-dark lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={goBack} className="mb-4 flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-primary">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{data.batchName}</h1>
              <p className="mt-1 text-sm text-muted">
                {data.targetExam && <span className="capitalize">{data.targetExam.replace(/_/g, " ")}</span>}
                {data.academicYear && ` · ${data.academicYear}`}
                {` · ${data.studentCount} students`}
                {selectedStudentIds.length > 0 && (
                  <span className="ml-2 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    Filtered to {selectedStudentIds.length}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DateRangePicker value={range} onChange={handleRangeChange} />
              <ExamTypeFilter value={examTypeFilter} onChange={handleExamTypeChange} />
              <StudentMultiSelect
                roster={roster}
                selected={selectedStudentIds}
                onChange={handleStudentsChange}
              />
              <div className="rounded-xl border border-border bg-surface p-4 text-center dark:border-border-dark dark:bg-surface-dark">
                <p className="font-mono text-2xl font-bold text-primary">{data.averageScore}%</p>
                <p className="text-xs text-muted">Avg Score</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Live KPI summary cards */}
        <div className="mt-6">
          <BatchSummaryCards batchId={batchId} />
        </div>

        {/* Tab Navigation — synced to URL ?tab= param */}
        {(() => {
          const TABS = [
            { key: "overview", label: "Overview" },
            { key: "bell-curve", label: "Bell Curve" },
            { key: "box-plot", label: "Box Plot" },
            { key: "at-risk", label: "At-Risk Students" },
            { key: "attendance", label: "Attendance" },
            { key: "syllabus", label: "Syllabus Coverage" },
          ] as const;
          const activeTab = searchParams.get("tab") || "overview";
          return (
            <motion.div
              className="mt-6 flex items-center rounded-xl border border-border bg-white p-1 dark:border-border-dark dark:bg-surface-dark"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    updateSearchParams((p) => {
                      if (tab.key === "overview") p.delete("tab");
                      else p.set("tab", tab.key);
                    });
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? "bg-white text-foreground shadow-sm dark:bg-surface-dark"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </motion.div>
          );
        })()}

        {/* Tab Content — rendered inline, no iframes */}
        {(searchParams.get("tab") === "bell-curve" || searchParams.get("tab") === "box-plot" || searchParams.get("tab") === "at-risk" || searchParams.get("tab") === "attendance" || searchParams.get("tab") === "syllabus") && (
          <TabContent batchId={batchId} tab={searchParams.get("tab")!} />
        )}

        {/* Overview tab (default) — Charts */}
        {(!searchParams.get("tab") || searchParams.get("tab") === "overview") && (<>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Score Distribution */}
          <motion.div className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <SectionTitle info="Histogram of student scores across all exams in the selected range. Each bar is a 10-pt bucket (0-10, 10-20, ...). Helps spot whether the batch clusters at a score level or spreads out.">
              Score Distribution
            </SectionTitle>
            <p className="text-xs text-muted">Distribution across all exams</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} formatter={(value: any) => [`${value} submissions`, "Count"]} />
                  <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Subject Radar */}
          <motion.div className="rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <SectionTitle info="Average accuracy per subject across all exams in the range. Shown as a radar when there are 3+ subjects, otherwise a simple list. Radar axes are capped at 100%.">
              Subject Performance
            </SectionTitle>
            <p className="text-xs text-muted">Average accuracy by subject</p>
            {subjectRadarData.length >= 3 ? (
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={subjectRadarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Radar name="Accuracy" dataKey="accuracy" stroke="#2563EB" fill="#2563EB" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {subjectRadarData.map((s) => (
                  <div key={s.subject} className="flex items-center justify-between rounded-lg border border-border/50 p-3 dark:border-border-dark/50">
                    <span className="text-sm font-medium">{s.subject}</span>
                    <span className="font-mono text-sm font-bold text-primary">{s.accuracy}%</span>
                  </div>
                ))}
                {subjectRadarData.length === 0 && <p className="py-8 text-center text-sm text-muted">No subject data</p>}
              </div>
            )}
          </motion.div>
        </div>

        {/* Topic × Bloom's Matrix */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-end">
            <Link
              href="/analytics/blooms-explainer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary dark:border-border-dark dark:bg-surface-dark"
            >
              How this works
            </Link>
          </div>
          <BatchBloomTopicMatrix data={matrix} loading={matrixLoading} />
        </div>

        {/* Topic Performance Table */}
        {data.topicPerformance.length > 0 && (
          <motion.div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <SectionTitle info="Topics sorted by lowest accuracy. Good candidates for re-teaching or assigning as DPPs. Minimum attempts threshold prevents one-question topics from gaming the list.">
              Weakest Topics
            </SectionTitle>
            <p className="text-xs text-muted">Topics where students struggle the most (sorted by accuracy ascending)</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
                    <th className="pb-2 pr-4">Topic</th>
                    <th className="pb-2 pr-4">Subject</th>
                    <th className="pb-2 pr-4 text-right">Questions</th>
                    <th className="pb-2 pr-4 text-right">Correct</th>
                    <th className="pb-2 text-right">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topicPerformance.slice(0, 15).map((t) => (
                    <tr key={t.topicId || t.topicName} className="border-b border-border/30 dark:border-border-dark/30">
                      <td className="py-2.5 pr-4 font-medium">{t.topicName}</td>
                      <td className="py-2.5 pr-4 text-muted">{t.subjectName}</td>
                      <td className="py-2.5 pr-4 text-right font-mono">{t.totalQuestions}</td>
                      <td className="py-2.5 pr-4 text-right font-mono">{t.correctAnswers}</td>
                      <td className="py-2.5 text-right">
                        <span className={`font-mono font-bold ${t.accuracy < 40 ? "text-danger" : t.accuracy < 60 ? "text-warning" : "text-success"}`}>
                          {t.accuracy}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Student Leaderboard */}
        <motion.div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
              <Trophy weight="duotone" className="h-5 w-5 text-warning" />
            </div>
            <div>
              <SectionTitle info="Students ranked by rolling average across the range. Percentile column is the student's rank position expressed as a percentage (99 = top 1%).">
                Student Leaderboard
              </SectionTitle>
              <p className="text-xs text-muted">{data.studentCount} students · Click headers to sort</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
                  <th className="cursor-pointer pb-2 pr-3" onClick={() => toggleSort("rank")}>
                    <span className="flex items-center gap-1"># <SortIcon field="rank" /></span>
                  </th>
                  <th className="cursor-pointer pb-2 pr-3" onClick={() => toggleSort("name")}>
                    <span className="flex items-center gap-1">Student <SortIcon field="name" /></span>
                  </th>
                  <th className="cursor-pointer pb-2 pr-3 text-right" onClick={() => toggleSort("averagePercentage")}>
                    <span className="flex items-center justify-end gap-1">Avg Score <SortIcon field="averagePercentage" /></span>
                  </th>
                  <th className="cursor-pointer pb-2 pr-3 text-right" onClick={() => toggleSort("averagePercentile")}>
                    <span className="flex items-center justify-end gap-1">Percentile <SortIcon field="averagePercentile" /></span>
                  </th>
                  <th className="cursor-pointer pb-2 text-right" onClick={() => toggleSort("examsAttempted")}>
                    <span className="flex items-center justify-end gap-1">Exams <SortIcon field="examsAttempted" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Users size={40} weight="duotone" className="text-blue-400 mb-3" />
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">No student data yet</h3>
                        <p className="text-sm text-muted mt-1 max-w-xs mx-auto">Student rankings will appear here once exams have been attempted in this batch.</p>
                      </div>
                    </td>
                  </tr>
                ) : sortedStudents.map((s) => (
                  <tr key={s.studentId} className="border-b border-border/30 transition-colors hover:bg-primary/5 dark:border-border-dark/30 dark:hover:bg-surface-elevated-dark/30">
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                        s.rank === 1 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400" :
                        s.rank === 2 ? "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400" :
                        s.rank === 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400" :
                        "text-muted"
                      }`}>
                        {s.rank}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Link href={`/analytics/student/${s.studentId}`} className="font-medium text-gray-900 hover:text-primary dark:text-white">{s.name}</Link>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono">{s.averagePercentage}%</td>
                    <td className="py-2.5 pr-3 text-right font-mono font-semibold text-primary">{s.averagePercentile}%ile</td>
                    <td className="py-2.5 text-right text-muted">{s.examsAttempted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Tier Segmentation — Top / Middle / Bottom */}
        <TierSegmentationPanel batchId={batchId} />

        {/* At-Risk Students */}
        {data.atRiskStudents.length > 0 && (
          <motion.div className="mt-6 mb-8 rounded-2xl border border-border bg-surface p-6 shadow-xs dark:border-border-dark dark:bg-surface-dark" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger/10">
                <Warning weight="duotone" className="h-5 w-5 text-danger" />
              </div>
              <div>
                <SectionTitle info="Students flagged by the at-risk classifier. A student qualifies if latest exam <40%, rolling avg <50%, or a declining trend across their last 2-3 exams. Click 'View all' to see the full list with risk scores.">
                  At-Risk Students
                </SectionTitle>
                <p className="text-xs text-muted">Students with consistently declining performance</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {data.atRiskStudents.map((s) => (
                <Link
                  key={s.studentId}
                  href={`/analytics/student/${s.studentId}`}
                  className="flex items-center justify-between rounded-lg border border-danger/20 bg-danger/5 p-3 transition-colors hover:bg-danger/10"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      {s.recentPercentiles.map((p, i) => (
                        <span key={i} className="flex items-center gap-0.5 rounded-md bg-danger/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-danger">
                          {i > 0 && <TrendDown size={10} />}
                          {Math.round(p)}%ile
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="rounded-full bg-danger/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-danger">{s.trend}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Student-vs-batch lookup */}
        <div className="mt-6">
          <StudentBatchRank batchId={batchId} />
        </div>
        </>)}
      </div>
    </div>
  );
}
