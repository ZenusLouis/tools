"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function McpRefreshButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/mcp/refresh", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Refresh failed");
      setMessage(`Synced ${body.result?.mcpServers ?? 0} servers and ${body.result?.mcpProfiles ?? 0} profiles.`);
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {message && <span className="hidden text-[10px] text-text-muted md:inline">{message}</span>}
      <button
        onClick={refresh}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
        Refresh MCP
      </button>
    </div>
  );
}
