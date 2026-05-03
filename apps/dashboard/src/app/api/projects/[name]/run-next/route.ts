import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const projectName = decodeURIComponent(name);

  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId: user.workspaceId }, { workspaceId: null }] },
    select: { activeTask: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let task = project.activeTask
    ? await db.task.findFirst({
        where: { id: project.activeTask, workspaceId: user.workspaceId, status: { in: ["pending", "in_progress", "blocked"] } },
        select: { id: true, name: true, status: true, phase: true },
      })
    : null;

  if (!task) {
    task = await db.task.findFirst({
      where: {
        workspaceId: user.workspaceId,
        status: { in: ["pending", "in_progress"] },
        feature: { module: { projectName } },
      },
      orderBy: { id: "asc" },
      select: { id: true, name: true, status: true, phase: true },
    });
  }

  return NextResponse.json({ task });
}
