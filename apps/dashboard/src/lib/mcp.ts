import "server-only";
import { db } from "@/lib/db";

export type McpServerType = "http" | "sse" | "stdio";

export type McpServer = {
  name: string;
  type: McpServerType;
  url?: string;
  command?: string;
  args?: string[];
};

export type McpProfile = {
  profile: string;
  description: string;
  servers: string[];
  use_when: string;
};

export async function getMcpServers(): Promise<McpServer[]> {
  const rows = await db.mcpServer.findMany({ orderBy: { name: "asc" } });
  return rows.map((r) => ({
    name: r.name,
    type: r.type as McpServerType,
    url: r.url ?? undefined,
    command: r.command ?? undefined,
    args: r.args.length > 0 ? r.args : undefined,
  }));
}

export async function getMcpProfiles(): Promise<McpProfile[]> {
  const rows = await db.mcpProfile.findMany({ orderBy: { profile: "asc" } });
  return rows.map((r) => ({
    profile: r.profile,
    description: r.description,
    servers: r.servers,
    use_when: r.useWhen,
  }));
}

export function buildMcpAddCommand(server: McpServer): string {
  if (server.type === "http" && server.url) return `claude mcp add --transport http ${server.name} ${server.url}`;
  if (server.type === "stdio" && server.command) {
    const args = server.args?.join(" ") ?? "";
    return `claude mcp add ${server.name} ${server.command}${args ? " " + args : ""}`;
  }
  return `claude mcp add ${server.name}`;
}
