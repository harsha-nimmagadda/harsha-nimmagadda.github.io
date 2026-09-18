"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, CaretDown, X, Check, MagnifyingGlass } from "@phosphor-icons/react";

export interface RosterStudent {
  userId: string;
  name: string;
  section?: string | null;
}

interface StudentMultiSelectProps {
  roster: RosterStudent[];
  selected: string[]; // userIds; empty = "all students"
  onChange: (nextSelected: string[]) => void;
}

export function StudentMultiSelect({
  roster,
  selected,
  onChange,
}: StudentMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allSelected = selected.length === 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.section ?? "").toLowerCase().includes(q),
    );
  }, [roster, query]);

  const toggle = (userId: string) => {
    const next = new Set(selectedSet);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    onChange(Array.from(next));
  };

  const clearAll = () => onChange([]);
  const selectAll = () => onChange(roster.map((s) => s.userId));

  const label = allSelected
    ? `All ${roster.length} students`
    : `${selected.length} selected`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-border-dark dark:bg-surface-dark dark:text-white dark:hover:bg-surface-elevated-dark/40"
      >
        <Users size={16} weight="duotone" className="text-primary" />
        <span>{label}</span>
        <CaretDown size={12} weight="bold" className="text-muted" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close student picker"
              className="fixed inset-0 z-30"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-border bg-surface shadow-lg dark:border-border-dark dark:bg-surface-dark"
            >
              <div className="border-b border-border p-2 dark:border-border-dark">
                <div className="flex items-center gap-2 rounded-lg bg-slate-50/40 px-2 py-1.5 dark:bg-surface-elevated-dark/40">
                  <MagnifyingGlass size={14} className="text-muted" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search students…"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="font-semibold text-primary hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="font-semibold text-muted hover:text-danger hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto p-1">
                {filtered.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-muted">
                    No students match "{query}"
                  </p>
                )}
                {filtered.map((s) => {
                  const isSelected = allSelected || selectedSet.has(s.userId);
                  return (
                    <button
                      key={s.userId}
                      type="button"
                      onClick={() => {
                        // When in "all" mode, clicking a row means
                        // "only this one" — seed selection with this
                        // row; future toggles behave normally.
                        if (allSelected) {
                          onChange([s.userId]);
                          return;
                        }
                        toggle(s.userId);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-primary/5 dark:hover:bg-surface-elevated-dark/40"
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          isSelected
                            ? "border-primary bg-primary text-white"
                            : "border-border dark:border-border-dark"
                        }`}
                      >
                        {isSelected && <Check size={10} weight="bold" />}
                      </span>
                      <span className="flex-1 truncate">{s.name}</span>
                      {s.section && (
                        <span className="rounded-md bg-slate-50/50 px-1.5 py-0.5 font-mono text-[10px] text-muted dark:bg-surface-elevated-dark/60">
                          {s.section}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {!allSelected && selected.length > 0 && (
                <div className="flex flex-wrap gap-1 border-t border-border p-2 dark:border-border-dark">
                  {selected.slice(0, 6).map((id) => {
                    const s = roster.find((r) => r.userId === id);
                    if (!s) return null;
                    return (
                      <span
                        key={id}
                        className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                      >
                        {s.name.split(" ")[0]}
                        <button
                          type="button"
                          onClick={() => toggle(id)}
                          aria-label={`Remove ${s.name}`}
                        >
                          <X size={10} weight="bold" />
                        </button>
                      </span>
                    );
                  })}
                  {selected.length > 6 && (
                    <span className="text-[11px] text-muted">
                      +{selected.length - 6} more
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
