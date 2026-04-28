import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const ResultSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["succeeded", "failed"]),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(4000).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = ResultSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const action = await db.bridgeFileAction.findFirst({
    where: { id: parsed.data.id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!action) return NextResponse.json({ error: "Action not found" }, { status: 404 });

  await db.bridgeFileAction.update({
    where: { id: action.id },
    data: {
      status: parsed.data.status,
      result: (parsed.data.result ?? {}) as Prisma.InputJsonValue,
      error: parsed.data.error ?? null,
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
