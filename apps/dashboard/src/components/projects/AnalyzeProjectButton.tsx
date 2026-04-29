"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Sparkles, Terminal } from "lucide-react";

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
    features?: Array<{ name?: string; tasks?: string[] }>;
  }>;
};

export function AnalyzeProjectButton({
  projectName,
  label = "Analyze BRD",
  size = "md",
}: {
  projectName: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [polling, setPolling] = useState(false);
  const [runnerLabel, setRunnerLabel] = useState("Claude");
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<AnalyzeSummary | null>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  function startPolling(projectEnc: string, actionId: string, labelForRunner = "Claude") {
    setPolling(true);
    setRunnerLabel(labelForRunner);
    setLog([`Queued - waiting for local ${labelForRunner}...`]);
    setSummary(null);
    let attempts = 0;

    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/projects/${projectEnc}/analyze/status?actionId=${actionId}`);
        if (res.ok) {
          const data = await res.json() as { ready: boolean; created?: number; log?: string[]; failed?: boolean; error?: string; summary?: AnalyzeSummary };
          if (data.log && data.log.length > 0) setLog(data.log);
          if (data.summary) setSummary(data.summary);
          if (data.failed) {
            clearInterval(pollRef.current!);
            setPolling(false);
            setFeedback(`Failed: ${data.error}`);
            setLog((prev) => [...prev, `Failed: ${data.error}`]);
            return;
          }
          if (data.ready) {
            clearInterval(pollRef.current!);
            setPolling(false);
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

      if (attempts >= 120) {
        clearInterval(pollRef.current!);
        setPolling(false);
        setFeedback("Timed out. Check bridge daemon.");
        setLog((prev) => [...prev, "Timed out after 10 minutes."]);
      }
    }, 5000);
  }

  function run() {
    setFeedback(null);
    setOk(false);
    setLog([]);
    setSummary(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/analyze`, { method: "POST" });
        const result = await res.json() as AnalyzeResult;
        const labelForRunner = result.runnerLabel ?? "AI";

        if (result.pending && result.actionId) {
          startPolling(encodeURIComponent(projectName), result.actionId, labelForRunner);
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

  const isLoading = pending || polling;
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
        {feedback && (
          <span className={ok ? "inline-flex items-center gap-1 text-[11px] text-done" : "inline-flex items-center gap-1 text-[11px] text-text-muted"}>
            {ok && <Check size={12} />}
            {feedback}
          </span>
        )}
      </span>

      {log.length > 0 && (
        <div className="w-full overflow-hidden rounded-lg border border-border bg-bg-base">
          <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-1.5">
            <Terminal size={11} className="text-text-muted" />
            <span className="font-mono text-[10px] text-text-muted">local {runnerLabel.toLowerCase()} output</span>
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

      {ok && summary?.modules && summary.modules.length > 0 && (
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
              </div>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}
