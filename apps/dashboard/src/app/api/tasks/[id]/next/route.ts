import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;

  const current = await db.task.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: { feature: { include: { module: true } } },
  });
  if (!current) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const projectName = current.feature.module.projectName;
  const next =
    await db.task.findFirst({
      where: {
        workspaceId: user.workspaceId,
        status: "pending",
        id: { gt: current.id },
        feature: { module: { projectName } },
      },
      orderBy: { id: "asc" },
      select: { id: true, name: true, status: true, phase: true },
    }) ??
    await db.task.findFirst({
      where: {
        workspaceId: user.workspaceId,
        status: "pending",
        feature: { module: { projectName } },
      },
      orderBy: { id: "asc" },
      select: { id: true, name: true, status: true, phase: true },
    });

  return NextResponse.json({ task: next });
}
