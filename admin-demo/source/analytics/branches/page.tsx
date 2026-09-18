"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { ArrowLeft, Buildings, Users, Exam, ChartBar } from "@phosphor-icons/react";
import { Skeleton } from "@brilliance/ui";
import { apiClient } from "@/lib/api-client";
import { BackLink } from "@/components/back-link";

/* eslint-disable @typescript-eslint/no-explicit-any */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

interface Branch {
  id: string;
  name: string;
  code?: string;
  status: string;
  studentCount?: number;
  avgScore?: number;
  examCount?: number;
}

export default function BranchesAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<any>("/api/v1/branches");
        if (!cancelled && res.success && res.data) {
          const list = Array.isArray(res.data) ? res.data : res.data.branches ?? [];
          setBranches(list);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Skeleton variant="text" className="h-4 w-40" />
          <Skeleton variant="rectangular" className="h-8 w-64" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-6 dark:bg-bg-dark lg:p-8">
      <motion.div
        className="mx-auto max-w-5xl"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Back link */}
        <motion.div variants={fadeUp}>
          <BackLink
            href="/analytics"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} /> Back
          </BackLink>
        </motion.div>

        {/* Title */}
        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Buildings size={22} weight="duotone" className="text-primary" />
          </div>
          <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Branches
          </h1>
          <p className="mt-1 text-sm text-muted">
            All branches in your institution. Click a branch to view its analytics.
          </p>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          variants={fadeUp}
          className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-xs dark:border-border-dark dark:bg-surface-dark"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted dark:border-border-dark">
                  <th className="px-5 py-3">Branch</th>
                  <th className="px-5 py-3 text-center">Students</th>
                  <th className="px-5 py-3 text-center">Avg Score</th>
                  <th className="px-5 py-3 text-center">Exams</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-border-dark">
                {branches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted">
                      No branches found.
                    </td>
                  </tr>
                )}
                {branches.map((branch) => (
                  <motion.tr
                    key={branch.id}
                    variants={fadeUp}
                    data-testid={`analytics.branches.list.row.${branch.id}`}
                    className="group cursor-pointer transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark"
                    onClick={() => router.push(`/analytics?branchId=${branch.id}`)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                          <Buildings weight="duotone" className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p
                            data-testid={`analytics.branches.list.row.${branch.id}.name`}
                            className="font-medium text-gray-900 dark:text-white group-hover:text-primary transition-colors"
                          >
                            {branch.name}
                          </p>
                          <p
                            data-testid={`analytics.branches.list.row.${branch.id}.code`}
                            className="text-[10px] text-muted"
                          >
                            {branch.code || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 text-muted">
                        <Users size={14} weight="duotone" />
                        <span
                          data-testid={`analytics.branches.list.row.${branch.id}.students`}
                          className="font-mono font-semibold text-gray-900 dark:text-white"
                        >
                          {branch.studentCount ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        data-testid={`analytics.branches.list.row.${branch.id}.avg`}
                        className="font-mono font-semibold text-gray-900 dark:text-white"
                      >
                        {branch.avgScore != null ? `${branch.avgScore}%` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 text-muted">
                        <Exam size={14} weight="duotone" />
                        <span
                          data-testid={`analytics.branches.list.row.${branch.id}.exams`}
                          className="font-mono font-semibold text-gray-900 dark:text-white"
                        >
                          {branch.examCount ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        data-testid={`analytics.branches.list.row.${branch.id}.status`}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          branch.status === "active"
                            ? "bg-success/10 text-success"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {branch.status === "active" ? "Active" : branch.status || "—"}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
