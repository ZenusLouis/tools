import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { authCookieName, verifyAuthToken } from "@/lib/auth-token";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  workspaceId: string;
  workspaceName: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(authCookieName())?.value;
  const payload = await verifyAuthToken(token).catch(() => null);
  if (!payload) return null;

  const membership = await db.workspaceMember.findFirst({
    where: { userId: payload.userId, workspaceId: payload.workspaceId },
    include: { user: true, workspace: true },
  });
  if (!membership) return null;

  return {
    id: membership.user.id,
    email: membership.user.email,
    name: membership.user.name,
    workspaceId: membership.workspace.id,
    workspaceName: membership.workspace.name,
  };
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

