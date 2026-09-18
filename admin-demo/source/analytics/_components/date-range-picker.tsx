"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarBlank, CaretDown, Check } from "@phosphor-icons/react";
import {
  type DateRange,
  type DateRangePreset,
  PRESET_LABELS,
  PRESET_ORDER,
  rangeForPreset,
  formatRangeLabel,
} from "@/lib/date-ranges";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (next: DateRange) => void;
}

// Local ISO → yyyy-mm-dd helper for <input type="date">
function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInputToIso(value: string, endOfDay = false): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const handlePreset = (preset: DateRangePreset) => {
    if (preset === "custom") {
      onChange({ preset: "custom", from: value.from, to: value.to });
      return;
    }
    onChange(rangeForPreset(preset));
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-border-dark dark:bg-surface-dark dark:text-white dark:hover:bg-surface-elevated-dark/40"
      >
        <CalendarBlank size={16} weight="duotone" className="text-primary" />
        <span>{formatRangeLabel(value)}</span>
        <CaretDown size={12} weight="bold" className="text-muted" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close date picker"
              className="fixed inset-0 z-30"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-border bg-surface p-2 shadow-lg dark:border-border-dark dark:bg-surface-dark"
            >
              <div className="flex flex-col">
                {PRESET_ORDER.map((p) => {
                  const active = value.preset === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePreset(p)}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-gray-700 hover:bg-primary/5 dark:text-gray-200 dark:hover:bg-surface-elevated-dark/40"
                      }`}
                    >
                      {PRESET_LABELS[p]}
                      {active && <Check size={14} weight="bold" />}
                    </button>
                  );
                })}
              </div>

              {value.preset === "custom" && (
                <div className="mt-2 border-t border-border px-3 py-3 dark:border-border-dark">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    From
                  </label>
                  <input
                    type="date"
                    value={isoToDateInput(value.from)}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        from: dateInputToIso(e.target.value, false),
                      })
                    }
                    className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm dark:border-border-dark dark:bg-surface-dark"
                  />
                  <label className="mt-2 mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    To
                  </label>
                  <input
                    type="date"
                    value={isoToDateInput(value.to)}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        to: dateInputToIso(e.target.value, true),
                      })
                    }
                    className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm dark:border-border-dark dark:bg-surface-dark"
                  />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={!value.from || !value.to}
                    className="mt-3 w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
                  >
                    Apply
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
