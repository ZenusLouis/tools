import "server-only";
import { db } from "@/lib/db";

type TaskMemoryInput = {
  id: string;
  name: string;
  summary?: string | null;
  details?: string | null;
  moduleName?: string | null;
  featureName?: string | null;
  reqIds?: string[];
};

type RelatedMemory = {
  id: string;
  kind: string;
  title: string;
  projectName: string | null;
  reqIds: string[];
  tags: string[];
  score: number;
  reasons: string[];
  snippet: string;
};

function tokenize(value: string) {
  const stop = new Set([
    "and",
    "the",
    "for",
    "with",
    "from",
    "this",
    "that",
    "task",
    "tasks",
    "implement",
    "create",
    "update",
    "delete",
    "none",
    "null",
    "true",
    "false",
  ]);
  return new Set(
    value
      .toLowerCase()
      .match(/[a-z0-9][a-z0-9-]{2,}/g)
      ?.filter((token) => !stop.has(token) && token.length <= 42) ?? [],
  );
}

function clip(value: string, maxChars = 900) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxChars ? `${normalized.slice(0, maxChars).trim()} ...` : normalized;
}

export async function findRelatedMemory(params: {
  workspaceId: string;
  projectName: string;
  task: TaskMemoryInput;
  limit?: number;
}): Promise<RelatedMemory[]> {
  const reqIds = new Set(params.task.reqIds ?? []);
  const tokens = tokenize([
    params.task.id,
    params.task.name,
    params.task.summary ?? "",
    params.task.details ?? "",
    params.task.moduleName ?? "",
    params.task.featureName ?? "",
    ...(params.task.reqIds ?? []),
  ].join(" "));

  const nodes = await db.memoryNode.findMany({
    where: {
      workspaceId: params.workspaceId,
      OR: [
        { projectName: params.projectName },
        { projectName: null },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 600,
    select: {
      id: true,
      kind: true,
      title: true,
      projectName: true,
      body: true,
      tags: true,
      reqIds: true,
    },
  });

  return nodes
    .map((node) => {
      let score = 0;
      const reasons: string[] = [];
      if (node.projectName === params.projectName) {
        score += 12;
        reasons.push("project match");
      }
      const reqMatches = node.reqIds.filter((reqId) => reqIds.has(reqId));
      if (reqMatches.length) {
        score += reqMatches.length * 30;
        reasons.push(`reqId match ${reqMatches.slice(0, 4).join(", ")}`);
      }
      const corpus = `${node.title} ${node.tags.join(" ")} ${node.body}`.toLowerCase();
      const tokenHits = Array.from(tokens).filter((token) => corpus.includes(token));
      if (tokenHits.length) {
        score += Math.min(40, tokenHits.length * 4);
        reasons.push(`keyword match ${tokenHits.slice(0, 5).join(", ")}`);
      }
      if (node.kind === "decision") {
        score += 8;
        reasons.push("decision memory");
      }
      if (node.kind === "run-telemetry") {
        score += 4;
        reasons.push("run telemetry");
      }
      if (score <= 0) return null;
      return {
        id: node.id,
        kind: node.kind,
        title: node.title,
        projectName: node.projectName,
        reqIds: node.reqIds,
        tags: node.tags,
        score,
        reasons,
        snippet: clip(node.body),
      };
    })
    .filter((item): item is RelatedMemory => item !== null)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, params.limit ?? 6);
}
