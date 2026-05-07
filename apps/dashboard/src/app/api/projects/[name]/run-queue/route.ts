import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { expireStaleBridgeActions } from "@/lib/bridge-actions";
import { db } from "@/lib/db";

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const projectName = decodeURIComponent(name);
  const url = new URL(req.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 12);
  const page = Math.min(Math.max(Number(url.searchParams.get("page") ?? 1), 1), 10_000);
  const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") ?? requestedLimit), 1), 50);
  const status = url.searchParams.get("status");
  const provider = url.searchParams.get("provider");
  const phase = url.searchParams.get("phase");
  await expireStaleBridgeActions(user.workspaceId);

  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId: user.workspaceId }, { workspaceId: null }] },
    select: { name: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const statusFilter =
    status === "live" ? ["pending", "claimed", "running"] :
    status === "failed" ? ["failed", "cancelled", "expired"] :
    status === "done" ? ["succeeded"] :
    null;
  const providerFilter = provider === "claude" || provider === "codex" ? provider : null;
  const phaseFilter = phase === "analysis" || phase === "implementation" || phase === "review" ? phase : null;

  const baseWhere = {
    workspaceId: user.workspaceId,
    type: "run_task",
    AND: [
      { payload: { path: ["projectName"], equals: project.name } },
      ...(providerFilter ? [{ payload: { path: ["provider"], equals: providerFilter } }] : []),
      ...(phaseFilter ? [{ payload: { path: ["phase"], equals: phaseFilter } }] : []),
    ],
  };
  const where = {
    ...baseWhere,
    ...(statusFilter ? { status: { in: statusFilter } } : {}),
  };

  const [total, allCount, liveCount, failedCount, doneCount, actions] = await Promise.all([
    db.bridgeFileAction.count({ where }),
    db.bridgeFileAction.count({ where: baseWhere }),
    db.bridgeFileAction.count({ where: { ...baseWhere, status: { in: ["pending", "claimed", "running"] } } }),
    db.bridgeFileAction.count({ where: { ...baseWhere, status: { in: ["failed", "cancelled", "expired"] } } }),
    db.bridgeFileAction.count({ where: { ...baseWhere, status: "succeeded" } }),
    db.bridgeFileAction.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasPrev: page > 1,
    hasNext: page * pageSize < total,
    status: statusFilter ? status : "all",
    provider: providerFilter ?? "all",
    phase: phaseFilter ?? "all",
    counts: {
      all: allCount,
      live: liveCount,
      failed: failedCount,
      done: doneCount,
    },
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
        optimizer: payload.optimizer ?? result.optimizer ?? null,
        skillRouting: payload.skillRouting ?? result.skillRouting ?? null,
        contextPlan: payload.contextPlan ?? result.contextPlan ?? null,
        deviceName: action.device?.name ?? null,
        artifactPath: stringValue(result.artifactPath),
        exitCode: numberValue(result.exitCode),
        actualTokens: numberValue(result.actualTokens) ?? numberValue(result.tokens),
        providerTokens: numberValue(result.providerTokens),
        codexCredits: numberValue(result.codexCredits),
        normalizedCostUsd: numberValue(result.normalizedCostUsd) ?? numberValue(result.totalCostUSD),
        tokenMeter: stringValue(result.tokenMeter),
        contextReportPath: stringValue(result.contextReportPath),
        lastLogLine: log.at(-1) ?? action.error ?? null,
        logTail: log.slice(-80),
        createdAt: action.createdAt,
        updatedAt: action.updatedAt,
        completedAt: action.completedAt,
      };
    }),
  });
}
