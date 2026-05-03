import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 3), 1), 10);

  const current = await db.task.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: { feature: { include: { module: true } } },
  });
  if (!current) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const projectName = current.feature.module.projectName;
  const after = await db.task.findMany({
    where: {
      workspaceId: user.workspaceId,
      status: "pending",
      id: { gt: current.id },
      feature: { module: { projectName } },
    },
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true, name: true, status: true, phase: true },
  });

  if (after.length >= limit) return NextResponse.json({ tasks: after });

  const wrap = await db.task.findMany({
    where: {
      workspaceId: user.workspaceId,
      status: "pending",
      id: { lte: current.id },
      feature: { module: { projectName } },
    },
    orderBy: { id: "asc" },
    take: limit - after.length,
    select: { id: true, name: true, status: true, phase: true },
  });

  return NextResponse.json({ tasks: [...after, ...wrap] });
}
