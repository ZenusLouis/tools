import fs from "fs/promises";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import type { Dirent } from "fs";

type Db = PrismaClient;

type SyncOptions = {
  includeLogs?: boolean;
  includeLessons?: boolean;
  includeMcp?: boolean;
  includeProjects?: boolean;
  includeSkillsAndRoles?: boolean;
  onlyIfEmpty?: boolean;
};

type SyncResult = {
  projects: number;
  modules: number;
  features: number;
  tasks: number;
  decisions: number;
  lessons: number;
  mcpServers: number;
  mcpProfiles: number;
  sessions: number;
  toolUsages: number;
  skills: number;
  roles: number;
};

const emptyResult = (): SyncResult => ({
  projects: 0,
  modules: 0,
  features: 0,
  tasks: 0,
  decisions: 0,
  lessons: 0,
  mcpServers: 0,
  mcpProfiles: 0,
  sessions: 0,
  toolUsages: 0,
  skills: 0,
  roles: 0,
});

function resolveRoot(root: string, ...parts: string[]) {
  return path.join(root, ...parts);
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
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

function parseFrontmatter(text: string): Record<string, string> {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
  return data;
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
    if (entry.isFile() && entry.name === "SKILL.md") found.push(full);
  }
  return found;
}

function inferCategory(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  const idx = parts.findIndex((part) => part === "skills");
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : "custom";
}

function roleCompatibility(category: string, tags: string[]) {
  if (category === "analysis" || tags.includes("ba")) return ["ba", "reviewer"];
  if (category === "frameworks") return ["dev", "qa"];
  if (tags.includes("qa") || tags.includes("testing")) return ["qa", "dev"];
  if (tags.includes("review")) return ["reviewer"];
  if (tags.includes("design")) return ["design"];
  return ["researcher"];
}

function taskPhaseFromStatus(status: string) {
  if (status === "completed") return "done";
  if (status === "blocked") return "blocked";
  if (status === "in_progress" || status === "in-progress") return "implementation";
  return "pending";
}

function credentialFor(provider: string) {
  return provider === "claude" ? "anthropic" : provider === "chatgpt" ? "openai" : "none";
}

function modeFor(provider: string) {
  return provider === "chatgpt" ? "dashboard" : "local";
}

function roleTypeFor(slug: string, phase: string) {
  if (slug.includes("qa")) return "qa";
  if (phase === "implementation") return "dev";
  if (phase === "review") return "reviewer";
  if (phase === "research") return "researcher";
  return phase;
}

type RegistryJSON = Record<string, string>;
type ContextJSON = {
  path?: string;
  framework?: string[];
  lastIndexed?: string;
  activeTask?: string | null;
  tools?: Record<string, string>;
  docs?: Record<string, string>;
  mcpProfile?: string;
};
type ProgressTask = { id: string; name: string; status: string; estimate?: string | null; deps?: string[] };
type ProgressFeature = { id: string; name: string; tasks: ProgressTask[] };
type ProgressModule = { id: string; name: string; features: ProgressFeature[] };
type ProgressJSON = { modules?: ProgressModule[] };

