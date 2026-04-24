import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import path from "path";
import { pbkdf2Sync, randomBytes } from "crypto";
import type { Dirent } from "fs";

const db = new PrismaClient();
const ROOT = process.env.CLAUDE_ROOT ?? "d:\\GlobalClaudeSkills";
let defaultWorkspaceId = "";

function resolvePath(...parts: string[]) {
  return path.join(ROOT, ...parts);
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const iterations = 210_000;
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2:${iterations}:${salt}:${hash}`;
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

async function seedIdentity() {
  const workspace = await db.workspace.upsert({
    where: { slug: "default" },
    create: { name: "Default Workspace", slug: "default" },
    update: {},
  });
  defaultWorkspaceId = workspace.id;

  const email = (process.env.ADMIN_EMAIL ?? "admin@gcs.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin123456";
  const user = await db.user.upsert({
    where: { email },
    create: { email, name: "GCS Admin", passwordHash: hashPassword(password) },
    update: {},
  });
  await db.workspaceMember.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    create: { userId: user.id, workspaceId: workspace.id, role: "owner" },
    update: { role: "owner" },
  });
  console.log(`  OK Identity: ${email} / workspace ${workspace.slug}`);
}

type RegistryJSON = Record<string, string>;
type ContextJSON = {
  name: string;
  path?: string;
  framework?: string[];
  lastIndexed?: string;
  activeTask?: string | null;
  tools?: Record<string, string>;
  docs?: Record<string, string>;
  mcpProfile?: string;
};
type ProgressTask = { id: string; name: string; status: string; estimate?: string; deps?: string[] };
type ProgressFeature = { id: string; name: string; tasks: ProgressTask[] };
type ProgressModule = { id: string; name: string; features: ProgressFeature[] };
type ProgressJSON = { modules: ProgressModule[] };

function taskPhaseFromStatus(status: string) {
  if (status === "completed") return "done";
  if (status === "blocked") return "blocked";
  if (status === "in_progress" || status === "in-progress") return "implementation";
  return "pending";
}

async function seedProjects() {
  const registry = await readJSON<RegistryJSON>(resolvePath("projects", "registry.json"));
  if (!registry) {
    console.log("No registry.json found, skipping projects");
    return;
  }

  for (const [projectName, relPath] of Object.entries(registry).filter(([k]) => !k.startsWith("_"))) {
    const projectRoot = resolvePath(relPath);
    const ctx = await readJSON<ContextJSON>(path.join(projectRoot, "context.json"));
    if (!ctx) continue;

    await db.project.upsert({
      where: { name: projectName },
      create: {
        name: projectName,
        workspaceId: defaultWorkspaceId,
        path: ctx.path ?? null,
        frameworks: ctx.framework ?? [],
        lastIndexed: ctx.lastIndexed ? new Date(ctx.lastIndexed) : null,
        activeTask: ctx.activeTask ?? null,
        links: ctx.tools ?? {},
        docs: ctx.docs ?? {},
        mcpProfile: ctx.mcpProfile ?? null,
      },
      update: { workspaceId: defaultWorkspaceId },
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
            create: {
              id: task.id,
              workspaceId: defaultWorkspaceId,
              featureId,
              name: task.name,
              status: status as never,
              phase: taskPhaseFromStatus(status) as never,
              estimate: task.estimate ?? null,
              deps: task.deps ?? [],
            },
            update: { workspaceId: defaultWorkspaceId, phase: taskPhaseFromStatus(status) as never },
          });
        }
      }
    }
    console.log(`  OK Project: ${projectName}`);
  }
}

type SessionEntry = {
  type?: string;
  project?: string;
  date?: string;
  tasksCompleted?: string[];
  commitHash?: string | null;
  sessionNotes?: string | null;
  totalTokens?: number;
  totalCostUSD?: number;
  durationMin?: number;
  filesChanged?: unknown;
  risks?: string[];
  lessonSaved?: string | null;
  tool?: string;
  tokens?: number;
  ts?: string;
};

async function seedLogs() {
  const logsDir = resolvePath("logs");
  let files: string[];
  try {
    files = await fs.readdir(logsDir);
  } catch {
    return;
  }

  let sessionCount = 0;
  let toolCount = 0;

  for (const file of files.filter((f) => f.endsWith(".jsonl"))) {
    const entries = await readJSONL<SessionEntry>(path.join(logsDir, file));
    for (const entry of entries) {
      if (entry.type === "session" && entry.project && entry.date) {
        await db.session.create({
          data: {
            workspaceId: defaultWorkspaceId,
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
            workspaceId: defaultWorkspaceId,
            date: entry.ts ? new Date(entry.ts) : new Date(),
            tool: entry.tool,
            tokens: entry.tokens,
          },
        });
        toolCount++;
      }
    }
  }
  console.log(`  OK Sessions: ${sessionCount}, ToolUsage: ${toolCount}`);
}

async function seedLessons() {
  const md = await readMarkdown(resolvePath("memory", "global", "lessons.md"));
  if (!md) return;

  let framework = "general";
  let count = 0;
  for (const line of md.split("\n")) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      framework = h2[1].trim().toLowerCase();
      continue;
    }
    const item = line.match(/^-\s+(.+?)(?:\s+\[(\d{4}-\d{2}-\d{2})\])?$/);
    if (item) {
      await db.lesson.create({
        data: { framework, text: item[1].trim(), date: item[2] ? new Date(item[2]) : null },
      });
      count++;
    }
  }
  console.log(`  OK Lessons: ${count}`);
}

type McpJSON = { mcpServers: Record<string, { type?: string; url?: string; command?: string; args?: string[] }> };
type ProfileJSON = { profile: string; description: string; servers: string[]; use_when: string };

async function seedMcp() {
  const mcpJson = await readJSON<McpJSON>(resolvePath("mcp", ".mcp.json")) ?? await readJSON<McpJSON>(resolvePath(".mcp.json"));

  if (mcpJson?.mcpServers) {
    for (const [name, cfg] of Object.entries(mcpJson.mcpServers)) {
      await db.mcpServer.upsert({
        where: { name },
        create: { name, type: cfg.type ?? "stdio", url: cfg.url ?? null, command: cfg.command ?? null, args: cfg.args ?? [] },
        update: {},
      });
    }
    console.log(`  OK MCP servers: ${Object.keys(mcpJson.mcpServers).length}`);
  }

  const profilesDir = resolvePath("mcp", "profiles");
  let profileFiles: string[];
  try {
    profileFiles = (await fs.readdir(profilesDir)).filter((f) => f.endsWith(".json"));
  } catch {
    return;
  }

  for (const file of profileFiles) {
    const data = await readJSON<ProfileJSON>(path.join(profilesDir, file));
    if (!data?.profile) continue;
    await db.mcpProfile.upsert({
      where: { profile: data.profile },
      create: { profile: data.profile, description: data.description ?? "", servers: data.servers ?? [], useWhen: data.use_when ?? "" },
      update: {},
    });
  }
  console.log(`  OK MCP profiles: ${profileFiles.length}`);
}

function parseFrontmatter(text: string): Record<string, string> {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
  return data;
}

function inferCategory(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  const idx = parts.findIndex((p) => p === "skills");
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : "custom";
}

async function collectSkillFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await collectSkillFiles(full));
    else if (entry.isFile() && entry.name === "SKILL.md") found.push(full);
  }
  return found;
}

async function seedSkillsAndRoles() {
  const skillFiles = await collectSkillFiles(resolvePath("skills"));
  const skills: Array<{
    name: string;
    description: string;
    category: string;
    sourcePath: string | null;
    tags: string[];
    roleCompatibility: string[];
    isImported: boolean;
    isRemote: boolean;
  }> = [];

  for (const file of skillFiles) {
    const text = await readMarkdown(file);
    const fm = parseFrontmatter(text);
    const name = fm.name ?? path.basename(path.dirname(file));
    const category = inferCategory(file);
    skills.push({
      name,
      description: fm.description ?? `${name} skill`,
      category,
      sourcePath: path.relative(ROOT, file).replace(/\\/g, "/"),
      tags: [category, name],
      roleCompatibility: category === "analysis" ? ["ba", "reviewer"] : category === "frameworks" ? ["dev", "qa"] : [category],
      isImported: false,
      isRemote: false,
    });
  }

  const marketplace = await readJSON<{ skills?: Array<{ name: string; description: string; tags?: string[]; source?: string }> }>(resolvePath("skills", "imported", "marketplace.json"));
  for (const item of marketplace?.skills ?? []) {
    skills.push({
      name: item.name,
      description: item.description,
      category: "marketplace",
      sourcePath: item.source ?? null,
      tags: item.tags ?? [],
      roleCompatibility: item.tags?.includes("testing") ? ["qa", "dev"] : item.tags?.includes("review") ? ["reviewer"] : ["researcher"],
      isImported: true,
      isRemote: true,
    });
  }

  for (const skill of skills) {
    await db.skillDefinition.upsert({
      where: { workspaceId_slug: { workspaceId: defaultWorkspaceId, slug: skill.name } },
      create: {
        workspaceId: defaultWorkspaceId,
        name: skill.name,
        slug: skill.name,
        category: skill.category,
        sourcePath: skill.sourcePath,
        description: skill.description,
        providerCompatibility: ["claude", "codex", "chatgpt"],
        roleCompatibility: skill.roleCompatibility,
        tags: skill.tags,
        isImported: skill.isImported,
        isRemote: skill.isRemote,
      },
      update: {
        description: skill.description,
        sourcePath: skill.sourcePath,
        providerCompatibility: ["claude", "codex", "chatgpt"],
        roleCompatibility: skill.roleCompatibility,
        tags: skill.tags,
        isImported: skill.isImported,
        isRemote: skill.isRemote,
      },
    });
  }

  const roleSeeds = [
    ["BA Analyst", "ba-analyst", "claude", "analysis", "ba", "anthropic", ["requirement-analyzer", "clarifier", "architecture-designer", "project-context", "token-saver", "context7"], "Reads docs, clarifies requirements, and prepares implementation briefs."],
    ["Dev Implementer", "dev-implementer", "codex", "implementation", "dev", "openai", ["project-context", "token-saver", "nextjs", "react", "nestjs", "spring-boot", "fastapi", "django", "dotnet", "qodo-skills"], "Implements tasks from BA briefs, changes code, and runs checks."],
    ["Research Reviewer", "research-reviewer", "chatgpt", "review", "reviewer", "openai", ["clarifier", "architecture-designer", "project-context", "context7", "pr-review-toolkit"], "Reviews implementation, researches docs, and flags risks."],
    ["QA Test Engineer", "qa-test-engineer", "codex", "review", "qa", "openai", ["project-context", "token-saver", "qodo-skills", "pr-review-toolkit"], "Focuses on test coverage, regression checks, and quality gates."],
    ["Design Integrator", "design-integrator", "claude", "design", "design", "anthropic", ["figma-design", "stitch", "nextjs", "react"], "Connects design sources to implementation plans."],
    ["Knowledge Curator", "knowledge-curator", "claude", "research", "researcher", "anthropic", ["learn", "auto-learner", "project-context"], "Captures lessons and maintains reusable project knowledge."],
  ] as const;

  for (const [name, slug, provider, phase, roleType, credentialService, skillSlugs, description] of roleSeeds) {
    const roleSkills = await db.skillDefinition.findMany({
      where: { workspaceId: defaultWorkspaceId, slug: { in: [...skillSlugs] } },
      select: { id: true },
    });
    await db.agentRole.upsert({
      where: { workspaceId_slug: { workspaceId: defaultWorkspaceId, slug } },
      create: {
        workspaceId: defaultWorkspaceId,
        name,
        slug,
        description,
        provider: provider as never,
        phase: phase as never,
        roleType,
        credentialService,
        executionModeDefault: provider === "chatgpt" ? "dashboard" : "local",
        isBuiltin: true,
        rulesMarkdown: `# ${name}\n\n${description}\n`,
        generatedPaths: {},
        skills: { connect: roleSkills.map((s) => ({ id: s.id })) },
      },
      update: {
        description,
        isBuiltin: true,
        skills: { set: roleSkills.map((s) => ({ id: s.id })) },
      },
    });
  }
  console.log(`  OK Skills: ${skills.length}, Roles: ${roleSeeds.length}`);
}

async function main() {
  console.log("Seeding database from", ROOT);
  await seedIdentity();
  await seedProjects();
  await seedLogs();
  await seedLessons();
  await seedMcp();
  await seedSkillsAndRoles();
  console.log("Seed complete");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
