import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stitchGenerateScreen, stitchCreateProject } from "@/lib/stitch-mcp-client";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;

  const task = await db.designTask.findFirst({
    where: { id, workspaceId: user.workspaceId },
  });
  if (!task) return NextResponse.json({ error: "Design task not found" }, { status: 404 });
  if (task.status === "running") return NextResponse.json({ error: "Already running" }, { status: 409 });

  // Ensure Stitch project exists — stored in project.links.stitch
  const project = await db.project.findFirst({
    where: { name: task.projectName, OR: [{ workspaceId: user.workspaceId }, { workspaceId: null }] },
    select: { name: true, links: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let stitchProjectId = task.stitchProjectId;
  if (!stitchProjectId) {
    const links = project.links as Record<string, string> | null;
    stitchProjectId = links?.stitchProjectId ?? null;
  }

  await db.designTask.update({ where: { id }, data: { status: "running" } });

  try {
    // Auto-create Stitch project if needed
    if (!stitchProjectId) {
      stitchProjectId = await stitchCreateProject(`${task.projectName} — GCS Design`, user.workspaceId);
      await db.project.update({
        where: { name: task.projectName },
        data: { links: { ...(project.links as object ?? {}), stitchProjectId } },
      });
    }

    const result = await stitchGenerateScreen({
      projectId: stitchProjectId,
      prompt: task.prompt,
      deviceType: "DESKTOP",
      workspaceId: user.workspaceId,
    });

    await db.designTask.update({
      where: { id },
      data: {
        status: "done",
        stitchProjectId,
        stitchScreenId: result.screenId || null,
        outputUrl: result.outputUrl || null,
      },
    });

    return NextResponse.json({ ok: true, outputUrl: result.outputUrl, screenId: result.screenId });
  } catch (err) {
    await db.designTask.update({
      where: { id },
      data: { status: "failed", stitchProjectId },
    });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