async function syncProjects(db: Db, workspaceId: string, root: string, result: SyncResult) {
  const registry = await readJSON<RegistryJSON>(resolveRoot(root, "projects", "registry.json"));
  if (!registry) return;

  for (const [projectName, relPath] of Object.entries(registry).filter(([key]) => !key.startsWith("_"))) {
    const projectRoot = resolveRoot(root, relPath);
    const ctx = await readJSON<ContextJSON>(path.join(projectRoot, "context.json"));
    if (!ctx) continue;

    await db.project.upsert({
      where: { name: projectName },
      create: {
        name: projectName,
        workspaceId,
        path: ctx.path ?? null,
        frameworks: ctx.framework ?? [],
        lastIndexed: ctx.lastIndexed ? new Date(ctx.lastIndexed) : null,
        activeTask: ctx.activeTask ?? null,
        links: ctx.tools ?? {},
        docs: ctx.docs ?? {},
        mcpProfile: ctx.mcpProfile ?? null,
      },
      update: {
        workspaceId,
        path: ctx.path ?? null,
        frameworks: ctx.framework ?? [],
        lastIndexed: ctx.lastIndexed ? new Date(ctx.lastIndexed) : null,
        activeTask: ctx.activeTask ?? null,
        links: ctx.tools ?? {},
        docs: ctx.docs ?? {},
        mcpProfile: ctx.mcpProfile ?? null,
      },
    });
    result.projects++;

    const progress = await readJSON<ProgressJSON>(path.join(projectRoot, "progress.json"));
    for (const [moduleOrder, mod] of (progress?.modules ?? []).entries()) {
      await db.module.upsert({
        where: { id: mod.id },
        create: { id: mod.id, projectName, name: mod.name, order: moduleOrder },
        update: { projectName, name: mod.name, order: moduleOrder },
      });
      result.modules++;

      for (const [featureOrder, feature] of mod.features.entries()) {
        const featureId = `${mod.id}-${feature.id}`;
        await db.feature.upsert({
          where: { id: featureId },
          create: { id: featureId, moduleId: mod.id, name: feature.name, order: featureOrder },
          update: { moduleId: mod.id, name: feature.name, order: featureOrder },
        });
        result.features++;

        for (const task of feature.tasks) {
          const status = task.status === "in-progress" ? "in_progress" : task.status;
          await db.task.upsert({
            where: { id: task.id },
            create: {
              id: task.id,
              workspaceId,
              featureId,
              name: task.name,
              status: status as never,
              phase: taskPhaseFromStatus(status) as never,
              estimate: task.estimate ?? null,
              deps: task.deps ?? [],
            },
            update: {
              workspaceId,
              featureId,
              name: task.name,
              status: status as never,
              phase: taskPhaseFromStatus(status) as never,
              estimate: task.estimate ?? null,
              deps: task.deps ?? [],
            },
          });
          result.tasks++;
        }
      }
    }

    await syncDecisions(db, projectName, path.join(projectRoot, "decisions.md"), result);
  }
}

