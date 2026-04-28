"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, useRef } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

type AnalyzeResult = {
  ok: boolean;
  error?: string;
  created?: number;
  source?: string;
  pending?: boolean;
  actionId?: string;
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for bridge analysis completion
  function startPolling(projectEnc: string) {
    setPolling(true);
    setFeedback("Running via local Claude… checking every 5s");
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        // Check if tasks were created (project detail refresh)
        const res = await fetch(`/api/projects/${projectEnc}/analyze/status`);
        if (res.ok) {
          const data = await res.json() as { ready: boolean; created?: number };
          if (data.ready) {
            clearInterval(pollRef.current!);
            setPolling(false);
            setOk(true);
            setFeedback(`${data.created ?? "?"} tasks generated (local Claude).`);
            router.refresh();
            return;
          }
        }
      } catch { /* ignore */ }
      if (attempts >= 24) { // 2 minutes max
        clearInterval(pollRef.current!);
        setPolling(false);
        setFeedback("Timed out waiting for local Claude. Check bridge daemon logs.");
      }
    }, 5000);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function run() {
    setFeedback(null);
    setOk(false);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/analyze`, { method: "POST" });
        const result = await response.json() as AnalyzeResult;
        if (result.pending) {
          startPolling(encodeURIComponent(projectName));
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
  const className = size === "sm"
    ? "inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
    : "inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent/90 disabled:opacity-50";

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={run} disabled={isLoading} className={className}>
        {isLoading ? <Loader2 size={size === "sm" ? 10 : 13} className="animate-spin" /> : <Sparkles size={size === "sm" ? 10 : 13} />}
        {polling ? "Analyzing…" : label}
      </button>
      {feedback && (
        <span className={ok ? "inline-flex items-center gap-1 text-[11px] text-done" : "inline-flex items-center gap-1 text-[11px] text-text-muted"}>
          {ok && <Check size={12} />}
          {feedback}
        </span>
      )}
    </span>
  );
}
