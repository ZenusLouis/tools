import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeBridgeResult, telemetryFromActionResult } from "@/lib/bridge-actions";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";
import { sanitizeText } from "@/lib/sanitize";

const ResultSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["succeeded", "failed", "cancelled", "expired"]),
  deviceKey: z.string().min(1).max(120).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(4000).optional(),
});

const HOOK_SECRET = process.env.HOOK_SECRET;
const MCP_ACTION_TYPES = new Set(["mcp_design_inspection", "mcp_ui_brief", "mcp_design_implementation", "mcp_visual_review"]);

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(req: NextRequest) {
  let ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!ctx && HOOK_SECRET) {
    if (req.headers.get("x-hook-secret") === HOOK_SECRET) {
      const workspace = await db.workspace.findUnique({ where: { slug: "default" }, select: { id: true } });
      if (workspace) ctx = { workspaceId: workspace.id, deviceId: null, tokenId: null };
    }
  }
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = ResultSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  let deviceId = ctx.deviceId;
  if (!deviceId && parsed.data.deviceKey) {
    const device = await db.bridgeDevice.findUnique({
      where: { workspaceId_deviceKey: { workspaceId: ctx.workspaceId, deviceKey: parsed.data.deviceKey } },
      select: { id: true },
    });
    deviceId = device?.id ?? null;
  }

  const action = await db.bridgeFileAction.findFirst({
    where: { id: parsed.data.id, workspaceId: ctx.workspaceId },
    select: { id: true, type: true, payload: true, result: true, status: true, claimedAt: true, createdAt: true },
  });
  if (!action) return NextResponse.json({ error: "Action not found" }, { status: 404 });
  if (action.status === "cancelled" && parsed.data.status !== "cancelled") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const incomingResult = parsed.data.result ?? {};
  const completedAt = new Date();
  const sanitizedError = parsed.data.error ? sanitizeText(parsed.data.error) : null;
  const nextResult = normalizeBridgeResult(action.result, incomingResult, parsed.data.status, {
    actionType: action.type,
    completedAt: completedAt.toISOString(),
  }) as Prisma.InputJsonValue;

  await db.bridgeFileAction.update({
    where: { id: action.id },
    data: {
      status: parsed.data.status,
      resultVersion: 1,
      result: nextResult,
      error: sanitizedError,
      deviceId,
      completedAt,
      heartbeatAt: completedAt,
      leaseExpiresAt: null,
    },
  });
  await db.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actionId: action.id,
      actorType: "bridge",
      event: `bridge_action_${parsed.data.status}`,
      targetType: "BridgeFileAction",
      targetId: action.id,
      metadata: { type: action.type, deviceId },
    },
  }).catch(() => null);

  const resultObject = nextResult as Record<string, unknown>;

  if (MCP_ACTION_TYPES.has(action.type)) {
    const payload = objectValue(action.payload);
    const mcpServer = objectValue(payload.mcpServer);
    await db.auditLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        actionId: action.id,
        actorType: "bridge",
        event: parsed.data.status === "succeeded" ? "mcp_action_completed" : "mcp_action_failed",
        targetType: "McpServer",
        targetId: typeof mcpServer.name === "string" ? mcpServer.name : null,
        metadata: {
          type: action.type,
          projectName: typeof payload.projectName === "string" ? payload.projectName : null,
          server: typeof mcpServer.name === "string" ? mcpServer.name : null,
          status: parsed.data.status,
          artifactPath: typeof resultObject.artifactPath === "string" ? resultObject.artifactPath : null,
          error: sanitizedError,
        },
      },
    }).catch(() => null);
  }

  if (action.type === "run_task") {
    const telemetry = telemetryFromActionResult({
      workspaceId: ctx.workspaceId,
      actionId: action.id,
      type: action.type,
      payload: action.payload,
      result: resultObject,
      status: parsed.data.status,
      error: sanitizedError,
      startedAt: action.claimedAt ?? action.createdAt,
      completedAt,
    });
    await db.runTelemetry.create({ data: telemetry }).catch(() => null);
  }

  if (parsed.data.status === "succeeded" && action.type === "sync_project_metadata" && deviceId) {
    const payload = action.payload;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const data = payload as Record<string, unknown>;
      const projectName = typeof data.projectName === "string" ? data.projectName : "";
      const projectPath = typeof data.projectPath === "string" ? data.projectPath : "";
      if (projectName && projectPath) {
        await db.bridgeProjectPath.upsert({
          where: {
            workspaceId_projectName_deviceId: {
              workspaceId: ctx.workspaceId,
              projectName,
              deviceId,
            },
          },
          create: {
            workspaceId: ctx.workspaceId,
            projectName,
            deviceId,
            path: projectPath,
            lastSyncedAt: new Date(),
          },
          update: {
            path: projectPath,
            lastSyncedAt: new Date(),
          },
        });
        await db.bridgeProjectPath.deleteMany({
          where: {
            workspaceId: ctx.workspaceId,
            projectName,
            path: projectPath,
            deviceId: { not: deviceId },
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
