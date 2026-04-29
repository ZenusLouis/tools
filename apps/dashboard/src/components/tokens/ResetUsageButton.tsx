"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, RotateCcw } from "lucide-react";

export function ResetUsageButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string; deleted?: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function reset() {
    setResult(null);
    setConfirmOpen(false);
    startTransition(async () => {
      try {
        const res = await fetch("/api/tokens/reset-usage", { method: "POST" });
        const data = await res.json() as { ok?: boolean; error?: string; deletedToolUsage?: number; deletedSessions?: number };
        if (!res.ok || data.error) {
          setResult({ error: data.error ?? "Reset failed" });
          return;
        }
        setResult({ ok: true, deleted: (data.deletedToolUsage ?? 0) + (data.deletedSessions ?? 0) });
        router.refresh();
      } catch {
        setResult({ error: "Network error" });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-blocked/40 bg-blocked/10 px-3 py-1.5 text-xs font-semibold text-blocked transition-colors hover:bg-blocked/15 disabled:opacity-50"
      >
        <RotateCcw size={12} className={pending ? "animate-spin" : ""} />
        {pending ? "Resetting..." : "Reset Codex"}
      </button>
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blocked/10 text-blocked">
                <AlertCircle size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-text">Reset Codex usage?</h3>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  This clears Codex telemetry for the current workspace only. Projects, tasks, skills, Claude, and ChatGPT/OpenAI usage data stay intact.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted transition-colors hover:bg-card-hover hover:text-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={pending}
                className="rounded-lg bg-blocked px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blocked/90 disabled:opacity-50"
              >
                Reset Codex
              </button>
            </div>
          </div>
        </div>
      )}
      {result && !pending && (
        <span className={`inline-flex items-center gap-1 text-xs ${result.error ? "text-blocked" : "text-done"}`}>
          {result.error ? <><AlertCircle size={11} />{result.error}</> : <><Check size={11} />{result.deleted ?? 0} rows reset</>}
        </span>
      )}
    </div>
  );
}
