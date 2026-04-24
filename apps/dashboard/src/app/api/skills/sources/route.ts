import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { Dirent } from "fs";
import { requireCurrentUser } from "@/lib/auth";
import { resolvePath } from "@/lib/fs/resolve";

type Marketplace = {
  sources?: string[];
  skills?: Array<{ name: string; description: string; source?: string; tags?: string[] }>;
};

type SourceCatalog = {
  sources?: Array<{ name: string; url: string; kind: string; why: string; recommendedFor?: string[] }>;
};

type Inventory = {
  updated?: string;
  cachePath?: string;
  sources?: Array<{ name: string; status: string; skillCount: number; skills?: Array<{ name: string; path: string; description?: string }> }>;
};

type RecommendedImports = {
  totalCandidates?: number;
  recommendations?: Array<{
    name: string;
    source: string;
    sourceName: string;
    sourcePath: string;
    description: string;
    recommendedFor: string[];
    score: number;
  }>;
};

async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function collectWrappers(dir: string): Promise<Array<{ name: string; path: string }>> {
  const out: Array<{ name: string; path: string }> = [];
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(full, "SKILL.md");
    try {
      const text = await fs.readFile(skillPath, "utf-8");
      const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
      const name = match?.[1]?.match(/^name:\s*([a-z0-9-]+)\s*$/m)?.[1] ?? entry.name;
      out.push({ name, path: path.relative(resolvePath(), skillPath).replace(/\\/g, "/") });
    } catch {
      // Ignore incomplete wrapper folders.
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET() {
  await requireCurrentUser();
  const [sourceCatalog, marketplace, wrappers] = await Promise.all([
    readJSON<SourceCatalog>(resolvePath("agents", "sources", "github-skill-sources.json")),
    readJSON<Marketplace>(resolvePath("skills", "imported", "marketplace.json")),
    collectWrappers(resolvePath("skills", "imported", "github-sources")),
  ]);
  const inventory = await readJSON<Inventory>(resolvePath("skills", "imported", "github-inventory.json"));
  const recommended = await readJSON<RecommendedImports>(resolvePath("skills", "imported", "recommended-imports.json"));

  const wrapped = new Set(wrappers.map((w) => w.name));
  const skills = (marketplace?.skills ?? []).map((skill) => ({
    ...skill,
    wrapped: wrapped.has(skill.name),
  }));

  return NextResponse.json({
    sources: sourceCatalog?.sources ?? [],
    marketplaceSources: marketplace?.sources ?? [],
    inventory,
    recommended,
    skills,
    wrappers,
    summary: {
      sources: sourceCatalog?.sources?.length ?? 0,
      marketplace: skills.length,
      wrappers: wrappers.length,
      wrappedMarketplace: skills.filter((s) => s.wrapped).length,
      cachedSources: inventory?.sources?.filter((s) => s.status === "fetched" || s.status === "cached").length ?? 0,
      cachedSkills: inventory?.sources?.reduce((total, source) => total + source.skillCount, 0) ?? 0,
      recommendedImports: recommended?.recommendations?.length ?? 0,
      recommendedCandidates: recommended?.totalCandidates ?? 0,
    },
  });
}
