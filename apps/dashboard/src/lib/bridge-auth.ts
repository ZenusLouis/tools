import "server-only";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

export type BridgeContext = {
  workspaceId: string;
  deviceId: string | null;
  tokenId: string | null;
};

export function hashBridgeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createBridgeTokenValue(): string {
  return `gcsb_${randomBytes(32).toString("base64url")}`;
}

export async function verifyBridgeRequest(token: string | null): Promise<BridgeContext | null> {
  if (!token) return null;

  const legacy = process.env.HOOK_SECRET;
  if (legacy && token === legacy) {
    const workspace = await db.workspace.findUnique({ where: { slug: "default" }, select: { id: true } });
    return workspace ? { workspaceId: workspace.id, deviceId: null, tokenId: null } : null;
  }

  const row = await db.bridgeToken.findUnique({
    where: { tokenHash: hashBridgeToken(token) },
    include: { device: true },
  });
  if (!row || row.revokedAt) return null;

  await db.bridgeToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return { workspaceId: row.workspaceId, deviceId: row.deviceId, tokenId: row.id };
}

export function bridgeTokenFromHeaders(headers: Headers): string | null {
  return headers.get("x-bridge-token") ?? headers.get("x-hook-secret") ?? null;
}

