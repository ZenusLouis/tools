import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sanitizeJson, sanitizeLogLines } from "@/lib/sanitize";

export const BRIDGE_PAYLOAD_VERSION = 1;
export const BRIDGE_RESULT_VERSION = 1;
export const DEFAULT_LEASE_MS = 2 * 60 * 1000;

export function createClaimToken() {
  return randomBytes(18).toString("base64url");
}

export function leaseDate(ms = DEFAULT_LEASE_MS) {
  return new Date(Date.now() + ms);
}

export function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function getActionType(type: string, payload: unknown) {
  const payloadObject = objectValue(payload);
  return typeof payloadObject.actionType === "string" && payloadObject.actionType
    ? payloadObject.actionType
    : type;
}

export function buildBridgePayload(type: string, payload: Record<string, unknown>) {
  return {
    payloadVersion: BRIDGE_PAYLOAD_VERSION,
    actionType: payload.actionType ?? type,
    ...payload,
  };
}

export function normalizeBridgeResult(
  previous: unknown,
  incoming: Record<string, unknown>,
  status: string,
  extras: Record<string, unknown> = {},
): Prisma.InputJsonValue {
  const previousObject = objectValue(previous);
  const incomingSanitized = sanitizeJson(incoming);
  const prevLog = Array.isArray(previousObject.log) ? previousObject.log.filter((line): line is string => typeof line === "string") : [];
  const incomingLog = Array.isArray(incomingSanitized.log)
    ? incomingSanitized.log.filter((line): line is string => typeof line === "string")
    : [];
  return {
    ...sanitizeJson(previousObject),
    ...incomingSanitized,
    ...sanitizeJson(extras),
    resultVersion: BRIDGE_RESULT_VERSION,
    status,
    log: sanitizeLogLines([...prevLog, ...incomingLog]),
  } as Prisma.InputJsonValue;
}

export async function expireStaleBridgeActions(workspaceId?: string) {
  const now = new Date();
  const stale = await db.bridgeFileAction.findMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      status: { in: ["claimed", "running"] },
      leaseExpiresAt: { lt: now },
    },
    select: { id: true, workspaceId: true, result: true, type: true },
    take: 100,
  });
  for (const action of stale) {
    await db.bridgeFileAction.update({
      where: { id: action.id },
      data: {
        status: "expired",
        error: "Bridge action expired because the local bridge stopped refreshing its lease.",
        completedAt: now,
        result: normalizeBridgeResult(action.result, {
          log: ["Bridge action expired because the local bridge stopped refreshing its lease."],
        }, "expired", { errorCode: "LEASE_EXPIRED" }),
      },
    });
    await db.auditLog.create({
      data: {
        workspaceId: action.workspaceId,
        actionId: action.id,
        actorType: "system",
        event: "bridge_action_expired",
        targetType: "BridgeFileAction",
        targetId: action.id,
        metadata: { type: action.type },
      },
    }).catch(() => null);
  }
  return stale.length;
}

export function telemetryFromActionResult(params: {
  workspaceId: string;
  actionId: string;
  type: string;
  payload: unknown;
  result: Record<string, unknown>;
  status: string;
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}) {
  const payload = objectValue(params.payload);
  const optimizer = objectValue(payload.optimizer ?? params.result.optimizer);
  const skillRouting = objectValue(payload.skillRouting ?? params.result.skillRouting);
  const contextPlan = objectValue(payload.contextPlan ?? params.result.contextPlan);
  const selected = Array.isArray(skillRouting.selected)
    ? skillRouting.selected.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
  const selectedSkills = selected.map((item) => String(item.slug ?? "")).filter(Boolean);
  const skillScores = Object.fromEntries(selected.map((item) => [String(item.slug ?? ""), {
    score: typeof item.score === "number" ? item.score : null,
    reasons: Array.isArray(item.reasons) ? item.reasons : [],
  }]).filter(([slug]) => slug));
  const actualTokens = typeof params.result.actualTokens === "number"
    ? params.result.actualTokens
    : typeof params.result.tokens === "number"
      ? params.result.tokens
      : null;
  const estimatedTokens = typeof optimizer.estimatedPromptTokens === "number"
    ? optimizer.estimatedPromptTokens
    : typeof objectValue(params.result.contextReport).estimatedPromptTokens === "number"
      ? objectValue(params.result.contextReport).estimatedPromptTokens as number
      : null;
  const durationMs = params.startedAt && params.completedAt
    ? Math.max(0, params.completedAt.getTime() - params.startedAt.getTime())
    : null;
  return {
    workspaceId: params.workspaceId,
    actionId: params.actionId,
    taskId: typeof payload.taskId === "string" ? payload.taskId : null,
    projectName: typeof payload.projectName === "string" ? payload.projectName : null,
    provider: String(payload.provider ?? params.result.provider ?? "unknown"),
    model: typeof payload.model === "string" ? payload.model : null,
    role: typeof payload.role === "string" ? payload.role : null,
    source: params.type === "run_task" ? "run_task" : params.type,
    optimizerMode: typeof optimizer.mode === "string" ? optimizer.mode : null,
    contextMode: typeof optimizer.contextMode === "string" ? optimizer.contextMode : typeof contextPlan.mode === "string" ? contextPlan.mode : null,
    selectedSkills,
    skillScores,
    estimatedTokens,
    actualTokens,
    providerTokens: actualTokens,
    codexCredits: typeof params.result.codexCredits === "number" ? params.result.codexCredits : null,
    normalizedCostUsd: typeof params.result.totalCostUSD === "number" ? params.result.totalCostUSD : null,
    status: params.status,
    failureReason: params.status === "succeeded" ? null : params.error ?? String(params.result.failureReason ?? ""),
    startedAt: params.startedAt,
    completedAt: params.completedAt,
    durationMs,
    metadata: sanitizeJson({
      actionType: params.type,
      omittedCount: typeof skillRouting.omittedCount === "number" ? skillRouting.omittedCount : null,
      routingTokens: params.result.routingTokens ?? objectValue(params.result.contextReport).routingTokens ?? 0,
    }),
  };
}
