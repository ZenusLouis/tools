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

function normalizeTask(task: ParsedTask, fallbackName: string) {
  if (typeof task === "string") {
    return {
      name: task,
      summary: task,
      details: `Implement and verify: ${task}.`,
      acceptanceCriteria: [`${task} is implemented and visible in the expected user flow.`, "Main error and empty states are handled."],
      steps: ["Review BRD/PRD context and related code.", "Implement the scoped change.", "Verify the result."],
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
    priority: task.priority ?? "must",
    estimate: task.estimate,
    risk: task.risk ?? "",
    deps: task.deps ?? [],
  };
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

  // Mark bridge action complete
  await db.bridgeFileAction.update({
    where: { id: parsed.data.actionId },
    data: {
      status: "succeeded",
      completedAt: new Date(),
      result: parsed.data.analysisTranscript
        ? { analysisTranscript: parsed.data.analysisTranscript } as Prisma.InputJsonValue
        : undefined,
    },
  }).catch(() => null);

  // Check no tasks exist yet (idempotent guard)
  const existing = await db.task.count({ where: { feature: { module: { projectName } }, workspaceId: ctx.workspaceId } });
  if (existing > 0) return NextResponse.json({ ok: true, skipped: true });

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

  revalidatePath("/");
  revalidatePath(`/projects/${encodeURIComponent(projectName)}`);
  revalidatePath(`/projects/${encodeURIComponent(projectName)}/detail`);
  revalidatePath("/tasks");
  return NextResponse.json({ ok: true, created });
}
