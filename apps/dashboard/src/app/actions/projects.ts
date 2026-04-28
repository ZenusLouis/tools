"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";

type ProjectWithLatestPath = {
  name: string;
  workspaceId: string | null;
  path: string | null;
  docs: unknown;
  links: unknown;
  mcpProfile: string | null;
  frameworks: string[];
  bridgePaths: { deviceId: string; path: string }[];
};

const ANALYSIS_MODULES = [
  {
    id: "M0",
    name: "Product Discovery",
    features: [
      {
        id: "F0",
        name: "BRD/PRD Understanding",
        tasks: [
          "Extract business goals, actors, and core workflows",
          "Map user journeys and key screens",
          "Identify assumptions, constraints, and open questions",
        ],
      },
      {
        id: "F1",
        name: "Scope Definition",
        tasks: [
          "Define MVP scope and deferred scope",
          "Create acceptance criteria for core flows",
          "List risks and validation checkpoints",
        ],
      },
    ],
  },
  {
    id: "M1",
    name: "Experience & Interface",
    features: [
      {
        id: "F0",
        name: "UX Structure",
        tasks: [
          "Draft information architecture and navigation",
          "Define primary UI states and empty states",
          "Review accessibility and responsive behavior",
        ],
      },
    ],
  },
  {
    id: "M2",
    name: "Application Architecture",
    features: [
      {
        id: "F0",
        name: "Frontend Implementation Plan",
        tasks: [
          "Map pages, components, and client/server boundaries",
          "Define data loading and mutation flows",
          "Plan validation, error states, and loading states",
        ],
      },
      {
        id: "F1",
        name: "Backend & Data Model",
        tasks: [
          "Draft entities, relationships, and API contracts",
          "Identify auth, permission, and audit requirements",
          "Plan integration points and background jobs",
        ],
      },
    ],
  },
  {
    id: "M3",
    name: "Quality & Release",
    features: [
      {
        id: "F0",
        name: "Verification Plan",
        tasks: [
          "Create smoke test and regression checklist",
          "Define deployment readiness gates",
          "Prepare monitoring and rollback notes",
        ],
      },
    ],
  },
];

function docRecord(project: ProjectWithLatestPath): Record<string, string> {
  return (project.docs && typeof project.docs === "object" && !Array.isArray(project.docs))
    ? project.docs as Record<string, string>
    : {};
}

function buildProgressPayload(projectName: string, activeTask: string | null) {
  return {
    project: projectName,
    version: "1.0",
    activeTask,
    modules: ANALYSIS_MODULES.map((mod) => ({
      id: mod.id,
      name: mod.name,
      features: mod.features.map((feature) => ({
        id: `${mod.id}-${feature.id}`,
        name: feature.name,
        tasks: feature.tasks.map((task, index) => ({
          id: `${mod.id}-${feature.id}-T${index + 1}`,
          name: task,
          status: task === "Extract business goals, actors, and core workflows" ? "in_progress" : "pending",
          phase: index === 0 && mod.id === "M0" && feature.id === "F0" ? "analysis" : "pending",
          estimate: index === 0 ? "1h" : "2h",
          deps: [],
        })),
      })),
    })),
    risks: [],
    gates: {
      G1: { status: "done" },
      G2: { status: "pending" },
      G3: { status: "pending" },
      G4: { status: "pending" },
    },
  };
}

async function loadProjectForAction(projectName: string, workspaceId: string): Promise<ProjectWithLatestPath | null> {
  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId }, { workspaceId: null }] },
    include: { bridgePaths: { orderBy: { updatedAt: "desc" }, take: 20 } },
  });
  if (!project) return null;
  if (!project.workspaceId) {
    await db.project.update({ where: { name: projectName }, data: { workspaceId } }).catch(() => null);
  }
  return project;
}

async function queueProgressSync(project: ProjectWithLatestPath, workspaceId: string, content: string) {
  const targets = project.bridgePaths.length > 0
    ? project.bridgePaths.map((item) => ({ deviceId: item.deviceId, path: item.path }))
    : project.path
      ? [{ deviceId: null, path: project.path }]
      : [];

  for (const target of targets) {
    await db.bridgeFileAction.create({
      data: {
        workspaceId,
        deviceId: target.deviceId,
        type: "sync_project_metadata",
        payload: {
          projectName: project.name,
          projectPath: target.path,
          files: [
            {
              relativePath: ".gcs/progress.json",
              content,
            },
          ],
        },
      },
    });
  }
}

