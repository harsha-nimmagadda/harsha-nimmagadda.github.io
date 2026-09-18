"use client";

const EXAM_TYPES = [
  { value: "", label: "All Exam Types" },
  { value: "jee_mains", label: "JEE Mains" },
  { value: "jee_advanced", label: "JEE Advanced" },
  { value: "neet", label: "NEET" },
  { value: "clat", label: "CLAT" },
  { value: "ipmat_indore", label: "IPMAT Indore" },
  { value: "ipmat_rohtak", label: "IPMAT Rohtak" },
  { value: "bitsat", label: "BITSAT" },
  { value: "custom", label: "Custom" },
  { value: "mock", label: "Mock Test" },
  { value: "dpp", label: "DPP" },
  { value: "assignment", label: "Assignment" },
];

interface ExamTypeFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function ExamTypeFilter({ value, onChange }: ExamTypeFilterProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
    >
      {EXAM_TYPES.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
