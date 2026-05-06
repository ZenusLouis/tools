import { NextRequest, NextResponse } from "next/server";
import { listApiKeys, createApiKey } from "@/lib/api-keys";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  service: z.string().min(1).max(50),
  value: z.string().min(1),
});

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const keys = await listApiKeys(user.workspaceId);
    return NextResponse.json(keys);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await requireCurrentUser();
    const { name, service, value } = CreateSchema.parse(body);
    const key = await createApiKey(name, service, value, user.workspaceId);
    await db.auditLog.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        actorType: "user",
        event: "api_key_created",
        targetType: "ApiKey",
        targetId: key.id,
        metadata: { name: key.name, service: key.service },
      },
    }).catch(() => null);
    return NextResponse.json(key, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const key = await db.apiKey.findFirst({
      where: { id, workspaceId: user.workspaceId },
      select: { id: true, name: true, service: true },
    });
    if (!key) return NextResponse.json({ error: "API key not found" }, { status: 404 });
    await db.apiKey.delete({ where: { id: key.id } });
    await db.auditLog.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        actorType: "user",
        event: "api_key_deleted",
        targetType: "ApiKey",
        targetId: key.id,
        metadata: { name: key.name, service: key.service },
      },
    }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
