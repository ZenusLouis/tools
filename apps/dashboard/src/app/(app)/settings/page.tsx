import { FolderOpen, Terminal } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { PageShell } from "@/components/layout/PageShell";
import { TopBar } from "@/components/layout/TopBar";
import { ApiKeysPanel } from "@/components/settings/ApiKeysPanel";
import { BridgePanel } from "@/components/settings/BridgePanel";
import { GlobalSettingsClient } from "@/components/settings/GlobalSettingsClient";
import { requireCurrentUser } from "@/lib/auth";
import { listApiKeys } from "@/lib/api-keys";
import { getMcpProfiles } from "@/lib/mcp";

export default async function SettingsPage() {
  const user = await requireCurrentUser();
  const [profiles, apiKeys] = await Promise.all([
    getMcpProfiles(),
    listApiKeys(user.workspaceId),
  ]);
  const claudeRoot = process.env.CLAUDE_ROOT ?? "d:\\GlobalClaudeSkills";

  return (
    <>
      <TopBar title="Settings" />
      <PageShell>
        <div className="mx-auto max-w-[1200px] space-y-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Control Plane</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-text">System Configuration</h2>
            <p className="mt-1 text-sm text-text-muted">
              Manage {user.workspaceName}, token telemetry, bridge sync, and MCP server profiles.
            </p>
          </div>

          <GlobalSettingsClient profiles={profiles} />

          <section className="rounded-xl border border-border bg-card p-6">
            <ApiKeysPanel initialKeys={apiKeys} />
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <BridgePanel />
          </section>

          <section className="flex items-center justify-between rounded-xl border border-border bg-card p-6">
            <div>
              <h3 className="text-sm font-bold text-text">Signed in</h3>
              <p className="text-xs text-text-muted">{user.email}</p>
            </div>
            <LogoutButton />
          </section>

          <section className="relative overflow-hidden rounded-xl border border-border bg-card p-8">
            <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="flex items-center gap-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent shadow-xl shadow-accent/20 transition-transform group-hover:scale-105">
                  <Terminal size={28} className="text-white" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black tracking-tight text-text">GCS v1.0</h3>
                  <p className="text-sm text-text-muted">Global Claude Skills Developer Environment</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 md:items-end">
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Installation Path</span>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-base px-4 py-2 font-mono text-xs text-accent">
                  <FolderOpen size={13} />
                  {claudeRoot}
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-4 border-t border-border/50 pt-6">
              <div className="flex items-center gap-2 rounded-full border border-border bg-card-hover px-3 py-1">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-done" />
                <span className="text-[10px] text-text">System Ready</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border bg-card-hover px-3 py-1">
                <span className="text-[10px] text-accent">sync</span>
                <span className="text-[10px] text-text">Last check: 2m ago</span>
              </div>
            </div>
          </section>
        </div>
      </PageShell>
    </>
  );
}
