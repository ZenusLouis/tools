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
  projectPaths: z.array(z.object({
    projectName: z.string().min(1).max(200),
    path: z.string().min(1).max(2000),
  })).max(200).default([]),
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

  if (parsed.data.projectPaths.length > 0) {
    const projectNames = [...new Set(parsed.data.projectPaths.map((item) => item.projectName))];
    const projects = await db.project.findMany({
      where: {
        name: { in: projectNames },
        OR: [{ workspaceId: ctx.workspaceId }, { workspaceId: null }],
      },
      select: { name: true, workspaceId: true },
    });
    const validProjectNames = new Set(projects.map((project) => project.name));
    await Promise.all(
      parsed.data.projectPaths
        .filter((item) => validProjectNames.has(item.projectName))
        .map((item) =>
          db.bridgeProjectPath.upsert({
            where: {
              workspaceId_projectName_deviceId: {
                workspaceId: ctx.workspaceId,
                projectName: item.projectName,
                deviceId: device.id,
              },
            },
            create: {
              workspaceId: ctx.workspaceId,
              projectName: item.projectName,
              deviceId: device.id,
              path: item.path,
              lastSyncedAt: new Date(),
            },
            update: {
              path: item.path,
              lastSyncedAt: new Date(),
            },
          })
        )
    );
    const orphanedNames = projects.filter((project) => project.workspaceId === null).map((project) => project.name);
    if (orphanedNames.length > 0) {
      await db.project.updateMany({
        where: { name: { in: orphanedNames }, workspaceId: null },
        data: { workspaceId: ctx.workspaceId },
      });
    }
  }

  return NextResponse.json({ ok: true, deviceId: device.id });
}
