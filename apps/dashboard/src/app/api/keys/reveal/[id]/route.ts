import { NextRequest, NextResponse } from "next/server";
import { getApiKeyById } from "@/lib/api-keys";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await params;
    const value = await getApiKeyById(id, user.workspaceId);
    if (!value) return NextResponse.json({ error: "API key not found" }, { status: 404 });
    await db.auditLog.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        actorType: "user",
        event: "api_key_revealed",
        targetType: "ApiKey",
        targetId: id,
      },
    }).catch(() => null);
    return NextResponse.json({ value });
  } catch (e) {
    const msg = String(e);
    const status = msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
