"use server";

import path from "path";
import { redirect } from "next/navigation";
import { readJSON, writeJSON } from "@/lib/fs/json";
import { resolvePath, getClaudeRoot } from "@/lib/fs/resolve";
import { ContextJSON } from "@/lib/settings";
import { db } from "@/lib/db";

type Registry = Record<string, string>;

async function getContextPath(projectName: string): Promise<string | null> {
  try {
    const registry = await readJSON<Registry>(resolvePath("projects", "registry.json"));
    const relPath = registry[projectName];
    if (!relPath) return null;
    return path.join(getClaudeRoot(), relPath, "context.json");
  } catch {
    return null;
  }
}

export async function saveSettings(_prev: unknown, formData: FormData): Promise<{ error?: string; saved?: boolean }> {
  const projectName = formData.get("projectName") as string;
  const ctxPath = await getContextPath(projectName);
  if (!ctxPath) return { error: "Project not found" };

  const existing = await readJSON<ContextJSON>(ctxPath);

  // Docs
  const docs: Record<string, string> = {};
  for (const [key, val] of formData.entries()) {
    if (key.startsWith("docs.") && typeof val === "string" && val.trim()) {
      docs[key.slice(5)] = val.trim();
    }
  }

  // Tools
  const tools: Record<string, string> = {};
  for (const [key, val] of formData.entries()) {
    if (key.startsWith("tools.") && typeof val === "string" && val.trim()) {
      tools[key.slice(6)] = val.trim();
    }
  }

  // Env
  const envRequired = formData.get("env.required");
  let required: string[] = existing.env?.required ?? [];
  if (typeof envRequired === "string") {
    try { required = JSON.parse(envRequired); } catch { /* keep existing */ }
  }

  const updated: ContextJSON = {
    ...existing,
    mcpProfile: (formData.get("mcpProfile") as string) || existing.mcpProfile,
    docs: Object.keys(docs).length ? docs : existing.docs,
    tools: Object.keys(tools).length ? tools : existing.tools,
    env: { ...existing.env, required },
  };

  await writeJSON(ctxPath, updated);
  return { saved: true };
}

export async function removeProject(projectName: string): Promise<void> {
  // Remove from local registry
  try {
    const registryPath = resolvePath("projects", "registry.json");
    const registry = await readJSON<Registry>(registryPath);
    delete registry[projectName];
    await writeJSON(registryPath, registry);
  } catch { /* registry may not exist in cloud-only setup */ }

  // Remove from DB
  await db.project.delete({ where: { name: projectName } }).catch(() => null);

  redirect("/projects");
}
