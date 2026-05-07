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
  const baseDir = ".gcs/obsidian";
  const nodeFileStem = new Map<string, string>();
  const projectNames = new Set<string>();
  const reqIds = new Set<string>();
  for (const node of nodes) {
    if (node.projectName) projectNames.add(node.projectName);
    for (const reqId of node.reqIds) reqIds.add(reqId);
    const project = node.projectName ? slug(node.projectName) : "workspace";
    nodeFileStem.set(node.id, `${project}__${slug(node.kind)}__${slug(node.title)}__${node.id.slice(0, 8)}`);
  }
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
    const fileStem = nodeFileStem.get(node.id) ?? `${project}__${slug(node.kind)}__${slug(node.title)}__${node.id.slice(0, 8)}`;
    const fileName = `${baseDir}/nodes/${fileStem}.md`;
    const projectLink = node.projectName ? `project__${slug(node.projectName)}` : "workspace";
    const content = [
      frontmatter({ id: node.id, key: node.key, kind: node.kind, project: node.projectName, tags: node.tags, reqIds: node.reqIds, sourcePath: node.sourcePath }),
      "",
      `# ${node.title}`,
      "",
      node.projectName ? `Project: [[${projectLink}]]` : "Project: [[workspace]]",
      "",
      node.reqIds.length ? `Requirement IDs: ${node.reqIds.map((id) => `\`${id}\``).join(", ")}` : "",
      "",
      node.body,
      "",
      "## Relations",
      "",
      ...(outgoing.get(node.id) ?? []).slice(0, 50).map((edge) => `- ${edge.relation} -> [[${nodeFileStem.get(edge.toNodeId) ?? slug(edge.toNode.title)}]] (${edge.toNode.kind})`),
      ...(incoming.get(node.id) ?? []).slice(0, 50).map((edge) => `- ${edge.relation} <- [[${nodeFileStem.get(edge.fromNodeId) ?? slug(edge.fromNode.title)}]] (${edge.fromNode.kind})`),
      "",
      "## Backlinks",
      "",
      node.projectName ? `- [[${projectLink}]]` : "- [[workspace]]",
      ...node.reqIds.map((id) => `- [[req__${slug(id)}]]`),
    ].filter((line) => line !== "").join("\n");
    files.set(fileName, content);
    indexLines.push(`- [[${fileStem}]] - ${node.kind} - ${node.title}`);
  }

  const projectIndex = [
    "# Projects",
    "",
    ...Array.from(projectNames).sort().map((name) => `- [[project__${slug(name)}]]`),
  ].join("\n");
  files.set(`${baseDir}/projects.md`, `${projectIndex}\n`);
  for (const projectName of Array.from(projectNames).sort()) {
    const projectNodes = nodes.filter((node) => node.projectName === projectName);
    files.set(`${baseDir}/projects/project__${slug(projectName)}.md`, [
      frontmatter({ project: projectName, kind: "project-index" }),
      "",
      `# ${projectName}`,
      "",
      "## Memory",
      "",
      ...projectNodes.map((node) => `- [[${nodeFileStem.get(node.id)}]] - ${node.kind} - ${node.title}`),
    ].join("\n"));
  }

  const reqIndex = [
    "# Requirement IDs",
    "",
    ...Array.from(reqIds).sort().map((id) => `- [[req__${slug(id)}]]`),
  ].join("\n");
  files.set(`${baseDir}/requirements.md`, `${reqIndex}\n`);
  for (const reqId of Array.from(reqIds).sort()) {
    const relatedNodes = nodes.filter((node) => node.reqIds.includes(reqId));
    files.set(`${baseDir}/requirements/req__${slug(reqId)}.md`, [
      frontmatter({ reqId, kind: "requirement-index" }),
      "",
      `# ${reqId}`,
      "",
      "## Related Memory",
      "",
      ...relatedNodes.map((node) => `- [[${nodeFileStem.get(node.id)}]] - ${node.kind} - ${node.title}`),
    ].join("\n"));
  }

  files.set(`${baseDir}/index.md`, `${indexLines.join("\n")}\n\n## Indexes\n\n- [[projects]]\n- [[requirements]]\n`);
  return { files, nodeCount: nodes.length, edgeCount: edges.length };
}
