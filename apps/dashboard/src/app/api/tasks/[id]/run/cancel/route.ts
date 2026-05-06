import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth";
import { normalizeBridgeResult } from "@/lib/bridge-actions";
import { db } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;

  const task = await db.task.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: { feature: { include: { module: true } } },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const actions = await db.bridgeFileAction.findMany({
    where: {
      workspaceId: user.workspaceId,
      type: "run_task",
      status: { in: ["pending", "claimed", "running"] },
      payload: { path: ["taskId"], equals: id },
    },
    select: { id: true, result: true, status: true },
  });

  if (actions.length === 0) {
    return NextResponse.json({ ok: true, cancelled: 0 });
  }

  for (const action of actions) {
    const now = new Date();
    const immediate = action.status === "pending" || action.status === "claimed";
    await db.bridgeFileAction.update({
      where: { id: action.id },
      data: {
        status: immediate ? "cancelled" : action.status,
        cancelRequestedAt: now,
        completedAt: immediate ? now : undefined,
        result: normalizeBridgeResult(action.result, {
          log: ["Cancellation requested from dashboard."],
        }, immediate ? "cancelled" : action.status, { cancelRequestedAt: now.toISOString() }),
      },
    });
    await db.auditLog.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        actionId: action.id,
        actorType: "user",
        event: "bridge_action_cancel_requested",
        targetType: "BridgeFileAction",
        targetId: action.id,
        metadata: { taskId: id, previousStatus: action.status },
      },
    }).catch(() => null);
  }

  await db.task.update({
    where: { id },
    data: { status: "blocked", phase: "blocked" },
  });
  await db.session.create({
    data: {
      workspaceId: user.workspaceId,
      provider: task.devRoleId ? "codex" : "claude",
      role: "task-run",
      type: "task_run_cancelled",
      project: task.feature.module.projectName,
      date: new Date(),
      tasksCompleted: [],
      sessionNotes: `Cancelled local task run for ${id}.`,
      risks: ["Task run cancelled from dashboard."],
    },
  });

  revalidatePath(`/tasks/${id}`);
  revalidatePath("/tasks");
  revalidatePath(`/projects/${encodeURIComponent(task.feature.module.projectName)}`);
  return NextResponse.json({ ok: true, cancelled: actions.length });
}
