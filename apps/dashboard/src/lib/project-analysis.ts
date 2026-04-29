import fs from "fs/promises";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getApiKeyByService } from "@/lib/api-keys";
import { resolvePath } from "@/lib/fs/resolve";

type ProjectWithLatestPath = {
  name: string;
  workspaceId: string | null;
  path: string | null;
  docs: unknown;
  frameworks: string[];
  bridgePaths: { deviceId: string; path: string }[];
};

type AnalysisProvider = "claude" | "codex" | "chatgpt";

type AiModule = {
  name: string;
  features: Array<{
    name: string;
    tasks: string[];
  }>;
};

// ── Skill loader ─────────────────────────────────────────────────────────────

type SkillSummary = { slug: string; description: string; guidance: string };

async function loadSkillSummaries(skillSlugs: string[]): Promise<SkillSummary[]> {
  if (skillSlugs.length === 0) return [];

  const skills = await db.skillDefinition.findMany({
    where: { slug: { in: skillSlugs } },
    select: { slug: true, description: true, sourcePath: true },
  });

  return Promise.all(skills.map(async (skill) => {
    let guidance = "";
    if (skill.sourcePath) {
      try {
        const raw = await fs.readFile(resolvePath(skill.sourcePath), "utf-8");
        // Strip frontmatter, load FULL content — Anthropic caches it after first use
        guidance = raw.replace(/^---[\s\S]*?---\n/, "").trim();
      } catch { /* cloud can't access local file — fall back to description */ }
    }
    return { slug: skill.slug, description: skill.description, guidance };
  }));
}

function buildSkillBlock(skills: SkillSummary[]): string {
  if (skills.length === 0) return "";
  const lines = skills
    .filter((s) => s.guidance || s.description)
    .map((s) => `### ${s.slug}\n${s.guidance || s.description}`)
    .join("\n\n");
  return lines ? `\n\n## Attached Skills (apply all patterns below)\n${lines}` : "";
}

// ── AI callers ────────────────────────────────────────────────────────────────

async function callAnthropic(
  apiKey: string,
  model: string,
  skillBlock: string,   // stable — will be cached
  projectBlock: string, // dynamic — not cached
): Promise<string> {
  // Split into two user message blocks so Anthropic caches the skill content separately
  const messages: unknown[] = skillBlock
    ? [
        {
          role: "user",
          content: [
            // Stable skill content → mark for caching
            { type: "text", text: skillBlock, cache_control: { type: "ephemeral" } },
            // Dynamic project-specific prompt
            { type: "text", text: projectBlock },
          ],
        },
      ]
    : [{ role: "user", content: projectBlock }];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({ model, max_tokens: 4096, messages }),
  });
  const body = await res.json() as { content?: Array<{ text?: string }>; error?: { message?: string } };
  if (!res.ok) throw new Error(body?.error?.message ?? "Anthropic error");
  return body.content?.map((p) => p.text ?? "").join("") ?? "";
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  const body = await res.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!res.ok) throw new Error(body?.error?.message ?? "OpenAI error");
  return body.choices?.[0]?.message?.content ?? "";
}

// ── AI module generation ──────────────────────────────────────────────────────

