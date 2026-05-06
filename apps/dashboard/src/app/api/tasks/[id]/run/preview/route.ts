import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth";
import { buildTaskOptimizerPlan, CONTEXT_MODES, OPTIMIZER_MODES } from "@/lib/agent-optimizer";
import { db } from "@/lib/db";

const QuerySchema = z.object({
  phase: z.enum(["implementation", "review", "analysis"]).default("implementation"),
  provider: z.enum(["auto", "claude", "codex"]).default("auto"),
  optimizerMode: z.enum(OPTIMIZER_MODES).default("auto_aggressive"),
  contextMode: z.enum(CONTEXT_MODES).optional(),
});

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const task = await db.task.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: {
      feature: {
        include: {
          module: {
            include: {
              project: true,
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
  const provider = parsed.data.provider !== "auto"
    ? parsed.data.provider
    : role?.provider === "claude" || role?.provider === "codex"
      ? role.provider
      : "codex";

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
    risk: task.risk,
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
      }
    : null;
  const skillFeedback: Record<string, { successes: number; failures: number }> = {};
  for (const run of priorRuns) {
    const feedback = objectValue(objectValue(run.result).skillFeedback);
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

  return NextResponse.json({
    ok: true,
    provider,
    role: role?.slug ?? null,
    optimizer: optimizerPlan.optimizer,
    skillRouting: optimizerPlan.skillRouting,
    contextPlan: optimizerPlan.contextPlan,
  });
}
