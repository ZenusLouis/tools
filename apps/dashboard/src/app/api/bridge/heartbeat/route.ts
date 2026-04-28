import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";
import { getCurrentUser } from "@/lib/auth";

const HeartbeatSchema = z.object({
  deviceKey: z.string().min(1).max(120),
  name: z.string().min(1).max(120).optional(),
  claudeAvailable: z.boolean().default(false),
  codexAvailable: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: NextRequest) {
  let ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));

  // Fallback: allow session-authenticated browser heartbeats
  if (!ctx) {
    const user = await getCurrentUser();
    if (user) ctx = { workspaceId: user.workspaceId, deviceId: null, tokenId: null };
  }

  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = HeartbeatSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const metadata = parsed.data.metadata as Prisma.InputJsonValue;
  const device = await db.bridgeDevice.upsert({
    where: { workspaceId_deviceKey: { workspaceId: ctx.workspaceId, deviceKey: parsed.data.deviceKey } },
    create: {
      workspaceId: ctx.workspaceId,
      deviceKey: parsed.data.deviceKey,
      name: parsed.data.name ?? parsed.data.deviceKey,
      claudeAvailable: parsed.data.claudeAvailable,
      codexAvailable: parsed.data.codexAvailable,
      metadata,
      lastSeenAt: new Date(),
    },
    update: {
      name: parsed.data.name ?? parsed.data.deviceKey,
      claudeAvailable: parsed.data.claudeAvailable,
      codexAvailable: parsed.data.codexAvailable,
      metadata,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, deviceId: device.id });
}
