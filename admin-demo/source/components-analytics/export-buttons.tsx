"use client";

/**
 * Reusable export button cluster for analytics pages.
 *
 * Drop one of these into any analytics page header. It handles the
 * loading state, the blob download, and surfacing server-side error
 * messages as a toast — so every export across the dashboard behaves
 * the same and per-page wiring stays one line.
 *
 * Example:
 *   <AnalyticsExportButtons
 *     endpoint={`/api/v1/analytics/batch/${batchId}/export`}
 *     filename={`batch-${batchName}`}
 *     formats={["pdf", "xlsx"]}
 *     query={{ branchId, periodDays: 30 }}
 *   />
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DownloadSimple } from "@phosphor-icons/react";
import { downloadBlob } from "@/lib/download";

export type AnalyticsExportFormat = "pdf" | "xlsx" | "csv";

export interface AnalyticsExportButtonsProps {
  /** API path without the format query (e.g. "/api/v1/analytics/batch/123/export"). */
  endpoint: string;
  /** Filename stem without extension (extension is added per format). */
  filename: string;
  /** Formats to expose. Order is preserved in the UI. */
  formats: AnalyticsExportFormat[];
  /** Extra query params to forward (batch filter, date range, etc.). */
  query?: Record<string, string | number | undefined>;
  /** When true, disable all buttons — use while the underlying page is still loading. */
  disabled?: boolean;
  /** Override button size. Default is the compact header variant. */
  size?: "sm" | "md";
  /** Optional label prefix, default "Export". Set to null to hide the format prefix. */
  labelPrefix?: string | null;
}

const FORMAT_LABEL: Record<AnalyticsExportFormat, string> = {
  pdf: "PDF",
  xlsx: "Excel",
  csv: "CSV",
};

const FORMAT_COLOR: Record<AnalyticsExportFormat, string> = {
  pdf: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  xlsx: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  csv: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200",
};

function buildUrl(
  endpoint: string,
  format: AnalyticsExportFormat,
  query?: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams({ format });
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      params.set(k, String(v));
    }
  }
  const sep = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${sep}${params.toString()}`;
}

export function AnalyticsExportButtons({
  endpoint,
  filename,
  formats,
  query,
  disabled,
  size = "sm",
  labelPrefix = "Export",
}: AnalyticsExportButtonsProps) {
  const [busy, setBusy] = useState<AnalyticsExportFormat | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const handleClick = async (format: AnalyticsExportFormat) => {
    setBusy(format);
    const result = await downloadBlob({
      url: buildUrl(endpoint, format, query),
      filename: `${filename}.${format}`,
    });
    if (!result.ok) {
      setToast({ type: "error", message: result.message });
      setTimeout(() => setToast(null), 4000);
    }
    setBusy(null);
  };

  const sizeClass =
    size === "md"
      ? "min-h-10 px-4 py-2 text-sm"
      : "min-h-9 px-3 py-1.5 text-xs";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {formats.map((format) => {
          const loading = busy === format;
          const label = labelPrefix
            ? `${labelPrefix} ${FORMAT_LABEL[format]}`
            : FORMAT_LABEL[format];
          return (
            <button
              key={format}
              type="button"
              onClick={() => void handleClick(format)}
              disabled={disabled || busy !== null}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass} ${FORMAT_COLOR[format]}`}
            >
              <DownloadSimple weight="duotone" className="h-3.5 w-3.5" />
              {loading ? "Exporting…" : label}
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${
              toast.type === "success"
                ? "bg-emerald-500/95 text-white"
                : "bg-red-500/95 text-white"
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
