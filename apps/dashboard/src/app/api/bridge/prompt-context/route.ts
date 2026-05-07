import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { db } from "@/lib/db";
import { bridgeTokenFromHeaders, verifyBridgeRequest } from "@/lib/bridge-auth";
import { resolvePath } from "@/lib/fs/resolve";
import { findRelatedMemory } from "@/lib/memory-retrieval";
import { sanitizeText } from "@/lib/sanitize";

const HOOK_SECRET = process.env.HOOK_SECRET;

const STOP_WORDS = new Set([
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

async function bridgeContext(req: NextRequest) {
  let ctx = await verifyBridgeRequest(bridgeTokenFromHeaders(req.headers));
  if (!ctx && HOOK_SECRET && req.headers.get("x-hook-secret") === HOOK_SECRET) {
    const workspace = await db.workspace.findUnique({ where: { slug: "default" }, select: { id: true } });
    if (workspace) ctx = { workspaceId: workspace.id, deviceId: null, tokenId: null };
  }
  return ctx;
}

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .match(/[a-z0-9][a-z0-9-]{2,}/g)
      ?.filter((token) => !STOP_WORDS.has(token) && token.length <= 42) ?? [],
  );
}

async function readTextIfExists(filePath: string, maxChars = 80_000) {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  } catch {
    return "";
  }
}

