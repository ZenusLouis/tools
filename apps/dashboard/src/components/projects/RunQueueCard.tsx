"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Clock3,
  ExternalLink,
  Loader2,
  RotateCcw,
  TerminalSquare,
  X,
  XCircle,
} from "lucide-react";

type QueueAction = {
  id: string;
  status: string;
  error: string | null;
  taskId: string | null;
  taskName: string | null;
  provider: string | null;
  phase: string | null;
  role: string | null;
  deviceName: string | null;
  artifactPath: string | null;
  exitCode: number | null;
  lastLogLine: string | null;
  logTail: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type QueueFilter = "all" | "live" | "failed" | "done";

const FILTERS: Array<{ value: QueueFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "failed", label: "Failed" },
  { value: "done", label: "Done" },
];

function statusClass(status: string) {
  if (status === "succeeded") return "border-done/30 bg-done/10 text-done";
  if (status === "failed") return "border-blocked/30 bg-blocked/10 text-blocked";
  if (status === "cancelled") return "border-text-muted/30 bg-text-muted/10 text-text-muted";
  if (status === "running") return "border-accent/30 bg-accent/10 text-accent";
  return "border-in-progress/30 bg-in-progress/10 text-in-progress";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "succeeded") return <CheckCircle2 size={12} />;
  if (status === "failed" || status === "cancelled") return <XCircle size={12} />;
  if (status === "running") return <Loader2 size={12} className="animate-spin" />;
  return <Clock3 size={12} />;
}

