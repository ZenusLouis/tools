import "server-only";
import { db } from "@/lib/db";

export type TaskDetail = {
  id: string;
  name: string;
  summary: string | null;
  details: string | null;
  acceptanceCriteria: string[];
  steps: string[];
  reqIds: string[];
  priority: string | null;
  risk: string | null;
  status: string;
  estimate: string | null;
  deps: string[];
  moduleId: string;
  moduleName: string;
  featureId: string;
  featureName: string;
  projectName: string;
  phase: string;
  analysisBriefPath: string | null;
  implementationLogPath: string | null;
  reviewPath: string | null;
  baRoleName: string | null;
  devRoleName: string | null;
  reviewRoleName: string | null;
};

export type FileChange = { path: string; added: number; removed: number };

export type TaskLogEntry = {
  date: string;
  commitHash: string | null;
  sessionNotes: string | null;
  totalTokens: number | null;
  totalCostUSD: number | null;
  durationMin: number | null;
  filesChanged: FileChange[];
  risks: string[];
  lessonSaved: string | null;
};

export async function findTaskDetail(taskId: string): Promise<TaskDetail | null> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { feature: { include: { module: true } }, baRole: true, devRole: true, reviewRole: true },
  });
  if (!task) return null;

  return {
    id: task.id,
    name: task.name,
    summary: task.summary,
    details: task.details,
    acceptanceCriteria: task.acceptanceCriteria,
    steps: task.steps,
    reqIds: task.reqIds,
    priority: task.priority,
    risk: task.risk,
    status: task.status === "in_progress" ? "in-progress" : task.status,
    estimate: task.estimate,
    deps: task.deps,
    moduleId: task.feature.module.id,
    moduleName: task.feature.module.name,
    featureId: task.feature.id,
    featureName: task.feature.name,
    projectName: task.feature.module.projectName,
    phase: task.phase ?? (task.status === "completed" ? "done" : task.status === "blocked" ? "blocked" : "pending"),
    analysisBriefPath: task.analysisBriefPath,
    implementationLogPath: task.implementationLogPath,
    reviewPath: task.reviewPath,
    baRoleName: task.baRole?.name ?? null,
    devRoleName: task.devRole?.name ?? null,
    reviewRoleName: task.reviewRole?.name ?? null,
  };
}

export async function getTaskLogEntry(taskId: string): Promise<TaskLogEntry | null> {
  const since = new Date(Date.now() - 14 * 86_400_000);
  const session = await db.session.findFirst({
    where: { date: { gte: since }, tasksCompleted: { has: taskId } },
    orderBy: { date: "desc" },
  });
  if (!session) return null;

  return {
    date: session.date.toISOString(),
    commitHash: session.commitHash,
    sessionNotes: session.sessionNotes,
    totalTokens: session.totalTokens,
    totalCostUSD: session.totalCostUSD,
    durationMin: session.durationMin,
    filesChanged: (session.filesChanged as FileChange[]) ?? [],
    risks: session.risks,
    lessonSaved: session.lessonSaved,
  };
}
