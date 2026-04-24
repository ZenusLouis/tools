import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createBridgeTokenValue, hashBridgeToken } from "@/lib/bridge-auth";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  deviceId: z.string().optional(),
});

export async function GET() {
  const user = await requireCurrentUser();
  const [tokens, devices] = await Promise.all([
    db.bridgeToken.findMany({
      where: { workspaceId: user.workspaceId },
      include: { device: true },
      orderBy: { createdAt: "desc" },
    }),
    db.bridgeDevice.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { lastSeenAt: "desc" } }),
  ]);
  return NextResponse.json({ tokens, devices });
}

export async function POST(req: NextRequest) {
  const user = await requireCurrentUser();
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const rawToken = createBridgeTokenValue();
  const token = await db.bridgeToken.create({
    data: {
      workspaceId: user.workspaceId,
      deviceId: parsed.data.deviceId,
      name: parsed.data.name,
      tokenHash: hashBridgeToken(rawToken),
    },
  });
  return NextResponse.json({ token, rawToken }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await requireCurrentUser();
  const { id } = await req.json().catch(() => ({ id: "" }));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.bridgeToken.updateMany({
    where: { id, workspaceId: user.workspaceId },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

