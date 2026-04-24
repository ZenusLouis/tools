import "server-only";
import { db } from "@/lib/db";

export async function getDefaultWorkspaceId(): Promise<string> {
  const existing = await db.workspace.findUnique({ where: { slug: "default" }, select: { id: true } });
  if (existing) return existing.id;
  const workspace = await db.workspace.create({ data: { name: "Default Workspace", slug: "default" } });
  return workspace.id;
}

