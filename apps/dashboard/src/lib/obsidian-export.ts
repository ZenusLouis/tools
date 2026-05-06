import "server-only";
import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { resolvePath } from "@/lib/fs/resolve";

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

export async function exportObsidianVault(workspaceId: string) {
  const nodes = await db.memoryNode.findMany({
    where: { workspaceId },
    orderBy: [{ projectName: "asc" }, { kind: "asc" }, { title: "asc" }],
    take: 2000,
  });

  const vaultDir = resolvePath(".gcs", "obsidian");
  await fs.mkdir(vaultDir, { recursive: true });

  const indexLines = [
    "# GCS Memory Vault",
    "",
    `Exported at: ${new Date().toISOString()}`,
    `Nodes: ${nodes.length}`,
    "",
    "## Nodes",
  ];

  let written = 0;
  for (const node of nodes) {
    const project = node.projectName ? slug(node.projectName) : "workspace";
    const fileName = `${project}__${slug(node.kind)}__${slug(node.title)}__${node.id.slice(0, 8)}.md`;
    const rel = fileName;
    const content = [
      frontmatter({
        id: node.id,
        key: node.key,
        kind: node.kind,
        project: node.projectName,
        tags: node.tags,
        reqIds: node.reqIds,
        sourcePath: node.sourcePath,
      }),
      "",
      `# ${node.title}`,
      "",
      node.projectName ? `Project: [[${node.projectName}]]` : "Project: workspace",
      "",
      node.reqIds.length ? `Requirement IDs: ${node.reqIds.map((id) => `\`${id}\``).join(", ")}` : "",
      "",
      node.body,
      "",
      "## Backlinks",
      "",
      node.projectName ? `- [[${node.projectName}]]` : "- [[Workspace]]",
      ...node.reqIds.map((id) => `- [[${id}]]`),
      "",
    ].filter((line) => line !== "").join("\n");
    await fs.writeFile(path.join(vaultDir, fileName), content, "utf-8");
    indexLines.push(`- [[${rel.replace(/\.md$/, "")}]] - ${node.kind} - ${node.title}`);
    written++;
  }

  await fs.writeFile(path.join(vaultDir, "index.md"), `${indexLines.join("\n")}\n`, "utf-8");
  return { vaultDir, nodes: nodes.length, files: written + 1 };
}
