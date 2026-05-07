import { revalidatePath } from "next/cache";
import { buildBridgePayload } from "@/lib/bridge-actions";
import { db } from "@/lib/db";

type ProjectWithLatestPath = {
  name: string;
  workspaceId: string | null;
  path: string | null;
  bridgePaths: { path: string; deviceId: string; device: { lastSeenAt: Date | null } }[];
};

async function loadProjectForOperation(projectName: string, workspaceId: string): Promise<ProjectWithLatestPath | null> {
  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId }, { workspaceId: null }] },
    include: { bridgePaths: { orderBy: { updatedAt: "desc" }, take: 1, include: { device: { select: { lastSeenAt: true } } } } },
  });

  if (!project) return null;

  if (!project.workspaceId) {
    await db.project.update({ where: { name: projectName }, data: { workspaceId } }).catch(() => null);
  }

  return project;
}

function revalidateProject(projectName: string) {
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${encodeURIComponent(projectName)}`);
  revalidatePath(`/projects/${encodeURIComponent(projectName)}/detail`);
}

export async function recordReindexProject(projectName: string, workspaceId: string): Promise<{ ok: boolean; error?: string }> {
  const project = await loadProjectForOperation(projectName, workspaceId);
  if (!project) return { ok: false, error: "Project not found" };

  const now = new Date();
  const projectPath = project.bridgePaths[0]?.path ?? project.path;
  await db.project.update({
    where: { name: projectName },
    data: { lastIndexed: now },
  });
  await db.session.create({
    data: {
      workspaceId,
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

  if (projectPath) {
    const onlineDevice = project.bridgePaths.find(
      (bp) => bp.device.lastSeenAt && Date.now() - bp.device.lastSeenAt.getTime() < 90_000
    );
    await db.bridgeFileAction.create({
      data: {
        workspaceId,
        type: "generate_code_index",
        deviceId: onlineDevice?.deviceId ?? null,
        payloadVersion: 1,
        actionType: "generate_code_index",
        payload: buildBridgePayload("generate_code_index", { projectName, projectPath }),
      },
    });
  }

  revalidateProject(projectName);
  return { ok: true };
}

export async function recordDeployProject(projectName: string, workspaceId: string): Promise<{ ok: boolean; error?: string }> {
  const project = await loadProjectForOperation(projectName, workspaceId);
  if (!project) return { ok: false, error: "Project not found" };

  const now = new Date();
  const projectPath = project.bridgePaths[0]?.path ?? project.path;
  await db.session.create({
    data: {
      workspaceId,
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

  revalidateProject(projectName);
  return { ok: true };
}

const FIGMA_DESIGN_ACTIONS = {
  mcp_design_inspection: {
    label: "Figma design inspection",
    note: "Queued Figma design inspection",
  },
  mcp_ui_brief: {
    label: "Figma UI brief",
    note: "Queued Figma UI brief generation",
  },
  mcp_design_implementation: {
    label: "Figma design implementation",
    note: "Queued Figma design implementation handoff",
  },
  mcp_visual_review: {
    label: "Figma visual diff review",
    note: "Queued Figma visual diff review",
  },
} as const;

export type FigmaDesignActionType = keyof typeof FIGMA_DESIGN_ACTIONS;

export async function queueFigmaDesignAction(
  projectName: string,
  workspaceId: string,
  designAction: FigmaDesignActionType = "mcp_design_inspection",
): Promise<{ ok: boolean; error?: string; actionId?: string }> {
  const actionConfig = FIGMA_DESIGN_ACTIONS[designAction];
  if (!actionConfig) return { ok: false, error: "Unsupported Figma design action" };
  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId }, { workspaceId: null }] },
    include: {
      bridgePaths: {
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: { device: { select: { lastSeenAt: true } } },
      },
    },
  });
  if (!project) return { ok: false, error: "Project not found" };
  if (!project.workspaceId) {
    await db.project.update({ where: { name: projectName }, data: { workspaceId } }).catch(() => null);
  }

  const links = project.links && typeof project.links === "object" && !Array.isArray(project.links)
    ? project.links as Record<string, string>
    : {};
  const figmaUrl = links.figma;
  if (!figmaUrl) return { ok: false, error: "Add a Figma URL in Project Settings first." };

  const onlinePath = project.bridgePaths.find(
    (bp) => bp.device.lastSeenAt && Date.now() - bp.device.lastSeenAt.getTime() < 90_000
  ) ?? project.bridgePaths[0];
  const projectPath = onlinePath?.path ?? project.path;
  if (!projectPath) return { ok: false, error: "No local project path is registered for this project." };

  const mcpServer = await db.mcpServer.findFirst({
    where: { OR: [{ name: "figma-mcp-go" }, { name: "figma" }] },
    orderBy: { name: "desc" },
  });

  const action = await db.bridgeFileAction.create({
    data: {
      workspaceId,
      deviceId: onlinePath?.deviceId ?? null,
      type: designAction,
      payloadVersion: 1,
      actionType: designAction,
      payload: buildBridgePayload(designAction, {
        projectName,
        projectPath,
        figmaUrl,
        designAction,
        designActionLabel: actionConfig.label,
        mcpProfile: project.mcpProfile,
        mcpServer: mcpServer ? {
          name: mcpServer.name,
          type: mcpServer.type,
          url: mcpServer.url,
          command: mcpServer.command,
          args: mcpServer.args,
        } : null,
        provider: "claude",
        phase: "design",
        role: "design-integrator",
      }),
    },
  });

  await Promise.all([
    db.auditLog.create({
      data: {
        workspaceId,
        actionId: action.id,
        actorType: "user",
        event: `${designAction}_queued`,
        targetType: "BridgeFileAction",
        targetId: action.id,
        metadata: { projectName, figmaUrl, server: mcpServer?.name ?? null, designAction },
      },
    }).catch(() => null),
    db.session.create({
      data: {
        workspaceId,
        provider: "claude",
        role: "design-integrator",
        type: "project-event",
        project: projectName,
        date: new Date(),
        tasksCompleted: [],
        sessionNotes: `${actionConfig.note} for ${projectName}.`,
        cwd: projectPath,
      },
    }).catch(() => null),
  ]);

  revalidateProject(projectName);
  return { ok: true, actionId: action.id };
}

export async function queueFigmaDesignInspection(
  projectName: string,
  workspaceId: string,
): Promise<{ ok: boolean; error?: string; actionId?: string }> {
  return queueFigmaDesignAction(projectName, workspaceId, "mcp_design_inspection");
}
