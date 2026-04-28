import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const HOOK_SECRET = process.env.HOOK_SECRET;

const ModuleSchema = z.object({
  name: z.string(),
  features: z.array(z.object({
    name: z.string(),
    tasks: z.array(z.string()),
  })),
});

const ResultSchema = z.object({
  actionId: z.string(),
  projectName: z.string(),
  modules: z.array(ModuleSchema).min(1).max(20),
});

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
    data: { status: "succeeded", completedAt: new Date() },
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
      for (const [ti, taskName] of feature.tasks.entries()) {
        const taskId = `${featureId}-T${ti + 1}`;
        await db.task.create({
          data: {
            id: taskId, workspaceId: ctx.workspaceId, featureId, name: taskName,
            status: taskId === firstTaskId ? "in_progress" : "pending",
            phase: taskId === firstTaskId ? "analysis" : "pending",
            estimate: ti === 0 ? "1h" : "2h", deps: [],
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
  revalidatePath("/tasks");
  return NextResponse.json({ ok: true, created });
}
