import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const HOOK_SECRET = process.env.HOOK_SECRET;
const NullableString = z.preprocess((value) => value == null ? undefined : value, z.string().optional());
const NullableStringArray = z.preprocess((value) => Array.isArray(value) ? value.filter((item) => item != null).map(String) : value == null ? undefined : value, z.array(z.string()).optional());

const ModuleSchema = z.object({
  name: z.string(),
  features: z.array(z.object({
    name: z.string(),
    tasks: z.array(z.union([
      z.string(),
      z.object({
        name: z.string(),
        summary: NullableString,
        details: NullableString,
        acceptanceCriteria: NullableStringArray,
        steps: NullableStringArray,
        reqIds: NullableStringArray,
        priority: NullableString,
        estimate: NullableString,
        risk: NullableString,
        deps: NullableStringArray,
      }),
    ])),
  })),
});

const ResultSchema = z.object({
  actionId: z.string(),
  projectName: z.string(),
  modules: z.array(ModuleSchema).min(1).max(30),
  analysisTranscript: z.record(z.string(), z.unknown()).optional(),
});

type ParsedTask = z.infer<typeof ModuleSchema>["features"][number]["tasks"][number];

type AnalysisTranscript = Record<string, unknown>;

function normalizeTask(task: ParsedTask, fallbackName: string) {
  if (typeof task === "string") {
    return {
      name: task,
      summary: task,
      details: `Implement and verify: ${task}.`,
      acceptanceCriteria: [`${task} is implemented and visible in the expected user flow.`, "Main error and empty states are handled."],
      steps: ["Review BRD/PRD context and related code.", "Implement the scoped change.", "Verify the result."],
      reqIds: [],
      priority: "must",
      estimate: undefined,
      risk: "",
      deps: [],
    };
  }
  const name = task.name || fallbackName;
  return {
    name,
    summary: task.summary || name,
    details: task.details || `Implement and verify: ${name}.`,
    acceptanceCriteria: task.acceptanceCriteria ?? [`${name} is implemented and testable.`],
    steps: task.steps ?? ["Inspect current flow.", "Implement scoped changes.", "Run verification."],
    reqIds: task.reqIds ?? [],
    priority: task.priority ?? "must",
    estimate: task.estimate,
    risk: task.risk ?? "",
    deps: task.deps ?? [],
  };
}

function numberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function extractTokenTotalFromUsage(usage: unknown) {
  if (!usage || typeof usage !== "object") return 0;
  const row = usage as Record<string, unknown>;
  return (
    numberField(row.input_tokens) +
    numberField(row.cache_creation_input_tokens) +
    numberField(row.cache_read_input_tokens) +
    numberField(row.output_tokens)
  );
}

function extractTokenTotalFromModelUsage(modelUsage: unknown) {
  if (!modelUsage || typeof modelUsage !== "object") return 0;
  return Object.values(modelUsage as Record<string, unknown>).reduce<number>((sum, value) => {
    if (!value || typeof value !== "object") return sum;
    const row = value as Record<string, unknown>;
    return sum +
      numberField(row.inputTokens) +
      numberField(row.cacheCreationInputTokens) +
      numberField(row.cacheReadInputTokens) +
      numberField(row.outputTokens);
  }, 0);
}

function modelFromTranscript(transcript: AnalysisTranscript) {
  const modelUsage = transcript.modelUsage;
  if (!modelUsage || typeof modelUsage !== "object") return typeof transcript.model === "string" ? transcript.model : null;
  const rows = Object.entries(modelUsage as Record<string, unknown>)
    .map(([model, value]) => {
      const cost = value && typeof value === "object" ? numberField((value as Record<string, unknown>).costUSD) : 0;
      return { model, cost };
    })
    .sort((a, b) => b.cost - a.cost);
  return rows[0]?.model ?? (typeof transcript.model === "string" ? transcript.model : null);
}

