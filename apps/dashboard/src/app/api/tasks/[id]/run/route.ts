import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth";
import { buildTaskOptimizerPlan, CONTEXT_MODES, OPTIMIZER_MODES } from "@/lib/agent-optimizer";
import { db } from "@/lib/db";
import { resolvePath } from "@/lib/fs/resolve";
import { syncWorkspaceFromRepo } from "@/lib/repo-sync";

const BodySchema = z.object({
  phase: z.enum(["implementation", "review", "analysis"]).default("implementation"),
  provider: z.enum(["claude", "codex"]).optional(),
  optimizerMode: z.enum(OPTIMIZER_MODES).default("auto_aggressive"),
  contextMode: z.enum(CONTEXT_MODES).optional(),
});

function isOnline(lastSeenAt: Date | null) {
  return lastSeenAt ? Date.now() - lastSeenAt.getTime() < 90_000 : false;
}

function providerAvailable(provider: "claude" | "codex", device: { claudeAvailable: boolean; codexAvailable: boolean }) {
  return provider === "claude" ? device.claudeAvailable : device.codexAvailable;
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  await syncWorkspaceFromRepo(db, user.workspaceId, resolvePath(), {
    includeSkillsAndRoles: true,
    includeLogs: false,
    includeLessons: false,
    includeMcp: false,
    includeProjects: false,
  }).catch((err) => {
    console.warn("Skill brain refresh before task run failed:", err);
  });

  const task = await db.task.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: {
      feature: {
        include: {
          module: {
            include: {
              project: {
                include: {
                  bridgePaths: {
                    include: { device: true },
                    orderBy: { updatedAt: "desc" },
                  },
                },
              },
            },
          },
        },
      },
      baRole: { include: { skills: { select: { slug: true } } } },
      devRole: { include: { skills: { select: { slug: true } } } },
      reviewRole: { include: { skills: { select: { slug: true } } } },
    },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const role =
    parsed.data.phase === "analysis"
      ? task.baRole
      : parsed.data.phase === "review"
        ? task.reviewRole
        : task.devRole;
  const provider = parsed.data.provider ?? (role?.provider === "claude" || role?.provider === "codex" ? role.provider : "codex");
  if (provider !== "claude" && provider !== "codex") {
    return NextResponse.json({ error: "Only local Claude/Codex task runs are supported here." }, { status: 400 });
  }

  const project = task.feature.module.project;
  const roleSkillSlugs = role?.skills.map((skill) => skill.slug) ?? [];
  const taskCore = {
    id: task.id,
    name: task.name,
    summary: task.summary,
    details: task.details,
    acceptanceCriteria: task.acceptanceCriteria,
    steps: task.steps,
    reqIds: task.reqIds,
    priority: task.priority,
    estimate: task.estimate,
    risk: task.risk,
    deps: task.deps,
    moduleName: task.feature.module.name,
    featureName: task.feature.name,
  };
  const [availableSkills, retryCount, priorRuns, previousFailedRun] = await Promise.all([
    db.skillDefinition.findMany({
      where: {
        OR: [
          { workspaceId: user.workspaceId },
          { workspaceId: null },
        ],
      },
      select: {
        slug: true,
        name: true,
        category: true,
        description: true,
        content: true,
        providerCompatibility: true,
        roleCompatibility: true,
        tags: true,
        sourcePath: true,
      },
    }),
    db.bridgeFileAction.count({
      where: {
        workspaceId: user.workspaceId,
        type: "run_task",
        status: { in: ["failed", "cancelled"] },
        payload: { path: ["taskId"], equals: task.id },
      },
    }),
    db.bridgeFileAction.findMany({
      where: {
        workspaceId: user.workspaceId,
        type: "run_task",
        payload: { path: ["projectName"], equals: project.name },
        status: { in: ["succeeded", "failed", "cancelled"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { result: true },
    }),
    db.bridgeFileAction.findFirst({
      where: {
        workspaceId: user.workspaceId,
        type: "run_task",
        status: { in: ["failed", "cancelled"] },
        payload: { path: ["taskId"], equals: task.id },
      },
      orderBy: { updatedAt: "desc" },
      select: { error: true, result: true, updatedAt: true },
    }),
  ]);
  const previousFailure = previousFailedRun
    ? {
        error: previousFailedRun.error,
        updatedAt: previousFailedRun.updatedAt.toISOString(),
        logTail: Array.isArray(objectValue(previousFailedRun.result).log)
          ? (objectValue(previousFailedRun.result).log as unknown[]).filter((line): line is string => typeof line === "string").slice(-40)
          : [],
        artifactPath: typeof objectValue(previousFailedRun.result).artifactPath === "string" ? String(objectValue(previousFailedRun.result).artifactPath) : null,
        exitCode: typeof objectValue(previousFailedRun.result).exitCode === "number" ? Number(objectValue(previousFailedRun.result).exitCode) : null,
      }
    : null;
  const skillFeedback: Record<string, { successes: number; failures: number }> = {};
  for (const run of priorRuns) {
    const result = objectValue(run.result);
    const feedback = objectValue(result.skillFeedback);
    const selectedSkills = Array.isArray(feedback.selectedSkills)
      ? feedback.selectedSkills.filter((slug): slug is string => typeof slug === "string")
      : [];
    const status = feedback.status === "success" ? "success" : feedback.status === "failed" ? "failed" : null;
    for (const slug of selectedSkills) {
      skillFeedback[slug] ??= { successes: 0, failures: 0 };
      if (status === "success") skillFeedback[slug].successes += 1;
      if (status === "failed") skillFeedback[slug].failures += 1;
    }
  }
  const optimizerPlan = buildTaskOptimizerPlan({
    optimizerMode: parsed.data.optimizerMode,
    requestedContextMode: parsed.data.contextMode,
    phase: parsed.data.phase,
    provider,
    model: role?.defaultModel ?? null,
    roleSlug: role?.slug ?? null,
    roleType: role?.roleType ?? null,
    roleSkillSlugs,
    project: { name: project.name, frameworks: project.frameworks },
    task: taskCore,
    availableSkills,
    retryCount,
    skillFeedback,
    previousFailure,
  });
  const selectedModel = typeof optimizerPlan.optimizer.model === "string" && optimizerPlan.optimizer.model
    ? optimizerPlan.optimizer.model
    : role?.defaultModel ?? null;
  const target = project.bridgePaths.find((item) => isOnline(item.device.lastSeenAt) && providerAvailable(provider, item.device))
    ?? project.bridgePaths.find((item) => providerAvailable(provider, item.device));
  if (!target) {
    const pathDevices = project.bridgePaths.map((item) => ({
      device: item.device.name,
      path: item.path,
      online: isOnline(item.device.lastSeenAt),
      claudeAvailable: item.device.claudeAvailable,
      codexAvailable: item.device.codexAvailable,
    }));
    const hasProjectPath = pathDevices.length > 0;
    const hasProviderSomewhere = pathDevices.some((item) => provider === "claude" ? item.claudeAvailable : item.codexAvailable);
    const onlineHint = pathDevices.some((item) => item.online) ? "online" : "offline";
    const detail = hasProjectPath
      ? hasProviderSomewhere
        ? `This project has local paths, but none of the ${provider} devices are currently online.`
        : `This project has local paths, but the bridge heartbeat does not report ${provider} as installed/available on those devices.`
      : `This project has no registered local path yet.`;
    return NextResponse.json({
      error: `${detail} Restart the local bridge from a terminal where '${provider}' works, or choose Auto/another local provider.`,
      code: "LOCAL_PROVIDER_UNAVAILABLE",
      provider,
      bridgeState: onlineHint,
      devices: pathDevices,
    }, { status: 409 });
  }

  await db.bridgeFileAction.deleteMany({
    where: {
      workspaceId: user.workspaceId,
      type: "run_task",
      status: { in: ["pending", "running"] },
      payload: { path: ["taskId"], equals: task.id },
    },
  });

  const action = await db.bridgeFileAction.create({
    data: {
      workspaceId: user.workspaceId,
      deviceId: target.deviceId,
      type: "run_task",
      payload: {
        taskId: task.id,
        projectName: project.name,
        projectPath: target.path,
        phase: parsed.data.phase,
        provider,
        role: role?.slug ?? (provider === "codex" ? "dev-implementer" : "run-task"),
        model: selectedModel,
        skills: optimizerPlan.skillRouting.selected.map((skill) => skill.slug),
        optimizer: optimizerPlan.optimizer,
        skillRouting: optimizerPlan.skillRouting,
        contextPlan: optimizerPlan.contextPlan,
        previousFailure,
        task: taskCore,
      },
    },
  });

  await db.task.update({
    where: { id: task.id },
    data: { status: "in_progress", phase: parsed.data.phase === "review" ? "review" : "implementation" },
  });
  await db.project.update({ where: { name: project.name }, data: { activeTask: task.id } });
  await db.session.create({
    data: {
      workspaceId: user.workspaceId,
      deviceId: target.deviceId,
      provider,
      role: role?.slug ?? null,
      model: selectedModel,
      type: "task_run_queued",
      project: project.name,
      date: new Date(),
      tasksCompleted: [],
      cwd: target.path,
      sessionNotes: `Queued ${provider} ${parsed.data.phase} run for ${task.id}. Optimizer=${optimizerPlan.optimizer.mode}/${optimizerPlan.optimizer.contextMode}; model=${selectedModel ?? "provider default"}; skills=${optimizerPlan.skillRouting.selected.map((skill) => skill.slug).join(", ") || "none"}; routing=0 LLM tokens.`,
    },
  });

  revalidatePath(`/tasks/${task.id}`);
  revalidatePath("/tasks");
  revalidatePath(`/projects/${encodeURIComponent(project.name)}`);
  return NextResponse.json({
    ok: true,
    actionId: action.id,
    provider,
    device: target.device.name,
    optimizer: optimizerPlan.optimizer,
    skillRouting: optimizerPlan.skillRouting,
    contextPlan: optimizerPlan.contextPlan,
  });
}
