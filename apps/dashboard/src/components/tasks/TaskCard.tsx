"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Lock } from "lucide-react";
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
      className={`group flex w-full flex-col gap-2.5 rounded-xl border p-3.5 text-left transition-all ${
        isSelected
          ? "border-accent bg-accent/10 shadow-md shadow-accent/10"
          : isActive
            ? "border-in-progress/40 bg-card-hover hover:border-in-progress/60"
            : "border-border bg-card-hover hover:border-accent/40 hover:bg-card"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold leading-none text-accent">{task.id}</span>
        <div className="flex items-center gap-1.5">
          {isActive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-in-progress" />}
          {isLocked && <Lock className="h-3 w-3 shrink-0 text-text-muted" />}
        </div>
      </div>

      <p className={`line-clamp-2 text-xs leading-snug ${isSelected ? "font-medium text-text" : "text-text"}`}>
        {task.name}
      </p>
      {task.summary && task.summary !== task.name && (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-text-muted">{task.summary}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-border px-1.5 py-0.5 text-[10px] font-medium text-text-muted">{task.featureId}</span>
        {task.reqIds?.slice(0, 3).map((reqId) => (
          <span key={reqId} className="rounded-md bg-done/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-done">{reqId}</span>
        ))}
        <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">{task.phase}</span>
        {task.baRoleName && <span className="rounded-md bg-card px-1.5 py-0.5 text-[10px] font-medium text-text-muted">BA: {task.baRoleName}</span>}
        {task.devRoleName && <span className="rounded-md bg-card px-1.5 py-0.5 text-[10px] font-medium text-text-muted">Dev: {task.devRoleName}</span>}
        {task.estimate && <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">{task.estimate}</span>}
        {task.priority && <span className="rounded-md bg-in-progress/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-in-progress">{task.priority}</span>}
        {isActive && <span className="rounded-md bg-in-progress/15 px-1.5 py-0.5 text-[10px] font-semibold text-in-progress">active</span>}
        {isLocked && (
          <span className="flex items-center gap-1 rounded-md bg-blocked/15 px-1.5 py-0.5 text-[10px] font-semibold text-blocked">
            <AlertTriangle size={9} />
            blocked
          </span>
        )}
        {task.gates.includes("G3") && <span className="rounded-md bg-in-progress/15 px-1.5 py-0.5 text-[10px] font-bold text-in-progress">G3</span>}
        {task.gates.includes("G4") && <span className="rounded-md bg-done/15 px-1.5 py-0.5 text-[10px] font-bold text-done">G4</span>}
      </div>
    </motion.button>
  );
}
