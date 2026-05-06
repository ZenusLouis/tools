import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await requireCurrentUser();
  const snapshots = await db.snapshotExport.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { exportedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ snapshots });
}
