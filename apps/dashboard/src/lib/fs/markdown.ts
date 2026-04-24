import fs from "fs/promises";
import path from "path";

export async function readMarkdown(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf-8").catch(() => "");
}

export async function appendMarkdown(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, "\n" + content, "utf-8");
}

export async function writeMarkdown(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}
