import "server-only";
import { getApiKeyByService } from "@/lib/api-keys";

const STITCH_MCP_URL = "https://stitch.googleapis.com/mcp";

type McpResponse<T = unknown> = { result?: T; error?: { code: number; message: string } };

async function resolveApiKey(workspaceId?: string): Promise<string> {
  if (workspaceId) {
    const key = await getApiKeyByService("google", workspaceId);
    if (key) return key;
  }
  return process.env.STITCH_API_KEY ?? "";
}

async function mcpPost<T = unknown>(
  method: string,
  params: Record<string, unknown>,
  sessionId?: string,
  timeout = 300_000,
  apiKey = "",
): Promise<{ data: T; sessionId?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "X-Goog-Api-Key": apiKey,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(STITCH_MCP_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`Stitch MCP error ${res.status}: ${text.slice(0, 300)}`);
    }

    const newSession = res.headers.get("Mcp-Session-Id") ?? sessionId;
    const contentType = res.headers.get("Content-Type") ?? "";

    let body: McpResponse<T>;
    if (contentType.includes("text/event-stream")) {
      // SSE: collect last data event
      const text = await res.text();
      const lines = text.split("\n").filter((l) => l.startsWith("data: "));
      const last = lines.at(-1)?.slice(6) ?? "{}";
      body = JSON.parse(last) as McpResponse<T>;
    } else {
      body = await res.json() as McpResponse<T>;
    }

    if (body.error) throw new Error(`Stitch MCP error: ${body.error.message}`);
    return { data: body.result as T, sessionId: newSession ?? undefined };
  } finally {
    clearTimeout(timer);
  }
}

async function initSession(apiKey: string): Promise<string> {
  const { sessionId } = await mcpPost(
    "initialize",
    {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "gcs-dashboard", version: "1.0" },
    },
    undefined,
    10_000,
    apiKey,
  );
  if (!sessionId) throw new Error("Stitch MCP did not return a session ID");
  return sessionId;
}

type ToolCallResult = { content?: Array<{ type: string; text?: string }> };

export async function stitchGenerateScreen(params: {
  projectId: string;
  prompt: string;
  deviceType?: "DESKTOP" | "MOBILE" | "TABLET";
  workspaceId?: string;
}): Promise<{ screenId: string; outputUrl?: string; raw: unknown }> {
  const apiKey = await resolveApiKey(params.workspaceId);
  if (!apiKey) throw new Error("Stitch/Google API key not configured. Add it in Settings → API Keys.");
  const sessionId = await initSession(apiKey);

  const { data } = await mcpPost<ToolCallResult>(
    "tools/call",
    {
      name: "generate_screen_from_text",
      arguments: {
        projectId: params.projectId,
        prompt: params.prompt,
        deviceType: params.deviceType ?? "DESKTOP",
        modelId: "GEMINI_3_1_PRO",
      },
    },
    sessionId,
    300_000,
    apiKey,
  );

  const text = data?.content?.find((c) => c.type === "text")?.text ?? "";
  // Stitch returns screen info in text; extract screen ID
  const screenMatch = text.match(/screens\/([a-zA-Z0-9_-]+)/);
  const screenId = screenMatch?.[1] ?? "";

  // Build output URL from project + screen
  const outputUrl = screenId
    ? `https://stitch.withgoogle.com/view/${params.projectId}/screens/${screenId}`
    : undefined;

  return { screenId, outputUrl, raw: data };
}

export async function stitchGetScreen(params: {
  projectId: string;
  screenId: string;
  workspaceId?: string;
}): Promise<{ status: string; outputUrl?: string; raw: unknown }> {
  const apiKey = await resolveApiKey(params.workspaceId);
  const sessionId = await initSession(apiKey);

  const { data } = await mcpPost<ToolCallResult>(
    "tools/call",
    { name: "get_screen", arguments: { name: `projects/${params.projectId}/screens/${params.screenId}` } },
    sessionId,
    30_000,
    apiKey,
  );

  const text = data?.content?.find((c) => c.type === "text")?.text ?? "";
  const outputUrl = `https://stitch.withgoogle.com/view/${params.projectId}/screens/${params.screenId}`;
  return { status: text.includes("FAILED") ? "failed" : "done", outputUrl, raw: data };
}

export async function stitchCreateProject(projectName: string, workspaceId?: string): Promise<string> {
  const apiKey = await resolveApiKey(workspaceId);
  const sessionId = await initSession(apiKey);

  const { data } = await mcpPost<ToolCallResult>(
    "tools/call",
    { name: "create_project", arguments: { displayName: projectName } },
    sessionId,
    30_000,
    apiKey,
  );

  const text = data?.content?.find((c) => c.type === "text")?.text ?? "";
  const match = text.match(/projects\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error("Could not extract project ID from Stitch response");
  return match[1];
}
