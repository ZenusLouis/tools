import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachSnapshotHash, buildWorkspaceSnapshot } from "@/lib/snapshots";

export async function GET() {
  const user = await requireCurrentUser();
  const snapshot = attachSnapshotHash(await buildWorkspaceSnapshot(user.workspaceId));

  await db.snapshotExport.create({
    data: {
      workspaceId: user.workspaceId,
      kind: "workspace",
      schemaVersion: snapshot.schemaVersion,
      snapshotVersion: snapshot.snapshotVersion,
      hash: snapshot.hash,
      status: "exported",
      metadata: {
        hash: snapshot.hash,
        exportedAt: snapshot.exportedAt,
        projectCount: snapshot.projects.length,
        roleCount: snapshot.roles.length,
        skillCount: snapshot.skills.length,
      },
    },
  });

  await db.auditLog.create({
    data: {
      workspaceId: user.workspaceId,
      userId: user.id,
      actorType: "user",
      event: "workspace_snapshot_exported",
      targetType: "Workspace",
      targetId: user.workspaceId,
      metadata: { hash: snapshot.hash },
    },
  }).catch(() => null);

  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gcs-workspace-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
