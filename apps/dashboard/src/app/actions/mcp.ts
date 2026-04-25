"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function registerMcpServer(_prev: unknown, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "http").trim();
  const url = String(formData.get("url") ?? "").trim();
  const command = String(formData.get("command") ?? "").trim();
  const args = String(formData.get("args") ?? "").split(/\s+/).filter(Boolean);
  if (!name) return { ok: false, error: "Server name required" };
  if (type === "http" && !url) return { ok: false, error: "HTTP server URL required" };
  if (type === "stdio" && !command) return { ok: false, error: "stdio command required" };

  await db.mcpServer.upsert({
    where: { name },
    create: { name, type, url: url || null, command: command || null, args },
    update: { type, url: url || null, command: command || null, args },
  });
  revalidatePath("/mcp");
  return { ok: true };
}

export async function saveMcpProfile(_prev: unknown, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const profile = String(formData.get("profile") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const useWhen = String(formData.get("useWhen") ?? "").trim();
  const servers = String(formData.get("servers") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!profile) return { ok: false, error: "Profile name required" };
  if (servers.length === 0) return { ok: false, error: "At least one server required" };

  await db.mcpProfile.upsert({
    where: { profile },
    create: { profile, description, useWhen, servers },
    update: { description, useWhen, servers },
  });
  revalidatePath("/mcp");
  return { ok: true };
}
