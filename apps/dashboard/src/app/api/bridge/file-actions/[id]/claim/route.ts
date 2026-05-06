import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createClaimToken, expireStaleBridgeActions, leaseDate } from "@/lib/bridge-actions";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const HOOK_SECRET = process.env.HOOK_SECRET;

const ClaimSchema = z.object({
  deviceKey: z.string().min(1).max(120).optional(),
});

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
  const parsed = ClaimSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  await expireStaleBridgeActions(ctx.workspaceId);

  let deviceId = ctx.deviceId;
  if (!deviceId && parsed.data.deviceKey) {
    const device = await db.bridgeDevice.findUnique({
      where: { workspaceId_deviceKey: { workspaceId: ctx.workspaceId, deviceKey: parsed.data.deviceKey } },
      select: { id: true },
    });
    deviceId = device?.id ?? null;
  }

  const claimToken = createClaimToken();
  const now = new Date();
  const leaseExpiresAt = leaseDate();
  const action = await db.bridgeFileAction.updateMany({
    where: {
      id,
      workspaceId: ctx.workspaceId,
      status: "pending",
      OR: [{ deviceId: null }, ...(deviceId ? [{ deviceId }] : [])],
    },
    data: {
      status: "claimed",
      deviceId,
      claimToken,
      claimedAt: now,
      heartbeatAt: now,
      leaseExpiresAt,
      attempt: { increment: 1 },
    },
  });
  if (action.count === 0) return NextResponse.json({ error: "Action is not claimable" }, { status: 409 });
  await db.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actionId: id,
      actorType: "bridge",
      event: "bridge_action_claimed",
      targetType: "BridgeFileAction",
      targetId: id,
      metadata: { deviceId, leaseExpiresAt },
    },
  }).catch(() => null);
  return NextResponse.json({ ok: true, claimToken, leaseExpiresAt });
}
