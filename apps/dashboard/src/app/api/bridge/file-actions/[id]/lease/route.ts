import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leaseDate } from "@/lib/bridge-actions";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const HOOK_SECRET = process.env.HOOK_SECRET;

const LeaseSchema = z.object({
  claimToken: z.string().min(1).optional(),
});

async function context(req: NextRequest) {
  let ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!ctx && HOOK_SECRET && req.headers.get("x-hook-secret") === HOOK_SECRET) {
    const ws = await db.workspace.findUnique({ where: { slug: "default" }, select: { id: true } });
    if (ws) ctx = { workspaceId: ws.id, deviceId: null, tokenId: null };
  }
  return ctx;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await context(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = LeaseSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  const action = await db.bridgeFileAction.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true, claimToken: true, cancelRequestedAt: true },
  });
  if (!action) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (action.claimToken && parsed.data.claimToken && action.claimToken !== parsed.data.claimToken) {
    return NextResponse.json({ error: "claim token mismatch" }, { status: 409 });
  }
  if (action.status === "cancelled" || action.cancelRequestedAt) {
    return NextResponse.json({ ok: true, cancelled: true, status: "cancelled" });
  }
  if (!["claimed", "running"].includes(action.status)) {
    return NextResponse.json({ ok: true, status: action.status });
  }
  const leaseExpiresAt = leaseDate();
  await db.bridgeFileAction.update({
    where: { id: action.id },
    data: {
      status: "running",
      heartbeatAt: new Date(),
      leaseExpiresAt,
    },
  });
  return NextResponse.json({ ok: true, status: "running", leaseExpiresAt });
}
