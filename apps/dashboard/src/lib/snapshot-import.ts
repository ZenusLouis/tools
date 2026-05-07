import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { snapshotHash } from "@/lib/snapshots";

type SnapshotTask = {
  id?: unknown;
  name?: unknown;
  summary?: unknown;
  details?: unknown;
  acceptanceCriteria?: unknown;
  steps?: unknown;
  reqIds?: unknown;
  priority?: unknown;
  risk?: unknown;
  status?: unknown;
  estimate?: unknown;
  deps?: unknown;
  phase?: unknown;
};

type SnapshotFeature = {
  id?: unknown;
  name?: unknown;
  order?: unknown;
  tasks?: unknown;
};

type SnapshotModule = {
  id?: unknown;
  name?: unknown;
  order?: unknown;
  features?: unknown;
};

type SnapshotProject = {
  name?: unknown;
  path?: unknown;
  frameworks?: unknown;
  lastIndexed?: unknown;
  activeTask?: unknown;
  links?: unknown;
  docs?: unknown;
  mcpProfile?: unknown;
  modules?: unknown;
};

type ImportSummary = {
  projects: number;
  modules: number;
  features: number;
  tasks: number;
  roles: number;
  skills: number;
  memories: number;
  skippedLocalPaths: number;
};

const TASK_STATUSES = new Set(["pending", "in_progress", "completed", "blocked"]);
const TASK_PHASES = new Set(["pending", "analysis", "ready_for_dev", "implementation", "review", "done", "blocked"]);
const PROVIDERS = new Set(["claude", "codex", "chatgpt"]);
const ROLE_PHASES = new Set(["analysis", "implementation", "review", "research", "design", "custom"]);
const EXECUTION_MODES = new Set(["local", "dashboard"]);

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function intValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function dateValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return objectValue(value) as Prisma.InputJsonObject;
}

function verifyHash(snapshot: Record<string, unknown>) {
  const expected = typeof snapshot.hash === "string" ? snapshot.hash : null;
  if (!expected) return { ok: true, expected: null, actual: null };
  const withoutHash = Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== "hash"));
  const actual = snapshotHash(withoutHash);
  return { ok: expected === actual, expected, actual };
}

async function importProject(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  rawProject: SnapshotProject,
): Promise<Pick<ImportSummary, "projects" | "modules" | "features" | "tasks" | "skippedLocalPaths">> {
  const name = stringValue(rawProject.name);
  if (!name) throw new Error("Snapshot project is missing name.");
  const modules = Array.isArray(rawProject.modules) ? rawProject.modules as SnapshotModule[] : [];

  await tx.project.upsert({
    where: { name },
    create: {
      name,
      workspaceId,
      path: nullableString(rawProject.path),
      frameworks: stringList(rawProject.frameworks),
      lastIndexed: dateValue(rawProject.lastIndexed),
      activeTask: nullableString(rawProject.activeTask),
      links: jsonValue(rawProject.links),
      docs: jsonValue(rawProject.docs),
      mcpProfile: nullableString(rawProject.mcpProfile),
    },
    update: {
      workspaceId,
      path: nullableString(rawProject.path),
      frameworks: stringList(rawProject.frameworks),
      lastIndexed: dateValue(rawProject.lastIndexed),
      activeTask: nullableString(rawProject.activeTask),
      links: jsonValue(rawProject.links),
      docs: jsonValue(rawProject.docs),
      mcpProfile: nullableString(rawProject.mcpProfile),
    },
  });

  await tx.task.deleteMany({ where: { feature: { module: { projectName: name } } } });
  await tx.feature.deleteMany({ where: { module: { projectName: name } } });
  await tx.module.deleteMany({ where: { projectName: name } });

  let moduleCount = 0;
  let featureCount = 0;
  let taskCount = 0;
  for (const [moduleIndex, rawModule] of modules.entries()) {
    const moduleId = stringValue(rawModule.id, `${name}-M${moduleIndex}`);
    await tx.module.create({
      data: {
        id: moduleId,
        projectName: name,
        name: stringValue(rawModule.name, `Module ${moduleIndex + 1}`),
        order: intValue(rawModule.order, moduleIndex),
      },
    });
    moduleCount++;
    const features = Array.isArray(rawModule.features) ? rawModule.features as SnapshotFeature[] : [];
    for (const [featureIndex, rawFeature] of features.entries()) {
      const featureId = stringValue(rawFeature.id, `${moduleId}-F${featureIndex}`);
      await tx.feature.create({
        data: {
          id: featureId,
          moduleId,
          name: stringValue(rawFeature.name, `Feature ${featureIndex + 1}`),
          order: intValue(rawFeature.order, featureIndex),
        },
      });
      featureCount++;
      const tasks = Array.isArray(rawFeature.tasks) ? rawFeature.tasks as SnapshotTask[] : [];
      for (const [taskIndex, rawTask] of tasks.entries()) {
        const taskId = stringValue(rawTask.id, `${featureId}-T${taskIndex + 1}`);
        const status = stringValue(rawTask.status, "pending");
        const phase = nullableString(rawTask.phase);
        await tx.task.create({
          data: {
            id: taskId,
            workspaceId,
            featureId,
            name: stringValue(rawTask.name, `Task ${taskIndex + 1}`),
            summary: nullableString(rawTask.summary),
            details: nullableString(rawTask.details),
            acceptanceCriteria: stringList(rawTask.acceptanceCriteria),
            steps: stringList(rawTask.steps),
            reqIds: stringList(rawTask.reqIds),
            priority: nullableString(rawTask.priority),
            risk: nullableString(rawTask.risk),
            status: TASK_STATUSES.has(status) ? status as Prisma.TaskCreateInput["status"] : "pending",
            estimate: nullableString(rawTask.estimate),
            deps: stringList(rawTask.deps),
            phase: phase && TASK_PHASES.has(phase) ? phase as Prisma.TaskCreateInput["phase"] : null,
          },
        });
        taskCount++;
      }
    }
  }

  return {
    projects: 1,
    modules: moduleCount,
    features: featureCount,
    tasks: taskCount,
    skippedLocalPaths: Array.isArray((rawProject as Record<string, unknown>).localPaths)
      ? ((rawProject as Record<string, unknown>).localPaths as unknown[]).length
      : 0,
  };
}

