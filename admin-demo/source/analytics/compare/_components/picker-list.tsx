"use client";

// Inline checkbox list for the setup wizard's Pick step. Deliberately NOT
// the popover student-multi-select — picking is the step's whole job here,
// so the list stays visible. Plain checkboxes, same as the grid's.
//
// `selected === null` means "everything selected" — the default state,
// carried as NO url param so plain deep links keep today's behavior.

import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";

export interface PickerItem {
  id: string;
  label: string;
  sub?: string | null;
}

const listBtn =
  "text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function PickerList({
  title,
  items,
  selected,
  onToggle,
  onAll,
  onNone,
  searchable,
}: {
  title: string;
  items: PickerItem[];
  /** null = all selected (no url param); a Set = exactly those ids. */
  selected: Set<string> | null;
  onToggle: (id: string) => void;
  onAll: () => void;
  onNone: () => void;
  searchable?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(needle) ||
        (i.sub ?? "").toLowerCase().includes(needle),
    );
  }, [items, filter]);

  const isChecked = (id: string) => selected === null || selected.has(id);
  const checkedCount =
    selected === null ? items.length : items.filter((i) => selected.has(i.id)).length;

  return (
    <div className="rounded-(--radius) border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-foreground">
          {title}
          <span className="ml-1.5 font-normal text-muted-foreground">
            {checkedCount} of {items.length}
          </span>
        </span>
        <span className="flex items-center gap-2.5">
          <button type="button" className={listBtn} onClick={onAll}>
            Select all
          </button>
          <button type="button" className={listBtn} onClick={onNone}>
            Clear
          </button>
        </span>
      </div>
      {searchable && (
        <div className="relative border-b border-border">
          <MagnifyingGlass
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${title.toLowerCase()}…`}
            aria-label={`Filter ${title.toLowerCase()}`}
            className="h-8 w-full bg-transparent pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}
      <ul className="max-h-80 overflow-y-auto py-1">
        {shown.length === 0 ? (
          <li className="px-3 py-2 text-xs text-muted-foreground">
            {items.length === 0 ? "Nothing in this scope" : "No matches"}
          </li>
        ) : (
          shown.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-primary/5">
                <input
                  type="checkbox"
                  checked={isChecked(item.id)}
                  onChange={() => onToggle(item.id)}
                  className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary"
                />
                <span className="min-w-0">
                  <span className="block truncate text-foreground">{item.label}</span>
                  {item.sub && (
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {item.sub}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
