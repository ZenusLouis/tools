"use client";

import { useState } from "react";
import { Check, Code2, Copy, Database, Palette, Send, Server } from "lucide-react";
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

  function handleCopy() {
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
  if (servers.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-6 text-center text-sm text-text-muted">
        No servers found in <code className="font-mono text-accent">.mcp.json</code>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {servers.map((server) => {
        const status = statusForServer(server);
        const Icon = SERVER_ICONS[server.name.toLowerCase()] ?? Server;
        return (
          <div key={server.name} className="rounded-xl border border-border bg-card p-4 transition-all hover:border-border/80">
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
  );
}
