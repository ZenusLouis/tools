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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string; actionId: string }> },
) {
  const user = await requireCurrentUser();
  const { name, actionId } = await params;
  const projectName = decodeURIComponent(name);

  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId: user.workspaceId }, { workspaceId: null }] },
    select: { name: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const action = await db.bridgeFileAction.findFirst({
    where: { id: actionId, workspaceId: user.workspaceId, type: "run_task" },
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
  });
  if (!action) return NextResponse.json({ error: "Run action not found" }, { status: 404 });

  const payload = objectValue(action.payload);
  if (stringValue(payload.projectName) !== project.name) {
    return NextResponse.json({ error: "Run action does not belong to this project" }, { status: 404 });
  }

  const result = objectValue(action.result);
  const log = Array.isArray(result.log) ? result.log.filter((line): line is string => typeof line === "string") : [];

  return NextResponse.json({
    action: {
      id: action.id,
      status: action.status,
      error: action.error,
      taskId: stringValue(payload.taskId),
      provider: stringValue(payload.provider),
      phase: stringValue(payload.phase),
      role: stringValue(payload.role),
      optimizer: payload.optimizer ?? result.optimizer ?? null,
      skillRouting: payload.skillRouting ?? result.skillRouting ?? null,
      contextPlan: payload.contextPlan ?? result.contextPlan ?? null,
      deviceName: action.device?.name ?? null,
      artifactPath: stringValue(result.artifactPath),
      exitCode: typeof result.exitCode === "number" ? result.exitCode : null,
      actualTokens: typeof result.actualTokens === "number" ? result.actualTokens : typeof result.tokens === "number" ? result.tokens : null,
      contextReportPath: stringValue(result.contextReportPath),
      contextReport: result.contextReport ?? null,
      command: log.find((line) => line.startsWith("CMD: "))?.slice(5) ?? null,
      log,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt,
      completedAt: action.completedAt,
    },
  });
}
