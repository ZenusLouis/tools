import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  await params;
  const actionId = req.nextUrl.searchParams.get("actionId");
  if (!actionId) return NextResponse.json({ error: "actionId required" }, { status: 400 });

  const action = await db.bridgeFileAction.findFirst({
    where: { id: actionId, workspaceId: user.workspaceId },
    select: { id: true, status: true, error: true, result: true },
  });
  if (!action) return NextResponse.json({ error: "not found" }, { status: 404 });

  const result = action.result && typeof action.result === "object" && !Array.isArray(action.result)
    ? action.result as Record<string, unknown>
    : {};
  const log = Array.isArray(result.log) ? result.log as string[] : [];

  return NextResponse.json({ status: action.status, error: action.error, log });
}
