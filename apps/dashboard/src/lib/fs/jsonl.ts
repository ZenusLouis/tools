import fs from "fs/promises";
import path from "path";

export async function readJSONL<T>(filePath: string): Promise<T[]> {
  const raw = await fs.readFile(filePath, "utf-8").catch(() => "");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export async function appendJSONL(filePath: string, entry: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, JSON.stringify(entry) + "\n", "utf-8");
}
