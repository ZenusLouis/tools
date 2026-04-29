"use server";

import path from "path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { readJSON, writeJSON } from "@/lib/fs/json";
import { resolvePath, getClaudeRoot } from "@/lib/fs/resolve";
import { ContextJSON } from "@/lib/settings";
import { db } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";

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
  const user = await requireCurrentUser();
  const projectName = formData.get("projectName") as string;
  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId: user.workspaceId }, { workspaceId: null }] },
  });
  if (!project) return { error: "Project not found" };
  if (!project.workspaceId) {
    await db.project.update({ where: { name: projectName }, data: { workspaceId: user.workspaceId } }).catch(() => null);
  }

  const ctxPath = await getContextPath(projectName);
  let existing: ContextJSON = {
    name: project.name,
    path: project.path ?? undefined,
    framework: project.frameworks,
    mcpProfile: project.mcpProfile ?? undefined,
    docs: (project.docs as Record<string, string>) ?? {},
    tools: (project.links as Record<string, string>) ?? {},
    env: { required: [], envFile: ".env.local" },
    lastIndexed: project.lastIndexed?.toISOString().slice(0, 10),
    activeTask: project.activeTask,
  };
  if (ctxPath) {
    try {
      existing = { ...existing, ...(await readJSON<ContextJSON>(ctxPath)) };
    } catch {
      // DB remains the source of truth when workspace files are missing in hosted runtime.
    }
  }

  // Frameworks
  let frameworks: string[] = project.frameworks;
  const frameworksRaw = formData.get("frameworks");
  if (typeof frameworksRaw === "string" && frameworksRaw) {
    try { frameworks = JSON.parse(frameworksRaw); } catch { /* keep existing */ }
  }

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
    docs,
    tools,
    env: { ...existing.env, required },
  };

  if (ctxPath) {
    await writeJSON(ctxPath, updated);
  }

  await db.project.update({
    where: { name: projectName },
    data: {
      mcpProfile: updated.mcpProfile ?? null,
      frameworks,
      docs,
      links: tools,
    },
  });

  const devicePaths = await db.bridgeProjectPath.findMany({
    where: { workspaceId: user.workspaceId, projectName },
    select: { deviceId: true, path: true },
  });
  const syncTargets = devicePaths.length > 0
    ? devicePaths
    : project.path
      ? [{ deviceId: null, path: project.path }]
      : [];

  for (const target of syncTargets) {
    await db.bridgeFileAction.create({
      data: {
        workspaceId: user.workspaceId,
        deviceId: target.deviceId,
        type: "sync_project_metadata",
        payload: {
          projectName,
          projectPath: target.path,
          files: [
            {
              relativePath: ".gcs/context.json",
              content: JSON.stringify(updated, null, 2),
            },
          ],
        },
      },
    });
  }

  revalidatePath(`/projects/${encodeURIComponent(projectName)}`);
  revalidatePath(`/projects/${encodeURIComponent(projectName)}/settings`);
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
