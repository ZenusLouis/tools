"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle, Clock, ExternalLink, GitCommit, Lock, Share2, X } from "lucide-react";
import { markTaskStatus } from "@/app/actions/tasks";
import { CommitComposerModal } from "@/components/tasks/CommitComposerModal";
import { RunTaskButton } from "@/components/tasks/detail/RunTaskButton";
import type { KanbanTask } from "@/lib/tasks";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending: { label: "PENDING", cls: "bg-pending/15 text-pending border-pending/30" },
  "in-progress": { label: "IN PROGRESS", cls: "bg-in-progress/15 text-in-progress border-in-progress/30" },
  completed: { label: "COMPLETED", cls: "bg-done/15 text-done border-done/30" },
  blocked: { label: "BLOCKED", cls: "bg-blocked/15 text-blocked border-blocked/30" },
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
  const [commitOpen, setCommitOpen] = useState(false);

  function handleMark(status: "completed" | "blocked") {
    if (!task) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await markTaskStatus(projectName, task.id, status);
      if (!result.ok) setFeedback(result.error ?? "Error");
      else onClose();
    });
  }

  const unmetDeps = task?.deps.filter((dep) => !completedIds.has(dep)) ?? [];
  const metDeps = task?.deps.filter((dep) => completedIds.has(dep)) ?? [];
  const statusCfg = task ? (STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending) : STATUS_CONFIG.pending;

  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onClose} />
          <motion.div className="fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-[100vw] flex-col border-l border-border bg-card shadow-2xl" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.22, ease: "easeOut" }}>
            <div className="border-b border-border px-5 py-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-accent">{task.id}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusCfg.cls}`}>{statusCfg.label}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Link href={`/tasks/${task.id}`} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-accent/10 hover:text-accent" title="Share / Open full detail">
                    <Share2 className="h-3.5 w-3.5" />
                  </Link>
                  <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-border hover:text-text">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <h2 className="text-sm font-semibold leading-snug text-text">{task.name}</h2>
              {task.summary && <p className="mt-2 text-xs leading-relaxed text-text-muted">{task.summary}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-base/40 px-5 py-3">
              <MetaChip label="MODULE" value={task.featureId.split("-").slice(0, 1).join("-")} />
              <MetaChip label="FEATURE" value={task.featureName} />
              {task.estimate && (
                <div className="flex items-center gap-1">
                  <Clock size={10} className="text-text-muted" />
                  <span className="font-mono text-[11px] text-text-muted">{task.estimate}</span>
                </div>
              )}
              {task.gates.includes("G3") && <span className="rounded bg-in-progress/15 px-1.5 py-0.5 text-[10px] font-bold text-in-progress">G3</span>}
              {task.gates.includes("G4") && <span className="rounded bg-done/15 px-1.5 py-0.5 text-[10px] font-bold text-done">G4</span>}
              {task.reqIds?.slice(0, 6).map((reqId) => (
                <span key={reqId} className="rounded bg-done/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-done">{reqId}</span>
              ))}
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              {task.deps.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Dependencies</p>
                  <ul className="flex flex-col gap-1.5">
                    {metDeps.map((dep) => (
                      <li key={dep} className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-done" />
                        <span className="font-mono text-text-muted">{dep}</span>
                        <span className="text-[10px] text-done">done</span>
                      </li>
                    ))}
                    {unmetDeps.map((dep) => (
                      <li key={dep} className="flex items-center gap-2 text-xs">
                        <Lock className="h-3.5 w-3.5 shrink-0 text-pending" />
                        <span className="font-mono text-text-muted">{dep}</span>
                        <span className="text-[10px] text-blocked">not done</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {unmetDeps.length > 0 && (
                <div className="rounded-xl border border-blocked/30 bg-blocked/10 p-3.5">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-blocked" />
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blocked">High Risk Factors</p>
                  </div>
                  <p className="text-xs leading-relaxed text-blocked/80">
                    {unmetDeps.length} {unmetDeps.length > 1 ? "dependencies" : "dependency"} not yet completed.
                    Complete prerequisite tasks before starting implementation.
                  </p>
                </div>
              )}

              {(task.details || task.acceptanceCriteria?.length || task.steps?.length || task.risk) && (
                <div className="rounded-xl border border-border bg-bg-base/60 p-3.5">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Task Detail</p>
                  {task.details && <p className="text-xs leading-relaxed text-text-muted">{task.details}</p>}
                  {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-accent">Acceptance</p>
                      <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-text-muted">
                        {task.acceptanceCriteria.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  )}
                  {task.steps && task.steps.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-accent">Steps</p>
                      <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-text-muted">
                        {task.steps.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                      </ol>
                    </div>
                  )}
                  {task.risk && <p className="mt-3 rounded-lg bg-in-progress/10 px-2 py-1.5 text-xs text-in-progress">{task.risk}</p>}
                </div>
              )}

              <Link href={`/tasks/${task.id}`} className="flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-accent">
                <ExternalLink size={11} />
                View full task log and implementation detail
              </Link>

              <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-accent">Multi-Agent Flow</p>
                <div className="flex flex-col gap-1 text-xs text-text-muted">
                  <span>Phase: <span className="font-semibold text-text">{task.phase}</span></span>
                  {task.baRoleName && <span>BA: <span className="font-semibold text-text">{task.baRoleName}</span></span>}
                  {task.devRoleName && <span>Dev: <span className="font-semibold text-text">{task.devRoleName}</span></span>}
                  {task.reviewRoleName && <span>Review: <span className="font-semibold text-text">{task.reviewRoleName}</span></span>}
                  {!task.baRoleName && !task.devRoleName && !task.reviewRoleName && (
                    <span>No role assignment recorded for this task.</span>
                  )}
                </div>
              </div>

              <RunTaskButton taskId={task.id} disabled={task.status === "completed"} />

              {feedback && <p className="rounded-lg bg-blocked/10 px-3 py-2 text-xs text-blocked">{feedback}</p>}
            </div>

            <div className="space-y-3 border-t border-border px-5 py-4">
              <p className="text-[10px] text-text-muted">
                Open the full detail page for DB-backed logs, artifacts, risks, file changes, and commit actions.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/tasks/${task.id}`} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-accent/30 bg-accent/15 py-2.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/25">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Full Detail
                </Link>
                <button onClick={() => navigator.clipboard.writeText(`gcs task brief ${projectName} ${task.id}`)} className="rounded-xl border border-accent/30 bg-accent/15 py-2.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/25">Copy BA</button>
                <button onClick={() => navigator.clipboard.writeText(`gcs task implement ${projectName} ${task.id}`)} className="rounded-xl border border-in-progress/30 bg-in-progress/15 py-2.5 text-xs font-semibold text-in-progress transition-colors hover:bg-in-progress/25">Copy Dev</button>
                <button onClick={() => setCommitOpen(true)} className="flex items-center justify-center gap-1.5 rounded-xl border border-accent/30 bg-accent/15 py-2.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/25">
                  <GitCommit className="h-3.5 w-3.5" />
                  Commit
                </button>
                <button onClick={() => handleMark("completed")} disabled={isPending || task.status === "completed"} className="flex items-center justify-center gap-1.5 rounded-xl border border-done/30 bg-done/15 py-2.5 text-xs font-semibold text-done transition-colors hover:bg-done/25 disabled:cursor-not-allowed disabled:opacity-40">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Mark Done
                </button>
                <button onClick={() => handleMark("blocked")} disabled={isPending || task.status === "blocked"} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-blocked/30 bg-blocked/15 py-2.5 text-xs font-semibold text-blocked transition-colors hover:bg-blocked/25 disabled:cursor-not-allowed disabled:opacity-40">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Mark Blocked
                </button>
              </div>
            </div>
          </motion.div>
          <CommitComposerModal
            open={commitOpen}
            taskId={task.id}
            taskName={task.name}
            projectName={projectName}
            agentName={task.devRoleName ?? "Codex Dev Implementer"}
            onClose={() => setCommitOpen(false)}
          />
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
