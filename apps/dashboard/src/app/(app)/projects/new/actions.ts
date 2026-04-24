"use server";

import path from "path";
import fs from "fs/promises";
import type { Dirent } from "fs";
import { readJSON, writeJSON } from "@/lib/fs/json";
import { resolvePath } from "@/lib/fs/resolve";

type Registry = Record<string, string>;

// ── Step 1: Scan folder ──────────────────────────────────────────────────────

export type ScanResult = {
  name: string;
  framework: string[];
  error?: string;
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
  try {
    const stat = await fs.stat(folderPath);
    if (!stat.isDirectory()) return { name: "", framework: [], error: "Path is not a directory" };

    const framework = await detectFramework(folderPath);
    const name = path.basename(folderPath).toLowerCase().replace(/\s+/g, "-");
    return { name, framework };
  } catch {
    return { name: "", framework: [], error: "Folder not found or inaccessible" };
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
    `# Code Index: ${projectName} [HEADER — load on /start]`,
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

export async function createProject(input: CreateProjectInput): Promise<{ error?: string }> {
  const { name, folderPath, framework, mcpProfile, docs, tools } = input;

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

  // Write context.json
  const filteredDocs = Object.fromEntries(
    Object.entries(docs).filter(([, v]) => v?.trim())
  );
  const filteredTools = Object.fromEntries(
    Object.entries(tools).filter(([, v]) => v?.trim())
  );
  await writeJSON(ctxPath, {
    name,
    path: folderPath,
    framework,
    mcpProfile: mcpProfile || undefined,
    docs: Object.keys(filteredDocs).length ? filteredDocs : undefined,
    tools: Object.keys(filteredTools).length ? filteredTools : undefined,
    env: { required: [], envFile: ".env.local" },
    lastIndexed: new Date().toISOString().slice(0, 10),
    activeTask: null,
  });

  // Write empty progress.json
  await writeJSON(progressPath, {
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
  });

  // Build code-index
  const fileMap = new Map<string, string[]>();
  await scanDir(folderPath, folderPath, 0, fileMap);
  const indexContent = buildCodeIndex(name, fileMap);
  await fs.writeFile(codeIndexPath, indexContent, "utf-8");

  // Register
  registry[name] = projectDir;
  await writeJSON(registryPath, registry);

  return {};
}
