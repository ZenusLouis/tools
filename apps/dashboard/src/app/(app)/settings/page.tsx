import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { GlobalSettingsClient } from "@/components/settings/GlobalSettingsClient";
import { ApiKeysPanel } from "@/components/settings/ApiKeysPanel";
import { getMcpProfiles } from "@/lib/mcp";
import { listApiKeys } from "@/lib/api-keys";
import { Terminal, FolderOpen } from "lucide-react";

export default async function SettingsPage() {
  const [profiles, apiKeys] = await Promise.all([
    getMcpProfiles(),
    listApiKeys(),
  ]);
  const claudeRoot = process.env.CLAUDE_ROOT ?? "d:\\GlobalClaudeSkills";

  return (
    <>
      <TopBar title="Settings" />
      <PageShell>
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-text">System Configuration</h2>
            <p className="text-text-muted text-sm mt-1">
              Manage your development environment, token budgets, and MCP server profiles.
            </p>
          </div>

          {/* 3-column bento grid */}
          <GlobalSettingsClient profiles={profiles} />

          {/* API Keys section */}
          <section className="bg-card border border-border rounded-xl p-6">
            <ApiKeysPanel initialKeys={apiKeys} />
          </section>

          {/* About card — glassmorphism */}
          <section className="relative overflow-hidden bg-linear-to-br from-card to-bg-base border border-border rounded-xl p-8 group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center shadow-xl shadow-accent/20 group-hover:scale-105 transition-transform shrink-0">
                  <Terminal size={28} className="text-white" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-text tracking-tight">GCS v1.0</h3>
                  <p className="text-text-muted text-sm">Global Claude Skills Developer Environment</p>
                </div>
              </div>
              <div className="flex flex-col md:items-end gap-2">
                <span className="text-[10px] uppercase font-bold text-text-muted tracking-widest">Installation Path</span>
                <div className="flex items-center gap-2 bg-bg-base border border-border rounded-lg px-4 py-2 font-mono text-xs text-accent">
                  <FolderOpen size={13} />
                  {claudeRoot}
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-border/50 flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-card-hover border border-border rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-done animate-pulse" />
                <span className="text-[10px] text-text">System Ready</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-card-hover border border-border rounded-full">
                <span className="text-[10px] text-accent">↻</span>
                <span className="text-[10px] text-text">Last check: 2m ago</span>
              </div>
            </div>
          </section>
        </div>
      </PageShell>
    </>
  );
}
