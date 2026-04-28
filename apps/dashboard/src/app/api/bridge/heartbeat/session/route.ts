import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // DeviceKey tied to the user account — stable across browser sessions
  const deviceKey = `user-${user.id}`;
  const metadata: Prisma.InputJsonValue = { source: "browser-session", userId: user.id };

  const device = await db.bridgeDevice.upsert({
    where: { workspaceId_deviceKey: { workspaceId: user.workspaceId, deviceKey } },
    create: {
      workspaceId: user.workspaceId,
      deviceKey,
      name: user.name ?? user.email,
      claudeAvailable: true,
      codexAvailable: false,
      metadata,
      lastSeenAt: new Date(),
    },
    update: {
      lastSeenAt: new Date(),
      metadata,
    },
  });

  return NextResponse.json({ ok: true, deviceId: device.id });
}