export async function analyzeProject(projectName: string): Promise<{ ok: boolean; error?: string; created?: number }> {
  const user = await requireCurrentUser();
  const project = await loadProjectForAction(projectName, user.workspaceId);
  if (!project) return { ok: false, error: "Project not found" };

  const docs = docRecord(project);
  if (!docs.brd && !docs.prd) {
    return { ok: false, error: "Add a BRD or PRD before analysis." };
  }

  const existingTasks = await db.task.count({
    where: { feature: { module: { projectName } }, ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}) },
  });
  if (existingTasks > 0) {
    return { ok: false, error: "This project already has generated tasks." };
  }

  const baRole = await db.agentRole.findFirst({
    where: { workspaceId: user.workspaceId, phase: "analysis" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const devRole = await db.agentRole.findFirst({
    where: { workspaceId: user.workspaceId, phase: "implementation" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const reviewRole = await db.agentRole.findFirst({
    where: { workspaceId: user.workspaceId, phase: "review" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const firstTaskId = `${projectName}-M0-F0-T1`;
  let created = 0;

  for (const [moduleIndex, mod] of ANALYSIS_MODULES.entries()) {
    const moduleId = `${projectName}-${mod.id}`;
    await db.module.create({
      data: {
        id: moduleId,
        projectName,
        name: mod.name,
        order: moduleIndex,
      },
    });

    for (const [featureIndex, feature] of mod.features.entries()) {
      const featureId = `${projectName}-${mod.id}-${feature.id}`;
      await db.feature.create({
        data: {
          id: featureId,
          moduleId,
          name: feature.name,
          order: featureIndex,
        },
      });

      for (const [taskIndex, taskName] of feature.tasks.entries()) {
        const taskId = `${projectName}-${mod.id}-${feature.id}-T${taskIndex + 1}`;
        await db.task.create({
          data: {
            id: taskId,
            workspaceId: user.workspaceId,
            featureId,
            name: taskName,
            status: taskId === firstTaskId ? "in_progress" : "pending",
            phase: taskId === firstTaskId ? "analysis" : "pending",
            estimate: taskIndex === 0 ? "1h" : "2h",
            deps: [],
            baRoleId: baRole?.id ?? null,
            devRoleId: devRole?.id ?? null,
            reviewRoleId: reviewRole?.id ?? null,
          },
        });
        created += 1;
      }
    }
  }

  const now = new Date();
  await db.project.update({
    where: { name: projectName },
    data: {
      activeTask: firstTaskId,
      lastIndexed: now,
    },
  });
  await db.session.create({
    data: {
      workspaceId: user.workspaceId,
      provider: "claude",
      role: "ba-analyst",
      type: "project-event",
      project: projectName,
      date: now,
      tasksCompleted: [],
      sessionNotes: `Analysis generated ${created} tasks from ${docs.brd ? "BRD" : "PRD"}.`,
      cwd: project.bridgePaths[0]?.path ?? project.path,
    },
  });

  await queueProgressSync(project, user.workspaceId, JSON.stringify(buildProgressPayload(projectName, firstTaskId), null, 2));

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${encodeURIComponent(projectName)}`);
  revalidatePath(`/projects/${encodeURIComponent(projectName)}/detail`);
  revalidatePath("/tasks");
  return { ok: true, created };
}

export async function reindexProject(projectName: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireCurrentUser();
  const project = await loadProjectForAction(projectName, user.workspaceId);
  if (!project) return { ok: false, error: "Project not found" };

  const now = new Date();
  const projectPath = project.bridgePaths[0]?.path ?? project.path;
  await db.project.update({
    where: { name: projectName },
    data: { lastIndexed: now },
  });
  await db.session.create({
    data: {
      workspaceId: user.workspaceId,
      provider: "codex",
      role: "project-indexer",
      type: "project-event",
      project: projectName,
      date: now,
      tasksCompleted: [],
      sessionNotes: "Project reindexed from dashboard",
      cwd: projectPath,
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectName}`);
  revalidatePath(`/projects/${projectName}/detail`);
  return { ok: true };
}

export async function deployProject(projectName: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireCurrentUser();
  const project = await loadProjectForAction(projectName, user.workspaceId);
  if (!project) return { ok: false, error: "Project not found" };

  const now = new Date();
  const projectPath = project.bridgePaths[0]?.path ?? project.path;
  await db.session.create({
    data: {
      workspaceId: user.workspaceId,
      provider: "claude",
      role: "deployment-orchestrator",
      type: "project-event",
      project: projectName,
      date: now,
      tasksCompleted: [],
      sessionNotes: "Deploy requested from dashboard",
      cwd: projectPath,
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectName}`);
  revalidatePath(`/projects/${projectName}/detail`);
  return { ok: true };
}
