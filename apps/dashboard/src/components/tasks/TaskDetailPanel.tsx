"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, CheckCircle, AlertTriangle, ExternalLink, Share2, FileText, Clock } from "lucide-react";
import type { KanbanTask } from "@/lib/tasks";
import { markTaskStatus } from "@/app/actions/tasks";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:       { label: "PENDING",     cls: "bg-pending/15 text-pending border-pending/30" },
  "in-progress": { label: "IN PROGRESS", cls: "bg-in-progress/15 text-in-progress border-in-progress/30" },
  completed:     { label: "COMPLETED",   cls: "bg-done/15 text-done border-done/30" },
  blocked:       { label: "BLOCKED",     cls: "bg-blocked/15 text-blocked border-blocked/30" },
};

interface Props {
  task: KanbanTask | null;
  projectName: string;
  completedIds: Set<string>;
  onClose: () => void;
}

export function TaskDetailPanel({ task, projectName, completedIds, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleMark(status: "completed" | "blocked") {
    if (!task) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await markTaskStatus(projectName, task.id, status);
      if (!result.ok) setFeedback(result.error ?? "Error");
      else onClose();
    });
  }

  const unmetDeps = task?.deps.filter((d) => !completedIds.has(d)) ?? [];
  const metDeps   = task?.deps.filter((d) =>  completedIds.has(d)) ?? [];
  const statusCfg = task ? (STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending) : STATUS_CONFIG.pending;

  return (
    <AnimatePresence>
      {task && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 h-full w-105 z-50 bg-card border-l border-border flex flex-col shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-accent">{task.id}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusCfg.cls}`}>
                    {statusCfg.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                    title="Share / Open full detail"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-border transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <h2 className="text-sm font-semibold leading-snug text-text">{task.name}</h2>
            </div>

            {/* Meta chips */}
            <div className="px-5 py-3 border-b border-border flex items-center gap-2 flex-wrap bg-bg-base/40">
              <MetaChip label="MODULE" value={task.featureId.split("-").slice(0, 1).join("-")} />
              <span className="text-border">·</span>
              <MetaChip label="FEATURE" value={task.featureName} />
              {task.estimate && (
                <>
                  <span className="text-border">·</span>
                  <div className="flex items-center gap-1">
                    <Clock size={10} className="text-text-muted" />
                    <span className="text-[11px] text-text-muted font-mono">{task.estimate}</span>
                  </div>
                </>
              )}
              {(task.gates.includes("G3") || task.gates.includes("G4")) && (
                <>
                  <span className="text-border">·</span>
                  {task.gates.includes("G3") && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-in-progress/15 text-in-progress">G3</span>
                  )}
                  {task.gates.includes("G4") && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-done/15 text-done">G4</span>
                  )}
                </>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {/* Dependencies */}
              {task.deps.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Dependencies</p>
                  <ul className="flex flex-col gap-1.5">
                    {metDeps.map((dep) => (
                      <li key={dep} className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-3.5 w-3.5 text-done shrink-0" />
                        <span className="font-mono text-text-muted">{dep}</span>
                        <span className="text-[10px] text-done">done</span>
                      </li>
                    ))}
                    {unmetDeps.map((dep) => (
                      <li key={dep} className="flex items-center gap-2 text-xs">
                        <Lock className="h-3.5 w-3.5 text-pending shrink-0" />
                        <span className="font-mono text-text-muted">{dep}</span>
                        <span className="text-[10px] text-blocked">not done</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* High risk factors — shown when blocked or unmet deps */}
              {unmetDeps.length > 0 && (
                <div className="rounded-xl border border-blocked/30 bg-blocked/8 p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-blocked shrink-0" />
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blocked">High Risk Factors</p>
                  </div>
                  <p className="text-xs text-blocked/80 leading-relaxed">
                    {unmetDeps.length} {unmetDeps.length > 1 ? "dependencies" : "dependency"} not yet completed.
                    This task may fail or produce incorrect results if started now.
                    Complete prerequisite tasks via CLI first.
                  </p>
                </div>
              )}

              {/* Open full log link */}
              <Link
                href={`/tasks/${task.id}`}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
              >
                <ExternalLink size={11} />
                View full task log &amp; implementation detail
              </Link>

              {/* Resources placeholder */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Resources</p>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <FileText size={11} className="shrink-0" />
                    <span className="font-mono">progress.json</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <FileText size={11} className="shrink-0" />
                    <span className="font-mono">code-index.md</span>
                  </div>
                </div>
              </div>

              {feedback && (
                <p className="text-xs text-blocked bg-blocked/10 rounded-lg px-3 py-2">{feedback}</p>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-5 py-4 border-t border-border space-y-3">
              <p className="text-[10px] text-text-muted">
                Task implementation is done via <code className="font-mono text-accent">claude</code> CLI. Use buttons below to update status only.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleMark("completed")}
                  disabled={isPending || task.status === "completed"}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-done/15 border border-done/30 text-done text-xs font-semibold py-2.5 hover:bg-done/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Mark Done
                </button>
                <button
                  onClick={() => handleMark("blocked")}
                  disabled={isPending || task.status === "blocked"}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blocked/15 border border-blocked/30 text-blocked text-xs font-semibold py-2.5 hover:bg-blocked/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Mark Blocked
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
      <span className="text-[11px] font-medium text-text">{value}</span>
    </div>
  );
}
