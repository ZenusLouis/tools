"use client";

import { useEffect, useState, useTransition } from "react";
import { Bot, Loader2, Play, TerminalSquare } from "lucide-react";

type RunStatus = {
  id: string;
  status: string;
  error: string | null;
  log: string[];
  artifactPath: string | null;
  exitCode: number | null;
} | null;

export function RunTaskButton({ taskId, disabled }: { taskId: string; disabled?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run/status`, { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json() as { action?: RunStatus };
      if (cancelled) return;
      setStatus(body.action ?? null);
      if (body.action?.id) setActionId(body.action.id);
    }
    load();
    return () => { cancelled = true; };
  }, [taskId]);

  useEffect(() => {
    if (!actionId) return;
    if (status?.status && !["pending", "running"].includes(status.status)) return;
    const timer = window.setInterval(async () => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run/status`, { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json() as { action?: RunStatus };
      setStatus(body.action ?? null);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [actionId, status?.status, taskId]);

  function runTask() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "implementation" }),
      });
      const body = await res.json().catch(() => ({})) as { actionId?: string; error?: string; provider?: string; device?: string };
      if (!res.ok) {
        setMessage(body.error ?? "Failed to queue task.");
        return;
      }
      setActionId(body.actionId ?? null);
      setStatus({ id: body.actionId ?? "", status: "pending", error: null, log: [`Queued ${body.provider ?? "agent"} on ${body.device ?? "local bridge"}.`], artifactPath: null, exitCode: null });
    });
  }

  const running = isPending || status?.status === "pending" || status?.status === "running";
  const done = status?.status === "succeeded";
  const failed = status?.status === "failed";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-text">
            <Bot size={15} className="text-accent" />
            Local Agent Run
          </p>
          <p className="mt-1 text-xs text-text-muted">Queue this task to the local bridge and sync implementation artifacts back here.</p>
        </div>
        <button
          type="button"
          onClick={runTask}
          disabled={disabled || running}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
          {running ? "Running..." : "Run Task"}
        </button>
      </div>

      {message && <p className="mt-3 rounded-lg border border-blocked/30 bg-blocked/10 px-3 py-2 text-xs text-blocked">{message}</p>}
      {status && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-bg-base">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
              <TerminalSquare size={13} />
              {status.status}
            </span>
            {done && <span className="text-xs font-bold text-done">Done</span>}
            {failed && <span className="text-xs font-bold text-blocked">Failed</span>}
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 py-3 font-mono text-[11px] leading-5 text-text-muted">
            {(status.log.length ? status.log : ["Waiting for local bridge..."]).join("\n")}
            {status.error ? `\n${status.error}` : ""}
            {status.artifactPath ? `\nArtifact: ${status.artifactPath}` : ""}
          </pre>
        </div>
      )}
    </div>
  );
}