function timeLabel(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function commandFromLog(action: QueueAction) {
  return action.logTail.find((line) => line.startsWith("CMD: "))?.slice(5) ?? null;
}

export function RunQueueCard({ projectName }: { projectName: string }) {
  const [actions, setActions] = useState<QueueAction[]>([]);
  const [visibleLimit, setVisibleLimit] = useState(8);
  const [totalActions, setTotalActions] = useState(0);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);

  const hasLiveAction = useMemo(
    () => actions.some((action) => action.status === "pending" || action.status === "running"),
    [actions],
  );
  const liveActions = useMemo(
    () => actions.filter((action) => action.taskId && (action.status === "pending" || action.status === "running")),
    [actions],
  );
  const retryableActions = useMemo(
    () => actions.filter((action) => action.taskId && (action.status === "failed" || action.status === "cancelled")),
    [actions],
  );

  const loadQueue = useCallback(async (active = true) => {
      try {
        const params = new URLSearchParams({ limit: String(visibleLimit), status: filter });
        const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/run-queue?${params.toString()}`, { cache: "no-store" });
        const body = await res.json().catch(() => ({})) as { actions?: QueueAction[]; total?: number; error?: string };
        if (!active) return;
        if (!res.ok) {
          setError(body.error ?? "Failed to load run queue.");
          return;
        }
        setActions(body.actions ?? []);
        setTotalActions(body.total ?? body.actions?.length ?? 0);
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load run queue.");
      } finally {
        if (active) setLoading(false);
      }
  }, [filter, projectName, visibleLimit]);

  useEffect(() => {
    let active = true;

    function refreshQueue() {
      void loadQueue(active);
    }

    const initialTimer = window.setTimeout(() => void loadQueue(active), 0);
    const timer = window.setInterval(() => void loadQueue(active), hasLiveAction ? 3000 : 10000);
    window.addEventListener("gcs-run-queue-refresh", refreshQueue);
    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      window.removeEventListener("gcs-run-queue-refresh", refreshQueue);
    };
  }, [hasLiveAction, loadQueue]);

  async function cancelTaskRun(action: QueueAction) {
    if (!action.taskId) return;
    setBusyActionId(action.id);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(action.taskId)}/run/cancel`, { method: "POST" });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) setError(body.error ?? "Failed to cancel task run.");
      await loadQueue();
    } finally {
      setBusyActionId(null);
    }
  }

  async function retryTaskRun(action: QueueAction) {
    if (!action.taskId) return;
    setBusyActionId(action.id);
    setError(null);
    try {
      const phase = action.phase === "analysis" || action.phase === "review" || action.phase === "implementation"
        ? action.phase
        : "implementation";
      const provider = action.provider === "claude" || action.provider === "codex" ? action.provider : undefined;
      const res = await fetch(`/api/tasks/${encodeURIComponent(action.taskId)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, provider }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) setError(body.error ?? "Failed to retry task run.");
      await loadQueue();
    } finally {
      setBusyActionId(null);
    }
  }

  async function cancelLiveRuns() {
    if (liveActions.length === 0) return;
    setBusyActionId("bulk-cancel");
    setError(null);
    try {
      for (const action of liveActions) {
        await cancelTaskRun(action);
      }
      await loadQueue();
    } finally {
      setBusyActionId(null);
    }
  }

  async function retryFailedRuns() {
    if (retryableActions.length === 0) return;
    setBusyActionId("bulk-retry");
    setError(null);
    try {
      for (const action of retryableActions.slice(0, 5)) {
        await retryTaskRun(action);
      }
      await loadQueue();
    } finally {
      setBusyActionId(null);
    }
  }

  async function copyCommand(action: QueueAction) {
    const command = commandFromLog(action);
    if (!command) return;
    await navigator.clipboard.writeText(command);
    setCopiedActionId(action.id);
    window.setTimeout(() => setCopiedActionId((current) => current === action.id ? null : current), 1500);
  }

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
          <TerminalSquare size={13} className="text-accent" />
          Run Queue
        </h2>
        <div className="flex items-center gap-1.5">
          {liveActions.length > 0 && (
            <button
              type="button"
              onClick={() => void cancelLiveRuns()}
              disabled={busyActionId === "bulk-cancel"}
              className="inline-flex items-center gap-1 rounded border border-blocked/30 px-2 py-1 text-[10px] font-bold text-blocked hover:bg-blocked/10 disabled:opacity-50"
            >
              {busyActionId === "bulk-cancel" ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
              Cancel Live
            </button>
          )}
          {retryableActions.length > 0 && (
            <button
              type="button"
              onClick={() => void retryFailedRuns()}
              disabled={busyActionId === "bulk-retry"}
              className="inline-flex items-center gap-1 rounded border border-accent/30 px-2 py-1 text-[10px] font-bold text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {busyActionId === "bulk-retry" ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
              Retry Failed
            </button>
          )}
          <span className="rounded border border-border bg-bg-base px-2 py-0.5 text-[10px] font-mono text-text-muted">
            {loading ? "..." : `${actions.length}/${totalActions}`}
          </span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setFilter(item.value);
              setVisibleLimit(8);
              setExpandedActionId(null);
            }}
            className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
              filter === item.value
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-bg-base text-text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-blocked/30 bg-blocked/10 px-3 py-2 text-xs text-blocked">
          {error}
        </div>
      )}

      {!error && actions.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-bg-base p-4 text-center">
          <Activity size={18} className="mx-auto mb-2 text-text-muted" />
          <p className="text-xs font-medium text-text">No task runs yet</p>
          <p className="mt-1 text-[11px] text-text-muted">Queued local Claude/Codex task runs will appear here.</p>
        </div>
      )}

      {!error && actions.length > 0 && (
        <div className="space-y-2">
          {actions.map((action) => (
            <div key={action.id} className="rounded-lg border border-border bg-bg-base p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(action.status)}`}>
                      <StatusIcon status={action.status} />
                      {action.status}
                    </span>
                    {action.taskId ? (
                      <Link href={`/tasks/${encodeURIComponent(action.taskId)}`} className="font-mono text-xs font-bold text-accent hover:underline">
                        {action.taskId}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-text-muted">unknown task</span>
                    )}
                  </div>
                  {action.taskName && (
                    <p className="mt-1 truncate text-xs font-medium text-text" title={action.taskName}>
                      {action.taskName}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-text-muted">
                    {action.provider && <span className="font-bold uppercase text-text">{action.provider}</span>}
                    {action.phase && <span>{action.phase}</span>}
                    {action.deviceName && <span>{action.deviceName}</span>}
                    <span>{timeLabel(action.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {(action.logTail.length > 0 || action.artifactPath) && (
                    <button
                      type="button"
                      onClick={() => setExpandedActionId((current) => current === action.id ? null : action.id)}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:border-accent hover:text-accent"
                    >
                      {expandedActionId === action.id ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                      Log
                    </button>
                  )}
                  {action.taskId && (action.status === "pending" || action.status === "running") && (
                    <button
                      type="button"
                      onClick={() => void cancelTaskRun(action)}
                      disabled={busyActionId === action.id}
                      className="inline-flex items-center gap-1 rounded border border-blocked/30 px-2 py-1 text-[10px] font-bold text-blocked hover:bg-blocked/10 disabled:opacity-50"
                    >
                      {busyActionId === action.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                      Cancel
                    </button>
                  )}
                  {action.taskId && (action.status === "failed" || action.status === "cancelled") && (
                    <button
                      type="button"
                      onClick={() => void retryTaskRun(action)}
                      disabled={busyActionId === action.id}
                      className="inline-flex items-center gap-1 rounded border border-accent/30 px-2 py-1 text-[10px] font-bold text-accent hover:bg-accent/10 disabled:opacity-50"
                    >
                      {busyActionId === action.id ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                      Retry
                    </button>
                  )}
                  {action.taskId && (
                    <Link
                      href={`/tasks/${encodeURIComponent(action.taskId)}`}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:border-accent hover:text-accent"
                    >
                      Open <ExternalLink size={10} />
                    </Link>
                  )}
                </div>
              </div>
              {(action.lastLogLine || action.error) && (
                <p className="mt-2 line-clamp-2 rounded border border-border bg-card px-2 py-1.5 font-mono text-[10px] text-text-muted">
                  {action.error ?? action.lastLogLine}
                </p>
              )}
              {expandedActionId === action.id && (
                <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Process Tail</span>
                    <div className="flex items-center gap-2">
                      {action.artifactPath && (
                        <span className="hidden max-w-[220px] truncate font-mono text-[10px] text-done sm:block" title={action.artifactPath}>
                          {action.artifactPath}
                        </span>
                      )}
                      {commandFromLog(action) && (
                        <button
                          type="button"
                          onClick={() => void copyCommand(action)}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:border-accent hover:text-accent"
                        >
                          <Clipboard size={10} />
                          {copiedActionId === action.id ? "Copied" : "Copy CMD"}
                        </button>
                      )}
                    </div>
                  </div>
                  {action.logTail.length > 0 ? (
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[10px] leading-relaxed text-text-muted">
                      {action.logTail.join("\n")}
                    </pre>
                  ) : (
                    <p className="px-3 py-2 text-[11px] text-text-muted">No process output captured yet.</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {actions.length < totalActions && (
            <button
              type="button"
              onClick={() => setVisibleLimit((current) => Math.min(current + 8, 50))}
              className="w-full rounded-lg border border-dashed border-border bg-bg-base px-3 py-2 text-xs font-bold text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              Show more runs ({totalActions - actions.length} hidden)
            </button>
          )}
        </div>
      )}
    </section>
  );
}
