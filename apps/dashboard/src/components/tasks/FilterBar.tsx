"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { TaskStatus } from "@/lib/tasks";

const STATUS_OPTIONS: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" },
];

const DOT: Record<string, string> = {
  pending: "bg-pending",
  "in-progress": "bg-in-progress",
  completed: "bg-done",
  blocked: "bg-blocked",
};

interface Props {
  statusFilter: TaskStatus | "all";
  featureFilter: string;
  features: string[];
  onStatusChange: (s: TaskStatus | "all") => void;
  onFeatureChange: (f: string) => void;
}

export function FilterBar({ statusFilter, featureFilter, features, onStatusChange, onFeatureChange }: Props) {
  const [open, setOpen] = useState(false);
  const currentFeature = featureFilter === "all" ? "All Features" : featureFilter;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm shadow-black/10">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onStatusChange(value as TaskStatus | "all")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              statusFilter === value ? "bg-accent/20 text-accent" : "text-text-muted hover:text-text"
            }`}
          >
            {value !== "all" && <span className={`h-1.5 w-1.5 rounded-full ${DOT[value]}`} />}
            {label}
          </button>
        ))}
      </div>

      {features.length > 1 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex min-w-40 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text shadow-sm shadow-black/10 transition-colors hover:bg-card-hover"
          >
            <span className="truncate">{currentFeature}</span>
            <ChevronDown size={13} className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border border-border bg-bg-base p-1.5 shadow-2xl shadow-black/40">
              {[{ value: "all", label: "All Features" }, ...features.map((feature) => ({ value: feature, label: feature }))].map((feature) => (
                <button
                  key={feature.value}
                  type="button"
                  onClick={() => {
                    onFeatureChange(feature.value);
                    setOpen(false);
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-text-muted transition-colors hover:bg-accent/10 hover:text-text"
                >
                  {feature.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
