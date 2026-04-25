import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { McpServerList } from "@/components/mcp/McpServerList";
import { McpProfileViewer } from "@/components/mcp/McpProfileViewer";
import { RegisterMcpServerForm } from "@/components/mcp/McpForms";
import { getMcpServers, getMcpProfiles } from "@/lib/mcp";
import type { McpServer } from "@/lib/mcp";

export default async function McpPage() {
  const [servers, profiles] = await Promise.all([
    getMcpServers(),
    getMcpProfiles(),
  ]);

  const serverMap: Record<string, McpServer> = Object.fromEntries(
    servers.map((s) => [s.name, s])
  );

  return (
    <>
      <TopBar title="MCP Monitor" />
      <PageShell>
        <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-text">MCP Servers</h2>
              <RegisterMcpServerForm />
            </div>
            <McpServerList servers={servers} />
          </div>

          <div className="col-span-12 lg:col-span-5 space-y-6">
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
