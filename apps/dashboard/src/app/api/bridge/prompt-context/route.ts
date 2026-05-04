import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { taskId, role, phase } = await req.json();

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
    const roleSlug = task.devRole?.slug || "dev-implementer";

    // 2. Fetch Command Template dynamically
    const targetSlug = phase === "planning" ? "prepare-brief" : phase === "review" ? "review" : "implement";
    const commandTemplate = await db.commandTemplate.findUnique({
      where: { workspaceId_slug: { workspaceId: "global", slug: targetSlug } }
    });

    // 3. Fetch Memory/Lessons
    const lessons = await db.lesson.findMany();
    const globalMemory = lessons.map(l => `### Lesson: ${l.framework}\n${l.text}`).join("\n\n");

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
  } catch (error: any) {
    console.error("Prompt Context Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
