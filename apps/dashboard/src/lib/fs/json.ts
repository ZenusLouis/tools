import 'server-only';
import fs from "fs/promises";
import path from "path";

export async function readJSON<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export async function writeJSON(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function patchJSON<T extends Record<string, unknown>>(
  filePath: string,
  patch: Partial<T>
): Promise<T> {
  const existing = await readJSON<T>(filePath);
  const updated = { ...existing, ...patch };
  await writeJSON(filePath, updated);
  return updated;
}
