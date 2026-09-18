"use client";

import { useState, useEffect, useRef } from "react";
import { MagnifyingGlass, X, CheckSquare, Square, UsersThree } from "@phosphor-icons/react";
import { apiClient } from "@/lib/api-client";

interface StudentResult {
  id: string;
  name: string;
  email: string;
  batchName: string;
  branchName: string;
}

interface CrossBatchStudentPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  branchId?: string;
}

export function CrossBatchStudentPicker({ selected, onChange, branchId }: CrossBatchStudentPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Map<string, StudentResult>>(() => new Map());
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync selected from parent
  useEffect(() => {
    if (selected.length === 0) setSelectedStudents(new Map());
  }, [selected]);

  const search = async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, limit: "30" });
      if (branchId) params.set("branchId", branchId);
      const res = await apiClient.get<any>(`/api/v1/analytics/v2/students/search?${params}`);
      setResults(res.success ? (res.data?.students || []) : []);
    } catch { setResults([]); }
    setLoading(false);
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const toggleStudent = (student: StudentResult) => {
    const next = new Map(selectedStudents);
    if (next.has(student.id)) {
      next.delete(student.id);
    } else {
      next.set(student.id, student);
    }
    setSelectedStudents(next);
    onChange(Array.from(next.keys()));
  };

  const clearAll = () => {
    setSelectedStudents(new Map());
    onChange([]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
          selected.length > 0
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
        }`}
      >
        <UsersThree size={16} weight={selected.length > 0 ? "fill" : "regular"} />
        {selected.length > 0 ? `${selected.length} students` : "Select Students"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[360px] rounded-xl border border-gray-200 bg-white shadow-xl">
          {/* Search */}
          <div className="border-b border-gray-100 p-2">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50/70 px-3 py-2">
              <MagnifyingGlass size={14} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by name (min 2 chars)..."
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                autoFocus
              />
              {query && (
                <button onClick={() => { setQuery(""); setResults([]); }}>
                  <X size={12} className="text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Selected chips */}
          {selectedStudents.size > 0 && (
            <div className="border-b border-gray-100 px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase text-gray-400">{selectedStudents.size} selected</span>
                <button onClick={clearAll} className="text-[10px] text-red-500 hover:text-red-700">Clear all</button>
              </div>
              <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto">
                {Array.from(selectedStudents.values()).map((s) => (
                  <span key={s.id} className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    {s.name.split(" ")[0]}
                    <button onClick={() => toggleStudent(s)}><X size={10} /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          <div className="max-h-[240px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              </div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">
                {query.length < 2 ? "Type to search across all batches" : "No students found"}
              </div>
            ) : (
              results.map((s) => {
                const isSelected = selectedStudents.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleStudent(s)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-primary/5 transition-colors ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    {isSelected
                      ? <CheckSquare weight="fill" size={16} className="text-blue-600 shrink-0" />
                      : <Square size={16} className="text-gray-300 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                      <p className="text-[10px] text-gray-400">{s.batchName} · {s.branchName}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
