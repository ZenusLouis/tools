import "server-only";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

export type ApiKeyRow = {
  id: string;
  name: string;
  service: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiKeyWithValue = ApiKeyRow & { value: string };

export async function listApiKeys(workspaceId?: string): Promise<ApiKeyRow[]> {
  const rows = await db.apiKey.findMany({ where: workspaceId ? { workspaceId } : undefined, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    service: r.service,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createApiKey(name: string, service: string, value: string, workspaceId?: string): Promise<ApiKeyRow> {
  const { encryptedValue, iv } = encrypt(value);
  const row = await db.apiKey.create({
    data: { name, service, encryptedValue, iv, workspaceId },
  });
  return {
    id: row.id,
    name: row.name,
    service: row.service,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function revealApiKey(id: string): Promise<string> {
  const row = await db.apiKey.findUnique({ where: { id } });
  if (!row) throw new Error("API key not found");
  return decrypt(row.encryptedValue, row.iv);
}

export async function deleteApiKey(id: string): Promise<void> {
  await db.apiKey.delete({ where: { id } });
}

export async function getApiKeyByService(service: string, workspaceId?: string): Promise<string | null> {
  const row = await db.apiKey.findFirst({ where: { service, ...(workspaceId ? { workspaceId } : {}) }, orderBy: { updatedAt: "desc" } });
  if (!row) return null;
  return decrypt(row.encryptedValue, row.iv);
}

export async function getApiKeyById(id: string, workspaceId?: string): Promise<string | null> {
  const row = await db.apiKey.findFirst({ where: { id, ...(workspaceId ? { workspaceId } : {}) } });
  if (!row) return null;
  return decrypt(row.encryptedValue, row.iv);
}
