import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { normalizeBridgeResult } from "@/lib/bridge-actions";
import { db } from "@/lib/db";

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ name: string; actionId: string }> },
) {
  const user = await requireCurrentUser();
  const { name, actionId } = await params;
  const projectName = decodeURIComponent(name);

  const action = await db.bridgeFileAction.findFirst({
    where: { id: actionId, workspaceId: user.workspaceId },
    select: { id: true, status: true, result: true, payload: true },
  });
  if (!action) return NextResponse.json({ error: "Run action not found" }, { status: 404 });

  const payload = objectValue(action.payload);
  if (payload.projectName !== projectName) {
    return NextResponse.json({ error: "Run action does not belong to this project" }, { status: 404 });
  }

  const now = new Date();
  const shouldComplete = action.status === "pending" || action.status === "claimed";
  await db.bridgeFileAction.update({
    where: { id: action.id },
    data: {
      cancelRequestedAt: now,
      status: shouldComplete ? "cancelled" : action.status,
      completedAt: shouldComplete ? now : undefined,
      result: normalizeBridgeResult(action.result, {
        log: ["Cancellation requested from dashboard."],
      }, shouldComplete ? "cancelled" : action.status, { cancelRequestedAt: now.toISOString() }),
    },
  });
  await db.auditLog.create({
    data: {
      workspaceId: user.workspaceId,
      actionId: action.id,
      actorType: "user",
      event: "bridge_action_cancel_requested",
      targetType: "BridgeFileAction",
      targetId: action.id,
      metadata: { projectName, previousStatus: action.status },
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