async function generateModulesWithAI(
  projectName: string,
  frameworks: string[],
  docs: Record<string, string>,
  role: { provider: string; defaultModel: string | null; credentialService: string; rulesMarkdown: string | null; skillSlugs: string[] },
  workspaceId: string,
): Promise<AiModule[] | null> {
  const skillSummaries = await loadSkillSummaries(role.skillSlugs);
  const brdHint = docs.brd
    ? `BRD file: ${docs.brd.split(/[\\/]/).pop()}`
    : docs.prd
      ? `PRD file: ${docs.prd.split(/[\\/]/).pop()}`
      : "No document filename available";

  const fw = frameworks.filter((f) => f !== "unknown").join(", ") || "unknown stack";

  const skillBlock = buildSkillBlock(skillSummaries);

  // Stable block (cached after first call): role rules + skills
  const stableBlock = [
    "You are a senior BA/Product Analyst.",
    role.rulesMarkdown ? `\n## Role Rules\n${role.rulesMarkdown}` : "",
    skillBlock,
  ].filter(Boolean).join("\n");

  // Dynamic block (changes per project): project context + output format
  const projectBlock = `## Project Context
- Name: ${projectName}
- Stack: ${fw}
- ${brdHint}

## Output Requirements
Generate 3–6 modules, each with 1–4 features, each feature with 2–5 atomic tasks.
- Infer domain from project name + document filename
- Tasks must be specific and actionable (real entity names, screens, actions)
- Apply MoSCoW: must-have tasks first per feature
- Flag high-risk: payments, real-time, auth, file upload

Respond ONLY with valid JSON — no markdown, no explanation:
{"modules":[{"name":"...","features":[{"name":"...","tasks":["task1","task2"]}]}]}`;

  let raw = "";
  if (role.credentialService === "anthropic") {
    const key = await getApiKeyByService("anthropic", workspaceId);
    if (!key) throw new Error("Anthropic API key not configured");
    raw = await callAnthropic(key, role.defaultModel ?? "claude-sonnet-4-6", stableBlock, projectBlock);
  } else if (role.credentialService === "openai") {
    const key = await getApiKeyByService("openai", workspaceId);
    if (!key) throw new Error("OpenAI API key not configured");
    // OpenAI doesn't have explicit cache_control but caches automatically for identical prefixes
    raw = await callOpenAI(key, role.defaultModel ?? "gpt-4o-mini", stableBlock + "\n\n" + projectBlock);
  } else {
    return null;
  }

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { modules?: AiModule[] };
    if (!Array.isArray(parsed.modules) || parsed.modules.length === 0) return null;
    return parsed.modules;
  } catch {
    return null;
  }
}

// ── Fallback template ─────────────────────────────────────────────────────────

const FALLBACK_MODULES: AiModule[] = [
  {
    name: "Product Discovery",
    features: [
      { name: "BRD/PRD Understanding", tasks: ["Extract business goals, actors, and core workflows", "Map user journeys and key screens", "Identify assumptions, constraints, and open questions"] },
      { name: "Scope Definition", tasks: ["Define MVP scope and deferred scope", "Create acceptance criteria for core flows", "List risks and validation checkpoints"] },
    ],
  },
  {
    name: "Application Architecture",
    features: [
      { name: "Frontend Plan", tasks: ["Map pages, components, and client/server boundaries", "Define data loading and mutation flows", "Plan validation and error states"] },
      { name: "Backend & Data Model", tasks: ["Draft entities, relationships, and API contracts", "Identify auth and permission requirements", "Plan integration points and background jobs"] },
    ],
  },
  {
    name: "Quality & Release",
    features: [
      { name: "Verification Plan", tasks: ["Create smoke test and regression checklist", "Define deployment readiness gates", "Prepare monitoring and rollback notes"] },
    ],
  },
];

// ── DB helpers ────────────────────────────────────────────────────────────────

function docRecord(project: ProjectWithLatestPath): Record<string, string> {
  return project.docs && typeof project.docs === "object" && !Array.isArray(project.docs)
    ? project.docs as Record<string, string>
    : {};
}

async function loadProjectForAnalysis(projectName: string, workspaceId: string): Promise<ProjectWithLatestPath | null> {
  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId }, { workspaceId: null }] },
    include: { bridgePaths: { orderBy: { updatedAt: "desc" }, take: 20 } },
  });
  if (!project) return null;
  if (!project.workspaceId) {
    await db.project.update({ where: { name: projectName }, data: { workspaceId } }).catch(() => null);
  }
  return project;
}

