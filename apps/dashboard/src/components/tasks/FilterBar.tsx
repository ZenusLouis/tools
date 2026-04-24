"use client";

import type { TaskStatus } from "@/lib/tasks";

const STATUS_OPTIONS: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all",         label: "All" },
  { value: "pending",     label: "Pending" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed",   label: "Completed" },
  { value: "blocked",     label: "Blocked" },
];

const DOT: Record<string, string> = {
  pending:      "bg-pending",
  "in-progress":"bg-in-progress",
  completed:    "bg-done",
  blocked:      "bg-blocked",
};

interface Props {
  statusFilter: TaskStatus | "all";
  featureFilter: string;
  features: string[];
  onStatusChange: (s: TaskStatus | "all") => void;
  onFeatureChange: (f: string) => void;
}

export function FilterBar({ statusFilter, featureFilter, features, onStatusChange, onFeatureChange }: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onStatusChange(value as TaskStatus | "all")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              statusFilter === value
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            {value !== "all" && (
              <span className={`h-1.5 w-1.5 rounded-full ${DOT[value]}`} />
            )}
            {label}
          </button>
        ))}
      </div>

      {features.length > 1 && (
        <select
          value={featureFilter}
          onChange={(e) => onFeatureChange(e.target.value)}
          className="rounded-lg border bg-card px-3 py-1.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
        >
          <option value="all">All Features</option>
          {features.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      )}
    </div>
  );
}
