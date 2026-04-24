import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const HOOK_SECRET = process.env.HOOK_SECRET;

const ToolEntrySchema = z.object({
  type: z.literal("tool").default("tool"),
  ts: z.string(),
  tool: z.string(),
  tokens: z.number().int().min(0),
  project: z.string().optional(),
});

const SessionEntrySchema = z.object({
  type: z.literal("session"),
  project: z.string(),
  date: z.string(),
  tasksCompleted: z.array(z.string()).default([]),
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
  // Verify hook secret if configured
  if (HOOK_SECRET) {
    const auth = req.headers.get("x-hook-secret");
    if (auth !== HOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = EntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
  }

  const entry = parsed.data;

  if (entry.type === "tool") {
    await db.toolUsage.create({
      data: {
        date: new Date(entry.ts),
        tool: entry.tool,
        tokens: entry.tokens,
      },
    });
  } else {
    await db.session.create({
      data: {
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
