"use client";

import { useEffect, useState, useTransition } from "react";
import { formatDateTime } from "@/lib/utils/format";

type Device = { id: string; name: string; deviceKey: string; claudeAvailable: boolean; codexAvailable: boolean; lastSeenAt: string | null };
type Token = { id: string; name: string; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };

export function BridgePanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [name, setName] = useState("Local bridge");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const res = await fetch("/api/bridge/tokens");
    const body = await res.json();
    setDevices(body.devices ?? []);
    setTokens(body.tokens ?? []);
  }

  function createToken() {
    startTransition(async () => {
      const res = await fetch("/api/bridge/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (body.rawToken) setRawToken(body.rawToken);
      await refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-text">Local Bridge</h3>
          <p className="mt-1 text-xs text-text-muted">Create a machine token for Claude/Codex local sync.</p>
        </div>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-border bg-bg-base px-3 py-1.5 text-xs text-text" />
          <button onClick={createToken} disabled={pending} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Create Token</button>
        </div>
      </div>

      {rawToken && (
        <div className="mb-4 rounded-lg border border-in-progress/30 bg-in-progress/10 p-3">
          <p className="text-xs font-semibold text-in-progress">Copy now. This token is shown once.</p>
          <p className="mt-1 text-xs text-text-muted">
            Store it in <code>.codex/settings.local.json</code> under <code>env.BRIDGE_TOKEN</code>. Device identity is generated locally per account token; do not set machine-specific environment variables or commit secrets.
          </p>
          <code className="mt-2 block break-all rounded bg-bg-base px-2 py-1 text-xs text-accent">{rawToken}</code>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Devices</p>
          <div className="space-y-2">
            {devices.length === 0 ? <p className="text-xs text-text-muted">No bridge heartbeat yet.</p> : devices.map((device) => (
              <div key={device.id} className="rounded-lg border border-border bg-bg-base p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text">{device.name}</span>
                  <span className="text-text-muted">{formatDateTime(device.lastSeenAt)}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <span className={`rounded px-1.5 py-0.5 ${device.claudeAvailable ? "bg-done/15 text-done" : "bg-border text-text-muted"}`}>Claude</span>
                  <span className={`rounded px-1.5 py-0.5 ${device.codexAvailable ? "bg-done/15 text-done" : "bg-border text-text-muted"}`}>Codex</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Tokens</p>
          <div className="space-y-2">
            {tokens.length === 0 ? <p className="text-xs text-text-muted">No tokens created.</p> : tokens.map((token) => (
              <div key={token.id} className="rounded-lg border border-border bg-bg-base p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text">{token.name}</span>
                  <span className={token.revokedAt ? "text-blocked" : "text-done"}>{token.revokedAt ? "revoked" : "active"}</span>
                </div>
                <p className="mt-1 text-text-muted">Last used: {formatDateTime(token.lastUsedAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
