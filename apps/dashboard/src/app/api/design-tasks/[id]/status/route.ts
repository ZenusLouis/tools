import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;

  const task = await db.designTask.findFirst({
    where: { id, workspaceId: user.workspaceId },
    select: { id: true, status: true, outputUrl: true, stitchScreenId: true, figmaNodeId: true },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(task);
}