async function queueProgressSync(project: ProjectWithLatestPath, workspaceId: string, content: string) {
  const targets = project.bridgePaths.length > 0
    ? project.bridgePaths.map((bp) => ({ deviceId: bp.deviceId, path: bp.path }))
    : project.path ? [{ deviceId: null, path: project.path }] : [];

  for (const target of targets) {
    await db.bridgeFileAction.create({
      data: {
        workspaceId,
        deviceId: target.deviceId,
        type: "sync_project_metadata",
        payload: {
          projectName: project.name,
          projectPath: target.path,
          files: [{ relativePath: ".gcs/progress.json", content }],
        },
      },
    });
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

function providerCredential(provider: string, credentialService: string) {
  if (credentialService !== "none") return credentialService;
  if (provider === "chatgpt") return "openai";
  if (provider === "claude") return "anthropic";
  return "none";
}

function providerLabel(provider: string) {
  if (provider === "chatgpt") return "ChatGPT";
  if (provider === "codex") return "Codex";
  return "Claude";
}

export async function analyzeProjectForWorkspace(
  projectName: string,
  workspaceId: string,
): Promise<{
  ok: boolean;
  error?: string;
  created?: number;
  source?: "ai" | "bridge" | "fallback";
  pending?: boolean;
  actionId?: string;
  provider?: AnalysisProvider;
  runnerLabel?: string;
}> {
  const project = await loadProjectForAnalysis(projectName, workspaceId);
  if (!project) return { ok: false, error: "Project not found" };

  const docs = docRecord(project);
  if (!docs.brd && !docs.prd) return { ok: false, error: "Add a BRD or PRD before analysis." };

  const roleSelect = {
    id: true, slug: true, phase: true, provider: true, defaultModel: true,
    credentialService: true, executionModeDefault: true, rulesMarkdown: true, name: true,
    skills: { select: { slug: true } },
  } as const;

  // Collect ALL dashboard-runnable roles, preferred order: ba-analyst first, then any analysis, then any
  const allRoles = await db.agentRole.findMany({
    where: { workspaceId },
    select: roleSelect,
    orderBy: [{ createdAt: "asc" }],
  });
  const prioritized = [
    ...allRoles.filter((r) => r.slug === "ba-analyst"),
    ...allRoles.filter((r) => r.phase === "analysis" && r.slug !== "ba-analyst"),
    ...allRoles.filter((r) => r.phase !== "analysis"),
  ].filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i); // dedup

  let modules: AiModule[] | null = null;
  let source: "ai" | "bridge" | "fallback" = "fallback";
  let selectedProvider: AnalysisProvider = "claude";
  let selectedRunner = "Claude";

  // Try each dashboard-runnable agent in order until one succeeds
  for (const role of prioritized) {
    const cred = providerCredential(role.provider, role.credentialService);
    if (cred !== "openai" && cred !== "anthropic") continue; // skip local-only
    try {
      modules = await generateModulesWithAI(projectName, project.frameworks, docs, {
        ...role, credentialService: cred, skillSlugs: role.skills.map((s) => s.slug),
      }, workspaceId);
      if (modules) {
        source = "ai";
        selectedProvider = role.provider as AnalysisProvider;
        selectedRunner = providerLabel(selectedProvider);
        break;
      }
    } catch { /* key missing or API error — try next agent */ }
  }

  // Cách 2: No dashboard agent worked → queue via local bridge (claude -p)
  if (!modules) {
    const bridgeDevice = await db.bridgeDevice.findFirst({
      where: { workspaceId, claudeAvailable: true, lastSeenAt: { gte: new Date(Date.now() - 5 * 60_000) } },
      select: { id: true },
    });
    if (bridgeDevice) {
      await db.task.deleteMany({ where: { feature: { module: { projectName } }, workspaceId } });
      await db.feature.deleteMany({ where: { module: { projectName } } });
      await db.module.deleteMany({ where: { projectName } });
      await db.project.update({ where: { name: projectName }, data: { activeTask: null } });

      const action = await db.bridgeFileAction.create({
        data: {
          workspaceId,
          deviceId: bridgeDevice.id,
          type: "run_analysis",
          payload: {
            projectName,
            frameworks: project.frameworks,
            docs,
            provider: selectedProvider,
            runnerLabel: selectedRunner,
            skillSlugs: (await db.agentRole.findFirst({
              where: { workspaceId, phase: "analysis" },
              select: { skills: { select: { slug: true } } },
            }))?.skills.map((s) => s.slug) ?? [],
            callbackPath: `/api/projects/${encodeURIComponent(projectName)}/analyze/result`,
          },
        },
      });
      return { ok: true, pending: true, actionId: action.id, created: 0, source: "bridge", provider: selectedProvider, runnerLabel: selectedRunner };
    }
  }

  if (!modules && selectedProvider === "chatgpt") {
    return {
      ok: false,
      error: "ChatGPT analysis needs an OpenAI API key in Settings.",
      provider: selectedProvider,
      runnerLabel: selectedRunner,
    };
  }

  // Final fallback to template
  if (!modules) modules = FALLBACK_MODULES;

  await db.task.deleteMany({ where: { feature: { module: { projectName } }, workspaceId } });
  await db.feature.deleteMany({ where: { module: { projectName } } });
  await db.module.deleteMany({ where: { projectName } });
  await db.project.update({ where: { name: projectName }, data: { activeTask: null } });

  // Find roles to attach to tasks
  const [baRole, devRole, reviewRole] = await Promise.all([
    db.agentRole.findFirst({ where: { workspaceId, phase: "analysis" }, select: { id: true } }),
    db.agentRole.findFirst({ where: { workspaceId, phase: "implementation" }, select: { id: true } }),
    db.agentRole.findFirst({ where: { workspaceId, phase: "review" }, select: { id: true } }),
  ]);

  const firstTaskId = `${projectName}-M0-F0-T1`;
  let created = 0;

  for (const [mi, mod] of modules.entries()) {
    const moduleId = `${projectName}-M${mi}`;
    await db.module.create({ data: { id: moduleId, projectName, name: mod.name, order: mi } });

    for (const [fi, feature] of mod.features.entries()) {
      const featureId = `${moduleId}-F${fi}`;
      await db.feature.create({ data: { id: featureId, moduleId, name: feature.name, order: fi } });

      for (const [ti, taskName] of feature.tasks.entries()) {
        const taskId = `${featureId}-T${ti + 1}`;
        await db.task.create({
          data: {
            id: taskId,
            workspaceId,
            featureId,
            name: taskName,
            status: taskId === firstTaskId ? "in_progress" : "pending",
            phase: taskId === firstTaskId ? "analysis" : "pending",
            estimate: ti === 0 ? "1h" : "2h",
            deps: [],
            baRoleId: baRole?.id ?? null,
            devRoleId: devRole?.id ?? null,
            reviewRoleId: reviewRole?.id ?? null,
          },
        });
        created++;
      }
    }
  }

  const now = new Date();
  await db.project.update({ where: { name: projectName }, data: { activeTask: firstTaskId, lastIndexed: now } });

  await db.session.create({
    data: {
      workspaceId,
      provider: selectedProvider,
      role: "ba-analyst",
      model: null,
      type: "project-event",
      project: projectName,
      date: now,
      tasksCompleted: [],
      sessionNotes: `Analysis (${source}) generated ${created} tasks from ${docs.brd ? "BRD" : "PRD"}.`,
      cwd: project.bridgePaths[0]?.path ?? project.path,
    },
  });

  const progressPayload = {
    project: projectName,
    version: "1.0",
    activeTask: firstTaskId,
    modules: modules.map((mod, mi) => ({
      id: `M${mi}`,
      name: mod.name,
      features: mod.features.map((f, fi) => ({
        id: `M${mi}-F${fi}`,
        name: f.name,
        tasks: f.tasks.map((t, ti) => ({
          id: `${projectName}-M${mi}-F${fi}-T${ti + 1}`,
          name: t,
          status: ti === 0 && mi === 0 && fi === 0 ? "in_progress" : "pending",
        })),
      })),
    })),
    risks: [],
    gates: { G1: { status: "done" }, G2: { status: "pending" }, G3: { status: "pending" }, G4: { status: "pending" } },
  };
  await queueProgressSync(project, workspaceId, JSON.stringify(progressPayload, null, 2));

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${encodeURIComponent(projectName)}`);
  revalidatePath(`/projects/${encodeURIComponent(projectName)}/detail`);
  revalidatePath("/tasks");
  return { ok: true, created, source, provider: selectedProvider, runnerLabel: selectedRunner };
}