async function syncDecisions(db: Db, projectName: string, filePath: string, result: SyncResult) {
  const markdown = await readMarkdown(filePath);
  if (!markdown) return;

  const blocks = markdown.split(/\n(?=###\s+)/).filter((block) => block.trim().startsWith("### "));
  for (const block of blocks) {
    const [heading = "", ...bodyLines] = block.trim().split(/\r?\n/);
    const title = heading.replace(/^###\s+/, "").trim();
    const key = title.match(/^(D\d+)/)?.[1] ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!key) continue;
    await db.decision.deleteMany({ where: { projectName, decisionKey: key } });
    await db.decision.create({ data: { projectName, decisionKey: key, title, body: bodyLines.join("\n").trim() } });
    result.decisions++;
  }
}

async function syncLessons(db: Db, root: string, result: SyncResult) {
  const markdown = await readMarkdown(resolveRoot(root, "memory", "global", "lessons.md"));
  if (!markdown) return;

  await db.lesson.deleteMany({});
  let framework = "general";
  for (const line of markdown.split(/\r?\n/)) {
    const section = line.match(/^##\s+(.+)/);
    if (section) {
      framework = section[1].trim().toLowerCase();
      continue;
    }
    const item = line.match(/^-\s+(.+?)(?:\s+\[(\d{4}-\d{2}-\d{2})\])?$/);
    if (!item) continue;
    await db.lesson.create({ data: { framework, text: item[1].trim(), date: item[2] ? new Date(item[2]) : null } });
    result.lessons++;
  }
}

type McpJSON = { mcpServers: Record<string, { type?: string; url?: string; command?: string; args?: string[] }> };
type ProfileJSON = { profile: string; description?: string; servers?: string[]; use_when?: string };

async function syncMcp(db: Db, root: string, result: SyncResult) {
  const mcpJson = await readJSON<McpJSON>(resolveRoot(root, "mcp", ".mcp.json")) ?? await readJSON<McpJSON>(resolveRoot(root, ".mcp.json"));
  if (mcpJson?.mcpServers) {
    for (const [name, cfg] of Object.entries(mcpJson.mcpServers)) {
      await db.mcpServer.upsert({
        where: { name },
        create: { name, type: cfg.type ?? "stdio", url: cfg.url ?? null, command: cfg.command ?? null, args: cfg.args ?? [] },
        update: { type: cfg.type ?? "stdio", url: cfg.url ?? null, command: cfg.command ?? null, args: cfg.args ?? [] },
      });
      result.mcpServers++;
    }
  }

  const profileFiles = (await fs.readdir(resolveRoot(root, "mcp", "profiles")).catch(() => [])).filter((file) => file.endsWith(".json"));
  for (const file of profileFiles) {
    const data = await readJSON<ProfileJSON>(resolveRoot(root, "mcp", "profiles", file));
    if (!data?.profile) continue;
    await db.mcpProfile.upsert({
      where: { profile: data.profile },
      create: { profile: data.profile, description: data.description ?? "", servers: data.servers ?? [], useWhen: data.use_when ?? "" },
      update: { description: data.description ?? "", servers: data.servers ?? [], useWhen: data.use_when ?? "" },
    });
    result.mcpProfiles++;
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
  provider?: "claude" | "codex" | "chatgpt";
  role?: string;
  model?: string;
};

async function syncLogs(db: Db, workspaceId: string, root: string, result: SyncResult) {
  const files = (await fs.readdir(resolveRoot(root, "logs")).catch(() => [])).filter((file) => file.endsWith(".jsonl"));
  await db.session.deleteMany({ where: { workspaceId, transcriptPath: null, deviceId: null } });
  await db.toolUsage.deleteMany({ where: { workspaceId, deviceId: null } });

  for (const file of files) {
    const entries = await readJSONL<SessionEntry>(resolveRoot(root, "logs", file));
    for (const entry of entries) {
      if (entry.type === "session" && entry.project && entry.date) {
        await db.session.create({
          data: {
            workspaceId,
            type: entry.type,
            provider: entry.provider ?? "claude",
            role: entry.role ?? null,
            model: entry.model ?? null,
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
        result.sessions++;
      } else if (entry.tool && entry.tokens) {
        await db.toolUsage.create({
          data: {
            workspaceId,
            provider: entry.provider ?? "claude",
            role: entry.role ?? null,
            model: entry.model ?? null,
            date: entry.ts ? new Date(entry.ts) : new Date(),
            tool: entry.tool,
            tokens: entry.tokens,
          },
        });
        result.toolUsages++;
      }
    }
  }
}

type SeedSkill = {
  name: string;
  description: string;
  category: string;
  sourcePath: string | null;
  tags: string[];
  roleCompatibility: string[];
  isImported: boolean;
  isRemote: boolean;
};

type RoleFile = {
  slug: string;
  name: string;
  provider: "claude" | "codex" | "chatgpt";
  phase: "analysis" | "implementation" | "review" | "research" | "design" | "custom";
  defaultCommand?: string;
  description?: string;
  rulesMarkdown?: string;
  skills?: string[];
};

async function syncSkillsAndRoles(db: Db, workspaceId: string, root: string, result: SyncResult) {
  const skillsBySlug = new Map<string, SeedSkill>();
  const mergeSkill = (skill: SeedSkill) => {
    const existing = skillsBySlug.get(skill.name);
    if (!existing) {
      skillsBySlug.set(skill.name, skill);
      return;
    }
    const existingIsWrapper = existing.sourcePath?.includes("github-sources") ?? false;
    const skillIsWrapper = skill.sourcePath?.includes("github-sources") ?? false;
    const hasLocalWrapper = existingIsWrapper || skillIsWrapper;
    skillsBySlug.set(skill.name, {
      name: existing.name,
      description: existing.description || skill.description,
      category: existing.category === "marketplace" && skill.category !== "marketplace" ? skill.category : existing.category,
      sourcePath: hasLocalWrapper ? (existingIsWrapper ? existing.sourcePath : skill.sourcePath) : (existing.sourcePath ?? skill.sourcePath),
      tags: Array.from(new Set([...existing.tags, ...skill.tags])),
      roleCompatibility: Array.from(new Set([...existing.roleCompatibility, ...skill.roleCompatibility])),
      isImported: existing.isImported || skill.isImported || hasLocalWrapper,
      isRemote: hasLocalWrapper ? false : existing.isRemote || skill.isRemote,
    });
  };

  for (const file of await collectSkillFiles(resolveRoot(root, "skills"))) {
    const text = await readMarkdown(file);
    const frontmatter = parseFrontmatter(text);
    const name = frontmatter.name ?? path.basename(path.dirname(file));
    const category = inferCategory(file);
    const tags = [category, name];
    mergeSkill({
      name,
      description: frontmatter.description ?? `${name} skill`,
      category,
      sourcePath: path.relative(root, file).replace(/\\/g, "/"),
      tags,
      roleCompatibility: roleCompatibility(category, tags),
      isImported: category === "imported",
      isRemote: false,
    });
  }

  const marketplace = await readJSON<{ skills?: Array<{ name: string; description: string; tags?: string[]; source?: string }> }>(
    resolveRoot(root, "skills", "imported", "marketplace.json"),
  );
  for (const item of marketplace?.skills ?? []) {
    const tags = [...(item.tags ?? []), ...(item.source ? [`source:${item.source}`] : [])];
    mergeSkill({
      name: item.name,
      description: item.description,
      category: "marketplace",
      sourcePath: item.source ?? null,
      tags,
      roleCompatibility: roleCompatibility("marketplace", tags),
      isImported: true,
      isRemote: true,
    });
  }

  const skills = Array.from(skillsBySlug.values());
  for (const skill of skills) {
    await db.skillDefinition.upsert({
      where: { workspaceId_slug: { workspaceId, slug: skill.name } },
      create: {
        workspaceId,
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
        category: skill.category,
        sourcePath: skill.sourcePath,
        description: skill.description,
        providerCompatibility: ["claude", "codex", "chatgpt"],
        roleCompatibility: skill.roleCompatibility,
        tags: skill.tags,
        isImported: skill.isImported,
        isRemote: skill.isRemote,
      },
    });
    result.skills++;
  }

  const roleFiles = (await fs.readdir(resolveRoot(root, "agents", "roles")).catch(() => [])).filter((file) => file.endsWith(".json"));
  for (const file of roleFiles) {
    const role = await readJSON<RoleFile>(resolveRoot(root, "agents", "roles", file));
    if (!role?.slug || !role.name) continue;
    const skillRows = await db.skillDefinition.findMany({
      where: { workspaceId, slug: { in: role.skills ?? [] } },
      select: { id: true },
    });
    const description = role.description ?? `${role.name} ${role.phase} role synced from agents/roles.`;
    await db.agentRole.upsert({
      where: { workspaceId_slug: { workspaceId, slug: role.slug } },
      create: {
        workspaceId,
        name: role.name,
        slug: role.slug,
        description,
        provider: role.provider,
        phase: role.phase,
        roleType: roleTypeFor(role.slug, role.phase),
        executionModeDefault: modeFor(role.provider),
        credentialService: credentialFor(role.provider),
        isBuiltin: true,
        rulesMarkdown: role.rulesMarkdown ?? `# ${role.name}\n\nDefault command: ${role.defaultCommand ?? "custom"}\n`,
        generatedPaths: {
          shared: `agents/roles/${role.slug}.json`,
          claude: `.claude/roles/${role.slug}.md`,
          codex: `.codex/skills/${role.slug}/SKILL.md`,
          chatgpt: `.agents/providers/chatgpt/roles/${role.slug}.md`,
        },
        skills: { connect: skillRows.map((skill) => ({ id: skill.id })) },
      },
      update: {
        name: role.name,
        description,
        provider: role.provider,
        phase: role.phase,
        roleType: roleTypeFor(role.slug, role.phase),
        executionModeDefault: modeFor(role.provider),
        credentialService: credentialFor(role.provider),
        isBuiltin: true,
        rulesMarkdown: role.rulesMarkdown ?? `# ${role.name}\n\nDefault command: ${role.defaultCommand ?? "custom"}\n`,
        generatedPaths: {
          shared: `agents/roles/${role.slug}.json`,
          claude: `.claude/roles/${role.slug}.md`,
          codex: `.codex/skills/${role.slug}/SKILL.md`,
          chatgpt: `.agents/providers/chatgpt/roles/${role.slug}.md`,
        },
        skills: { set: skillRows.map((skill) => ({ id: skill.id })) },
      },
    });
    result.roles++;
  }
}

export async function syncWorkspaceFromRepo(db: Db, workspaceId: string, root: string, options: SyncOptions = {}) {
  const opts = {
    includeProjects: true,
    includeLessons: true,
    includeMcp: true,
    includeSkillsAndRoles: true,
    includeLogs: false,
    onlyIfEmpty: false,
    ...options,
  };
  const result = emptyResult();

  if (opts.onlyIfEmpty && !(await isWorkspaceEmptyForRepoBootstrap(db, workspaceId))) {
    return result;
  }

  if (opts.includeProjects) await syncProjects(db, workspaceId, root, result);
  if (opts.includeLessons) await syncLessons(db, root, result);
  if (opts.includeMcp) await syncMcp(db, root, result);
  if (opts.includeSkillsAndRoles) await syncSkillsAndRoles(db, workspaceId, root, result);
  if (opts.includeLogs) await syncLogs(db, workspaceId, root, result);

  return result;
}

async function isWorkspaceEmptyForRepoBootstrap(db: Db, workspaceId: string) {
  const [projects, skills, roles, sessions, toolUsages, lessons] = await Promise.all([
    db.project.count({ where: { workspaceId } }),
    db.skillDefinition.count({ where: { workspaceId } }),
    db.agentRole.count({ where: { workspaceId } }),
    db.session.count({ where: { workspaceId } }),
    db.toolUsage.count({ where: { workspaceId } }),
    db.lesson.count(),
  ]);
  return projects + skills + roles + sessions + toolUsages + lessons === 0;
}
