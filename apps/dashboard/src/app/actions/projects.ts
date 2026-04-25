"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";

export async function reindexProject(projectName: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireCurrentUser();
  const project = await db.project.findUnique({ where: { name: projectName } });
  if (!project || project.workspaceId !== user.workspaceId) return { ok: false, error: "Project not found" };

  const now = new Date();
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
      cwd: project.path,
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
  const project = await db.project.findUnique({ where: { name: projectName } });
  if (!project || project.workspaceId !== user.workspaceId) return { ok: false, error: "Project not found" };

  const now = new Date();
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
      cwd: project.path,
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectName}`);
  revalidatePath(`/projects/${projectName}/detail`);
  return { ok: true };
}
