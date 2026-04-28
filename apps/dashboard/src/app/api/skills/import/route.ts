import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolvePath } from "@/lib/fs/resolve";

const ImportSchema = z.object({
  sourceName: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().regex(/^[a-z0-9-]+$/),
  sourcePath: z.string().min(1),
});

type Inventory = {
  sources?: Array<{
    name: string;
    url: string;
    skills?: Array<{ name: string; path: string; description?: string }>;
  }>;
};

function assertSafeRelative(input: string) {
  const normalized = input.replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/") || normalized.includes(":")) {
    throw new Error("Unsafe source path");
  }
  return normalized;
}

function githubRawUrl(repoUrl: string, filePath: string): string {
  // https://github.com/owner/repo → https://raw.githubusercontent.com/owner/repo/HEAD/<path>
  const match = repoUrl.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)/);
  if (!match) throw new Error(`Cannot derive raw URL from: ${repoUrl}`);
  return `https://raw.githubusercontent.com/${match[1]}/HEAD/${filePath}`;
}

async function readSkillText(sourceFile: string, repoUrl: string, filePath: string): Promise<string> {
  try {
    return await fs.readFile(sourceFile, "utf-8");
  } catch {
    // Cache miss — fetch from GitHub
    const rawUrl = githubRawUrl(repoUrl, filePath);
    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status} ${rawUrl}`);
    return res.text();
  }
}

export async function POST(req: NextRequest) {
  const user = await requireCurrentUser();
  const parsed = ImportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  let inventory: Inventory;
  try {
    inventory = JSON.parse(await fs.readFile(resolvePath("skills", "imported", "github-inventory.json"), "utf-8")) as Inventory;
  } catch {
    return NextResponse.json({ error: "Skill inventory not available" }, { status: 503 });
  }

  const source = inventory.sources?.find((item) => item.name === parsed.data.sourceName);
  const skill = source?.skills?.find((item) => item.name === parsed.data.name && item.path === parsed.data.sourcePath);
  if (!source || !skill) return NextResponse.json({ error: "Skill not found in inventory" }, { status: 404 });

  const safeSourcePath = assertSafeRelative(skill.path);
  const sourceFile = resolvePath("skills", ".cache", "github-sources", parsed.data.sourceName, safeSourcePath);
  const targetDir = resolvePath("skills", "imported", "github-sources", parsed.data.name);
  const targetFile = path.join(targetDir, "SKILL.md");

  let text: string;
  try {
    text = await readSkillText(sourceFile, source.url, safeSourcePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Could not fetch skill: ${msg}` }, { status: 502 });
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetFile, text, "utf-8");

  const sourcePath = path.relative(resolvePath(), targetFile).replace(/\\/g, "/");
  const saved = await db.skillDefinition.upsert({
    where: { workspaceId_slug: { workspaceId: user.workspaceId, slug: parsed.data.name } },
    create: {
      workspaceId: user.workspaceId,
      name: parsed.data.name,
      slug: parsed.data.name,
      category: "imported",
      sourcePath,
      description: skill.description || `${parsed.data.name} imported skill`,
      providerCompatibility: ["claude", "codex", "chatgpt"],
      roleCompatibility: ["ba", "dev", "reviewer", "qa", "design", "researcher"],
      tags: ["imported", parsed.data.sourceName, `source:${source.url}`],
      isImported: true,
      isRemote: false,
    },
    update: {
      category: "imported",
      sourcePath,
      description: skill.description || `${parsed.data.name} imported skill`,
      providerCompatibility: ["claude", "codex", "chatgpt"],
      tags: ["imported", parsed.data.sourceName, `source:${source.url}`],
      isImported: true,
      isRemote: false,
    },
  });

  return NextResponse.json({ skill: saved });
}
