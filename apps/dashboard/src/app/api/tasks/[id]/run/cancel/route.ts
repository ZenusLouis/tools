import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth";
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
      status: { in: ["pending", "running"] },
      payload: { path: ["taskId"], equals: id },
    },
    select: { id: true, result: true },
  });

  if (actions.length === 0) {
    return NextResponse.json({ ok: true, cancelled: 0 });
  }

  for (const action of actions) {
    const previous =
      action.result && typeof action.result === "object" && !Array.isArray(action.result)
        ? action.result as Record<string, unknown>
        : {};
    const previousLog = Array.isArray(previous.log) ? previous.log.filter((line): line is string => typeof line === "string") : [];
    await db.bridgeFileAction.update({
      where: { id: action.id },
      data: {
        status: "cancelled",
        completedAt: new Date(),
        result: {
          ...previous,
          log: [...previousLog, "Cancellation requested from dashboard."].slice(-200),
        },
      },
    });
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
