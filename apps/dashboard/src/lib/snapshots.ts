import { createHash } from "crypto";
import { db } from "@/lib/db";

export function snapshotHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function attachSnapshotHash<T extends Record<string, unknown>>(snapshot: T): T & { hash: string } {
  return { ...snapshot, hash: snapshotHash(snapshot) };
}

export async function buildProjectSnapshot(workspaceId: string, projectName: string) {
  const project = await db.project.findFirst({
    where: { name: projectName, workspaceId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          features: {
            orderBy: { order: "asc" },
            include: { tasks: { orderBy: { id: "asc" } } },
          },
        },
      },
      bridgePaths: {
        include: { device: { select: { deviceKey: true, name: true, lastSeenAt: true } } },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!project) return null;
  const exportedAt = new Date().toISOString();
  return {
    schemaVersion: 1,
    snapshotVersion: 1,
    workspaceId,
    projectName: project.name,
    exportedAt,
    project: {
      name: project.name,
      path: project.path,
      frameworks: project.frameworks,
      lastIndexed: project.lastIndexed?.toISOString() ?? null,
      activeTask: project.activeTask,
      links: project.links,
      docs: project.docs,
      mcpProfile: project.mcpProfile,
    },
    localPaths: project.bridgePaths.map((path) => ({
      deviceId: path.deviceId,
      deviceKey: path.device.deviceKey,
      deviceName: path.device.name,
      path: path.path,
      lastSyncedAt: path.lastSyncedAt?.toISOString() ?? null,
      deviceLastSeenAt: path.device.lastSeenAt?.toISOString() ?? null,
    })),
    modules: project.modules.map((module) => ({
      id: module.id,
      name: module.name,
      order: module.order,
      features: module.features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        order: feature.order,
        tasks: feature.tasks.map((task) => ({
          id: task.id,
          name: task.name,
          summary: task.summary,
          details: task.details,
          acceptanceCriteria: task.acceptanceCriteria,
          steps: task.steps,
          reqIds: task.reqIds,
          priority: task.priority,
          risk: task.risk,
          status: task.status,
          estimate: task.estimate,
          deps: task.deps,
          phase: task.phase,
        })),
      })),
    })),
  };
}

export async function buildWorkspaceSnapshot(workspaceId: string) {
  const [projects, roles, skills, sessions, toolUsage, runTelemetries, memories] = await Promise.all([
    db.project.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            features: {
              orderBy: { order: "asc" },
              include: { tasks: { orderBy: { id: "asc" } } },
            },
          },
        },
        bridgePaths: {
          include: { device: { select: { deviceKey: true, name: true, lastSeenAt: true } } },
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
    db.agentRole.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      include: { skills: { select: { slug: true } } },
    }),
    db.skillDefinition.findMany({
      where: { workspaceId },
      orderBy: [{ category: "asc" }, { slug: "asc" }],
      select: {
        slug: true,
        name: true,
        category: true,
        sourcePath: true,
        description: true,
        providerCompatibility: true,
        roleCompatibility: true,
        tags: true,
        isImported: true,
        isRemote: true,
        updatedAt: true,
      },
    }),
    db.session.findMany({
      where: { workspaceId },
      orderBy: { date: "desc" },
      take: 500,
    }),
    db.toolUsage.findMany({
      where: { workspaceId },
      orderBy: { date: "desc" },
      take: 500,
    }),
    db.runTelemetry.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.memoryNode.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
  ]);

  const exportedAt = new Date().toISOString();
  return {
    schemaVersion: 1,
    snapshotVersion: 1,
    workspaceId,
    projectName: null,
    deviceKey: null,
    exportedAt,
    projects: projects.map((project) => ({
      name: project.name,
      path: project.path,
      frameworks: project.frameworks,
      lastIndexed: project.lastIndexed?.toISOString() ?? null,
      activeTask: project.activeTask,
      links: project.links,
      docs: project.docs,
      mcpProfile: project.mcpProfile,
      localPaths: project.bridgePaths.map((item) => ({
        deviceId: item.deviceId,
        deviceKey: item.device.deviceKey,
        deviceName: item.device.name,
        path: item.path,
        lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
        deviceLastSeenAt: item.device.lastSeenAt?.toISOString() ?? null,
      })),
      modules: project.modules.map((module) => ({
        id: module.id,
        name: module.name,
        order: module.order,
        features: module.features.map((feature) => ({
          id: feature.id,
          name: feature.name,
          order: feature.order,
          tasks: feature.tasks.map((task) => ({
            id: task.id,
            name: task.name,
            summary: task.summary,
            details: task.details,
            acceptanceCriteria: task.acceptanceCriteria,
            steps: task.steps,
            reqIds: task.reqIds,
            priority: task.priority,
            risk: task.risk,
            status: task.status,
            estimate: task.estimate,
            deps: task.deps,
            phase: task.phase,
          })),
        })),
      })),
    })),
    roles: roles.map((role) => ({
      slug: role.slug,
      name: role.name,
      description: role.description,
      provider: role.provider,
      phase: role.phase,
      defaultModel: role.defaultModel,
      executionModeDefault: role.executionModeDefault,
      credentialService: role.credentialService,
      roleType: role.roleType,
      mcpProfile: role.mcpProfile,
      isBuiltin: role.isBuiltin,
      skills: role.skills.map((skill) => skill.slug),
    })),
    skills: skills.map((skill) => ({
      ...skill,
      updatedAt: skill.updatedAt.toISOString(),
    })),
    sessions,
    toolUsage,
    runTelemetries,
    memories,
  };
}