function relevantCodeIndexSnippets(codeIndex: string, keywords: Set<string>, maxSections = 8, maxChars = 8_000) {
  if (!codeIndex.trim()) {
    return "No code-index.md found for this project yet. Run Reindex from the dashboard or bridge.";
  }
  const sections = codeIndex
    .split(/\n(?=##\s+)/)
    .map((section) => section.trim())
    .filter(Boolean);
  const ranked = sections
    .map((section) => {
      const corpus = section.toLowerCase();
      const hits = Array.from(keywords).filter((keyword) => corpus.includes(keyword));
      return { section, score: hits.length, hits };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.section.length - right.section.length)
    .slice(0, maxSections);

  const selected = ranked.length ? ranked.map((item) => item.section) : sections.slice(0, 3);
  const body = selected.join("\n\n");
  return body.length > maxChars ? `${body.slice(0, maxChars).trim()}\n\n... relevant code-index snippets truncated ...` : body;
}

function compactSkillLine(skill: { slug: string; description: string; compactGuidance: string | null }) {
  const guidance = (skill.compactGuidance || skill.description || "").replace(/\s+/g, " ").trim();
  return `### ${skill.slug}\n${guidance.length > 700 ? `${guidance.slice(0, 700).trim()}...` : guidance}`;
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await bridgeContext(req);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { taskId, phase } = await req.json().catch(() => ({})) as { taskId?: string; phase?: string };
    if (!taskId) return NextResponse.json({ error: "taskId is required" }, { status: 400 });

    const task = await db.task.findFirst({
      where: { id: taskId, OR: [{ workspaceId: ctx.workspaceId }, { workspaceId: null }] },
      include: {
        feature: { include: { module: { include: { project: true } } } },
        devRole: {
          include: {
            skills: {
              select: {
                slug: true,
                description: true,
                compactGuidance: true,
              },
              orderBy: [{ sourcePriority: "desc" }, { slug: "asc" }],
              take: 8,
            },
          },
        },
      },
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const project = task.feature?.module?.project;
    const projectName = project?.name || "local";
    const targetSlug = phase === "planning" || phase === "analysis"
      ? "prepare-brief"
      : phase === "review"
        ? "review"
        : "implement";
    const commandTemplate = await db.commandTemplate.findFirst({
      where: {
        slug: targetSlug,
        OR: [{ workspaceId: ctx.workspaceId }, { workspaceId: "global" }, { workspaceId: null }],
      },
      orderBy: [{ workspaceId: "desc" }],
    });

    const reqIds = task.reqIds || [];
    const acceptance = task.acceptanceCriteria || [];
    const steps = task.steps || [];
    const keywords = tokenize([
      task.id,
      task.name,
      task.summary ?? "",
      task.details ?? "",
      task.feature?.name ?? "",
      task.feature?.module?.name ?? "",
      ...reqIds,
    ].join(" "));

    const [lessons, recentSessions, relatedMemory] = await Promise.all([
      db.lesson.findMany({
        where: {
          OR: [
            { projectName },
            { projectName: null },
            { framework: { in: project?.frameworks ?? [] } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      db.session.findMany({
        where: { workspaceId: ctx.workspaceId, project: projectName },
        orderBy: { date: "desc" },
        take: 4,
        select: {
          date: true,
          provider: true,
          role: true,
          type: true,
          tasksCompleted: true,
          sessionNotes: true,
          risks: true,
        },
      }),
      findRelatedMemory({
        workspaceId: ctx.workspaceId,
        projectName,
        task: {
          id: task.id,
          name: task.name,
          summary: task.summary,
          details: task.details,
          moduleName: task.feature?.module?.name,
          featureName: task.feature?.name,
          reqIds,
        },
        limit: 4,
      }),
    ]);

    const codeIndex = await readTextIfExists(resolvePath("projects", projectName, "code-index.md"));
    const skillBlock = task.devRole?.skills.length
      ? `## Compact Skill Guidance\n\n${task.devRole.skills.map(compactSkillLine).join("\n\n")}`
      : "## Compact Skill Guidance\n\nNo role skills selected.";
    const memoryBlock = relatedMemory.length
      ? relatedMemory.map((item) => `### ${item.kind}: ${item.title}\nScore: ${item.score}; Reasons: ${item.reasons.join(", ")}\n${item.snippet}`).join("\n\n")
      : "No related memory snippets matched this task.";
    const lessonBlock = lessons.length
      ? lessons.map((lesson) => `- ${lesson.framework}: ${lesson.text.replace(/\s+/g, " ").slice(0, 400)}`).join("\n")
      : "No compact lessons matched.";
    const sessionBlock = recentSessions.length
      ? recentSessions.map((session) => [
          `- ${session.date.toISOString()} ${session.provider}${session.role ? `/${session.role}` : ""} ${session.type}`,
          session.tasksCompleted.length ? `completed=${session.tasksCompleted.slice(0, 8).join(", ")}` : "",
          session.sessionNotes ? `notes=${session.sessionNotes.replace(/\s+/g, " ").slice(0, 300)}` : "",
          session.risks.length ? `risks=${session.risks.slice(0, 4).join("; ")}` : "",
        ].filter(Boolean).join(" | ")).join("\n")
      : "No recent project sessions matched.";

    const promptText = sanitizeText(`
${commandTemplate?.content || "You are running a GCS local task. Work inside the local project folder. Implement the scoped task."}

## Context Contract
- This prompt was built by deterministic backend retrieval.
- Skill routing used 0 LLM tokens.
- Only compact skill guidance and relevant memory/code-index snippets are included.

## Compact Lessons
${lessonBlock}

## Recent Project Session Memory
${sessionBlock}

## Related Memory Snippets
${memoryBlock}

## Relevant Code Index Snippets
${relevantCodeIndexSnippets(codeIndex, keywords)}

${skillBlock}

## Task Context
Project: ${projectName}
Task ID: ${task.id}
Task: ${task.name}
Module: ${task.feature?.module?.name || ""}
Feature: ${task.feature?.name || ""}
Requirement IDs: ${reqIds.length ? reqIds.join(", ") : "none"}

## Summary
${task.summary || ""}

## Details
${task.details || ""}

## Acceptance Criteria
${acceptance.map((item) => `- ${item}`).join("\n")}

## Suggested Steps
${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## General Rules of Engagement
- Work inside the current local project folder.
- Preserve unrelated user changes.
- Implement only the scoped task.
- Report changed files and verification commands.
- Do not claim success unless implementation or blocker is clear.
`.trim());

    await db.auditLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        actorType: "bridge",
        event: "bridge_prompt_context_built",
        targetType: "Task",
        targetId: task.id,
        metadata: {
          projectName,
          phase: phase ?? null,
          relatedMemoryCount: relatedMemory.length,
          skillCount: task.devRole?.skills.length ?? 0,
          routingTokens: 0,
        },
      },
    }).catch(() => null);

    return NextResponse.json({
      promptText,
      contextReport: {
        projectName,
        taskId: task.id,
        phase: phase ?? null,
        relatedMemoryCount: relatedMemory.length,
        compactSkillCount: task.devRole?.skills.length ?? 0,
        codeIndexMode: codeIndex ? "relevant_snippets" : "missing",
        routingTokens: 0,
      },
    });
  } catch (error: unknown) {
    console.error("Prompt Context Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Prompt context failed" }, { status: 500 });
  }
}
