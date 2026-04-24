"use client";

import { useState } from "react";
import { Copy, Check, Server, Palette, Database, Send, Code2 } from "lucide-react";
import type { McpServer } from "@/lib/mcp";
import { buildMcpAddCommand } from "@/lib/mcp-utils";

interface Props {
  servers: McpServer[];
}

const SERVER_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  github:   Code2,
  figma:    Palette,
  context7: Database,
  postman:  Send,
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
    <button
      onClick={handleCopy}
      className="text-[10px] font-bold text-text-muted border border-border px-3 py-1.5 rounded-lg hover:bg-card-hover hover:text-text transition-all flex items-center gap-2"
    >
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
      <div className="rounded-xl border border-border bg-card px-5 py-6 text-sm text-text-muted text-center">
        No servers found in <code className="font-mono text-accent">.mcp.json</code>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {servers.map((server) => {
        const status = statusForServer(server);
        const IconComp = SERVER_ICONS[server.name.toLowerCase()] ?? Server;
        return (
          <div key={server.name} className="bg-card p-4 rounded-xl border border-border hover:border-border/80 transition-all group">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-card-hover flex items-center justify-center shrink-0">
                  <IconComp size={18} className="text-text" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-text">{server.name}</h3>
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${status.badge} text-[10px] font-bold uppercase tracking-wider`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${status.pulse ? "animate-pulse" : ""}`} />
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                    <span className="bg-card-hover px-2 py-0.5 rounded text-[10px] font-mono border border-border">{server.type}</span>
                    <span className="font-mono opacity-60 truncate max-w-48">
                      {server.url ?? server.command ?? "—"}
                    </span>
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
