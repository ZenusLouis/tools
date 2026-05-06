import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncWorkspaceFromRepo } from "@/lib/repo-sync";

const REPO_ROOT = process.env.GCS_REPO_ROOT ?? process.env.CLAUDE_ROOT ?? "d:\\GlobalClaudeSkills";

export async function POST() {
  const user = await requireCurrentUser();
  const result = await syncWorkspaceFromRepo(db, user.workspaceId, REPO_ROOT, {
    includeMcp: true,
    includeProjects: false,
    includeLessons: false,
    includeSkillsAndRoles: false,
    includeLogs: false,
    onlyIfEmpty: false,
  });

  await db.auditLog.create({
    data: {
      workspaceId: user.workspaceId,
      userId: user.id,
      actorType: "user",
      event: "mcp_registry_refreshed",
      targetType: "McpRegistry",
      targetId: "global",
      metadata: result,
    },
  }).catch(() => null);

  revalidatePath("/mcp");
  return NextResponse.json({ ok: true, result });
}
