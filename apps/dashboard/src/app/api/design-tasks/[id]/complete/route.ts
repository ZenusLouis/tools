import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const HOOK_SECRET = process.env.HOOK_SECRET;

const BodySchema = z.object({
  figmaNodeId: z.string().optional(),
  figmaFileKey: z.string().optional(),
  outputUrl: z.string().url().optional(),
  status: z.enum(["done", "failed"]).default("done"),
  error: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!ctx && HOOK_SECRET && req.headers.get("x-hook-secret") === HOOK_SECRET) {
    const ws = await db.workspace.findUnique({ where: { slug: "default" }, select: { id: true } });
    if (ws) ctx = { workspaceId: ws.id, deviceId: null, tokenId: null };
  }
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const task = await db.designTask.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.designTask.update({
    where: { id },
    data: {
      status: parsed.data.status,
      figmaNodeId: parsed.data.figmaNodeId ?? null,
      figmaFileKey: parsed.data.figmaFileKey ?? null,
      outputUrl: parsed.data.outputUrl ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
