import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";

const HOOK_SECRET = process.env.HOOK_SECRET;

const NodeSchema = z.object({
  kind: z.string().min(1).max(80),
  key: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  body: z.string().max(8000),
  projectName: z.string().max(200).optional(),
  tags: z.array(z.string().max(80)).max(20).default([]),
  reqIds: z.array(z.string().max(80)).max(30).default([]),
  sourcePath: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const BodySchema = z.object({
  nodes: z.array(NodeSchema).min(1).max(50),
});

export async function POST(req: NextRequest) {
  let ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!ctx && HOOK_SECRET && req.headers.get("x-hook-secret") === HOOK_SECRET) {
    const ws = await db.workspace.findUnique({ where: { slug: "default" }, select: { id: true } });
    if (ws) ctx = { workspaceId: ws.id, deviceId: null, tokenId: null };
  }
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { workspaceId } = ctx;
  let upserted = 0;

  for (const node of parsed.data.nodes) {
    await db.memoryNode.upsert({
      where: { workspaceId_key: { workspaceId, key: node.key } },
      create: {
        workspaceId,
        kind: node.kind,
        key: node.key,
        title: node.title,
        body: node.body,
        projectName: node.projectName ?? null,
        tags: node.tags,
        reqIds: node.reqIds,
        sourcePath: node.sourcePath ?? null,
        metadata: node.metadata as any,
      },
      update: {
        title: node.title,
        body: node.body,
        tags: node.tags,
        reqIds: node.reqIds,
        sourcePath: node.sourcePath ?? null,
        metadata: node.metadata as any,
      },
    });
    upserted++;
  }

  return NextResponse.json({ ok: true, upserted });
}
