import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const BodySchema = z.object({
  status: z.enum(["pending", "in-progress", "completed", "blocked"]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const dbStatus = parsed.data.status === "in-progress" ? "in_progress" : parsed.data.status;

  const task = await db.task.findFirst({
    where: { id, workspaceId: user.workspaceId },
    select: { id: true, feature: { select: { module: { select: { project: { select: { name: true } } } } } } },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  await db.task.update({ where: { id }, data: { status: dbStatus } });

  revalidatePath("/tasks");
  revalidatePath(`/projects/${encodeURIComponent(task.feature.module.project.name)}`);
  return NextResponse.json({ ok: true });
}
