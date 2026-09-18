"use client";

// ============================================================
// BRILLIANCE — Persona Switcher
// Tab bar at the top of /analytics that lets super_admin see
// exactly what each role sees: Admin | Faculty | Student | Parent.
// ============================================================

import { motion } from "framer-motion";
import { cn } from "@brilliance/ui";

export type Persona = "admin" | "faculty" | "student" | "parent";

const PERSONAS: { key: Persona; label: string; description: string }[] = [
  { key: "admin", label: "Admin", description: "Institution-wide view" },
  { key: "faculty", label: "Faculty", description: "Batch-level teaching view" },
  { key: "student", label: "Student", description: "Personal learning view" },
  { key: "parent", label: "Parent", description: "Child progress view" },
];

interface PersonaSwitcherProps {
  active: Persona;
  onSwitch: (persona: Persona) => void;
  /** Only show personas available to this role */
  userRole?: string;
  className?: string;
}

export function PersonaSwitcher({
  active,
  onSwitch,
  userRole,
  className,
}: PersonaSwitcherProps) {
  const visible =
    userRole === "super_admin" || userRole === "branch_admin"
      ? PERSONAS
      : PERSONAS.filter((p) => p.key === "faculty" || p.key === "admin");

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-border bg-white p-1 dark:border-border-dark dark:bg-surface-dark",
        className,
      )}
      role="tablist"
      aria-label="Persona view"
    >
      {visible.map((p) => (
        <button
          key={p.key}
          role="tab"
          aria-selected={active === p.key}
          onClick={() => onSwitch(p.key)}
          className={cn(
            "relative rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            active === p.key
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          title={p.description}
        >
          {active === p.key && (
            <motion.div
              layoutId="persona-tab"
              className="absolute inset-0 rounded-lg bg-white shadow-sm"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{p.label}</span>
        </button>
      ))}
    </div>
  );
}
