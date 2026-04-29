import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const projectName = decodeURIComponent(name);
  const actionId = req.nextUrl.searchParams.get("actionId");

  const count = await db.task.count({
    where: { feature: { module: { projectName } }, workspaceId: user.workspaceId },
  });

  let log: string[] = [];
  let failed = false;
  let errorMsg = "";
  let status: string | null = null;
  let updatedAt: string | null = null;
  let summary: unknown = null;
  if (actionId) {
    const action = await db.bridgeFileAction.findFirst({
      where: { id: actionId, workspaceId: user.workspaceId },
      select: { result: true, status: true, error: true, updatedAt: true },
    });
    status = action?.status ?? null;
    updatedAt = action?.updatedAt?.toISOString() ?? null;
    const result = action?.result as { log?: string[]; summary?: unknown } | null;
    log = result?.log ?? [];
    summary = result?.summary ?? null;
    if (action?.status === "running" && log.length === 0) {
      log = ["Local bridge picked up the analysis action.", "Claude is generating modules and tasks..."];
    }
    if (action?.status === "failed") {
      failed = true;
      errorMsg = action.error ?? "Bridge action failed";
    }
  }

  return NextResponse.json({ ready: count > 0, created: count, log, failed, error: errorMsg, status, updatedAt, summary });
}
