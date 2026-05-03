import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const BodySchema = z.object({
  phase: z.enum(["implementation", "review", "analysis"]).default("implementation"),
  provider: z.enum(["claude", "codex"]).optional(),
});

function isOnline(lastSeenAt: Date | null) {
  return lastSeenAt ? Date.now() - lastSeenAt.getTime() < 90_000 : false;
}

function providerAvailable(provider: "claude" | "codex", device: { claudeAvailable: boolean; codexAvailable: boolean }) {
  return provider === "claude" ? device.claudeAvailable : device.codexAvailable;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

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
  const target = project.bridgePaths.find((item) => isOnline(item.device.lastSeenAt) && providerAvailable(provider, item.device))
    ?? project.bridgePaths.find((item) => providerAvailable(provider, item.device));
  if (!target) {
    return NextResponse.json({ error: `No local ${provider} bridge device has a registered path for this project.` }, { status: 409 });
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
        model: role?.defaultModel ?? null,
        skills: role?.skills.map((skill) => skill.slug) ?? [],
        task: {
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
        },
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
      model: role?.defaultModel ?? null,
      type: "task_run_queued",
      project: project.name,
      date: new Date(),
      tasksCompleted: [],
      cwd: target.path,
      sessionNotes: `Queued ${provider} ${parsed.data.phase} run for ${task.id}.`,
    },
  });

  revalidatePath(`/tasks/${task.id}`);
  revalidatePath("/tasks");
  revalidatePath(`/projects/${encodeURIComponent(project.name)}`);
  return NextResponse.json({ ok: true, actionId: action.id, provider, device: target.device.name });
}
