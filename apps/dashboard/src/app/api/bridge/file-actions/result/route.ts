import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const ResultSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["succeeded", "failed"]),
  deviceKey: z.string().min(1).max(120).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(4000).optional(),
});

const HOOK_SECRET = process.env.HOOK_SECRET;

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
    select: { id: true, type: true, payload: true },
  });
  if (!action) return NextResponse.json({ error: "Action not found" }, { status: 404 });

  await db.bridgeFileAction.update({
    where: { id: action.id },
    data: {
      status: parsed.data.status,
      result: (parsed.data.result ?? {}) as Prisma.InputJsonValue,
      error: parsed.data.error ?? null,
      deviceId,
      completedAt: new Date(),
    },
  });

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
      }
    }
  }

  return NextResponse.json({ ok: true });
}
