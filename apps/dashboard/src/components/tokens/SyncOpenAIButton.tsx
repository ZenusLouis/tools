"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

interface Props {
  lastSyncedAt: string | null; // ISO string of most recent openai-sync session date
}

export function SyncOpenAIButton({ lastSyncedAt }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ synced?: number; error?: string } | null>(null);

  async function doSync(days: number) {
    setResult(null);
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        try {
          const res = await fetch("/api/sync/openai-usage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ days }),
          });
          const data = await res.json() as { ok?: boolean; synced?: number; error?: string };
          if (!res.ok || data.error) setResult({ error: data.error ?? "Sync failed" });
          else { setResult({ synced: data.synced ?? 0 }); router.refresh(); }
        } catch { setResult({ error: "Network error" }); }
        resolve();
      });
    });
  }

  // Auto-sync if last sync > 1 hour ago (or never)
  useEffect(() => {
    const stale = !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > 60 * 60 * 1000;
    if (stale) doSync(7);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-lg border border-border bg-bg-base overflow-hidden">
        {([7, 30] as const).map((d) => (
          <button key={d} type="button" onClick={() => doSync(d)} disabled={pending}
            className="px-2.5 py-1.5 text-xs font-semibold text-text-muted hover:bg-card-hover hover:text-text transition-colors disabled:opacity-50 border-r border-border">
            {d}d
          </button>
        ))}
        <button type="button" onClick={() => doSync(7)} disabled={pending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 transition-colors disabled:opacity-50">
          <RefreshCw size={12} className={pending ? "animate-spin" : ""} />
          {pending ? "Syncing…" : "OpenAI"}
        </button>
      </div>
      {result && !pending && (
        <span className={`flex items-center gap-1 text-xs ${result.error ? "text-blocked" : "text-done"}`}>
          {result.error ? <><AlertCircle size={11} />{result.error}</> : <><Check size={11} />{result.synced}d synced</>}
        </span>
      )}
      {lastSyncedAt && !pending && (
        <span className="text-[10px] text-text-muted">
          last {new Date(lastSyncedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}
