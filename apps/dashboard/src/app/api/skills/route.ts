import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await requireCurrentUser();
  const skills = await db.skillDefinition.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(skills);
}

