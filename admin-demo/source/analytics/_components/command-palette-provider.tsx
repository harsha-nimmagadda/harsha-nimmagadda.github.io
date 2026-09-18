"use client";

import { useRouter } from "next/navigation";
import {
  ChartBar,
  ChatCenteredDots,
  Users,
  ChalkboardTeacher,
  Student,
  Trophy,
  BellSimpleRinging,
  ChartLine,
  Exam,
  Gauge,
  TreeStructure,
  WarningCircle,
  ArrowsLeftRight,
  FlowArrow,
  ChartPieSlice,
  UserList,
  FileText,
} from "@phosphor-icons/react";
import { CommandPalette, type CommandItem } from "@brilliance/ui";

const ANALYTICS_ITEMS: CommandItem[] = [
  // Pages
  {
    id: "home",
    label: "Analytics Home",
    group: "Pages",
    icon: <ChartBar weight="duotone" className="h-4 w-4 text-blue-500" />,
    href: "/analytics/home",
    keywords: ["overview", "insights", "dashboard", "kpi"],
  },
  {
    id: "ask",
    label: "Ask Excellencia AI",
    group: "Pages",
    icon: <ChatCenteredDots weight="duotone" className="h-4 w-4 text-violet-500" />,
    href: "/analytics/ask",
    keywords: ["ai", "question", "chat", "query", "llm"],
  },

  // Institution
  {
    id: "cohorts",
    label: "Cohort Comparison",
    group: "Institution",
    icon: <ArrowsLeftRight weight="duotone" className="h-4 w-4 text-indigo-500" />,
    href: "/analytics/institution/cohorts",
    keywords: ["compare", "year", "batch", "cohort", "class"],
  },
  {
    id: "faculty-impact",
    label: "Faculty Impact",
    group: "Institution",
    icon: <ChalkboardTeacher weight="duotone" className="h-4 w-4 text-emerald-500" />,
    href: "/analytics/institution/faculty-impact",
    keywords: ["teacher", "ranking", "performance", "effectiveness"],
  },

  // Batch Analytics
  {
    id: "batch-overview",
    label: "Batch Overview",
    group: "Batch",
    icon: <Users weight="duotone" className="h-4 w-4 text-cyan-500" />,
    href: "/analytics/batch",
    keywords: ["class", "section", "group", "batch"],
  },
  {
    id: "batch-bell-curve",
    label: "Batch Bell Curve",
    group: "Batch",
    icon: <ChartLine weight="duotone" className="h-4 w-4 text-blue-500" />,
    href: "/analytics/batch/bell-curve",
    keywords: ["distribution", "normal", "curve", "scores", "bell"],
  },
  {
    id: "batch-at-risk",
    label: "At-Risk Students",
    group: "Batch",
    icon: <WarningCircle weight="duotone" className="h-4 w-4 text-orange-500" />,
    href: "/analytics/batch/at-risk",
    keywords: ["risk", "failing", "struggling", "weak", "alert"],
  },
  {
    id: "batch-attendance",
    label: "Attendance Histogram",
    group: "Batch",
    icon: <ChartPieSlice weight="duotone" className="h-4 w-4 text-teal-500" />,
    href: "/analytics/batch/attendance-histogram",
    keywords: ["attendance", "present", "absent", "histogram"],
  },
  {
    id: "batch-box-plot",
    label: "Batch Box Plot",
    group: "Batch",
    icon: <Gauge weight="duotone" className="h-4 w-4 text-purple-500" />,
    href: "/analytics/batch/box-plot",
    keywords: ["quartile", "median", "spread", "distribution", "box"],
  },
  {
    id: "batch-discrimination",
    label: "Question Discrimination",
    group: "Batch",
    icon: <TreeStructure weight="duotone" className="h-4 w-4 text-rose-500" />,
    href: "/analytics/batch/discrimination",
    keywords: ["difficulty", "discrimination", "irt", "question quality"],
  },
  {
    id: "batch-syllabus-flow",
    label: "Syllabus Flow",
    group: "Batch",
    icon: <FlowArrow weight="duotone" className="h-4 w-4 text-amber-500" />,
    href: "/analytics/batch/syllabus-flow",
    keywords: ["syllabus", "coverage", "topic", "chapter", "flow"],
  },

  // Student Analytics
  {
    id: "student-overview",
    label: "Student Profile",
    group: "Student",
    icon: <Student weight="duotone" className="h-4 w-4 text-sky-500" />,
    href: "/analytics/student",
    keywords: ["student", "profile", "individual", "learner"],
  },
  {
    id: "student-pta-report",
    label: "PTA Report",
    group: "Student",
    icon: <FileText weight="duotone" className="h-4 w-4 text-lime-600" />,
    href: "/analytics/student/pta-report",
    keywords: ["parent", "teacher", "report", "pta", "guardian"],
  },

  // Exam Analytics
  {
    id: "exam-overview",
    label: "Exam Analysis",
    group: "Exam",
    icon: <Exam weight="duotone" className="h-4 w-4 text-fuchsia-500" />,
    href: "/analytics/exam",
    keywords: ["exam", "test", "paper", "analysis", "score"],
  },

  // Faculty Analytics
  {
    id: "faculty-overview",
    label: "Faculty Analytics",
    group: "Faculty",
    icon: <UserList weight="duotone" className="h-4 w-4 text-orange-500" />,
    href: "/analytics/faculty",
    keywords: ["teacher", "faculty", "instructor", "teaching"],
  },

  // Quick Actions
  {
    id: "action-leaderboard",
    label: "Top Batches Leaderboard",
    group: "Quick Actions",
    icon: <Trophy weight="duotone" className="h-4 w-4 text-yellow-500" />,
    href: "/analytics/home",
    keywords: ["leaderboard", "top", "rank", "best", "trophy"],
    shortcut: "⌘L",
  },
  {
    id: "action-alerts",
    label: "Performance Alerts",
    group: "Quick Actions",
    icon: <BellSimpleRinging weight="duotone" className="h-4 w-4 text-red-500" />,
    href: "/analytics/batch/at-risk",
    keywords: ["alert", "notification", "warning", "flag"],
    shortcut: "⌘A",
  },
];

export function AnalyticsCommandPalette() {
  const router = useRouter();

  return (
    <CommandPalette
      items={ANALYTICS_ITEMS}
      onSelect={(item) => {
        if (item.href) router.push(item.href);
      }}
      placeholder="Search analytics pages…"
    />
  );
}
