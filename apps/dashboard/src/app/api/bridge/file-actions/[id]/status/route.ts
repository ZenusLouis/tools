import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expireStaleBridgeActions } from "@/lib/bridge-actions";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const HOOK_SECRET = process.env.HOOK_SECRET;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!ctx && HOOK_SECRET && req.headers.get("x-hook-secret") === HOOK_SECRET) {
    const workspace = await db.workspace.findUnique({ where: { slug: "default" }, select: { id: true } });
    if (workspace) ctx = { workspaceId: workspace.id, deviceId: null, tokenId: null };
  }
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await expireStaleBridgeActions(ctx.workspaceId);
  const action = await db.bridgeFileAction.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: {
      id: true,
      status: true,
      error: true,
      updatedAt: true,
      leaseExpiresAt: true,
      heartbeatAt: true,
      cancelRequestedAt: true,
    },
  });
  if (!action) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    id: action.id,
    status: action.status,
    cancelled: action.status === "cancelled" || !!action.cancelRequestedAt,
    error: action.error,
    updatedAt: action.updatedAt,
    heartbeatAt: action.heartbeatAt,
    leaseExpiresAt: action.leaseExpiresAt,
    cancelRequestedAt: action.cancelRequestedAt,
  });
}
