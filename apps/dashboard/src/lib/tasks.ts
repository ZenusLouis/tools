import "server-only";
import { db } from "@/lib/db";

export type TaskStatus = "pending" | "in-progress" | "completed" | "blocked";

export type KanbanTask = {
  id: string;
  name: string;
  status: TaskStatus;
  phase: string;
  featureId: string;
  featureName: string;
  estimate: string;
  deps: string[];
  gates: ("G3" | "G4")[];
  baRoleName?: string;
  devRoleName?: string;
  reviewRoleName?: string;
};

export type ModuleProgress = {
  id: string;
  name: string;
  completed: number;
  total: number;
  percent: number;
};
export type TaskPageInfo = { page: number; pageSize: number; total: number; totalPages: number; showAll?: boolean };
export type TaskPagination = Record<TaskStatus, TaskPageInfo>;

export type ProjectOption = { name: string };
export type ModuleOption = { id: string; name: string };

function dbStatusToKanban(status: string): TaskStatus {
  if (status === "in_progress") return "in-progress";
  return status as TaskStatus;
}

function kanbanStatusToDb(status: TaskStatus) {
  return status === "in-progress" ? "in_progress" : status;
}

export async function getProjectOptions(workspaceId?: string): Promise<ProjectOption[]> {
  return db.project.findMany({ where: workspaceId ? { workspaceId } : undefined, select: { name: true }, orderBy: { name: "asc" } });
}

export async function getModuleOptions(projectName: string): Promise<ModuleOption[]> {
  return db.module.findMany({
    where: { projectName },
    select: { id: true, name: true },
    orderBy: { order: "asc" },
  });
}

export async function getCompletedTaskIds(projectName: string, workspaceId?: string): Promise<Set<string>> {
  const tasks = await db.task.findMany({
    where: { status: "completed", ...(workspaceId ? { workspaceId } : {}), feature: { module: { projectName } } },
    select: { id: true },
  });
  return new Set(tasks.map((t) => t.id));
}

export async function getModuleTasks(
  projectName: string,
  moduleId: string,
  workspaceId?: string,
  pagination?: { pageSize: number; pageByStatus: Partial<Record<TaskStatus, number>>; showAllByStatus?: Partial<Record<TaskStatus, boolean>> },
): Promise<KanbanTask[]> {
  if (pagination) {
    const statuses: TaskStatus[] = ["pending", "in-progress", "completed", "blocked"];
    const rows = await Promise.all(statuses.map((status) => {
      const showAll = pagination.showAllByStatus?.[status] ?? false;
      const page = Math.max(1, pagination.pageByStatus[status] ?? 1);
      return db.task.findMany({
        where: {
          status: kanbanStatusToDb(status),
          ...(workspaceId ? { workspaceId } : {}),
          feature: { module: { projectName, ...(moduleId !== "all" ? { id: moduleId } : {}) } },
        },
        include: { feature: true, baRole: true, devRole: true, reviewRole: true },
        orderBy: { id: "asc" },
        ...(showAll ? {} : { skip: (page - 1) * pagination.pageSize, take: pagination.pageSize }),
      });
    }));
    return rows.flat().map((task) => {
      const gates: ("G3" | "G4")[] = task.status === "completed" ? ["G4"] : [];
      return {
        id: task.id,
        name: task.name,
        status: dbStatusToKanban(task.status),
        phase: task.phase ?? dbStatusToKanban(task.status),
        featureId: task.feature.id,
        featureName: task.feature.name,
        estimate: task.estimate ?? "",
        deps: task.deps,
        gates,
        baRoleName: task.baRole?.name,
        devRoleName: task.devRole?.name,
        reviewRoleName: task.reviewRole?.name,
      };
    });
  }

  const features = await db.feature.findMany({
    where: { module: { projectName, ...(moduleId !== "all" ? { id: moduleId } : {}) } },
    include: {
      tasks: {
        where: workspaceId ? { workspaceId } : undefined,
        include: { baRole: true, devRole: true, reviewRole: true },
        orderBy: { id: "asc" },
      },
    },
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
        phase: task.phase ?? dbStatusToKanban(task.status),
        featureId: feature.id,
        featureName: feature.name,
        estimate: task.estimate ?? "",
        deps: task.deps,
        gates,
        baRoleName: task.baRole?.name,
        devRoleName: task.devRole?.name,
        reviewRoleName: task.reviewRole?.name,
      };
    })
  );
}

export async function getTaskPagination(
  projectName: string,
  moduleId: string,
  workspaceId: string | undefined,
  pageSize: number,
  pageByStatus: Partial<Record<TaskStatus, number>>,
  showAllByStatus: Partial<Record<TaskStatus, boolean>> = {},
): Promise<TaskPagination> {
  const statuses: TaskStatus[] = ["pending", "in-progress", "completed", "blocked"];
  const counts = await Promise.all(statuses.map((status) => db.task.count({
    where: {
      status: kanbanStatusToDb(status),
      ...(workspaceId ? { workspaceId } : {}),
      feature: { module: { projectName, ...(moduleId !== "all" ? { id: moduleId } : {}) } },
    },
  })));

  return statuses.reduce((acc, status, index) => {
    const total = counts[index] ?? 0;
    const showAll = showAllByStatus[status] ?? false;
    const totalPages = showAll ? 1 : Math.max(1, Math.ceil(total / pageSize));
    const page = showAll ? 1 : Math.min(Math.max(pageByStatus[status] ?? 1, 1), totalPages);
    acc[status] = { page, pageSize, total, totalPages, showAll };
    return acc;
  }, {} as TaskPagination);
}

export async function getModuleProgress(projectName: string, moduleId: string, workspaceId?: string): Promise<ModuleProgress | null> {
  if (moduleId === "all") {
    const modules = await db.module.findMany({
      where: { projectName },
      include: { features: { include: { tasks: true } } },
    });
    const tasks = modules.flatMap((mod) => mod.features.flatMap((feature) => feature.tasks)).filter((task) => !workspaceId || task.workspaceId === workspaceId);
    const total = tasks.length;
    const completed = tasks.filter((task) => task.status === "completed").length;
    return { id: "all", name: "All Modules", completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }

  const mod = await db.module.findUnique({
    where: { id: moduleId },
    include: { features: { include: { tasks: true } } },
  });
  if (!mod || mod.projectName !== projectName) return null;

  const tasks = mod.features.flatMap((f) => f.tasks).filter((t) => !workspaceId || t.workspaceId === workspaceId);
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;

  return { id: mod.id, name: mod.name, completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}
