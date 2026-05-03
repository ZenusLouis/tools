import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const projectName = decodeURIComponent(name);
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 12), 1), 50);
  const status = url.searchParams.get("status");

  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId: user.workspaceId }, { workspaceId: null }] },
    select: { name: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const statusFilter =
    status === "live" ? ["pending", "running"] :
    status === "failed" ? ["failed", "cancelled"] :
    status === "done" ? ["succeeded"] :
    null;

  const where = {
    workspaceId: user.workspaceId,
    type: "run_task",
    ...(statusFilter ? { status: { in: statusFilter } } : {}),
    payload: { path: ["projectName"], equals: project.name },
  };

  const [total, actions] = await Promise.all([
    db.bridgeFileAction.count({ where }),
    db.bridgeFileAction.findMany({
      where,
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
        device: { select: { name: true } },
      },
    }),
  ]);

  const taskIds = actions
    .map((action) => stringValue(objectValue(action.payload).taskId))
    .filter((taskId): taskId is string => !!taskId);
  const tasks = taskIds.length > 0
    ? await db.task.findMany({
        where: { workspaceId: user.workspaceId, id: { in: taskIds } },
        select: { id: true, name: true },
      })
    : [];
  const taskNameById = new Map(tasks.map((task) => [task.id, task.name]));

  return NextResponse.json({
    total,
    limit,
    status: statusFilter ? status : "all",
    actions: actions.map((action) => {
      const payload = objectValue(action.payload);
      const result = objectValue(action.result);
      const log = Array.isArray(result.log) ? result.log.filter((line): line is string => typeof line === "string") : [];
      const taskId = stringValue(payload.taskId);
      return {
        id: action.id,
        status: action.status,
        error: action.error,
        taskId,
        taskName: taskId ? taskNameById.get(taskId) ?? null : null,
        provider: stringValue(payload.provider),
        phase: stringValue(payload.phase),
        role: stringValue(payload.role),
        deviceName: action.device?.name ?? null,
        artifactPath: stringValue(result.artifactPath),
        exitCode: typeof result.exitCode === "number" ? result.exitCode : null,
        lastLogLine: log.at(-1) ?? action.error ?? null,
        logTail: log.slice(-80),
        createdAt: action.createdAt,
        updatedAt: action.updatedAt,
        completedAt: action.completedAt,
      };
    }),
  });
}
