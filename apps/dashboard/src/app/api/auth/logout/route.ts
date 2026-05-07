import { NextResponse } from "next/server";
import { authCookieName } from "@/lib/auth-token";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    await db.auditLog.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        actorType: "user",
        event: "user_logout",
        targetType: "User",
        targetId: user.id,
        metadata: { email: user.email },
      },
    }).catch(() => null);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(authCookieName(), "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