export async function importDbSnapshot(
  client: PrismaClient,
  workspaceId: string,
  snapshot: unknown,
): Promise<{ summary: ImportSummary; hash: { expected: string | null; actual: string | null } }> {
  const root = objectValue(snapshot);
  if (root.schemaVersion !== 1 || root.snapshotVersion !== 1) {
    throw new Error("Unsupported snapshot schema/version.");
  }
  const hashCheck = verifyHash(root);
  if (!hashCheck.ok) {
    throw new Error(`Snapshot hash mismatch. Expected ${hashCheck.expected}, got ${hashCheck.actual}.`);
  }

  const summary: ImportSummary = {
    projects: 0,
    modules: 0,
    features: 0,
    tasks: 0,
    roles: 0,
    skills: 0,
    memories: 0,
    skippedLocalPaths: 0,
  };

  await client.$transaction(async (tx) => {
    const projectItems = Array.isArray(root.projects)
      ? root.projects as SnapshotProject[]
      : root.project && typeof root.project === "object"
        ? [{ ...(root.project as Record<string, unknown>), modules: root.modules, localPaths: root.localPaths }]
        : [];

    for (const project of projectItems) {
      const result = await importProject(tx, workspaceId, project);
      summary.projects += result.projects;
      summary.modules += result.modules;
      summary.features += result.features;
      summary.tasks += result.tasks;
      summary.skippedLocalPaths += result.skippedLocalPaths;
    }

    const skills = Array.isArray(root.skills) ? root.skills as Array<Record<string, unknown>> : [];
    for (const skill of skills) {
      const slug = stringValue(skill.slug);
      if (!slug) continue;
      await tx.skillDefinition.upsert({
        where: { workspaceId_slug: { workspaceId, slug } },
        create: {
          workspaceId,
          slug,
          name: stringValue(skill.name, slug),
          category: stringValue(skill.category, "imported"),
          sourceType: stringValue(skill.sourceType, "snapshot"),
          sourcePriority: intValue(skill.sourcePriority, 45),
          contentHash: nullableString(skill.contentHash),
          importMode: stringValue(skill.importMode, "metadata"),
          trustedSourceSlug: nullableString(skill.trustedSourceSlug),
          sourcePath: nullableString(skill.sourcePath),
          compactGuidance: nullableString(skill.compactGuidance),
          description: stringValue(skill.description, `${slug} imported from DB snapshot`),
          providerCompatibility: stringList(skill.providerCompatibility),
          roleCompatibility: stringList(skill.roleCompatibility),
          tags: stringList(skill.tags),
          metadata: jsonValue(skill.metadata),
          isImported: true,
          isRemote: Boolean(skill.isRemote),
        },
        update: {
          name: stringValue(skill.name, slug),
          category: stringValue(skill.category, "imported"),
          sourceType: stringValue(skill.sourceType, "snapshot"),
          sourcePriority: intValue(skill.sourcePriority, 45),
          contentHash: nullableString(skill.contentHash),
          importMode: stringValue(skill.importMode, "metadata"),
          trustedSourceSlug: nullableString(skill.trustedSourceSlug),
          sourcePath: nullableString(skill.sourcePath),
          compactGuidance: nullableString(skill.compactGuidance),
          description: stringValue(skill.description, `${slug} imported from DB snapshot`),
          providerCompatibility: stringList(skill.providerCompatibility),
          roleCompatibility: stringList(skill.roleCompatibility),
          tags: stringList(skill.tags),
          metadata: jsonValue(skill.metadata),
          isImported: true,
          isRemote: Boolean(skill.isRemote),
        },
      });
      summary.skills++;
    }

    const roles = Array.isArray(root.roles) ? root.roles as Array<Record<string, unknown>> : [];
    for (const role of roles) {
      const slug = stringValue(role.slug);
      if (!slug) continue;
      const provider = stringValue(role.provider, "claude");
      const phase = stringValue(role.phase, "custom");
      const executionMode = stringValue(role.executionModeDefault, "local");
      await tx.agentRole.upsert({
        where: { workspaceId_slug: { workspaceId, slug } },
        create: {
          workspaceId,
          slug,
          name: stringValue(role.name, slug),
          description: stringValue(role.description, `${slug} imported from DB snapshot`),
          provider: PROVIDERS.has(provider) ? provider as Prisma.AgentRoleCreateInput["provider"] : "claude",
          phase: ROLE_PHASES.has(phase) ? phase as Prisma.AgentRoleCreateInput["phase"] : "custom",
          defaultModel: nullableString(role.defaultModel),
          executionModeDefault: EXECUTION_MODES.has(executionMode) ? executionMode as Prisma.AgentRoleCreateInput["executionModeDefault"] : "local",
          credentialService: stringValue(role.credentialService, "none"),
          roleType: stringValue(role.roleType, "custom"),
          rulesMarkdown: stringValue(role.rulesMarkdown, ""),
          mcpProfile: nullableString(role.mcpProfile),
          generatedPaths: jsonValue(role.generatedPaths),
          isBuiltin: Boolean(role.isBuiltin),
          skills: { connect: stringList(role.skills).map((skillSlug) => ({ workspaceId_slug: { workspaceId, slug: skillSlug } })) },
        },
        update: {
          name: stringValue(role.name, slug),
          description: stringValue(role.description, `${slug} imported from DB snapshot`),
          provider: PROVIDERS.has(provider) ? provider as Prisma.AgentRoleUpdateInput["provider"] : "claude",
          phase: ROLE_PHASES.has(phase) ? phase as Prisma.AgentRoleUpdateInput["phase"] : "custom",
          defaultModel: nullableString(role.defaultModel),
          executionModeDefault: EXECUTION_MODES.has(executionMode) ? executionMode as Prisma.AgentRoleUpdateInput["executionModeDefault"] : "local",
          credentialService: stringValue(role.credentialService, "none"),
          roleType: stringValue(role.roleType, "custom"),
          rulesMarkdown: stringValue(role.rulesMarkdown, ""),
          mcpProfile: nullableString(role.mcpProfile),
          generatedPaths: jsonValue(role.generatedPaths),
          isBuiltin: Boolean(role.isBuiltin),
          skills: { set: stringList(role.skills).map((skillSlug) => ({ workspaceId_slug: { workspaceId, slug: skillSlug } })) },
        },
      });
      summary.roles++;
    }

    const memories = Array.isArray(root.memories) ? root.memories as Array<Record<string, unknown>> : [];
    for (const memory of memories) {
      const key = stringValue(memory.key);
      if (!key) continue;
      await tx.memoryNode.upsert({
        where: { workspaceId_key: { workspaceId, key } },
        create: {
          workspaceId,
          projectName: nullableString(memory.projectName),
          kind: stringValue(memory.kind, "note"),
          key,
          title: stringValue(memory.title, key),
          body: stringValue(memory.body, ""),
          tags: stringList(memory.tags),
          reqIds: stringList(memory.reqIds),
          sourcePath: nullableString(memory.sourcePath),
          metadata: jsonValue(memory.metadata),
        },
        update: {
          projectName: nullableString(memory.projectName),
          kind: stringValue(memory.kind, "note"),
          title: stringValue(memory.title, key),
          body: stringValue(memory.body, ""),
          tags: stringList(memory.tags),
          reqIds: stringList(memory.reqIds),
          sourcePath: nullableString(memory.sourcePath),
          metadata: jsonValue(memory.metadata),
        },
      });
      summary.memories++;
    }
  }, { timeout: 30_000 });

  return { summary, hash: { expected: hashCheck.expected, actual: hashCheck.actual } };
}
