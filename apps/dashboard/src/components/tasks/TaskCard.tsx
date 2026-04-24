"use client";

import { motion } from "framer-motion";
import { Lock, AlertTriangle } from "lucide-react";
import type { KanbanTask } from "@/lib/tasks";

interface Props {
  task: KanbanTask;
  completedIds: Set<string>;
  onClick?: () => void;
  isSelected?: boolean;
}

export function TaskCard({ task, completedIds, onClick, isSelected }: Props) {
  const isLocked = task.deps.some((dep) => !completedIds.has(dep));
  const isActive = task.status === "in-progress";

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
      className={`w-full text-left rounded-xl border p-3.5 flex flex-col gap-2.5 transition-all group ${
        isSelected
          ? "border-accent bg-accent/10 shadow-md shadow-accent/10"
          : isActive
          ? "border-in-progress/40 bg-card-hover hover:border-in-progress/60"
          : "border-border bg-card-hover hover:border-accent/40 hover:bg-card"
      }`}
    >
      {/* Top row: ID + lock/active indicator */}
      <div className="flex items-center justify-between gap-2">
        <span className={`font-mono text-[11px] font-bold leading-none ${isSelected ? "text-accent" : "text-accent"}`}>
          {task.id}
        </span>
        <div className="flex items-center gap-1.5">
          {isActive && (
            <span className="h-1.5 w-1.5 rounded-full bg-in-progress animate-pulse" />
          )}
          {isLocked && (
            <Lock className="h-3 w-3 text-text-muted shrink-0" />
          )}
        </div>
      </div>

      {/* Task name */}
      <p className={`text-xs leading-snug line-clamp-2 ${isSelected ? "text-text font-medium" : "text-text"}`}>
        {task.name}
      </p>

      {/* Chips row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-border text-text-muted">
          {task.featureId}
        </span>
        {task.estimate && (
          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-accent/10 text-accent">
            {task.estimate}
          </span>
        )}
        {isActive && (
          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-in-progress/15 text-in-progress">
            ● active
          </span>
        )}
        {isLocked && (
          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-blocked/15 text-blocked flex items-center gap-1">
            <AlertTriangle size={9} />
            blocked
          </span>
        )}
        {task.gates.includes("G3") && (
          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-in-progress/15 text-in-progress">G3</span>
        )}
        {task.gates.includes("G4") && (
          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-done/15 text-done">G4</span>
        )}
      </div>
    </motion.button>
  );
}
