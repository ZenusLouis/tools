import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";
import { sanitizeJson, sanitizeText } from "@/lib/sanitize";

const ArtifactSchema = z.object({
  project: z.string().min(1),
  taskId: z.string().min(1),
  kind: z.enum(["brief", "implementation", "review"]),
  path: z.string().min(1),
  content: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = ArtifactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const field =
    parsed.data.kind === "brief"
      ? "analysisBriefPath"
      : parsed.data.kind === "implementation"
        ? "implementationLogPath"
        : "reviewPath";

  await db.task.updateMany({
    where: { id: parsed.data.taskId, workspaceId: ctx.workspaceId },
    data: { [field]: parsed.data.path },
  });

  await db.session.create({
    data: {
      workspaceId: ctx.workspaceId,
      deviceId: ctx.deviceId,
      provider: parsed.data.kind === "implementation" ? "codex" : "claude",
      role: parsed.data.kind,
      type: "artifact",
      project: parsed.data.project,
      date: new Date(),
      tasksCompleted: [],
      sessionNotes: sanitizeText(`Artifact synced: ${parsed.data.kind} -> ${parsed.data.path}`),
      filesChanged: {
        artifact: sanitizeJson({
          project: parsed.data.project,
          taskId: parsed.data.taskId,
          kind: parsed.data.kind,
          path: parsed.data.path,
          contentLength: parsed.data.content?.length ?? 0,
        }),
      },
    },
  });

  await db.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorType: "bridge",
      event: "local_file_artifact_synced",
      targetType: "Task",
      targetId: parsed.data.taskId,
      metadata: sanitizeJson({
        project: parsed.data.project,
        kind: parsed.data.kind,
        path: sanitizeText(parsed.data.path),
        contentLength: parsed.data.content?.length ?? 0,
        deviceId: ctx.deviceId,
      }),
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
