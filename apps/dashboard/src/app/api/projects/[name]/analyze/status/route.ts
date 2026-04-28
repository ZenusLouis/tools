import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const projectName = decodeURIComponent(name);

  const count = await db.task.count({
    where: { feature: { module: { projectName } }, workspaceId: user.workspaceId },
  });

  return NextResponse.json({ ready: count > 0, created: count });
}
