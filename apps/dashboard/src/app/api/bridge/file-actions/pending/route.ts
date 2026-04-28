import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const PendingSchema = z.object({
  deviceKey: z.string().min(1).max(120).optional(),
  limit: z.number().int().min(1).max(10).default(5),
});

export async function POST(req: NextRequest) {
  const ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = PendingSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  let deviceId = ctx.deviceId;
  if (!deviceId && parsed.data.deviceKey) {
    const device = await db.bridgeDevice.findUnique({
      where: { workspaceId_deviceKey: { workspaceId: ctx.workspaceId, deviceKey: parsed.data.deviceKey } },
      select: { id: true },
    });
    deviceId = device?.id ?? null;
  }

  const actions = await db.bridgeFileAction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      status: "pending",
      OR: [{ deviceId: null }, ...(deviceId ? [{ deviceId }] : [])],
    },
    orderBy: { createdAt: "asc" },
    take: parsed.data.limit,
  });

  if (actions.length > 0) {
    await db.bridgeFileAction.updateMany({
      where: { id: { in: actions.map((action) => action.id) }, status: "pending" },
      data: { status: "running", deviceId, claimedAt: new Date() },
    });
  }

  return NextResponse.json({
    actions: actions.map((action) => ({
      id: action.id,
      type: action.type,
      payload: action.payload,
      createdAt: action.createdAt,
    })),
  });
}
