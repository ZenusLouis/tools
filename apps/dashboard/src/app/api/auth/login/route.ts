import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { authCookieName, signAuthToken } from "@/lib/auth-token";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = LoginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    include: { memberships: { include: { workspace: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash) || user.memberships.length === 0) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const membership = user.memberships[0];
  const token = await signAuthToken({
    userId: user.id,
    email: user.email,
    workspaceId: membership.workspaceId,
  });

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const res = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    workspace: { id: membership.workspace.id, name: membership.workspace.name },
  });
  res.cookies.set(authCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}

