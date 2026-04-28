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
  if (actionId) {
    const action = await db.bridgeFileAction.findFirst({
      where: { id: actionId, workspaceId: user.workspaceId },
      select: { result: true, status: true },
    });
    log = (action?.result as { log?: string[] } | null)?.log ?? [];
  }

  return NextResponse.json({ ready: count > 0, created: count, log });
}
