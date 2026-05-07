import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolvePath } from "@/lib/fs/resolve";
import { syncWorkspaceFromRepo } from "@/lib/repo-sync";

export async function POST() {
  const user = await requireCurrentUser();
  const result = await syncWorkspaceFromRepo(db, user.workspaceId, resolvePath(), {
    includeSkillsAndRoles: true,
    includeLogs: false,
    includeLessons: false,
    includeMcp: false,
    includeProjects: false,
  });
  await db.auditLog.create({
    data: {
      workspaceId: user.workspaceId,
      userId: user.id,
      actorType: "user",
      event: "skill_brain_refreshed",
      targetType: "SkillDefinition",
      metadata: { skills: result.skills, roles: result.roles },
    },
  }).catch(() => null);
  return NextResponse.json({
    ok: true,
    skills: result.skills,
    roles: result.roles,
    message: "Skill brain refreshed from local repo sources.",
  });
}
