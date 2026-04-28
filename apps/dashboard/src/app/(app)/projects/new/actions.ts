"use server";

import path from "path";
import fs from "fs/promises";
import type { Dirent } from "fs";
import { readJSON, writeJSON } from "@/lib/fs/json";
import { resolvePath } from "@/lib/fs/resolve";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type Registry = Record<string, string>;

function slugFromProjectPath(folderPath: string): string {
  const normalized = folderPath.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
  const lastSegment = normalized.split("/").filter(Boolean).pop() ?? "";
  return lastSegment
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeProjectName(name: string, folderPath: string): string {
  const lastNameSegment = name.trim().replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? "";
  const slug = lastNameSegment
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || slugFromProjectPath(folderPath);
}

// ── Step 1: Scan folder ──────────────────────────────────────────────────────

export type ScanResult = {
  name: string;
  framework: string[];
  error?: string;
  warning?: string;
};

async function detectFramework(folderPath: string): Promise<string[]> {
  const frameworks: string[] = [];

  // package.json
  try {
    const pkgRaw = await fs.readFile(path.join(folderPath, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps["next"]) frameworks.push("nextjs");
    else if (deps["react"]) frameworks.push("react");
    if (deps["vue"]) frameworks.push("vue");
    if (deps["nuxt"]) frameworks.push("nuxt");
    if (deps["express"]) frameworks.push("express");
    if (deps["@nestjs/core"]) frameworks.push("nestjs");
    if (deps["svelte"]) frameworks.push("svelte");
  } catch { /* no package.json */ }

  // Go
  try {
    await fs.access(path.join(folderPath, "go.mod"));
    frameworks.push("go");
  } catch { /* noop */ }

  // Python
  try {
    await fs.access(path.join(folderPath, "requirements.txt"));
    frameworks.push("python");
  } catch { /* noop */ }
  try {
    await fs.access(path.join(folderPath, "pyproject.toml"));
    if (!frameworks.includes("python")) frameworks.push("python");
  } catch { /* noop */ }

  // Rust
  try {
    await fs.access(path.join(folderPath, "Cargo.toml"));
    frameworks.push("rust");
  } catch { /* noop */ }

  // Java
  try {
    await fs.access(path.join(folderPath, "pom.xml"));
    frameworks.push("java");
  } catch { /* noop */ }
  try {
    await fs.access(path.join(folderPath, "build.gradle"));
    if (!frameworks.includes("java")) frameworks.push("java");
  } catch { /* noop */ }

  return frameworks.length ? frameworks : ["unknown"];
}

export async function scanProject(folderPath: string): Promise<ScanResult> {
  const trimmedPath = folderPath.trim();
  const fallbackName = slugFromProjectPath(trimmedPath);
  if (!trimmedPath || !fallbackName) {
    return { name: "", framework: [], error: "Enter a project folder path" };
  }

  try {
    const stat = await fs.stat(trimmedPath);
    if (!stat.isDirectory()) return { name: "", framework: [], error: "Path is not a directory" };

    const framework = await detectFramework(trimmedPath);
    return { name: fallbackName, framework };
  } catch {
    return {
      name: fallbackName,
      framework: ["unknown"],
      warning: "Folder is not accessible from this dashboard runtime. The project can still be created with an empty index; run the local bridge on the machine that owns this path to sync files later.",
    };
  }
}

// ── Step 3: Build code-index ─────────────────────────────────────────────────

const SOURCE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".kt", ".rb",
  ".css", ".scss", ".html", ".vue", ".svelte",
  ".json", ".yaml", ".yml", ".toml", ".md",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build",
  "__pycache__", ".venv", "target", ".turbo",
]);

async function scanDir(
  dir: string,
  base: string,
  depth: number,
  result: Map<string, string[]>
): Promise<void> {
  if (depth > 4) return;
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await scanDir(path.join(dir, entry.name), base, depth + 1, result);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!SOURCE_EXTS.has(ext)) continue;
      const rel = path.relative(base, dir).replace(/\\/g, "/") || ".";
      if (!result.has(rel)) result.set(rel, []);
      result.get(rel)!.push(entry.name);
    }
  }
}

