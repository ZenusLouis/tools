import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;

  const action = await db.bridgeFileAction.findFirst({
    where: {
      workspaceId: user.workspaceId,
      type: "run_task",
      payload: { path: ["taskId"], equals: id },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, status: true, error: true, result: true, createdAt: true, updatedAt: true, completedAt: true },
  });

  if (!action) return NextResponse.json({ action: null });
  const result = action.result && typeof action.result === "object" && !Array.isArray(action.result)
    ? action.result as Record<string, unknown>
    : {};
  return NextResponse.json({
    action: {
      id: action.id,
      status: action.status,
      error: action.error,
      log: Array.isArray(result.log) ? result.log : [],
      artifactPath: typeof result.artifactPath === "string" ? result.artifactPath : null,
      exitCode: typeof result.exitCode === "number" ? result.exitCode : null,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt,
      completedAt: action.completedAt,
    },
  });
}
