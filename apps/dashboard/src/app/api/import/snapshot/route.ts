import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { importDbSnapshot } from "@/lib/snapshot-import";

export async function POST(req: Request) {
  const user = await requireCurrentUser();
  const body = await req.json().catch(() => ({})) as { snapshot?: unknown };
  if (!body.snapshot) return NextResponse.json({ ok: false, error: "snapshot is required" }, { status: 400 });

  const job = await db.importJob.create({
    data: {
      workspaceId: user.workspaceId,
      sourceType: "db-snapshot",
      sourcePath: "uploaded-json",
      status: "running",
      conflictPolicy: "snapshot_replaces_project_backlog",
      summary: {},
    },
  });

  try {
    const result = await importDbSnapshot(db, user.workspaceId, body.snapshot);
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "succeeded",
        summary: result.summary,
      },
    });
    await db.auditLog.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        actorType: "user",
        event: "db_snapshot_imported",
        targetType: "Workspace",
        targetId: user.workspaceId,
        metadata: { jobId: job.id, summary: result.summary, hash: result.hash },
      },
    }).catch(() => null);
    return NextResponse.json({ ok: true, jobId: job.id, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: message,
      },
    });
    await db.auditLog.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        actorType: "user",
        event: "db_snapshot_import_failed",
        targetType: "Workspace",
        targetId: user.workspaceId,
        metadata: { jobId: job.id, error: message },
      },
    }).catch(() => null);
    return NextResponse.json({ ok: false, jobId: job.id, error: message }, { status: 500 });
  }
}
