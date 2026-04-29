import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { resetCodexUsage } from "@/lib/token-cleanup";

export async function POST() {
  const user = await requireCurrentUser();
  const result = await resetCodexUsage(user.workspaceId);
  return NextResponse.json({ ok: true, ...result });
}
