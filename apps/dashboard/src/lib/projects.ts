import "server-only";
import { db } from "@/lib/db";

export type ProjectSummary = {
  name: string;
  frameworks: string[];
  lastIndexed: string | null;
  activeTask: string | null;
  completedTasks: number;
  totalTasks: number;
  progressPercent: number;
};

export type ModuleProgress = {
  id: string;
  name: string;
  completed: number;
  total: number;
  percent: number;
};

export type ProjectDetail = {
  name: string;
  projectPath: string | null;
  frameworks: string[];
  lastIndexed: string | null;
  codeIndexExists: boolean;
  activeTask: string | null;
  completedTasks: number;
  totalTasks: number;
  progressPercent: number;
  modules: ModuleProgress[];
  links: Record<string, string>;
  docs: Record<string, string>;
};

async function countTasks(projectName: string) {
  const [total, completed] = await Promise.all([
    db.task.count({ where: { feature: { module: { projectName } } } }),
    db.task.count({ where: { feature: { module: { projectName } }, status: "completed" } }),
  ]);
  return { total, completed };
}

export async function getActiveProjects(workspaceId?: string): Promise<ProjectSummary[]> {
  const projects = await db.project.findMany({
    where: workspaceId ? { OR: [{ workspaceId }, { workspaceId: null }] } : undefined,
    orderBy: { updatedAt: "desc" },
  });
  return Promise.all(
    projects.map(async (p) => {
      const { total, completed } = await countTasks(p.name);
      return {
        name: p.name,
        frameworks: p.frameworks,
        lastIndexed: p.lastIndexed?.toISOString() ?? null,
        activeTask: p.activeTask,
        completedTasks: completed,
        totalTasks: total,
        progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    })
  );
}

export async function getProjectDetail(name: string, workspaceId?: string): Promise<ProjectDetail | null> {
  const project = await db.project.findUnique({
    where: { name },
    include: {
      modules: {
        include: { features: { include: { tasks: true } } },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!project || (workspaceId && project.workspaceId !== null && project.workspaceId !== workspaceId)) return null;

  // Claim orphaned project (created before workspace was initialised)
  if (workspaceId && project.workspaceId === null) {
    await db.project.update({ where: { name }, data: { workspaceId } }).catch(() => null);
  }

  let totalAll = 0;
  let completedAll = 0;

  const modules: ModuleProgress[] = project.modules.map((mod) => {
    const tasks = mod.features.flatMap((f) => f.tasks);
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    totalAll += total;
    completedAll += completed;
    return {
      id: mod.id,
      name: mod.name,
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  return {
    name: project.name,
    projectPath: project.path,
    frameworks: project.frameworks,
    lastIndexed: project.lastIndexed?.toISOString() ?? null,
    codeIndexExists: !!project.lastIndexed,
    activeTask: project.activeTask,
    completedTasks: completedAll,
    totalTasks: totalAll,
    progressPercent: totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0,
    modules,
    links: (project.links as Record<string, string>) ?? {},
    docs: (project.docs as Record<string, string>) ?? {},
  };
}
