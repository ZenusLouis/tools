import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const projectName = decodeURIComponent(name);

  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId: user.workspaceId }, { workspaceId: null }] },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Delete tasks → features → modules in order (cascade)
  await db.task.deleteMany({ where: { feature: { module: { projectName } }, workspaceId: user.workspaceId } });
  await db.feature.deleteMany({ where: { module: { projectName } } });
  await db.module.deleteMany({ where: { projectName } });
  await db.bridgeFileAction.deleteMany({
    where: {
      workspaceId: user.workspaceId,
      type: "run_analysis",
      payload: { path: ["projectName"], equals: projectName },
    },
  });
  await db.project.update({ where: { name: projectName }, data: { activeTask: null } });

  revalidatePath(`/projects/${encodeURIComponent(projectName)}`);
  revalidatePath("/tasks");
  return NextResponse.json({ ok: true });
}
