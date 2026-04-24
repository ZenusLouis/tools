import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const EventSchema = z.object({
  taskId: z.string().min(1),
  phase: z.enum(["pending", "analysis", "ready_for_dev", "implementation", "review", "done", "blocked"]).optional(),
  status: z.enum(["pending", "in_progress", "completed", "blocked"]).optional(),
  note: z.string().optional(),
  provider: z.enum(["claude", "codex", "chatgpt"]).default("claude"),
  role: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = EventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  await db.task.updateMany({
    where: { id: parsed.data.taskId, workspaceId: ctx.workspaceId },
    data: {
      ...(parsed.data.phase ? { phase: parsed.data.phase } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
  });

  await db.session.create({
    data: {
      workspaceId: ctx.workspaceId,
      deviceId: ctx.deviceId,
      provider: parsed.data.provider,
      role: parsed.data.role,
      type: "task_event",
      project: "unknown",
      date: new Date(),
      tasksCompleted: parsed.data.status === "completed" ? [parsed.data.taskId] : [],
      sessionNotes: parsed.data.note ?? `Task event: ${parsed.data.taskId}`,
    },
  });

  return NextResponse.json({ ok: true });
}

