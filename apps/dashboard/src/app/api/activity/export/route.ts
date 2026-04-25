import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await requireCurrentUser();
  const sessions = await db.session.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { date: "desc" },
    take: 500,
  });
  const toolUsage = await db.toolUsage.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { date: "desc" },
    take: 500,
  });

  const body = JSON.stringify({
    exportedAt: new Date().toISOString(),
    workspaceId: user.workspaceId,
    sessions,
    toolUsage,
  }, null, 2);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gcs-activity-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
