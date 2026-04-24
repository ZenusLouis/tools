import type { McpServer } from "@/lib/mcp";

export function buildMcpAddCommand(server: McpServer): string {
  if (server.type === "http" && server.url) {
    return `claude mcp add --transport http ${server.name} ${server.url}`;
  }
  if (server.type === "sse" && server.url) {
    return `claude mcp add --transport sse ${server.name} ${server.url}`;
  }
  return `claude mcp add ${server.name}`;
}
