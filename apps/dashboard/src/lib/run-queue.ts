import "server-only";
import { db } from "@/lib/db";

export type RunQueueItem = {
  id: string;
  taskId: string | null;
  provider: string | null;
  phase: string | null;
  status: string;
  error: string | null;
  updatedAt: string;
  createdAt: string;
  completedAt: string | null;
  logTail: string[];
};

function payloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function resultLog(value: unknown): string[] {
  const result = payloadRecord(value);
  return Array.isArray(result.log) ? result.log.filter((line): line is string => typeof line === "string").slice(-5) : [];
}

export async function getProjectRunQueue(projectName: string, workspaceId: string, limit = 8): Promise<RunQueueItem[]> {
  const actions = await db.bridgeFileAction.findMany({
    where: {
      workspaceId,
      type: "run_task",
      payload: { path: ["projectName"], equals: projectName },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      error: true,
      payload: true,
      result: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
    },
  });

  return actions.map((action) => {
    const payload = payloadRecord(action.payload);
    return {
      id: action.id,
      taskId: typeof payload.taskId === "string" ? payload.taskId : null,
      provider: typeof payload.provider === "string" ? payload.provider : null,
      phase: typeof payload.phase === "string" ? payload.phase : null,
      status: action.status,
      error: action.error,
      createdAt: action.createdAt.toISOString(),
      updatedAt: action.updatedAt.toISOString(),
      completedAt: action.completedAt?.toISOString() ?? null,
      logTail: resultLog(action.result),
    };
  });
}
