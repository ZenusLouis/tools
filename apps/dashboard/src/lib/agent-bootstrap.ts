import { db } from "@/lib/db";
import { resolvePath } from "@/lib/fs/resolve";
import { syncWorkspaceFromRepo } from "@/lib/repo-sync";

const syncedWorkspaces = new Set<string>();

export async function ensureWorkspaceAgentDefaults(workspaceId: string) {
  if (syncedWorkspaces.has(workspaceId)) return;
  await syncWorkspaceFromRepo(db, workspaceId, resolvePath(), {
    includeProjects: true,
    includeLessons: true,
    includeMcp: true,
    includeSkillsAndRoles: true,
    includeLogs: true,
  });
  syncedWorkspaces.add(workspaceId);
}
