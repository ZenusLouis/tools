"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { Loader2, Sparkles, Play, TerminalSquare } from "lucide-react";
import { DesignTaskCard, type DesignTaskItem } from "./DesignTaskCard";
import { useRouter } from "next/navigation";

export function DesignBoardClient({
  projectName,
  initialTasks,
}: {
  projectName: string;
  initialTasks: DesignTaskItem[];
}) {
  const router = useRouter();
  const [tasks] = useState(initialTasks);
  const [analyzing, startAnalyze] = useTransition();
  const [runningAll, startRunAll] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [localActionId, setLocalActionId] = useState<string | null>(null);
  const [localLog, setLocalLog] = useState<string[]>([]);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  // Poll bridge action progress when running locally
  useEffect(() => {
    if (!localActionId) return;
    if (localStatus && !["pending", "claimed", "running"].includes(localStatus)) return;
    const timer = window.setInterval(async () => {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/design/analyze/status?actionId=${localActionId}`, { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json() as { status: string; log?: string[]; error?: string | null };
      setLocalStatus(body.status);
      if (body.log?.length) setLocalLog(body.log);
      if (body.status === "succeeded") {
        setLocalActionId(null);
        refresh();
      } else if (body.status === "failed") {
        setLocalLog((prev) => [...prev, body.error ?? "Analysis failed."]);
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [localActionId, localStatus, projectName, refresh]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [localLog]);

  function analyze() {
    setMessage(null);
    setLocalLog([]);
    setLocalStatus(null);
    startAnalyze(async () => {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/design/analyze`, { method: "POST" });
      const body = await res.json().catch(() => ({})) as { screensCreated?: number; linked?: number; error?: string; queued?: boolean; actionId?: string; message?: string };
      if (!res.ok) {
        setMessage(body.error ?? "Analysis failed");
        return;
      }
      if (body.queued && body.actionId) {
        setLocalActionId(body.actionId);
        setLocalStatus("pending");
        setLocalLog(["Analysis queued on local bridge. Waiting for bridge to pick up..."]);
        return;
      }
      setMessage(`Created ${body.screensCreated} screens, linked to ${body.linked} FE tasks.`);
      refresh();
    });
  }

  function runAllPending() {
    setMessage(null);
    startRunAll(async () => {
      const pending = tasks.filter((t) => t.status === "pending");
      let done = 0;
      for (const t of pending) {
        const res = await fetch(`/api/design-tasks/${t.id}/run/stitch`, { method: "POST" });
        if (res.ok) done++;
      }
      setMessage(`Ran ${done}/${pending.length} pending screens.`);
      refresh();
    });
  }

  const pending = tasks.filter((t) => t.status === "pending").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">
            <span className="font-bold text-text">{tasks.length}</span> screens ·{" "}
            <span className="text-done font-semibold">{doneCount} done</span> ·{" "}
            <span className="font-semibold">{pending} pending</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pending > 0 && (
            <button
              type="button"
              onClick={runAllPending}
              disabled={runningAll}
              className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-bold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              {runningAll ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
              Run All Pending ({pending})
            </button>
          )}
          <button
            type="button"
            onClick={analyze}
            disabled={analyzing}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {analyzing ? "Analyzing BRD..." : tasks.length > 0 ? "Re-analyze BRD" : "Analyze BRD"}
          </button>
        </div>
      </div>

      {message && (
        <p className="rounded-xl border border-done/30 bg-done/10 px-4 py-2 text-sm text-done">{message}</p>
      )}

      {localLog.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-bg-base">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <TerminalSquare size={13} className="text-text-muted" />
            <span className="font-mono text-[11px] text-text-muted">
              {localStatus === "succeeded" ? "done" : localStatus === "failed" ? "failed" : "running..."}
            </span>
            {localStatus && !["succeeded", "failed", "cancelled"].includes(localStatus) && (
              <Loader2 size={12} className="animate-spin text-accent" />
            )}
          </div>
          <pre ref={logRef} className="max-h-48 overflow-auto whitespace-pre-wrap px-3 py-3 font-mono text-[11px] leading-5 text-text-muted">
            {localLog.join("\n")}
          </pre>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
          <Sparkles size={32} className="text-text-muted/50" />
          <div>
            <p className="font-semibold text-text">No design screens yet</p>
            <p className="mt-1 text-sm text-text-muted">Click &quot;Analyze BRD&quot; to extract screens from your requirements document.</p>
          </div>
          <button
            type="button"
            onClick={analyze}
            disabled={analyzing}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Analyze BRD
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tasks.map((task) => (
            <DesignTaskCard key={task.id} task={task} onDone={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
