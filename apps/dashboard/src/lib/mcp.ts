import "server-only";
import { db } from "@/lib/db";

export type McpServerType = "http" | "sse" | "stdio";

export type McpServer = {
  name: string;
  type: McpServerType;
  url?: string;
  command?: string;
  args?: string[];
  runtime?: McpRuntimeStatus;
};

export type McpProfile = {
  profile: string;
  description: string;
  servers: string[];
  use_when: string;
};

export type McpRuntimeStatus = {
  state: "online" | "configured" | "local_required" | "offline" | "unknown";
  label: string;
  availableTools: string[];
  lastCall: string | null;
  lastError: string | null;
  requiresBridge: boolean;
};

export type McpActionRow = {
  id: string;
  actionType: string;
  status: string;
  projectName: string | null;
  server: string | null;
  artifactPath: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

const TOOL_HINTS: Record<string, string[]> = {
  figma: ["inspect_file", "read_nodes", "export_assets", "design_tokens"],
  "figma-mcp-go": ["inspect_selection", "read_document", "write_annotations", "export_components"],
  stitch: ["generate_screen", "edit_screen", "apply_design_system"],
  context7: ["resolve_library", "read_docs", "code_examples"],
  github: ["repo_search", "pull_request", "issue_lookup"],
  postman: ["collection_lookup", "api_spec", "request_debug"],
  prisma: ["schema_lookup", "migration_help", "query_context"],
  supabase: ["db_context", "migration_context", "auth_context"],
  "typescript-lsp": ["definition", "references", "diagnostics"],
  "jdtls-lsp": ["java_symbols", "hierarchy", "diagnostics"],
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

export async function getMcpServersWithRuntime(workspaceId: string): Promise<McpServer[]> {
  const [servers, bridgeDevices, auditEvents] = await Promise.all([
    getMcpServers(),
    db.bridgeDevice.findMany({
      where: { workspaceId },
      orderBy: { lastSeenAt: "desc" },
      take: 20,
      select: { lastSeenAt: true },
    }),
    db.auditLog.findMany({
      where: {
        workspaceId,
        OR: [
          { event: { startsWith: "mcp_" } },
          { targetType: "McpServer" },
          { targetType: "McpRegistry" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const hasOnlineBridge = bridgeDevices.some((device) => device.lastSeenAt && Date.now() - device.lastSeenAt.getTime() < 90_000);

  return servers.map((server) => {
    const lastRelatedEvent = auditEvents.find((event) => {
      const metadata = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? event.metadata as Record<string, unknown>
        : {};
      return event.targetId === server.name || metadata.server === server.name || event.targetType === "McpRegistry";
    });
    const lastErrorEvent = auditEvents.find((event) => {
      const metadata = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? event.metadata as Record<string, unknown>
        : {};
      return (event.targetId === server.name || metadata.server === server.name) && (event.event.includes("error") || typeof metadata.error === "string");
    });
    const isLocal = server.type === "stdio";
    const state = isLocal
      ? hasOnlineBridge ? "configured" : "local_required"
      : server.url ? "configured" : "unknown";
    return {
      ...server,
      runtime: {
        state,
        label: isLocal
          ? hasOnlineBridge ? "Configured - local bridge online" : "Local bridge required"
          : server.url ? "Configured HTTP MCP" : "Missing endpoint",
        availableTools: TOOL_HINTS[server.name.toLowerCase()] ?? ["tool_list_unknown"],
        lastCall: lastRelatedEvent ? `${lastRelatedEvent.event} · ${lastRelatedEvent.createdAt.toISOString()}` : null,
        lastError: lastErrorEvent
          ? String((lastErrorEvent.metadata as Record<string, unknown> | null)?.error ?? lastErrorEvent.event)
          : null,
        requiresBridge: isLocal,
      } satisfies McpRuntimeStatus,
    };
  });
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

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const MCP_ACTION_TYPES = ["mcp_design_inspection", "mcp_ui_brief", "mcp_design_implementation", "mcp_visual_review"];

export async function getRecentMcpActions(workspaceId: string): Promise<McpActionRow[]> {
  const actions = await db.bridgeFileAction.findMany({
    where: { workspaceId, type: { in: MCP_ACTION_TYPES } },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: {
      id: true,
      type: true,
      status: true,
      payload: true,
      result: true,
      error: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
    },
  });

  return actions.map((action) => {
    const payload = objectValue(action.payload);
    const result = objectValue(action.result);
    const mcpServer = objectValue(payload.mcpServer);
    return {
      id: action.id,
      actionType: action.type,
      status: action.status,
      projectName: typeof payload.projectName === "string" ? payload.projectName : null,
      server: typeof mcpServer.name === "string" ? mcpServer.name : null,
      artifactPath: typeof result.artifactPath === "string" ? result.artifactPath : null,
      error: action.error ?? (typeof result.error === "string" ? result.error : null),
      createdAt: action.createdAt.toISOString(),
      updatedAt: action.updatedAt.toISOString(),
      completedAt: action.completedAt?.toISOString() ?? null,
    };
  });
}

export function buildMcpAddCommand(server: McpServer): string {
  if (server.type === "http" && server.url) return `claude mcp add --transport http ${server.name} ${server.url}`;
  if (server.type === "stdio" && server.command) {
    const args = server.args?.join(" ") ?? "";
    return `claude mcp add ${server.name} ${server.command}${args ? " " + args : ""}`;
  }
  return `claude mcp add ${server.name}`;
}
