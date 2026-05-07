import "server-only";
import { db } from "@/lib/db";

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "memory";
}

function frontmatter(data: Record<string, unknown>) {
  const lines = Object.entries(data).map(([key, value]) => {
    if (Array.isArray(value)) return `${key}: [${value.map((item) => JSON.stringify(String(item))).join(", ")}]`;
    if (value === null || value === undefined) return `${key}: null`;
    return `${key}: ${JSON.stringify(String(value))}`;
  });
  return `---\n${lines.join("\n")}\n---`;
}

export async function buildObsidianFiles(workspaceId: string): Promise<{
  files: Map<string, string>;
  nodeCount: number;
  edgeCount: number;
}> {
  const nodes = await db.memoryNode.findMany({
    where: { workspaceId },
    orderBy: [{ projectName: "asc" }, { kind: "asc" }, { title: "asc" }],
    take: 2000,
  });
  const edges = await db.memoryEdge.findMany({
    where: { workspaceId },
    include: {
      fromNode: { select: { id: true, title: true, kind: true } },
      toNode: { select: { id: true, title: true, kind: true } },
    },
    take: 5000,
  });
  const outgoing = new Map<string, typeof edges>();
  const incoming = new Map<string, typeof edges>();
  for (const edge of edges) {
    outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge]);
    incoming.set(edge.toNodeId, [...(incoming.get(edge.toNodeId) ?? []), edge]);
  }

  const files = new Map<string, string>();
  const indexLines = [
    "# GCS Memory Vault",
    "",
    `Exported at: ${new Date().toISOString()}`,
    `Nodes: ${nodes.length}`,
    `Edges: ${edges.length}`,
    "",
    "## Nodes",
  ];

  for (const node of nodes) {
    const project = node.projectName ? slug(node.projectName) : "workspace";
    const fileName = `${project}__${slug(node.kind)}__${slug(node.title)}__${node.id.slice(0, 8)}.md`;
    const content = [
      frontmatter({ id: node.id, key: node.key, kind: node.kind, project: node.projectName, tags: node.tags, reqIds: node.reqIds, sourcePath: node.sourcePath }),
      "",
      `# ${node.title}`,
      "",
      node.projectName ? `Project: [[${node.projectName}]]` : "Project: workspace",
      "",
      node.reqIds.length ? `Requirement IDs: ${node.reqIds.map((id) => `\`${id}\``).join(", ")}` : "",
      "",
      node.body,
      "",
      "## Relations",
      "",
      ...(outgoing.get(node.id) ?? []).slice(0, 50).map((edge) => `- ${edge.relation} -> [[${edge.toNode.title}]] (${edge.toNode.kind})`),
      ...(incoming.get(node.id) ?? []).slice(0, 50).map((edge) => `- ${edge.relation} <- [[${edge.fromNode.title}]] (${edge.fromNode.kind})`),
      "",
      "## Backlinks",
      "",
      node.projectName ? `- [[${node.projectName}]]` : "- [[Workspace]]",
      ...node.reqIds.map((id) => `- [[${id}]]`),
    ].filter((line) => line !== "").join("\n");
    files.set(fileName, content);
    indexLines.push(`- [[${fileName.replace(/\.md$/, "")}]] - ${node.kind} - ${node.title}`);
  }

  files.set("index.md", `${indexLines.join("\n")}\n`);
  return { files, nodeCount: nodes.length, edgeCount: edges.length };
}
