"use client";

import { useEffect, useState, useTransition } from "react";
import { Bot, Check, Clipboard, Loader2, Play, TerminalSquare, X } from "lucide-react";
import { useRouter } from "next/navigation";

type RunStatus = {
  id: string;
  status: string;
  error: string | null;
  log: string[];
  artifactPath: string | null;
  exitCode: number | null;
} | null;

const PHASE_OPTIONS = [
  { value: "implementation", label: "Implement" },
  { value: "analysis", label: "Prepare Brief" },
  { value: "review", label: "Review" },
] as const;

const PROVIDER_OPTIONS = [
  { value: "auto", label: "Auto provider" },
  { value: "claude", label: "Claude local" },
  { value: "codex", label: "Codex local" },
] as const;

export function RunTaskButton({ taskId, disabled }: { taskId: string; disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState<(typeof PHASE_OPTIONS)[number]["value"]>("implementation");
  const [provider, setProvider] = useState<(typeof PROVIDER_OPTIONS)[number]["value"]>("auto");

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
        body: JSON.stringify({
          phase,
          ...(provider !== "auto" ? { provider } : {}),
        }),
      });
      const body = await res.json().catch(() => ({})) as { actionId?: string; error?: string; provider?: string; device?: string };
      if (!res.ok) {
        setMessage(body.error ?? "Failed to queue task.");
        return;
      }
      setActionId(body.actionId ?? null);
      setStatus({
        id: body.actionId ?? "",
        status: "pending",
        error: null,
        log: [`Queued ${phase} with ${body.provider ?? "agent"} on ${body.device ?? "local bridge"}.`],
        artifactPath: null,
        exitCode: null,
      });
    });
  }

  function cancelTask() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run/cancel`, { method: "POST" });
      const body = await res.json().catch(() => ({})) as { error?: string; cancelled?: number };
      if (!res.ok) {
        setMessage(body.error ?? "Failed to cancel task.");
        return;
      }
      setStatus((current) => current ? {
        ...current,
        status: "cancelled",
        log: [...current.log, `Cancellation requested for ${body.cancelled ?? 0} action(s).`],
      } : current);
    });
  }

  function copyCommand() {
    const cmd = status?.log.find((line) => line.startsWith("CMD: "))?.slice(5);
    if (!cmd) return;
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }

  function runNextTask() {
    setMessage(null);
    startTransition(async () => {
      const nextRes = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/next`, { cache: "no-store" });
      const nextBody = await nextRes.json().catch(() => ({})) as { task?: { id: string } | null; error?: string };
      if (!nextRes.ok || !nextBody.task?.id) {
        setMessage(nextBody.error ?? "No next pending task found.");
        return;
      }
      const runRes = await fetch(`/api/tasks/${encodeURIComponent(nextBody.task.id)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase,
          ...(provider !== "auto" ? { provider } : {}),
        }),
      });
      if (!runRes.ok) {
        const runBody = await runRes.json().catch(() => ({})) as { error?: string };
        setMessage(runBody.error ?? "Failed to queue next task.");
        return;
      }
      router.push(`/tasks/${encodeURIComponent(nextBody.task.id)}`);
    });
  }

  function runNextBatch() {
    setMessage(null);
    startTransition(async () => {
      const nextRes = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/next-batch?limit=3`, { cache: "no-store" });
      const nextBody = await nextRes.json().catch(() => ({})) as { tasks?: Array<{ id: string }> | null; error?: string };
      const tasks = nextBody.tasks ?? [];
      if (!nextRes.ok || tasks.length === 0) {
        setMessage(nextBody.error ?? "No next pending tasks found.");
        return;
      }
      for (const task of tasks) {
        const runRes = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase,
            ...(provider !== "auto" ? { provider } : {}),
          }),
        });
        if (!runRes.ok) {
          const runBody = await runRes.json().catch(() => ({})) as { error?: string };
          setMessage(`Queued ${tasks.indexOf(task)} task(s), then failed: ${runBody.error ?? "unknown error"}`);
          return;
        }
      }
      setMessage(`Queued ${tasks.length} task(s). Opening first queued task.`);
      router.push(`/tasks/${encodeURIComponent(tasks[0].id)}`);
    });
  }

  const running = isPending || status?.status === "pending" || status?.status === "running";
  const done = status?.status === "succeeded";
  const failed = status?.status === "failed";
  const cancelled = status?.status === "cancelled";
  const cmd = status?.log.find((line) => line.startsWith("CMD: "))?.slice(5);

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
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={phase}
            onChange={(event) => setPhase(event.target.value as typeof phase)}
            disabled={running}
            className="rounded-xl border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text outline-none transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
            title="Run phase"
          >
            {PHASE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as typeof provider)}
            disabled={running}
            className="rounded-xl border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text outline-none transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
            title="Local provider"
          >
            {PROVIDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {cmd && (
            <button
              type="button"
              onClick={copyCommand}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-muted transition-colors hover:bg-card-hover hover:text-text"
            >
              {copied ? <Check size={14} className="text-done" /> : <Clipboard size={14} />}
              {copied ? "Copied" : "Copy CMD"}
            </button>
          )}
          {running && (
            <button
              type="button"
              onClick={cancelTask}
              className="inline-flex items-center gap-2 rounded-xl border border-blocked/40 bg-blocked/10 px-3 py-2 text-xs font-bold text-blocked transition-colors hover:bg-blocked/20"
            >
              <X size={14} />
              Cancel
            </button>
          )}
          {done && (
            <button
              type="button"
              onClick={runNextTask}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-done/40 bg-done/10 px-3 py-2 text-xs font-bold text-done transition-colors hover:bg-done/20 disabled:opacity-50"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
              Run Next
            </button>
          )}
          {done && (
            <button
              type="button"
              onClick={runNextBatch}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-bold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
              Run Next 3
            </button>
          )}
          <button
            type="button"
            onClick={runTask}
            disabled={disabled || running}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
            {running ? "Running..." : status ? "Run Again" : "Run Task"}
          </button>
        </div>
      </div>

      {message && <p className="mt-3 rounded-lg border border-blocked/30 bg-blocked/10 px-3 py-2 text-xs text-blocked">{message}</p>}
      {cmd && (
        <div className="mt-3 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Command</p>
          <code className="mt-1 block overflow-x-auto whitespace-pre py-1 font-mono text-[11px] text-text-muted">{cmd}</code>
        </div>
      )}
      {status && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-bg-base">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
              <TerminalSquare size={13} />
              {status.status}
            </span>
            {done && <span className="text-xs font-bold text-done">Done</span>}
            {failed && <span className="text-xs font-bold text-blocked">Failed</span>}
            {cancelled && <span className="text-xs font-bold text-blocked">Cancelled</span>}
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
