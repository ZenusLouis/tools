import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachSnapshotHash, buildProjectSnapshot } from "@/lib/snapshots";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const projectName = decodeURIComponent(name);
  const rawSnapshot = await buildProjectSnapshot(user.workspaceId, projectName);
  if (!rawSnapshot) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const snapshot = attachSnapshotHash(rawSnapshot);
  await db.snapshotExport.create({
    data: {
      workspaceId: user.workspaceId,
      projectName,
      kind: "project",
      schemaVersion: snapshot.schemaVersion,
      snapshotVersion: snapshot.snapshotVersion,
      hash: snapshot.hash,
      status: "exported",
      metadata: { hash: snapshot.hash, exportedAt: snapshot.exportedAt },
    },
  });
  await db.auditLog.create({
    data: {
      workspaceId: user.workspaceId,
      userId: user.id,
      actorType: "user",
      event: "project_snapshot_exported",
      targetType: "Project",
      targetId: projectName,
      metadata: { hash: snapshot.hash },
    },
  }).catch(() => null);
  return NextResponse.json(snapshot);
}
