import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { exportObsidianVault } from "@/lib/obsidian-export";

export async function POST() {
  const user = await requireCurrentUser();
  const result = await exportObsidianVault(user.workspaceId);

  await db.auditLog.create({
    data: {
      workspaceId: user.workspaceId,
      userId: user.id,
      actorType: "user",
      event: "obsidian_vault_exported",
      targetType: "Workspace",
      targetId: user.workspaceId,
      metadata: result,
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true, result });
}
