import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { syncWorkspaceFromRepo } from "../src/lib/repo-sync";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf-8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

loadEnvFile(path.resolve(__dirname, "..", ".env"));
loadEnvFile(path.resolve(__dirname, "..", ".env.local"));

const db = new PrismaClient();

async function main() {
  const root = process.env.CLAUDE_ROOT ?? path.resolve(__dirname, "..", "..", "..");
  const workspaceSlug = process.env.WORKSPACE_SLUG ?? "default";
  const workspaceName = process.env.WORKSPACE_NAME ?? "Default Workspace";

  const workspace = await db.workspace.upsert({
    where: { slug: workspaceSlug },
    create: { slug: workspaceSlug, name: workspaceName },
    update: { name: workspaceName },
  });

  const result = await syncWorkspaceFromRepo(db, workspace.id, root, {
    includeProjects: true,
    includeLessons: true,
    includeMcp: true,
    includeSkillsAndRoles: true,
    includeLogs: process.env.SYNC_LOGS !== "false",
  });

  console.log(JSON.stringify({ root, workspace: workspace.slug, result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
