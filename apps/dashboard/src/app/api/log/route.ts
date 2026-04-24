import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const HOOK_SECRET = process.env.HOOK_SECRET;

const ToolEntrySchema = z.object({
  type: z.literal("tool").default("tool"),
  ts: z.string(),
  tool: z.string(),
  tokens: z.number().int().min(0),
  project: z.string().optional(),
  provider: z.enum(["claude", "codex", "chatgpt"]).default("claude"),
  role: z.string().optional(),
  model: z.string().optional(),
});

const SessionEntrySchema = z.object({
  type: z.literal("session"),
  project: z.string(),
  date: z.string(),
  tasksCompleted: z.array(z.string()).default([]),
  provider: z.enum(["claude", "codex", "chatgpt"]).default("claude"),
  role: z.string().optional(),
  model: z.string().optional(),
  transcriptPath: z.string().optional(),
  cwd: z.string().optional(),
  commitHash: z.string().nullable().optional(),
  sessionNotes: z.string().nullable().optional(),
  totalTokens: z.number().optional(),
  totalCostUSD: z.number().optional(),
  durationMin: z.number().optional(),
  risks: z.array(z.string()).default([]),
  lessonSaved: z.string().nullable().optional(),
});

const EntrySchema = z.discriminatedUnion("type", [ToolEntrySchema, SessionEntrySchema]);

export async function POST(req: NextRequest) {
  const bridgeCtx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!bridgeCtx && HOOK_SECRET) {
    const auth = req.headers.get("x-hook-secret");
    if (auth !== HOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!bridgeCtx && !HOOK_SECRET) {
    return NextResponse.json({ error: "Bridge token required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = EntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const entry = parsed.data;

  if (entry.type === "tool") {
    await db.toolUsage.create({
      data: {
        workspaceId: bridgeCtx?.workspaceId,
        deviceId: bridgeCtx?.deviceId,
        provider: entry.provider,
        role: entry.role,
        model: entry.model,
        date: new Date(entry.ts),
        tool: entry.tool,
        tokens: entry.tokens,
      },
    });
  } else {
    await db.session.create({
      data: {
        workspaceId: bridgeCtx?.workspaceId,
        deviceId: bridgeCtx?.deviceId,
        provider: entry.provider,
        role: entry.role,
        model: entry.model,
        transcriptPath: entry.transcriptPath,
        cwd: entry.cwd,
        type: "session",
        project: entry.project,
        date: new Date(entry.date),
        tasksCompleted: entry.tasksCompleted,
        commitHash: entry.commitHash ?? null,
        sessionNotes: entry.sessionNotes ?? null,
        totalTokens: entry.totalTokens ?? null,
        totalCostUSD: entry.totalCostUSD ?? null,
        durationMin: entry.durationMin ?? null,
        risks: entry.risks,
        lessonSaved: entry.lessonSaved ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
