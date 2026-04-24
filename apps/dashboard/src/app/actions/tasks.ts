"use server";

import path from "path";
import { revalidatePath } from "next/cache";
import { readJSON, writeJSON } from "@/lib/fs/json";
import { resolvePath, getClaudeRoot } from "@/lib/fs/resolve";

type Registry = Record<string, string>;
type ProgressTask = { id: string; name?: string; status: string; estimate?: string; deps?: string[]; [key: string]: unknown };
type ProgressFeature = { id: string; tasks: ProgressTask[]; [key: string]: unknown };
type ProgressModule = { id: string; features: ProgressFeature[]; [key: string]: unknown };
type ProgressJSON = { modules: ProgressModule[]; [key: string]: unknown };

async function getProgressPath(projectName: string): Promise<string | null> {
  try {
    const registry = await readJSON<Registry>(resolvePath("projects", "registry.json"));
    const relPath = registry[projectName];
    if (!relPath) return null;
    return path.join(getClaudeRoot(), relPath, "progress.json");
  } catch {
    return null;
  }
}

export async function addTask(
  projectName: string,
  moduleId: string,
  name: string
): Promise<{ ok: boolean; taskId?: string; error?: string }> {
  if (!name.trim()) return { ok: false, error: "Name required" };
  const progressPath = await getProgressPath(projectName);
  if (!progressPath) return { ok: false, error: "Project not found" };

  try {
    const progress = await readJSON<ProgressJSON>(progressPath);
    const mod = progress.modules.find((m) => m.id === moduleId);
    if (!mod) return { ok: false, error: `Module ${moduleId} not found` };

    const feat = mod.features[0];
    if (!feat) return { ok: false, error: "No features in module" };

    const nums = feat.tasks.map((t) => {
      const m = String(t.id).match(/-T(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const nextNum = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
    const taskId = `${feat.id}-T${nextNum}`;

    feat.tasks.push({ id: taskId, name: name.trim(), status: "pending", estimate: "?", deps: [] });
    await writeJSON(progressPath, progress);
    revalidatePath("/tasks");
    return { ok: true, taskId };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function markTaskStatus(
  projectName: string,
  taskId: string,
  status: "completed" | "blocked" | "in-progress" | "pending"
): Promise<{ ok: boolean; error?: string }> {
  const progressPath = await getProgressPath(projectName);
  if (!progressPath) return { ok: false, error: "Project not found" };

  try {
    const progress = await readJSON<ProgressJSON>(progressPath);
    let found = false;
    for (const mod of progress.modules) {
      for (const feat of mod.features) {
        for (const task of feat.tasks) {
          if (task.id === taskId) {
            task.status = status;
            found = true;
          }
        }
      }
    }
    if (!found) return { ok: false, error: `Task ${taskId} not found` };
    await writeJSON(progressPath, progress);
    revalidatePath("/tasks");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
