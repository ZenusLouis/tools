"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, Play, RefreshCw, ImageIcon } from "lucide-react";

export type DesignTaskItem = {
  id: string;
  screenName: string;
  screenDesc: string;
  status: string;
  provider: string;
  outputUrl: string | null;
  linkedTaskIds: string[];
  reqIds: string[];
};

export function DesignTaskCard({ task, onDone }: { task: DesignTaskItem; onDone?: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(task.status);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      setLocalStatus("running");
      const res = await fetch(`/api/design-tasks/${task.id}/run/stitch`, { method: "POST" });
      const body = await res.json().catch(() => ({})) as { error?: string; outputUrl?: string };
      if (!res.ok) {
        setError(body.error ?? "Run failed");
        setLocalStatus("failed");
        return;
      }
      setLocalStatus("done");
      onDone?.();
    });
  }

  const running = isPending || localStatus === "running";
  const done = localStatus === "done";
  const failed = localStatus === "failed";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-bold text-text">{task.screenName}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{task.screenDesc}</p>
        </div>
        <StatusBadge status={localStatus} />
      </div>

      {task.reqIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.reqIds.slice(0, 4).map((r) => (
            <span key={r} className="rounded-md bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">{r}</span>
          ))}
          {task.reqIds.length > 4 && <span className="text-[10px] text-text-muted">+{task.reqIds.length - 4}</span>}
        </div>
      )}

      {task.linkedTaskIds.length > 0 && (
        <p className="text-[11px] text-text-muted">
          Linked to <span className="font-semibold text-text">{task.linkedTaskIds.length}</span> FE task{task.linkedTaskIds.length > 1 ? "s" : ""}
        </p>
      )}

      {error && <p className="rounded-lg bg-blocked/10 px-2 py-1 text-[11px] text-blocked">{error}</p>}

      <div className="flex items-center gap-2">
        {done && task.outputUrl ? (
          <a
            href={task.outputUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-done/40 bg-done/10 px-3 py-1.5 text-xs font-bold text-done transition-colors hover:bg-done/20"
          >
            <ExternalLink size={12} />
            View Design
          </a>
        ) : (
          <button
            type="button"
            onClick={run}
            disabled={running || done}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : done ? <ImageIcon size={12} /> : <Play size={12} fill="currentColor" />}
            {running ? "Generating..." : done ? "Done" : "Run"}
          </button>
        )}
        {(done || failed) && (
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-card-hover"
          >
            <RefreshCw size={12} />
            Re-run
          </button>
        )}
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-text-muted">{task.provider}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-border text-text-muted" },
    running: { label: "Running", cls: "bg-accent/20 text-accent animate-pulse" },
    done:    { label: "Done",    cls: "bg-done/20 text-done" },
    failed:  { label: "Failed",  cls: "bg-blocked/20 text-blocked" },
  };
  const { label, cls } = map[status] ?? map.pending;
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>;
}
