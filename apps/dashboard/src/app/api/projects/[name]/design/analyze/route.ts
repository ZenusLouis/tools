import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { requireCurrentUser } from "@/lib/auth";
import { getApiKeyByService } from "@/lib/api-keys";
import { db } from "@/lib/db";

type ScreenDraft = {
  screenName: string;
  screenDesc: string;
  userFlow?: string;
  reqIds?: string[];
};

async function callClaude(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}`);
  const body = await res.json() as { content?: Array<{ text?: string }> };
  return body.content?.[0]?.text ?? "";
}

function buildScreenPrompt(screenName: string, screenDesc: string, userFlow?: string): string {
  return [
    `Design a UI screen for: ${screenName}`,
    `Description: ${screenDesc}`,
    userFlow ? `User flow: ${userFlow}` : "",
    "Create a clean, modern web application screen with appropriate layout, components, and interactions.",
    "Focus on: layout structure, key UI elements, color scheme, typography, and user interactions.",
  ].filter(Boolean).join("\n");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name: projectName } = await params;

  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId: user.workspaceId }, { workspaceId: null }] },
    select: { name: true, workspaceId: true, docs: true, frameworks: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Load BRD content
  const docs = project.docs as Record<string, string> | null;
  const brdPath = docs?.brd;
  let brdContent = "";
  if (brdPath) {
    try {
      const ext = brdPath.toLowerCase();
      if (ext.endsWith(".pdf")) {
        brdContent = `[BRD PDF: ${brdPath}] — content not directly readable from cloud; using filename as context.`;
      } else {
        brdContent = await fs.readFile(brdPath, "utf-8");
        if (brdContent.length > 30000) brdContent = brdContent.slice(0, 30000) + "\n\n... (truncated)";
      }
    } catch {
      brdContent = `[BRD at ${brdPath} — not accessible from cloud runtime]`;
    }
  }

  const analysisPrompt = `You are a UI/UX analyst. Given the following BRD (Business Requirements Document) for a ${project.frameworks.join(", ")} project called "${projectName}", extract all distinct UI screens that need to be designed.

BRD Content:
${brdContent || "No BRD content available. Infer screens from project name and frameworks."}

For each screen, provide:
- screenName: short unique name (e.g. "Hotel Search", "Booking Confirmation")
- screenDesc: 1-2 sentence description of the screen's purpose and key content
- userFlow: brief description of how user arrives at and interacts with this screen
- reqIds: array of requirement IDs mentioned in BRD that this screen relates to (e.g. ["HOT-MAS-001"])

Respond ONLY with valid JSON — no markdown, no explanation:
{"screens":[{"screenName":"...","screenDesc":"...","userFlow":"...","reqIds":["..."]}]}

Extract ALL screens needed for a complete app. Typical apps have 10-30 screens.`;

  const apiKey = await getApiKeyByService("anthropic", user.workspaceId);

  // Fallback to local bridge when no API key configured
  if (!apiKey) {
    const onlineBridge = await db.bridgeProjectPath.findFirst({
      where: {
        workspaceId: user.workspaceId,
        projectName,
        device: { lastSeenAt: { gte: new Date(Date.now() - 90_000) } },
      },
      include: { device: { select: { id: true } } },
    });
    if (!onlineBridge) {
      return NextResponse.json({
        error: "No Anthropic API key configured and no local bridge is online. Configure an API key in Settings or start the local bridge.",
      }, { status: 400 });
    }
    const docs = project.docs as Record<string, string> | null;
    const action = await db.bridgeFileAction.create({
      data: {
        workspaceId: user.workspaceId,
        deviceId: onlineBridge.device.id,
        type: "run_analysis",
        payload: {
          projectName,
          projectPath: onlineBridge.path,
          frameworks: project.frameworks,
          docs: docs ?? {},
          callbackPath: `/api/projects/${encodeURIComponent(projectName)}/design/analyze/result`,
          analysisKind: "design_screens",
          prompt: analysisPrompt,
        },
      },
    });
    return NextResponse.json({ ok: true, queued: true, actionId: action.id, message: "Analysis queued on local bridge." });
  }

  let screens: ScreenDraft[] = [];
  try {
    const raw = await callClaude(apiKey, "claude-sonnet-4-6", analysisPrompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { screens?: ScreenDraft[] };
      screens = Array.isArray(parsed.screens) ? parsed.screens : [];
    }
  } catch (err) {
    return NextResponse.json({ error: `AI analysis failed: ${String(err)}` }, { status: 500 });
  }

  if (screens.length === 0) return NextResponse.json({ error: "No screens extracted from BRD" }, { status: 422 });

  // Fetch existing FE tasks for auto-linking
  const feTasks = await db.task.findMany({
    where: { workspaceId: user.workspaceId, feature: { module: { projectName } } },
    select: { id: true, reqIds: true, designRefs: true },
  });

  let screensCreated = 0;
  let linked = 0;

  for (const screen of screens) {
    if (!screen.screenName?.trim()) continue;

    const prompt = buildScreenPrompt(screen.screenName, screen.screenDesc, screen.userFlow);
    const reqIds = Array.isArray(screen.reqIds) ? screen.reqIds.filter(Boolean) : [];

    // Find matching FE tasks by reqIds overlap
    const matchedTaskIds = feTasks
      .filter((t) => t.reqIds.some((r) => reqIds.includes(r)))
      .map((t) => t.id);

    const designTask = await db.designTask.upsert({
      where: { workspaceId_projectName_screenName: { workspaceId: user.workspaceId, projectName, screenName: screen.screenName } },
      create: {
        workspaceId: user.workspaceId,
        projectName,
        screenName: screen.screenName,
        screenDesc: screen.screenDesc ?? "",
        userFlow: screen.userFlow ?? null,
        reqIds,
        prompt,
        status: "pending",
        provider: "stitch",
        linkedTaskIds: matchedTaskIds,
      },
      update: {
        screenDesc: screen.screenDesc ?? "",
        userFlow: screen.userFlow ?? null,
        reqIds,
        prompt,
        linkedTaskIds: matchedTaskIds,
      },
    });
    screensCreated++;

    // Update matched FE tasks with this designTask's id
    if (matchedTaskIds.length > 0) {
      for (const taskId of matchedTaskIds) {
        const task = feTasks.find((t) => t.id === taskId);
        if (!task) continue;
        const existing = task.designRefs ?? [];
        if (!existing.includes(designTask.id)) {
          await db.task.update({
            where: { id: taskId },
            data: { designRefs: [...existing, designTask.id] },
          });
          task.designRefs = [...existing, designTask.id];
          linked++;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, screensCreated, linked });
}
