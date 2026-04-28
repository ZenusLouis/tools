import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth";
import { resolvePath } from "@/lib/fs/resolve";

const SearchSchema = z.object({ query: z.string().min(1).max(500) });

type InventorySkill = { name: string; path: string; description?: string };
type InventorySource = { name: string; url: string; skills?: InventorySkill[] };
type Inventory = { sources?: InventorySource[] };

export type SearchResult = {
  name: string;
  sourceName: string;
  sourcePath: string;
  description: string;
  repoUrl: string;
};

// Parse GitHub URL → { owner, repo }
function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

// List all SKILL.md files in a GitHub repo using the Trees API
async function fetchRepoSkills(owner: string, repo: string): Promise<SearchResult[]> {
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
  const res = await fetch(treeUrl, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${owner}/${repo}`);

  const data = await res.json() as { tree?: Array<{ path: string; type: string }> };
  const skillFiles = (data.tree ?? []).filter((f) => f.type === "blob" && f.path.endsWith("SKILL.md"));

  const repoUrl = `https://github.com/${owner}/${repo}`;
  const sourceName = `${owner}-${repo}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  return skillFiles.map((f) => {
    const parts = f.path.split("/");
    // Use the directory name closest to SKILL.md as the skill name
    const skillName = parts.length >= 2 ? parts[parts.length - 2] : parts[0].replace(/\.md$/i, "");
    return {
      name: skillName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      sourceName,
      sourcePath: f.path,
      description: `Skill from ${owner}/${repo}`,
      repoUrl,
    };
  });
}

// Filter inventory by keyword
function searchInventory(inventory: Inventory, query: string): SearchResult[] {
  const q = query.toLowerCase();
  const results: SearchResult[] = [];
  for (const source of inventory.sources ?? []) {
    for (const skill of source.skills ?? []) {
      if (skill.name.toLowerCase().includes(q) || (skill.description ?? "").toLowerCase().includes(q)) {
        results.push({
          name: skill.name,
          sourceName: source.name,
          sourcePath: skill.path,
          description: skill.description ?? "",
          repoUrl: source.url,
        });
      }
    }
  }
  return results.slice(0, 40);
}

export async function POST(req: NextRequest) {
  await requireCurrentUser();
  const parsed = SearchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const { query } = parsed.data;
  const ghParsed = parseGithubUrl(query);

  if (ghParsed) {
    try {
      const results = await fetchRepoSkills(ghParsed.owner, ghParsed.repo);
      return NextResponse.json({ results, source: "github" });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 502 });
    }
  }

  // Keyword search against local inventory
  let inventory: Inventory = {};
  try {
    inventory = JSON.parse(await fs.readFile(resolvePath("skills", "imported", "github-inventory.json"), "utf-8")) as Inventory;
  } catch { /* ignore */ }

  const results = searchInventory(inventory, query);
  return NextResponse.json({ results, source: "inventory" });
}
