import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { expireStaleBridgeActions } from "@/lib/bridge-actions";
import { db } from "@/lib/db";

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  await expireStaleBridgeActions(user.workspaceId);

  const action = await db.bridgeFileAction.findFirst({
    where: {
      workspaceId: user.workspaceId,
      type: "run_task",
      payload: { path: ["taskId"], equals: id },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, status: true, error: true, payload: true, result: true, createdAt: true, updatedAt: true, completedAt: true },
  });

  if (!action) return NextResponse.json({ action: null });
  const result = action.result && typeof action.result === "object" && !Array.isArray(action.result)
    ? action.result as Record<string, unknown>
    : {};
  const payload = action.payload && typeof action.payload === "object" && !Array.isArray(action.payload)
    ? action.payload as Record<string, unknown>
    : {};
  return NextResponse.json({
    action: {
      id: action.id,
      status: action.status,
      error: action.error,
      log: Array.isArray(result.log) ? result.log : [],
      artifactPath: typeof result.artifactPath === "string" ? result.artifactPath : null,
      exitCode: numberValue(result.exitCode),
      actualTokens: numberValue(result.actualTokens) ?? numberValue(result.tokens),
      providerTokens: numberValue(result.providerTokens),
      codexCredits: numberValue(result.codexCredits),
      normalizedCostUsd: numberValue(result.normalizedCostUsd) ?? numberValue(result.totalCostUSD),
      tokenMeter: stringValue(result.tokenMeter),
      optimizer: payload.optimizer ?? result.optimizer ?? null,
      skillRouting: payload.skillRouting ?? result.skillRouting ?? null,
      contextPlan: payload.contextPlan ?? result.contextPlan ?? null,
      contextReportPath: typeof result.contextReportPath === "string" ? result.contextReportPath : null,
      contextReport: result.contextReport ?? null,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt,
      completedAt: action.completedAt,
    },
  });
}
