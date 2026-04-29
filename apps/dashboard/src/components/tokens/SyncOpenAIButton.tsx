"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

interface Props {
  lastSyncedAt: string | null; // ISO string of most recent openai-sync session date
  apiKeys: Array<{ id: string; name: string; service: string }>;
}

const USAGE_SERVICES = new Set(["openai_admin", "openai_usage", "openai"]);

export function SyncOpenAIButton({ lastSyncedAt, apiKeys }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ synced?: number; error?: string; warning?: string } | null>(null);
  const usageKeys = apiKeys.filter((key) => USAGE_SERVICES.has(key.service));
  const preferredKey = usageKeys.find((key) => key.service === "openai_admin") ?? usageKeys.find((key) => key.service === "openai_usage") ?? usageKeys[0];
  const [apiKeyId, setApiKeyId] = useState(preferredKey?.id ?? "");

  async function doSync(days: number) {
    setResult(null);
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        try {
          const res = await fetch("/api/sync/openai-usage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ days, apiKeyId: apiKeyId || undefined }),
          });
          const data = await res.json() as { ok?: boolean; synced?: number; error?: string; warnings?: string[] };
          if (!res.ok || data.error) setResult({ error: data.error ?? "Sync failed" });
          else {
            setResult({ synced: data.synced ?? 0, warning: data.warnings?.[0] });
            router.refresh();
          }
        } catch { setResult({ error: "Network error" }); }
        resolve();
      });
    });
  }

  // Auto-sync if last sync > 1 hour ago (or never)
  useEffect(() => {
    const stale = !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > 60 * 60 * 1000;
    if (!stale) return;
    const timer = window.setTimeout(() => {
      void doSync(7);
    }, 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-lg border border-border bg-bg-base overflow-hidden">
        <select
          value={apiKeyId}
          onChange={(event) => setApiKeyId(event.target.value)}
          disabled={pending || usageKeys.length === 0}
          className="max-w-[180px] border-r border-border bg-card px-2 py-1.5 text-xs font-semibold text-text outline-none disabled:opacity-50"
          title="OpenAI key used for usage sync"
        >
          {usageKeys.length === 0 ? (
            <option value="">No usage key</option>
          ) : (
            usageKeys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.name} ({key.service})
              </option>
            ))
          )}
        </select>
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
        <span
          title={result.error ?? result.warning}
          className={`flex max-w-md items-center gap-1 text-xs ${result.error ? "text-blocked" : result.warning ? "text-in-progress" : "text-done"}`}
        >
          {result.error ? (
            <><AlertCircle size={11} />{result.error}</>
          ) : result.warning ? (
            <><AlertCircle size={11} />{result.synced}d synced, cost estimate only</>
          ) : (
            <><Check size={11} />{result.synced}d synced</>
          )}
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
