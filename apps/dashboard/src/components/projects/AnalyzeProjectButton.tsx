"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Sparkles, Terminal, X } from "lucide-react";

type AnalyzeResult = {
  ok: boolean;
  error?: string;
  created?: number;
  source?: string;
  pending?: boolean;
  actionId?: string;
  provider?: "claude" | "codex" | "chatgpt";
  runnerLabel?: string;
};

type AnalyzeSummary = {
  modules?: Array<{
    name?: string;
    features?: Array<{ name?: string; tasks?: string[]; reqIds?: string[] }>;
    reqIds?: string[];
  }>;
};

type AnalysisTranscript = {
  provider?: string;
  runner?: string;
  projectName?: string;
  documentPath?: string;
  frameworks?: string;
  command?: string;
  prompt?: string;
  responseText?: string;
  rawOutput?: string;
  durationMs?: number;
  durationApiMs?: number;
  sessionId?: string;
  totalCostUsd?: number;
  usage?: unknown;
  modelUsage?: unknown;
  permissionDenials?: unknown[];
  terminalReason?: string;
};

export function AnalyzeProjectButton({
  projectName,
  label = "Analyze BRD",
  size = "md",
  showOutput = true,
}: {
  projectName: string;
  label?: string;
  size?: "sm" | "md";
  showOutput?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [polling, setPolling] = useState(false);
  const [runnerLabel, setRunnerLabel] = useState("Claude");
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<AnalyzeSummary | null>(null);
  const [transcript, setTranscript] = useState<AnalysisTranscript | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const startPolling = useCallback((projectEnc: string, actionId: string, labelForRunner = "Claude") => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPolling(true);
    setRunnerLabel(labelForRunner);
    setActiveActionId(actionId);
    setLog((prev) => prev.length > 0 ? prev : [`Queued - waiting for local ${labelForRunner}...`]);
    setSummary((prev) => prev ?? null);
    let attempts = 0;
    let lastStatus: string | null = null;

    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/projects/${projectEnc}/analyze/status?actionId=${actionId}`);
        if (res.ok) {
          const data = await res.json() as { ready: boolean; created?: number; log?: string[]; failed?: boolean; error?: string; summary?: AnalyzeSummary; status?: string | null; analysisTranscript?: AnalysisTranscript | null };
          lastStatus = data.status ?? lastStatus;
          if (data.log && data.log.length > 0) setLog(data.log);
          if (data.summary) setSummary(data.summary);
          if (data.analysisTranscript) setTranscript(data.analysisTranscript);
          if (data.failed) {
            clearInterval(pollRef.current!);
            setPolling(false);
            setActiveActionId(null);
            setFeedback(`Failed: ${data.error}`);
            setLog((prev) => [...prev, `Failed: ${data.error}`]);
            return;
          }
          if (data.ready) {
            clearInterval(pollRef.current!);
            setPolling(false);
            setActiveActionId(null);
            setOk(true);
            setFeedback(`${data.created ?? "?"} tasks generated (local ${labelForRunner}).`);
            setLog((prev) => [...prev, "Done."]);
            if (data.summary) setSummary(data.summary);
            router.refresh();
            return;
          }
        }
      } catch {
        // Keep polling; transient network errors are normal during deploys.
      }

      if (attempts >= 120 && lastStatus !== "running" && lastStatus !== "claimed") {
        clearInterval(pollRef.current!);
        setPolling(false);
        setActiveActionId(null);
        setFeedback("Timed out. Check bridge daemon.");
        setLog((prev) => [...prev, "Timed out after 10 minutes."]);
      } else if (attempts >= 120 && attempts % 12 === 0) {
        setLog((prev) => {
          const line = "Still running locally. Waiting for bridge result...";
          return prev[prev.length - 1] === line ? prev : [...prev, line];
        });
      }
    }, 5000);
  }, [router]);

  useEffect(() => {
    if (!showOutput) return;
    let cancelled = false;
    async function resumeLatest() {
      try {
        const projectEnc = encodeURIComponent(projectName);
        const res = await fetch(`/api/projects/${projectEnc}/analyze/status`);
        if (!res.ok || cancelled) return;
        const data = await res.json() as {
          actionId?: string | null;
          ready: boolean;
          created?: number;
          log?: string[];
          failed?: boolean;
          error?: string;
          summary?: AnalyzeSummary;
          status?: string | null;
          runnerLabel?: string;
          analysisTranscript?: AnalysisTranscript | null;
        };
        const hasRecentAction = !!data.actionId && !!data.status;
        if (!hasRecentAction) return;
        const active = data.status === "pending" || data.status === "claimed" || data.status === "running";
        const completedWithLog = data.status === "succeeded" && data.log && data.log.length > 0;
        const failedWithLog = data.status === "failed" && data.log && data.log.length > 0;
        if (!active && !completedWithLog && !failedWithLog) return;

        const labelForRunner = data.runnerLabel ?? "Claude";
        setRunnerLabel(labelForRunner);
        if (data.log && data.log.length > 0) setLog(data.log);
        if (data.summary) setSummary(data.summary);
        if (data.analysisTranscript) setTranscript(data.analysisTranscript);
        if (data.failed) {
          setFeedback(`Failed: ${data.error}`);
          return;
        }
        if (data.ready && !active) {
          setOk(true);
          setFeedback(`${data.created ?? "?"} tasks generated (local ${labelForRunner}).`);
          return;
        }
        if (active && data.actionId) {
          setActiveActionId(data.actionId);
          setFeedback("Analysis still running locally.");
          startPolling(projectEnc, data.actionId, labelForRunner);
        }
      } catch {
        // Resume is best-effort; normal Analyze still works.
      }
    }
    resumeLatest();
    return () => { cancelled = true; };
  }, [projectName, showOutput, startPolling]);

  function run() {
    setFeedback(null);
    setOk(false);
    setLog([]);
    setSummary(null);
    setTranscript(null);
    setDetailsOpen(false);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/analyze`, { method: "POST" });
        const result = await res.json() as AnalyzeResult;
        const labelForRunner = result.runnerLabel ?? "AI";

        if (result.pending && result.actionId) {
          if (showOutput) {
            startPolling(encodeURIComponent(projectName), result.actionId, labelForRunner);
          } else {
            setFeedback(`Queued for local ${labelForRunner}. Track progress in Module Progress.`);
            router.refresh();
          }
        } else if (result.ok) {
          setOk(true);
          const src = result.source === "ai" ? `${labelForRunner} generated` : "template";
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

  async function cancelAnalysis() {
    if (pollRef.current) clearInterval(pollRef.current);
    setPolling(false);
    const actionId = activeActionId;
    setActiveActionId(null);
    setFeedback("Cancelling analysis...");
    setLog((prev) => [...prev, "Cancelling analysis..."]);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/analyze/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId }),
      });
      const data = await res.json().catch(() => ({})) as { cancelled?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Cancel failed");
      setFeedback("Analysis cancelled.");
      setLog((prev) => [...prev, `Cancelled ${data.cancelled ?? 0} queued/running action(s).`]);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cancel failed";
      setFeedback(message);
      setLog((prev) => [...prev, `Cancel failed: ${message}`]);
    }
  }

  const isLoading = pending || polling;
  const canCancel = polling || !!activeActionId;
  const btnClass = size === "sm"
    ? "inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
    : "inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent/90 disabled:opacity-50";

  return (
    <span className="inline-flex w-full flex-col gap-2">
      <span className="inline-flex flex-wrap items-center gap-2">
        <button type="button" onClick={run} disabled={isLoading} className={btnClass}>
          {isLoading ? <Loader2 size={size === "sm" ? 10 : 13} className="animate-spin" /> : <Sparkles size={size === "sm" ? 10 : 13} />}
          {polling ? "Analyzing..." : label}
        </button>
        {showOutput && canCancel && (
          <button
            type="button"
            onClick={cancelAnalysis}
            className={size === "sm"
              ? "inline-flex shrink-0 items-center gap-1 rounded-lg border border-blocked/40 px-2 py-1 text-[10px] font-bold text-blocked transition-colors hover:bg-blocked/10"
              : "inline-flex items-center gap-1.5 rounded-lg border border-blocked/40 px-3 py-2 text-xs font-bold text-blocked transition-colors hover:bg-blocked/10"}
          >
            <X size={size === "sm" ? 10 : 13} />
            Cancel
          </button>
        )}
        {feedback && (
          <span className={ok ? "inline-flex items-center gap-1 text-[11px] text-done" : "inline-flex items-center gap-1 text-[11px] text-text-muted"}>
            {ok && <Check size={12} />}
            {feedback}
          </span>
        )}
      </span>

      {showOutput && log.length > 0 && (
        <div className="w-full overflow-hidden rounded-lg border border-border bg-bg-base">
          <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-1.5">
            <Terminal size={11} className="text-text-muted" />
            <span className="font-mono text-[10px] text-text-muted">local {runnerLabel.toLowerCase()} output</span>
            {transcript?.command && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(transcript.command ?? "")}
                className="rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-text-muted transition-colors hover:bg-card-hover hover:text-text"
              >
                Copy cmd
              </button>
            )}
            {transcript && (
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="ml-auto rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/10"
              >
                Details
              </button>
            )}
            {polling && <span className="ml-auto inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
          </div>
          <pre
            ref={logRef}
            className="max-h-48 overflow-y-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed text-text-muted"
          >
            {log.join("\n")}
          </pre>
        </div>
      )}

      {showOutput && detailsOpen && transcript && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <Terminal size={16} className="text-accent" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-text">Analysis Transcript</h3>
                <p className="truncate text-xs text-text-muted">
                  {transcript.runner ?? runnerLabel} - {transcript.projectName ?? projectName} - {transcript.sessionId ?? "local session"}
                </p>
              </div>
              <button type="button" onClick={() => setDetailsOpen(false)} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-card-hover hover:text-text">
                <X size={16} />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-2">
              <TranscriptBlock title="Command" value={transcript.command} />
              <TranscriptBlock title="Prompt / Context" value={transcript.prompt} />
              <TranscriptBlock title="Claude Response" value={transcript.responseText} />
              <TranscriptBlock title="Usage" value={JSON.stringify({
                durationMs: transcript.durationMs,
                durationApiMs: transcript.durationApiMs,
                totalCostUsd: transcript.totalCostUsd,
                terminalReason: transcript.terminalReason,
                usage: transcript.usage,
                modelUsage: transcript.modelUsage,
              }, null, 2)} />
              <TranscriptBlock title="Permission Denials / Raw Tail" value={JSON.stringify({
                permissionDenials: transcript.permissionDenials ?? [],
                rawOutput: transcript.rawOutput,
              }, null, 2)} />
            </div>
          </div>
        </div>
      )}

      {showOutput && ok && summary?.modules && summary.modules.length > 0 && (
        <div className="w-full rounded-lg border border-border bg-bg-base p-3 text-left">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Generated Backlog Review</span>
            <span className="flex gap-2">
              <Link href={`/projects/${encodeURIComponent(projectName)}/detail`} className="text-[11px] font-semibold text-accent hover:underline">Open detail</Link>
              <Link href="/tasks" className="text-[11px] font-semibold text-accent hover:underline">Review tasks</Link>
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {summary.modules.slice(0, 4).map((mod, index) => (
              <div key={`${mod.name}-${index}`} className="rounded border border-border bg-card px-3 py-2">
                <p className="truncate text-xs font-bold text-text">{mod.name ?? "Untitled module"}</p>
                <ul className="mt-1 space-y-1 text-[11px] text-text-muted">
                  {(mod.features ?? []).slice(0, 2).map((feature, featureIndex) => (
                    <li key={`${feature.name}-${featureIndex}`} className="truncate">
                      {feature.name ?? "Feature"}: {(feature.tasks ?? []).slice(0, 2).join("; ")}
                    </li>
                  ))}
                </ul>
                {(mod.reqIds ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(mod.reqIds ?? []).slice(0, 5).map((reqId) => (
                      <span key={reqId} className="rounded bg-done/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-done">{reqId}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

function TranscriptBlock({ title, value }: { title: string; value?: string | null }) {
  return (
    <section className="min-h-72 overflow-hidden rounded-xl border border-border bg-bg-base">
      <div className="border-b border-border bg-card px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">{title}</div>
      <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed text-text-muted">
        {value || "--"}
      </pre>
    </section>
  );
}
