"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";

export async function reindexProject(projectName: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireCurrentUser();
  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId: user.workspaceId }, { workspaceId: null }] },
    include: { bridgePaths: { orderBy: { updatedAt: "desc" }, take: 1 } },
  });
  if (!project) return { ok: false, error: "Project not found" };
  if (!project.workspaceId) {
    await db.project.update({ where: { name: projectName }, data: { workspaceId: user.workspaceId } }).catch(() => null);
  }

  const now = new Date();
  const projectPath = project.bridgePaths[0]?.path ?? project.path;
  await db.project.update({
    where: { name: projectName },
    data: { lastIndexed: now },
  });
  await db.session.create({
    data: {
      workspaceId: user.workspaceId,
      provider: "codex",
      role: "project-indexer",
      type: "project-event",
      project: projectName,
      date: now,
      tasksCompleted: [],
      sessionNotes: "Project reindexed from dashboard",
      cwd: projectPath,
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectName}`);
  revalidatePath(`/projects/${projectName}/detail`);
  return { ok: true };
}

export async function deployProject(projectName: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireCurrentUser();
  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId: user.workspaceId }, { workspaceId: null }] },
    include: { bridgePaths: { orderBy: { updatedAt: "desc" }, take: 1 } },
  });
  if (!project) return { ok: false, error: "Project not found" };
  if (!project.workspaceId) {
    await db.project.update({ where: { name: projectName }, data: { workspaceId: user.workspaceId } }).catch(() => null);
  }

  const now = new Date();
  const projectPath = project.bridgePaths[0]?.path ?? project.path;
  await db.session.create({
    data: {
      workspaceId: user.workspaceId,
      provider: "claude",
      role: "deployment-orchestrator",
      type: "project-event",
      project: projectName,
      date: now,
      tasksCompleted: [],
      sessionNotes: "Deploy requested from dashboard",
      cwd: projectPath,
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectName}`);
  revalidatePath(`/projects/${projectName}/detail`);
  return { ok: true };
}
