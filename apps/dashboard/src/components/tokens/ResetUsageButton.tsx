"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
      <ConfirmDialog
        open={confirmOpen}
        title="Reset Codex usage?"
        description="This clears Codex telemetry for the current workspace only. Projects, tasks, skills, Claude, and ChatGPT/OpenAI usage data stay intact."
        confirmLabel="Reset Codex"
        pending={pending}
        onClose={() => {
          if (!pending) setConfirmOpen(false);
        }}
        onConfirm={reset}
      />
      {result && !pending && (
        <span className={`inline-flex items-center gap-1 text-xs ${result.error ? "text-blocked" : "text-done"}`}>
          {result.error ? <><AlertCircle size={11} />{result.error}</> : <><Check size={11} />{result.deleted ?? 0} rows reset</>}
        </span>
      )}
    </div>
  );
}
