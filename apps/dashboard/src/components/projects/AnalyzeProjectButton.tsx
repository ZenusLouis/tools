"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, useRef } from "react";
import { Check, Loader2, Sparkles, Terminal } from "lucide-react";

type AnalyzeResult = {
  ok: boolean; error?: string; created?: number;
  source?: string; pending?: boolean; actionId?: string;
};

export function AnalyzeProjectButton({
  projectName, label = "Analyze BRD", size = "md",
}: {
  projectName: string; label?: string; size?: "sm" | "md";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [polling, setPolling] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<HTMLPreElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function startPolling(projectEnc: string, aid: string) {
    setPolling(true);
    setActionId(aid);
    setLog(["⚡ Queued — waiting for local Claude..."]);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/projects/${projectEnc}/analyze/status?actionId=${aid}`);
        if (res.ok) {
          const data = await res.json() as { ready: boolean; created?: number; log?: string[]; failed?: boolean; error?: string };
          if (data.log && data.log.length > 0) setLog(data.log);
          if (data.failed) {
            clearInterval(pollRef.current!);
            setPolling(false);
            setFeedback(`Failed: ${data.error}`);
            setLog((prev) => [...prev, `❌ ${data.error}`]);
            return;
          }
          if (data.ready) {
            clearInterval(pollRef.current!);
            setPolling(false);
            setOk(true);
            setFeedback(`${data.created ?? "?"} tasks generated (local Claude).`);
            setLog((prev) => [...prev, "✅ Done!"]);
            router.refresh();
            return;
          }
        }
      } catch { /* ignore */ }
      if (attempts >= 24) {
        clearInterval(pollRef.current!);
        setPolling(false);
        setFeedback("Timed out. Check bridge daemon.");
        setLog((prev) => [...prev, "⚠ Timed out after 2 minutes."]);
      }
    }, 5000);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function run() {
    setFeedback(null); setOk(false); setLog([]);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/analyze`, { method: "POST" });
        const result = await res.json() as AnalyzeResult;
        if (result.pending && result.actionId) {
          startPolling(encodeURIComponent(projectName), result.actionId);
        } else if (result.ok) {
          setOk(true);
          const src = result.source === "ai" ? "AI-generated" : "template";
          setFeedback(`${result.created ?? 0} tasks generated (${src}).`);
          router.refresh();
        } else {
          setFeedback(result.error ?? "Analysis failed");
        }
      } catch {
        setFeedback("Analysis failed. Refresh and try again.");
      }
    });
  }

  const isLoading = pending || polling;
  const btnClass = size === "sm"
    ? "inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
    : "inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent/90 disabled:opacity-50";

  return (
    <span className="inline-flex w-full flex-col gap-2">
      <span className="inline-flex flex-wrap items-center gap-2">
        <button type="button" onClick={run} disabled={isLoading} className={btnClass}>
          {isLoading ? <Loader2 size={size === "sm" ? 10 : 13} className="animate-spin" /> : <Sparkles size={size === "sm" ? 10 : 13} />}
          {polling ? "Analyzing…" : label}
        </button>
        {feedback && (
          <span className={ok ? "inline-flex items-center gap-1 text-[11px] text-done" : "inline-flex items-center gap-1 text-[11px] text-text-muted"}>
            {ok && <Check size={12} />}{feedback}
          </span>
        )}
      </span>

      {log.length > 0 && (
        <div className="w-full rounded-lg border border-border bg-bg-base overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 bg-card">
            <Terminal size={11} className="text-text-muted" />
            <span className="text-[10px] font-mono text-text-muted">local claude output</span>
            {polling && <span className="ml-auto inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
          </div>
          <pre
            ref={logRef}
            className="max-h-48 overflow-y-auto p-3 font-mono text-[11px] text-text-muted leading-relaxed whitespace-pre-wrap"
          >
            {log.join("\n")}
          </pre>
        </div>
      )}
    </span>
  );
}
