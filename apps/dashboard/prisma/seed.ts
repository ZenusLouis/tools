import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { pbkdf2Sync, randomBytes } from "crypto";
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

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const iterations = 210_000;
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2:${iterations}:${salt}:${hash}`;
}

loadEnvFile(path.resolve(__dirname, "..", ".env"));
loadEnvFile(path.resolve(__dirname, "..", ".env.local"));

const db = new PrismaClient();
const root = process.env.CLAUDE_ROOT ?? "d:\\GlobalClaudeSkills";

async function seedIdentity() {
  const workspace = await db.workspace.upsert({
    where: { slug: process.env.WORKSPACE_SLUG ?? "default" },
    create: { name: process.env.WORKSPACE_NAME ?? "Default Workspace", slug: process.env.WORKSPACE_SLUG ?? "default" },
    update: { name: process.env.WORKSPACE_NAME ?? "Default Workspace" },
  });

  const email = (process.env.ADMIN_EMAIL ?? "admin@gcs.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin123456";
  const user = await db.user.upsert({
    where: { email },
    create: { email, name: "GCS Admin", passwordHash: hashPassword(password) },
    update: {},
  });

  await db.workspaceMember.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    create: { userId: user.id, workspaceId: workspace.id, role: "owner" },
    update: { role: "owner" },
  });

  return { workspace, email };
}

async function main() {
  console.log("Seeding database from", root);
  const { workspace, email } = await seedIdentity();
  console.log(`  OK Identity: ${email} / workspace ${workspace.slug}`);

  const result = await syncWorkspaceFromRepo(db, workspace.id, root, {
    includeProjects: true,
    includeLogs: true,
    includeLessons: true,
    includeMcp: true,
    includeSkillsAndRoles: true,
    onlyIfEmpty: process.env.FORCE_REPO_SYNC !== "true",
  });
  console.log(`  OK Repo sync: ${JSON.stringify(result)}`);
  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
