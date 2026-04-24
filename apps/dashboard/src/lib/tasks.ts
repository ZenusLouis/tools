import "server-only";
import { db } from "@/lib/db";

export type TaskStatus = "pending" | "in-progress" | "completed" | "blocked";

export type KanbanTask = {
  id: string;
  name: string;
  status: TaskStatus;
  featureId: string;
  featureName: string;
  estimate: string;
  deps: string[];
  gates: ("G3" | "G4")[];
};

export type ModuleProgress = {
  id: string;
  name: string;
  completed: number;
  total: number;
  percent: number;
};

export type ProjectOption = { name: string };
export type ModuleOption = { id: string; name: string };

function dbStatusToKanban(status: string): TaskStatus {
  if (status === "in_progress") return "in-progress";
  return status as TaskStatus;
}

export async function getProjectOptions(): Promise<ProjectOption[]> {
  return db.project.findMany({ select: { name: true }, orderBy: { name: "asc" } });
}

export async function getModuleOptions(projectName: string): Promise<ModuleOption[]> {
  return db.module.findMany({
    where: { projectName },
    select: { id: true, name: true },
    orderBy: { order: "asc" },
  });
}

export async function getCompletedTaskIds(projectName: string): Promise<Set<string>> {
  const tasks = await db.task.findMany({
    where: { status: "completed", feature: { module: { projectName } } },
    select: { id: true },
  });
  return new Set(tasks.map((t) => t.id));
}

export async function getModuleTasks(projectName: string, moduleId: string): Promise<KanbanTask[]> {
  const features = await db.feature.findMany({
    where: { moduleId },
    include: { tasks: { orderBy: { id: "asc" } } },
    orderBy: { order: "asc" },
  });

  return features.flatMap((feature) =>
    feature.tasks.map((task, idx) => {
      const gates: ("G3" | "G4")[] = [];
      if (idx === 0) gates.push("G3");
      if (task.status === "completed") gates.push("G4");
      return {
        id: task.id,
        name: task.name,
        status: dbStatusToKanban(task.status),
        featureId: feature.id,
        featureName: feature.name,
        estimate: task.estimate ?? "",
        deps: task.deps,
        gates,
      };
    })
  );
}

export async function getModuleProgress(projectName: string, moduleId: string): Promise<ModuleProgress | null> {
  const mod = await db.module.findUnique({
    where: { id: moduleId },
    include: { features: { include: { tasks: true } } },
  });
  if (!mod || mod.projectName !== projectName) return null;

  const tasks = mod.features.flatMap((f) => f.tasks);
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;

  return { id: mod.id, name: mod.name, completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}