function buildCodeIndex(projectName: string, fileMap: Map<string, string[]>): string {
  const dirs = [...fileMap.keys()].sort();
  const totalFiles = [...fileMap.values()].reduce((s, f) => s + f.length, 0);
  const lines: string[] = [
    `# Code Index: ${projectName} [HEADER - load on /start]`,
    `Total: ${totalFiles} files | Last indexed: ${new Date().toISOString().slice(0, 10)}`,
    `---FULL INDEX BELOW---`,
    "",
  ];
  for (const dir of dirs) {
    lines.push(`## ${dir}/`);
    for (const file of fileMap.get(dir)!.sort()) {
      lines.push(`- \`${file}\``);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ── Step 5: Create project ────────────────────────────────────────────────────

export type CreateProjectInput = {
  name: string;
  folderPath: string;
  framework: string[];
  mcpProfile: string;
  docs: { brd?: string; prd?: string; apiSpec?: string };
  tools: { figma?: string; github?: string; linear?: string };
};

export async function createProject(input: CreateProjectInput): Promise<{ error?: string; name?: string; localSyncQueued?: boolean }> {
  const user = await requireCurrentUser();
  const { folderPath, framework, mcpProfile, docs, tools } = input;
  const name = sanitizeProjectName(input.name, folderPath);

  if (!name) return { error: "Project name could not be detected from the folder path" };

  // Check name uniqueness
  const registryPath = resolvePath("projects", "registry.json");
  let registry: Registry = {};
  try {
    registry = await readJSON<Registry>(registryPath);
  } catch { /* first project */ }

  if (registry[name]) return { error: `Project "${name}" already exists` };

  // Paths
  const projectDir = `projects/${name}`;
  const ctxPath = resolvePath(projectDir, "context.json");
  const progressPath = resolvePath(projectDir, "progress.json");
  const codeIndexPath = resolvePath(projectDir, "code-index.md");

  const filteredDocs = Object.fromEntries(
    Object.entries(docs).filter(([, v]) => v?.trim())
  );
  const filteredTools = Object.fromEntries(
    Object.entries(tools).filter(([, v]) => v?.trim())
  );

  const contextPayload = {
    name,
    path: folderPath,
    framework,
    mcpProfile: mcpProfile || undefined,
    docs: Object.keys(filteredDocs).length ? filteredDocs : undefined,
    tools: Object.keys(filteredTools).length ? filteredTools : undefined,
    env: { required: [], envFile: ".env.local" },
    lastIndexed: new Date().toISOString().slice(0, 10),
    activeTask: null,
  };

  const progressPayload = {
    project: name,
    version: "1.0",
    activeTask: null,
    modules: [],
    risks: [],
    gates: {
      G1: { status: "pending" },
      G2: { status: "pending" },
      G3: { status: "pending" },
      G4: { status: "pending" },
    },
  };

  // Write context.json
  await writeJSON(ctxPath, contextPayload);

  // Write empty progress.json
  await writeJSON(progressPath, progressPayload);

  // Build code-index
  const fileMap = new Map<string, string[]>();
  await scanDir(folderPath, folderPath, 0, fileMap);
  const indexContent = buildCodeIndex(name, fileMap);
  await fs.writeFile(codeIndexPath, indexContent, "utf-8");

  // Register
  registry[name] = projectDir;
  await writeJSON(registryPath, registry);

  await db.project.upsert({
    where: { name },
    create: {
      name,
      workspaceId: user.workspaceId,
      path: folderPath,
      frameworks: framework,
      mcpProfile: mcpProfile || null,
      docs: filteredDocs,
      links: filteredTools,
      lastIndexed: new Date(),
      activeTask: null,
    },
    update: {
      workspaceId: user.workspaceId,
      path: folderPath,
      frameworks: framework,
      mcpProfile: mcpProfile || null,
      docs: filteredDocs,
      links: filteredTools,
      lastIndexed: new Date(),
    },
  });

  await db.bridgeFileAction.create({
    data: {
      workspaceId: user.workspaceId,
      type: "sync_project_metadata",
      payload: {
        projectName: name,
        projectPath: folderPath,
        files: [
          {
            relativePath: ".gcs/context.json",
            content: JSON.stringify(contextPayload, null, 2),
          },
          {
            relativePath: ".gcs/progress.json",
            content: JSON.stringify(progressPayload, null, 2),
          },
          {
            relativePath: ".gcs/code-index.md",
            content: indexContent,
          },
        ],
      },
    },
  });

  return { name, localSyncQueued: true };
}
