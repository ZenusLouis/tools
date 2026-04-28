import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getApiKeyByService } from "@/lib/api-keys";

type ProjectWithLatestPath = {
  name: string;
  workspaceId: string | null;
  path: string | null;
  docs: unknown;
  frameworks: string[];
  bridgePaths: { deviceId: string; path: string }[];
};

type AiModule = {
  name: string;
  features: Array<{
    name: string;
    tasks: string[];
  }>;
};

// ── AI callers ────────────────────────────────────────────────────────────────

async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
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
  role: { provider: string; defaultModel: string | null; credentialService: string; rulesMarkdown: string | null },
  workspaceId: string,
): Promise<AiModule[] | null> {
  const brdHint = docs.brd
    ? `BRD file: ${docs.brd.split(/[\\/]/).pop()}`
    : docs.prd
      ? `PRD file: ${docs.prd.split(/[\\/]/).pop()}`
      : "No document filename available";

  const fw = frameworks.filter((f) => f !== "unknown").join(", ") || "unknown stack";

  const prompt = `You are a senior BA/Product Analyst. Analyze this project and generate a structured implementation plan.

Project name: ${projectName}
Tech stack: ${fw}
${brdHint}
${role.rulesMarkdown ? `\nRole context:\n${role.rulesMarkdown.slice(0, 800)}` : ""}

Based on the project name and document hints, generate a realistic breakdown of:
- 3 to 6 modules (major areas of work)
- Each module: 1 to 4 features
- Each feature: 2 to 5 concrete, atomic implementation tasks (specific enough to code)

IMPORTANT: Infer the domain from the project name and document filename. Be specific — mention real entities, screens, and actions relevant to this project.

Respond ONLY with valid JSON in exactly this format (no markdown, no explanation):
{
  "modules": [
    {
      "name": "Module Name",
      "features": [
        {
          "name": "Feature Name",
          "tasks": ["Specific task 1", "Specific task 2", "Specific task 3"]
        }
      ]
    }
  ]
}`;

  let raw = "";
  try {
    if (role.credentialService === "anthropic") {
      const key = await getApiKeyByService("anthropic", workspaceId);
      if (!key) throw new Error("Anthropic API key not configured");
      raw = await callAnthropic(key, role.defaultModel ?? "claude-sonnet-4-6", prompt);
    } else if (role.credentialService === "openai") {
      const key = await getApiKeyByService("openai", workspaceId);
      if (!key) throw new Error("OpenAI API key not configured");
      raw = await callOpenAI(key, role.defaultModel ?? "gpt-4o-mini", prompt);
    } else {
      return null;
    }
  } catch {
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

export async function analyzeProjectForWorkspace(
  projectName: string,
  workspaceId: string,
): Promise<{ ok: boolean; error?: string; created?: number; source?: "ai" | "bridge" | "fallback"; pending?: boolean; actionId?: string }> {
  const project = await loadProjectForAnalysis(projectName, workspaceId);
  if (!project) return { ok: false, error: "Project not found" };

  const docs = docRecord(project);
  if (!docs.brd && !docs.prd) return { ok: false, error: "Add a BRD or PRD before analysis." };

  const existingTasks = await db.task.count({ where: { feature: { module: { projectName } }, workspaceId } });
  if (existingTasks > 0) return { ok: false, error: "This project already has generated tasks." };

  // Find best dashboard-run analysis role (prefer anthropic > openai)
  const analysisRole = await db.agentRole.findFirst({
    where: {
      workspaceId,
      executionModeDefault: "dashboard",
      credentialService: { in: ["anthropic", "openai"] },
    },
    orderBy: [{ credentialService: "asc" }, { createdAt: "asc" }],
    select: { id: true, provider: true, defaultModel: true, credentialService: true, rulesMarkdown: true },
  });

  // Try AI generation via direct API
  let modules: AiModule[] | null = null;
  let source: "ai" | "bridge" | "fallback" = "fallback";

  if (analysisRole) {
    modules = await generateModulesWithAI(projectName, project.frameworks, docs, analysisRole, workspaceId);
    if (modules) source = "ai";
  }

  // Cách 2: No direct API key → queue via local bridge (claude -p)
  if (!modules) {
    const bridgeDevice = await db.bridgeDevice.findFirst({
      where: { workspaceId, claudeAvailable: true, lastSeenAt: { gte: new Date(Date.now() - 5 * 60_000) } },
      select: { id: true },
    });
    if (bridgeDevice) {
      const action = await db.bridgeFileAction.create({
        data: {
          workspaceId,
          deviceId: bridgeDevice.id,
          type: "run_analysis",
          payload: {
            projectName,
            frameworks: project.frameworks,
            docs,
            callbackPath: `/api/projects/${encodeURIComponent(projectName)}/analyze/result`,
          },
        },
      });
      return { ok: true, pending: true, actionId: action.id, created: 0, source: "bridge" };
    }
  }

  // Final fallback to template
  if (!modules) modules = FALLBACK_MODULES;

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
      provider: "claude",
      role: "ba-analyst",
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
  return { ok: true, created, source };
}
