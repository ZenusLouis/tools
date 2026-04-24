import fs from "fs/promises";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { AgentLibraryClient } from "@/components/library/AgentLibraryClient";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureWorkspaceAgentDefaults } from "@/lib/agent-bootstrap";
import { resolvePath } from "@/lib/fs/resolve";

type SourceCatalog = {
  sources?: Array<{ name: string; url: string; kind: string; why: string; recommendedFor?: string[] }>;
};

type Marketplace = {
  skills?: Array<{ name: string; source?: string; tags?: string[] }>;
};

type Inventory = {
  sources?: Array<{ name: string; status: string; skillCount: number }>;
};

type RecommendedImports = {
  totalCandidates?: number;
  recommendations?: Array<{ name: string; sourceName: string; sourcePath: string; description: string; recommendedFor: string[]; score: number }>;
};

async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

export default async function LibraryPage() {
  const user = await requireCurrentUser();
  await ensureWorkspaceAgentDefaults(user.workspaceId);

  const [roles, skills, sourceCatalog, marketplace, inventory, recommended] = await Promise.all([
    db.agentRole.findMany({ where: { workspaceId: user.workspaceId }, include: { skills: true }, orderBy: { name: "asc" } }),
    db.skillDefinition.findMany({ where: { workspaceId: user.workspaceId }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    readJSON<SourceCatalog>(resolvePath("agents", "sources", "github-skill-sources.json")),
    readJSON<Marketplace>(resolvePath("skills", "imported", "marketplace.json")),
    readJSON<Inventory>(resolvePath("skills", "imported", "github-inventory.json")),
    readJSON<RecommendedImports>(resolvePath("skills", "imported", "recommended-imports.json")),
  ]);

  const wrappedSlugs = new Set(skills.filter((skill) => skill.sourcePath?.includes("github-sources")).map((skill) => skill.slug));
  const sourceSummary = {
    sources: sourceCatalog?.sources ?? [],
    marketplaceCount: marketplace?.skills?.length ?? 0,
    wrappedCount: wrappedSlugs.size,
    cachedSourceCount: inventory?.sources?.filter((source) => source.status === "fetched" || source.status === "cached").length ?? 0,
    cachedSkillCount: inventory?.sources?.reduce((total, source) => total + source.skillCount, 0) ?? 0,
    recommendedCount: recommended?.recommendations?.length ?? 0,
    recommendedCandidates: recommended?.totalCandidates ?? 0,
    recommended: recommended?.recommendations?.slice(0, 12) ?? [],
  };

  return (
    <>
      <TopBar title="Library" />
      <PageShell>
        <AgentLibraryClient roles={roles} skills={skills} sourceSummary={sourceSummary} />
      </PageShell>
    </>
  );
}
