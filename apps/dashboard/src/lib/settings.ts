import "server-only";
import { db } from "@/lib/db";

export type ProjectContext = {
  name: string;
  path: string | null;
  frameworks: string[];
  mcpProfile: string | null;
  docs: Record<string, string>;
  tools: Record<string, string>;
  lastIndexed: string | null;
  activeTask: string | null;
};

export async function getProjectContext(projectName: string): Promise<ProjectContext | null> {
  const p = await db.project.findUnique({ where: { name: projectName } });
  if (!p) return null;
  return {
    name: p.name,
    path: p.path,
    frameworks: p.frameworks,
    mcpProfile: p.mcpProfile,
    docs: (p.docs as Record<string, string>) ?? {},
    tools: (p.links as Record<string, string>) ?? {},
    lastIndexed: p.lastIndexed?.toISOString() ?? null,
    activeTask: p.activeTask,
  };
}

export async function getMcpProfiles(): Promise<string[]> {
  const rows = await db.mcpProfile.findMany({ select: { profile: true }, orderBy: { profile: "asc" } });
  return rows.map((r) => r.profile);
}
