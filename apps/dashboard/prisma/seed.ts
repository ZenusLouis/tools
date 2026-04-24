/**
 * One-time migration seed: reads existing files from CLAUDE_ROOT → inserts into PostgreSQL.
 * Run with: npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import path from "path";

const db = new PrismaClient();
const ROOT = process.env.CLAUDE_ROOT ?? "d:\\GlobalClaudeSkills";

function resolvePath(...parts: string[]) {
  return path.join(ROOT, ...parts);
}

async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function readMarkdown(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

async function readJSONL<T>(filePath: string): Promise<T[]> {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    return text.split("\n").filter(Boolean).map((l) => JSON.parse(l) as T);
  } catch {
    return [];
  }
}

// ─── Projects + Modules + Features + Tasks ───────────────────────────────────

type RegistryJSON = Record<string, string>;
type ContextJSON = {
  name: string; path?: string; framework?: string[]; lastIndexed?: string;
  activeTask?: string | null; tools?: Record<string, string>; docs?: Record<string, string>; mcpProfile?: string;
};
type ProgressTask = { id: string; name: string; status: string; estimate?: string; deps?: string[] };
type ProgressFeature = { id: string; name: string; tasks: ProgressTask[] };
type ProgressModule = { id: string; name: string; features: ProgressFeature[] };
type ProgressJSON = { modules: ProgressModule[] };

async function seedProjects() {
  const registry = await readJSON<RegistryJSON>(resolvePath("projects", "registry.json"));
  if (!registry) { console.log("No registry.json found, skipping projects"); return; }

  for (const [projectName, relPath] of Object.entries(registry)) {
    const projectRoot = resolvePath(relPath);
    const ctx = await readJSON<ContextJSON>(path.join(projectRoot, "context.json"));
    if (!ctx) continue;

    await db.project.upsert({
      where: { name: projectName },
      create: {
        name: projectName,
        path: ctx.path ?? null,
        frameworks: ctx.framework ?? [],
        lastIndexed: ctx.lastIndexed ? new Date(ctx.lastIndexed) : null,
        activeTask: ctx.activeTask ?? null,
        links: ctx.tools ?? {},
        docs: ctx.docs ?? {},
        mcpProfile: ctx.mcpProfile ?? null,
      },
      update: {},
    });

    const progress = await readJSON<ProgressJSON>(path.join(projectRoot, "progress.json"));
    if (!progress?.modules) continue;

    for (let mi = 0; mi < progress.modules.length; mi++) {
      const mod = progress.modules[mi];
      await db.module.upsert({
        where: { id: mod.id },
        create: { id: mod.id, projectName, name: mod.name, order: mi },
        update: {},
      });

      for (let fi = 0; fi < mod.features.length; fi++) {
        const feat = mod.features[fi];
        const featureId = `${mod.id}-${feat.id}`;
        await db.feature.upsert({
          where: { id: featureId },
          create: { id: featureId, moduleId: mod.id, name: feat.name, order: fi },
          update: {},
        });

        for (const task of feat.tasks) {
          const statusMap: Record<string, string> = { "in-progress": "in_progress" };
          const status = statusMap[task.status] ?? task.status;
          await db.task.upsert({
            where: { id: task.id },
            create: { id: task.id, featureId, name: task.name, status: status as never, estimate: task.estimate ?? null, deps: task.deps ?? [] },
            update: {},
          });
        }
      }
    }
    console.log(`  ✓ Project: ${projectName}`);
  }
}

// ─── Sessions + ToolUsage ─────────────────────────────────────────────────────

type SessionEntry = {
  type?: string; project?: string; date?: string; tasksCompleted?: string[];
  commitHash?: string | null; sessionNotes?: string | null; totalTokens?: number;
  totalCostUSD?: number; durationMin?: number; filesChanged?: unknown; risks?: string[]; lessonSaved?: string | null;
  tool?: string; tokens?: number; ts?: string;
};

async function seedLogs() {
  const logsDir = resolvePath("logs");
  let files: string[];
  try {
    files = await fs.readdir(logsDir);
  } catch { return; }

  let sessionCount = 0;
  let toolCount = 0;

  for (const file of files.filter((f) => f.endsWith(".jsonl"))) {
    const entries = await readJSONL<SessionEntry>(path.join(logsDir, file));
    for (const entry of entries) {
      if (entry.type === "session" && entry.project && entry.date) {
        await db.session.create({
          data: {
            type: entry.type,
            project: entry.project,
            date: new Date(entry.date),
            tasksCompleted: entry.tasksCompleted ?? [],
            commitHash: entry.commitHash ?? null,
            sessionNotes: entry.sessionNotes ?? null,
            totalTokens: entry.totalTokens ?? null,
            totalCostUSD: entry.totalCostUSD ?? null,
            durationMin: entry.durationMin ?? null,
            filesChanged: entry.filesChanged ?? undefined,
            risks: entry.risks ?? [],
            lessonSaved: entry.lessonSaved ?? null,
          },
        });
        sessionCount++;
      } else if (entry.tool && entry.tokens) {
        await db.toolUsage.create({
          data: {
            date: entry.ts ? new Date(entry.ts) : new Date(),
            tool: entry.tool,
            tokens: entry.tokens,
          },
        });
        toolCount++;
      }
    }
  }
  console.log(`  ✓ Sessions: ${sessionCount}, ToolUsage: ${toolCount}`);
}

// ─── Lessons ─────────────────────────────────────────────────────────────────

async function seedLessons() {
  const md = await readMarkdown(resolvePath("memory", "global", "lessons.md"));
  if (!md) return;

  let framework = "general";
  let count = 0;
  for (const line of md.split("\n")) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) { framework = h2[1].trim().toLowerCase(); continue; }
    const item = line.match(/^-\s+(.+?)(?:\s+\[(\d{4}-\d{2}-\d{2})\])?$/);
    if (item) {
      await db.lesson.create({
        data: { framework, text: item[1].trim(), date: item[2] ? new Date(item[2]) : null },
      });
      count++;
    }
  }
  console.log(`  ✓ Lessons: ${count}`);
}

// ─── MCP Servers + Profiles ───────────────────────────────────────────────────

type McpJSON = { mcpServers: Record<string, { type?: string; url?: string; command?: string; args?: string[] }> };
type ProfileJSON = { profile: string; description: string; servers: string[]; use_when: string };

async function seedMcp() {
  const mcpJson = await readJSON<McpJSON>(resolvePath("mcp", ".mcp.json"))
    ?? await readJSON<McpJSON>(resolvePath(".mcp.json"));

  if (mcpJson?.mcpServers) {
    for (const [name, cfg] of Object.entries(mcpJson.mcpServers)) {
      await db.mcpServer.upsert({
        where: { name },
        create: { name, type: cfg.type ?? "stdio", url: cfg.url ?? null, command: cfg.command ?? null, args: cfg.args ?? [] },
        update: {},
      });
    }
    console.log(`  ✓ MCP servers: ${Object.keys(mcpJson.mcpServers).length}`);
  }

  const profilesDir = resolvePath("mcp", "profiles");
  let profileFiles: string[];
  try { profileFiles = (await fs.readdir(profilesDir)).filter((f) => f.endsWith(".json")); }
  catch { return; }

  for (const file of profileFiles) {
    const data = await readJSON<ProfileJSON>(path.join(profilesDir, file));
    if (!data?.profile) continue;
    await db.mcpProfile.upsert({
      where: { profile: data.profile },
      create: { profile: data.profile, description: data.description ?? "", servers: data.servers ?? [], useWhen: data.use_when ?? "" },
      update: {},
    });
  }
  console.log(`  ✓ MCP profiles: ${profileFiles.length}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding database from", ROOT);
  await seedProjects();
  await seedLogs();
  await seedLessons();
  await seedMcp();
  console.log("✅ Seed complete");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
