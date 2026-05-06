import type { McpServer } from "@/lib/mcp";

export function buildMcpAddCommand(server: McpServer): string {
  if (server.type === "http" && server.url) {
    return `claude mcp add --transport http ${server.name} ${server.url}`;
  }
  if (server.type === "sse" && server.url) {
    return `claude mcp add --transport sse ${server.name} ${server.url}`;
  }
  if (server.type === "stdio" && server.command) {
    const args = server.args?.join(" ") ?? "";
    return `claude mcp add ${server.name} -- ${server.command}${args ? ` ${args}` : ""}`;
  }
  return `claude mcp add ${server.name}`;
}

export function buildCodexMcpAddCommand(server: McpServer): string {
  if (server.type === "stdio" && server.command) {
    const args = server.args?.join(" ") ?? "";
    return `codex mcp add ${server.name} -- ${server.command}${args ? ` ${args}` : ""}`;
  }
  if ((server.type === "http" || server.type === "sse") && server.url) {
    return `codex mcp add ${server.name} --url ${server.url}`;
  }
  return `codex mcp add ${server.name}`;
}
