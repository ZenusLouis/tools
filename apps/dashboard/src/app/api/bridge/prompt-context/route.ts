import { NextResponse } from "next/server";
import fs from "fs/promises";
import { db } from "@/lib/db";
import { resolvePath } from "@/lib/fs/resolve";

async function readTextIfExists(filePath: string, maxChars = 12_000) {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n... truncated ...` : text;
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  try {
    const { taskId, phase } = await req.json();

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    // 1. Fetch Task with relations
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        feature: {
          include: {
            module: {
              include: {
                project: true
              }
            }
          }
        },
        devRole: {
          include: {
            skills: true
          }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const projectName = task.feature?.module?.project?.name || "local";

    // 2. Fetch Command Template dynamically
    const targetSlug = phase === "planning" ? "prepare-brief" : phase === "review" ? "review" : "implement";
    const commandTemplate = await db.commandTemplate.findUnique({
      where: { workspaceId_slug: { workspaceId: "global", slug: targetSlug } }
    });

    // 3. Fetch Memory/Lessons and recent project sessions
    const [lessons, recentSessions] = await Promise.all([
      db.lesson.findMany({ orderBy: { createdAt: "desc" }, take: 24 }),
      db.session.findMany({
        where: { project: projectName },
        orderBy: { date: "desc" },
        take: 8,
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
    ]);
    const globalMemory = lessons.map(l => `### Lesson: ${l.framework}\n${l.text}`).join("\n\n");
    const sessionMemory = recentSessions.length
      ? recentSessions.map((session) => [
          `### ${session.date.toISOString()} - ${session.provider}${session.role ? `/${session.role}` : ""} - ${session.type}`,
          session.tasksCompleted.length ? `Completed: ${session.tasksCompleted.join(", ")}` : "",
          session.sessionNotes ?? "",
          session.risks.length ? `Risks: ${session.risks.join("; ")}` : "",
        ].filter(Boolean).join("\n")).join("\n\n")
      : "";

    const codeIndex = await readTextIfExists(resolvePath("projects", projectName, "code-index.md"));
    const codeIndexBlock = codeIndex
      ? `## Project Code Index\n\n${codeIndex}`
      : "## Project Code Index\n\nNo code-index.md found for this project yet. Run Reindex from the dashboard or bridge.";

    // 4. Construct Skills Block
    const skills = task.devRole?.skills || [];
    const skillLines = skills
      .filter(s => s.content)
      .map(s => `### ${s.slug}\n${s.content?.substring(0, 600)}`);
    const skillBlock = skillLines.length > 0 
      ? `## Skill Guidance\n\n${skillLines.join("\n\n")}` 
      : "";

    // 5. Build Final Prompt
    // We mix the Command Template, Global Memory, Skill Block, and Task Details.
    const reqIds = task.reqIds || [];
    const acceptance = task.acceptanceCriteria || [];
    const steps = task.steps || [];

    const promptText = `
${commandTemplate?.content || "You are running a GCS local task. Work inside the local project folder. Implement the scoped task."}

## Global Project Memory & Rules
${globalMemory || "No global rules found."}

## Recent Project Session Memory
${sessionMemory || "No previous project sessions found."}

${codeIndexBlock}

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
${acceptance.map(a => `- ${a}`).join("\n")}

## Suggested Steps
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## General Rules of Engagement
- Work inside the current local project folder.
- Preserve unrelated user changes.
- Implement ONLY the scoped task.
- After finishing, write a concise implementation summary.
- Required output:
  - Modify local source files if needed.
  - Include changed files and verification commands in your final answer.
  - Do not claim success unless you actually performed the implementation or clearly explain the blocker.
    `.trim();

    return NextResponse.json({ promptText });
  } catch (error: unknown) {
    console.error("Prompt Context Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Prompt context failed" }, { status: 500 });
  }
}
