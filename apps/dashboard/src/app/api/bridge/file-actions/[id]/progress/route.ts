import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const HOOK_SECRET = process.env.HOOK_SECRET;

const Schema = z.object({ lines: z.array(z.string()).max(100) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!ctx && HOOK_SECRET && req.headers.get("x-hook-secret") === HOOK_SECRET) {
    const ws = await db.workspace.findUnique({ where: { slug: "default" }, select: { id: true } });
    if (ws) ctx = { workspaceId: ws.id, deviceId: null, tokenId: null };
  }
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad input" }, { status: 400 });

  const action = await db.bridgeFileAction.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, result: true, status: true },
  });
  if (!action) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (action.status === "cancelled") return NextResponse.json({ ok: true, ignored: true });

  // Append new lines to existing log (keep last 200 lines max)
  const prev = (action.result as { log?: string[] } | null)?.log ?? [];
  const log = [...prev, ...parsed.data.lines].slice(-200);
  await db.bridgeFileAction.update({ where: { id }, data: { result: { log } } });

  return NextResponse.json({ ok: true });
}
