"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Layers, Settings2, Paintbrush, Cpu } from "lucide-react";
import type { McpProfile, McpServer } from "@/lib/mcp";
import { McpProfileForm } from "@/components/mcp/McpForms";

interface Props {
  profiles: McpProfile[];
  serverMap: Record<string, McpServer>;
}

const PROFILE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  fullstack:    Layers,
  frontend:     Paintbrush,
  "api-design": Cpu,
};

function serverStatus(server: McpServer | undefined): { dot: string } {
  if (!server) return { dot: "bg-pending" };
  if ((server.type === "http" && server.url) || (server.type === "stdio" && server.command)) return { dot: "bg-done" };
  return { dot: "bg-in-progress" };
}

export function McpProfileViewer({ profiles, serverMap }: Props) {
  const [expanded, setExpanded] = useState<string | null>(profiles[0]?.profile ?? null);

  if (profiles.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-6 text-sm text-text-muted text-center">
        No profiles in <code className="font-mono text-accent">mcp/profiles/</code>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {profiles.map((profile) => {
        const isOpen = expanded === profile.profile;
        const IconComp = PROFILE_ICONS[profile.profile.toLowerCase()] ?? Settings2;

        return (
          <div
            key={profile.profile}
            className={`bg-card rounded-xl border overflow-hidden transition-all ${isOpen ? "border-accent/40" : "border-border hover:border-border/80 cursor-pointer"}`}
          >
            <button
              onClick={() => setExpanded(isOpen ? null : profile.profile)}
              className={`w-full p-4 flex items-center justify-between ${isOpen ? "bg-accent/10" : "hover:bg-card-hover"} transition-colors`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded flex items-center justify-center shadow-lg ${isOpen ? "bg-accent shadow-accent/20" : "bg-card-hover"}`}>
                  <IconComp size={16} className={isOpen ? "text-white" : "text-text-muted"} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-text">{profile.profile}</h3>
                  {isOpen && <p className="text-[10px] text-accent font-bold uppercase tracking-tighter">Current Workspace</p>}
                  {!isOpen && <p className="text-[10px] text-text-muted">{profile.servers.length} servers configured</p>}
                </div>
              </div>
              {isOpen ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
            </button>

            {isOpen && (
              <div className="p-4 space-y-3">
                {profile.description && (
                  <p className="text-xs text-text-muted">{profile.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {profile.servers.map((name) => {
                    const srv = serverMap[name];
                    const { dot } = serverStatus(srv);
                    const hasError = !srv || (!srv.url && !srv.command);
                    return (
                      <span
                        key={name}
                        className={`bg-card-hover text-text text-[10px] px-2 py-1 rounded flex items-center gap-1.5 ${hasError ? "border border-blocked/30" : ""}`}
                      >
                        <span className={`w-1 h-1 rounded-full ${dot}`} />
                        {name}
                      </span>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-border flex justify-end">
                  <McpProfileForm serverNames={Object.keys(serverMap)} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
