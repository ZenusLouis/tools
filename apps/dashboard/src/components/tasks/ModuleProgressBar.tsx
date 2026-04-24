"use client";

import { motion } from "framer-motion";
import type { ModuleProgress } from "@/lib/tasks";

export function ModuleProgressBar({ mod }: { mod: ModuleProgress }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4 flex items-center gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-mono text-xs text-accent">{mod.id}</span>
          <span className="font-medium text-sm truncate">{mod.name}</span>
        </div>
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${mod.percent}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-2xl font-semibold tabular-nums">{mod.percent}%</p>
        <p className="text-xs text-text-muted">{mod.completed}/{mod.total} tasks</p>
      </div>
    </div>
  );
}

export function ModuleProgressEmpty() {
  return (
    <div className="rounded-xl border bg-card px-5 py-4 text-sm text-text-muted">
      No progress data. Run <code className="font-mono text-accent">/code-index</code> first.
    </div>
  );
}
