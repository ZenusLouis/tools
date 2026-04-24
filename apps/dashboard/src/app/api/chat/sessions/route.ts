import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await requireCurrentUser();
  const sessions = await db.chatSession.findMany({
    where: { workspaceId: user.workspaceId, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } }, agentRole: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(sessions);
}

