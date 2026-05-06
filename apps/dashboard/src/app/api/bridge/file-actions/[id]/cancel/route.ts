import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeBridgeResult } from "@/lib/bridge-actions";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const HOOK_SECRET = process.env.HOOK_SECRET;

async function context(req: NextRequest) {
  let ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!ctx && HOOK_SECRET && req.headers.get("x-hook-secret") === HOOK_SECRET) {
    const ws = await db.workspace.findUnique({ where: { slug: "default" }, select: { id: true } });
    if (ws) ctx = { workspaceId: ws.id, deviceId: null, tokenId: null };
  }
  return ctx;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await context(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const action = await db.bridgeFileAction.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, result: true, status: true },
  });
  if (!action) return NextResponse.json({ error: "not found" }, { status: 404 });
  const now = new Date();
  await db.bridgeFileAction.update({
    where: { id },
    data: {
      cancelRequestedAt: now,
      status: ["pending", "claimed"].includes(action.status) ? "cancelled" : action.status,
      completedAt: action.status === "pending" || action.status === "claimed" ? now : undefined,
      result: normalizeBridgeResult(action.result, {
        log: ["Cancellation requested."],
      }, ["pending", "claimed"].includes(action.status) ? "cancelled" : action.status, { cancelRequestedAt: now.toISOString() }),
    },
  });
  await db.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actionId: id,
      actorType: "bridge",
      event: "bridge_action_cancel_requested",
      targetType: "BridgeFileAction",
      targetId: id,
      metadata: { previousStatus: action.status },
    },
  }).catch(() => null);
  return NextResponse.json({ ok: true, cancelled: true });
}
