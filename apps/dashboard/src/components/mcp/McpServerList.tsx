"use client";

import { useState } from "react";
import { Check, Code2, Copy, Database, Palette, Send, Server, Terminal } from "lucide-react";
import type { McpServer } from "@/lib/mcp";
import { buildMcpAddCommand } from "@/lib/mcp-utils";

interface Props {
  servers: McpServer[];
}

const SERVER_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  github: Code2,
  figma: Palette,
  context7: Database,
  postman: Send,
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button onClick={handleCopy} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[10px] font-bold text-text-muted transition-all hover:bg-card-hover hover:text-text">
      {copied ? <Check size={12} className="text-done" /> : <Copy size={12} />}
      Copy claude mcp add
    </button>
  );
}

function statusForServer(server: McpServer): { label: string; dot: string; badge: string; pulse: boolean } {
  if ((server.type === "http" && server.url) || (server.type === "stdio" && server.command)) {
    return { label: "Active", dot: "bg-done", badge: "bg-done/10 text-done", pulse: true };
  }
  return { label: "Unknown", dot: "bg-in-progress", badge: "bg-in-progress/10 text-in-progress", pulse: false };
}

export function McpServerList({ servers }: Props) {
  const [selected, setSelected] = useState<McpServer | null>(servers[0] ?? null);

  if (servers.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-6 text-center text-sm text-text-muted">
        No servers found in <code className="font-mono text-accent">.mcp.json</code>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        {servers.map((server) => {
          const status = statusForServer(server);
          const Icon = SERVER_ICONS[server.name.toLowerCase()] ?? Server;
          const isSelected = selected?.name === server.name;
          return (
            <div
              key={server.name}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(server)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setSelected(server);
              }}
              className={`rounded-xl border bg-card p-4 transition-all hover:border-border/80 hover:bg-card-hover/40 ${
                isSelected ? "border-accent/60 ring-1 ring-accent/20" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card-hover">
                    <Icon size={18} className="text-text" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-text">{server.name}</h3>
                      <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot} ${status.pulse ? "animate-pulse" : ""}`} />
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-3 text-xs text-text-muted">
                      <span className="rounded border border-border bg-card-hover px-2 py-0.5 font-mono text-[10px]">{server.type}</span>
                      <span className="max-w-64 truncate font-mono opacity-70">{server.url ?? server.command ?? "--"}</span>
                    </div>
                  </div>
                </div>
                <CopyButton text={buildMcpAddCommand(server)} />
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <aside className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card-hover">
              <Terminal size={18} className="text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Server Detail</p>
              <h3 className="truncate text-lg font-bold text-text">{selected.name}</h3>
              <p className="text-xs text-text-muted">{selected.type.toUpperCase()} transport</p>
            </div>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-bg-base p-3">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Endpoint</dt>
              <dd className="mt-2 break-all font-mono text-xs text-text">{selected.url ?? selected.command ?? "Not configured"}</dd>
            </div>
            {selected.args && selected.args.length > 0 && (
              <div className="rounded-lg border border-border bg-bg-base p-3">
                <dt className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Arguments</dt>
                <dd className="mt-2 break-all font-mono text-xs text-text">{selected.args.join(" ")}</dd>
              </div>
            )}
            <div className="rounded-lg border border-border bg-bg-base p-3">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Claude Add Command</dt>
              <dd className="mt-2 break-all font-mono text-xs text-text">{buildMcpAddCommand(selected)}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <CopyButton text={buildMcpAddCommand(selected)} />
          </div>
        </aside>
      )}
    </div>
  );
}
