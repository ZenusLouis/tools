import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { refreshMemoryGraph } from "@/lib/memory-sync";

export async function POST() {
  const user = await requireCurrentUser();
  const result = await refreshMemoryGraph(user.workspaceId);

  await db.auditLog.create({
    data: {
      workspaceId: user.workspaceId,
      userId: user.id,
      actorType: "user",
      event: "memory_graph_refreshed",
      targetType: "Workspace",
      targetId: user.workspaceId,
      metadata: result,
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true, result, routingTokens: 0 });
}