async function recordAnalysisSession(params: {
  workspaceId: string;
  deviceId: string | null;
  projectName: string;
  actionId: string;
  transcript?: AnalysisTranscript;
  createdTasks?: number;
}) {
  const { workspaceId, deviceId, projectName, actionId, transcript, createdTasks } = params;
  if (!transcript) return;

  const modelUsageTokens = extractTokenTotalFromModelUsage(transcript.modelUsage);
  const usageTokens = extractTokenTotalFromUsage(transcript.usage);
  const totalTokens = modelUsageTokens || usageTokens;
  const totalCostUSD = numberField(transcript.totalCostUsd) || numberField(transcript.totalCostUSD);
  const durationMs = numberField(transcript.durationMs);
  const transcriptPath = `bridge-action:${actionId}`;

  if (!totalTokens && !totalCostUSD) return;

  const existing = await db.session.findFirst({
    where: { workspaceId, provider: "claude", transcriptPath },
    select: { id: true },
  });
  if (existing) return;

  await db.session.create({
    data: {
      workspaceId,
      deviceId,
      provider: "claude",
      role: "ba-analyst",
      model: modelFromTranscript(transcript),
      transcriptPath,
      type: "analysis",
      project: projectName,
      date: new Date(),
      tasksCompleted: [],
      sessionNotes: `Local Claude analysis${createdTasks ? ` generated ${createdTasks} tasks` : ""}.`,
      totalTokens: totalTokens || null,
      totalCostUSD: totalCostUSD || null,
      durationMin: durationMs ? durationMs / 60_000 : null,
      risks: [],
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  let ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!ctx && HOOK_SECRET && req.headers.get("x-hook-secret") === HOOK_SECRET) {
    const workspace = await db.workspace.findUnique({ where: { slug: "default" }, select: { id: true } });
    if (workspace) ctx = { workspaceId: workspace.id, deviceId: null, tokenId: null };
  }
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await params;
  const projectName = decodeURIComponent(name);

  const parsed = ResultSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  if (parsed.data.projectName !== projectName) {
    return NextResponse.json({ error: "Project name mismatch" }, { status: 400 });
  }

  const transcript = parsed.data.analysisTranscript as AnalysisTranscript | undefined;
  const action = await db.bridgeFileAction.findFirst({
    where: { id: parsed.data.actionId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (action?.status === "cancelled") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Mark bridge action complete
  if (action) {
    await db.bridgeFileAction.update({
      where: { id: action.id },
      data: {
        status: "succeeded",
        completedAt: new Date(),
        result: transcript
          ? { analysisTranscript: transcript } as Prisma.InputJsonValue
          : undefined,
      },
    }).catch(() => null);
  }

  // Check no tasks exist yet (idempotent guard)
  const existing = await db.task.count({ where: { feature: { module: { projectName } }, workspaceId: ctx.workspaceId } });
  if (existing > 0) {
    await recordAnalysisSession({
      workspaceId: ctx.workspaceId,
      deviceId: ctx.deviceId,
      projectName,
      actionId: parsed.data.actionId,
      transcript,
    });
    revalidatePath("/");
    revalidatePath("/tokens");
    return NextResponse.json({ ok: true, skipped: true });
  }

  const [baRole, devRole, reviewRole] = await Promise.all([
    db.agentRole.findFirst({ where: { workspaceId: ctx.workspaceId, phase: "analysis" }, select: { id: true } }),
    db.agentRole.findFirst({ where: { workspaceId: ctx.workspaceId, phase: "implementation" }, select: { id: true } }),
    db.agentRole.findFirst({ where: { workspaceId: ctx.workspaceId, phase: "review" }, select: { id: true } }),
  ]);

  let created = 0;
  const firstTaskId = `${projectName}-M0-F0-T1`;

  for (const [mi, mod] of parsed.data.modules.entries()) {
    const moduleId = `${projectName}-M${mi}`;
    await db.module.create({ data: { id: moduleId, projectName, name: mod.name, order: mi } });
    for (const [fi, feature] of mod.features.entries()) {
      const featureId = `${moduleId}-F${fi}`;
      await db.feature.create({ data: { id: featureId, moduleId, name: feature.name, order: fi } });
      for (const [ti, rawTask] of feature.tasks.entries()) {
        const task = normalizeTask(rawTask, `${feature.name} task ${ti + 1}`);
        const taskId = `${featureId}-T${ti + 1}`;
        await db.task.create({
          data: {
            id: taskId, workspaceId: ctx.workspaceId, featureId, name: task.name,
            summary: task.summary,
            details: task.details,
            acceptanceCriteria: task.acceptanceCriteria,
            steps: task.steps,
            reqIds: task.reqIds,
            priority: task.priority,
            risk: task.risk,
            status: taskId === firstTaskId ? "in_progress" : "pending",
            phase: taskId === firstTaskId ? "analysis" : "pending",
            estimate: task.estimate ?? (ti === 0 ? "1h" : "2h"), deps: task.deps,
            baRoleId: baRole?.id ?? null,
            devRoleId: devRole?.id ?? null,
            reviewRoleId: reviewRole?.id ?? null,
          },
        });
        created++;
      }
    }
  }

  await db.project.update({
    where: { name: projectName },
    data: { activeTask: firstTaskId, lastIndexed: new Date() },
  });

  await recordAnalysisSession({
    workspaceId: ctx.workspaceId,
    deviceId: ctx.deviceId,
    projectName,
    actionId: parsed.data.actionId,
    transcript,
    createdTasks: created,
  });

  revalidatePath("/");
  revalidatePath("/tokens");
  revalidatePath(`/projects/${encodeURIComponent(projectName)}`);
  revalidatePath(`/projects/${encodeURIComponent(projectName)}/detail`);
  revalidatePath("/tasks");
  return NextResponse.json({ ok: true, created });
}
