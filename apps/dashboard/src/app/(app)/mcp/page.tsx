import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { McpServerList } from "@/components/mcp/McpServerList";
import { McpProfileViewer } from "@/components/mcp/McpProfileViewer";
import { McpActionTimeline } from "@/components/mcp/McpActionTimeline";
import { RegisterMcpServerForm } from "@/components/mcp/McpForms";
import { McpRefreshButton } from "@/components/mcp/McpRefreshButton";
import { requireCurrentUser } from "@/lib/auth";
import { getMcpProfiles, getMcpServersWithRuntime, getRecentMcpActions } from "@/lib/mcp";
import type { McpServer } from "@/lib/mcp";

export default async function McpPage() {
  const user = await requireCurrentUser();
  const [servers, profiles, actions] = await Promise.all([
    getMcpServersWithRuntime(user.workspaceId),
    getMcpProfiles(),
    getRecentMcpActions(user.workspaceId),
  ]);

  const serverMap: Record<string, McpServer> = Object.fromEntries(
    servers.map((s) => [s.name, s])
  );

  return (
    <>
      <TopBar title="MCP Monitor" />
      <PageShell>
        <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-8 items-start">
          <div className="col-span-12 lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-text">MCP Servers</h2>
              <div className="flex items-center gap-2">
                <McpRefreshButton />
                <RegisterMcpServerForm />
              </div>
            </div>
            <McpServerList servers={servers} />
            <McpActionTimeline actions={actions} />
            <section className="rounded-xl border border-border bg-card p-5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">Figma Design Flow</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  ["Analyze Figma", "Use figma-mcp-go or Figma HTTP MCP to inspect the linked file and selected frames."],
                  ["Generate UI Brief", "Convert design signals into compact implementation guidance for the selected project/task."],
                  ["Implement Design", "Queue a local Codex/Claude run with design-integrator skills and project code-index snippets."],
                  ["Review Visual Diff", "Capture screenshots, compare layout regressions, and write review artifacts."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-lg border border-border bg-bg-base p-3">
                    <p className="text-sm font-bold text-text">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">{body}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="col-span-12 lg:col-span-5 space-y-6 lg:sticky lg:top-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-text">MCP Profiles</h2>
              <span className="text-xs text-text-muted bg-card-hover px-2 py-1 rounded">
                {profiles.length} Profiles
              </span>
            </div>
            <McpProfileViewer profiles={profiles} serverMap={serverMap} />
          </div>
        </div>
      </PageShell>
    </>
  );
}
