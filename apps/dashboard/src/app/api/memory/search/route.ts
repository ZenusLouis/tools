import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

function tokens(value: string) {
  return Array.from(new Set((value.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []).slice(0, 12)));
}

function excerpt(value: string, maxChars = 420) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxChars ? `${normalized.slice(0, maxChars).trim()} ...` : normalized;
}

export async function GET(req: NextRequest) {
  const user = await requireCurrentUser();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const projectName = url.searchParams.get("project") ?? undefined;
  const reqId = url.searchParams.get("reqId") ?? undefined;
  const queryTokens = tokens(q);
  const nodes = await db.memoryNode.findMany({
    where: {
      workspaceId: user.workspaceId,
      ...(projectName ? { OR: [{ projectName }, { projectName: null }] } : {}),
      ...(reqId ? { reqIds: { has: reqId } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 250,
  });
  const scored = nodes
    .map((node) => {
      const corpus = `${node.title} ${node.body} ${node.tags.join(" ")} ${node.reqIds.join(" ")}`.toLowerCase();
      const matchedTokens = queryTokens.filter((token) => corpus.includes(token));
      const score = queryTokens.reduce((sum, token) => sum + (corpus.includes(token) ? 1 : 0), 0)
        + (projectName && node.projectName === projectName ? 2 : 0)
        + (reqId && node.reqIds.includes(reqId) ? 5 : 0);
      return { node, score, matchedTokens };
    })
    .filter((row) => !q || row.score > 0)
    .sort((a, b) => b.score - a.score || a.node.title.localeCompare(b.node.title))
    .slice(0, 30)
    .map(({ node, score, matchedTokens }) => ({
      id: node.id,
      kind: node.kind,
      key: node.key,
      title: node.title,
      excerpt: excerpt(node.body),
      bodyPreview: excerpt(node.body),
      tags: node.tags,
      reqIds: node.reqIds,
      projectName: node.projectName,
      sourcePath: node.sourcePath,
      score,
      reasons: [
        ...(matchedTokens.length ? [`keyword ${matchedTokens.slice(0, 5).join(", ")}`] : []),
        ...(projectName && node.projectName === projectName ? ["project match"] : []),
        ...(reqId && node.reqIds.includes(reqId) ? ["reqId match"] : []),
      ],
    }));
  return NextResponse.json({ results: scored, count: scored.length, routingTokens: 0 });
}
