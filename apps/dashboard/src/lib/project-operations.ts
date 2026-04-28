import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

type ProjectWithLatestPath = {
  name: string;
  workspaceId: string | null;
  path: string | null;
  bridgePaths: { path: string }[];
};

async function loadProjectForOperation(projectName: string, workspaceId: string): Promise<ProjectWithLatestPath | null> {
  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId }, { workspaceId: null }] },
    include: { bridgePaths: { orderBy: { updatedAt: "desc" }, take: 1 } },
  });

  if (!project) return null;

  if (!project.workspaceId) {
    await db.project.update({ where: { name: projectName }, data: { workspaceId } }).catch(() => null);
  }

  return project;
}

function revalidateProject(projectName: string) {
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${encodeURIComponent(projectName)}`);
  revalidatePath(`/projects/${encodeURIComponent(projectName)}/detail`);
}

export async function recordReindexProject(projectName: string, workspaceId: string): Promise<{ ok: boolean; error?: string }> {
  const project = await loadProjectForOperation(projectName, workspaceId);
  if (!project) return { ok: false, error: "Project not found" };

  const now = new Date();
  const projectPath = project.bridgePaths[0]?.path ?? project.path;
  await db.project.update({
    where: { name: projectName },
    data: { lastIndexed: now },
  });
  await db.session.create({
    data: {
      workspaceId,
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

  revalidateProject(projectName);
  return { ok: true };
}

export async function recordDeployProject(projectName: string, workspaceId: string): Promise<{ ok: boolean; error?: string }> {
  const project = await loadProjectForOperation(projectName, workspaceId);
  if (!project) return { ok: false, error: "Project not found" };

  const now = new Date();
  const projectPath = project.bridgePaths[0]?.path ?? project.path;
  await db.session.create({
    data: {
      workspaceId,
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

  revalidateProject(projectName);
  return { ok: true };
}
