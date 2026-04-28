import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

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

function argValue(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1] ?? fallback;
  return fallback;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const maxTokens = Number(argValue("max-tokens", "1000000"));
  const since = argValue("since");
  const sinceDate = since ? new Date(since) : undefined;

  if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
    throw new Error("--max-tokens must be a positive number");
  }

  const dateFilter = sinceDate && !Number.isNaN(sinceDate.getTime()) ? { date: { gte: sinceDate } } : {};
  const toolWhere = {
    provider: "codex" as const,
    tokens: { gte: maxTokens },
    ...dateFilter,
  };
  const sessionWhere = {
    provider: "codex" as const,
    totalTokens: { gte: maxTokens },
    ...dateFilter,
  };

  const [toolCount, sessionCount, toolSum, sessionSum, sampleTools, sampleSessions] = await Promise.all([
    db.toolUsage.count({ where: toolWhere }),
    db.session.count({ where: sessionWhere }),
    db.toolUsage.aggregate({ where: toolWhere, _sum: { tokens: true } }),
    db.session.aggregate({ where: sessionWhere, _sum: { totalTokens: true } }),
    db.toolUsage.findMany({
      where: toolWhere,
      orderBy: { tokens: "desc" },
      take: 10,
      select: { id: true, date: true, tool: true, tokens: true, model: true, role: true },
    }),
    db.session.findMany({
      where: sessionWhere,
      orderBy: { totalTokens: "desc" },
      take: 10,
      select: { id: true, date: true, project: true, totalTokens: true, model: true, role: true, sessionNotes: true },
    }),
  ]);

  const summary = {
    mode: apply ? "apply" : "dry-run",
    maxTokens,
    since: sinceDate?.toISOString() ?? null,
    matched: {
      toolUsageRows: toolCount,
      toolUsageTokens: toolSum._sum.tokens ?? 0,
      sessionRows: sessionCount,
      sessionTokens: sessionSum._sum.totalTokens ?? 0,
    },
    samples: {
      toolUsage: sampleTools,
      sessions: sampleSessions,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to delete these inflated Codex rows.");
    return;
  }

  const [deletedTools, deletedSessions] = await db.$transaction([
    db.toolUsage.deleteMany({ where: toolWhere }),
    db.session.deleteMany({ where: sessionWhere }),
  ]);

  console.log(JSON.stringify({ deletedTools, deletedSessions }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
