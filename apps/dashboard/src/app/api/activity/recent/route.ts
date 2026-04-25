import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { getRecentActivity } from "@/lib/activity";

export async function GET() {
  const user = await requireCurrentUser();
  const items = await getRecentActivity(8, user.workspaceId, new Date(Date.now() - 7 * 86_400_000));
  return NextResponse.json({ items });
}
