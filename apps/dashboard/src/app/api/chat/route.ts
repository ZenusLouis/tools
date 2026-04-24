import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getApiKeyByService } from "@/lib/api-keys";

const ChatSchema = z.object({
  sessionId: z.string().optional(),
  agentRoleId: z.string().optional(),
  message: z.string().min(1),
});

function normalizeAgentHandle(value: string) {
  return value.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function extractMention(message: string) {
  return message.match(/@([a-zA-Z0-9][\w-]*)/)?.[1] ?? null;
}

async function callOpenAI(apiKey: string, model: string, messages: Array<{ role: string; content: string }>) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? "OpenAI request failed");
  return body.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(apiKey: string, model: string, messages: Array<{ role: string; content: string }>) {
  const system = messages.find((m) => m.role === "system")?.content;
  const userMessages = messages.filter((m) => m.role !== "system").map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system,
      messages: userMessages,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? "Anthropic request failed");
  return body.content?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
}

export async function POST(req: NextRequest) {
  const user = await requireCurrentUser();
  const parsed = ChatSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const mention = extractMention(parsed.data.message);
  const requestedSlug = mention ? normalizeAgentHandle(mention) : null;
  if (!parsed.data.agentRoleId && !requestedSlug) {
    return NextResponse.json({ error: "Mention an active bot with @bot-name" }, { status: 400 });
  }
  const role = await db.agentRole.findFirst({
    where: parsed.data.agentRoleId
      ? { id: parsed.data.agentRoleId, workspaceId: user.workspaceId }
      : requestedSlug
        ? { slug: requestedSlug, workspaceId: user.workspaceId }
        : { id: "__never__", workspaceId: user.workspaceId },
    include: { skills: true },
    orderBy: { name: "asc" },
  });
  if (!role) {
    return NextResponse.json({ error: requestedSlug ? `Agent @${requestedSlug} is unavailable` : "Mention an agent with @agent-name" }, { status: 404 });
  }
  if (!(await isRoleAvailable(role, user.workspaceId))) {
    return NextResponse.json({ error: `Agent @${role.slug} is not active yet` }, { status: 409 });
  }

  const session = parsed.data.sessionId
    ? await db.chatSession.findFirst({ where: { id: parsed.data.sessionId, workspaceId: user.workspaceId } })
    : await db.chatSession.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        title: parsed.data.message.replace(/@\S+\s*/, "").slice(0, 64) || role.name,
        agentRoleId: role.id,
        provider: role.provider,
        model: role.defaultModel,
      },
    });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  await db.chatMessage.create({
    data: { sessionId: session.id, role: "user", content: parsed.data.message },
  });

  const previous = await db.chatMessage.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" }, take: 20 });
  const system = [
    role.rulesMarkdown || role.description,
    role.skills.length ? `Available role skills: ${role.skills.map((s) => s.name).join(", ")}` : "",
  ].filter(Boolean).join("\n\n");
  const messages = [
    { role: "system", content: system },
    ...previous.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
  ];

  let answer = "";
  try {
    if (role.executionModeDefault === "local") {
      answer = `Local-run agent "${role.name}" is selected. Run the generated local command from the task/chat context; the bridge will sync results back here.`;
    } else if (role.credentialService === "openai") {
      const key = await getApiKeyByService("openai", user.workspaceId);
      if (!key) throw new Error("OpenAI API key is not configured");
      answer = await callOpenAI(key, role.defaultModel ?? "gpt-4o-mini", messages);
    } else if (role.credentialService === "anthropic") {
      const key = await getApiKeyByService("anthropic", user.workspaceId);
      if (!key) throw new Error("Anthropic API key is not configured");
      answer = await callAnthropic(key, role.defaultModel ?? "claude-3-5-sonnet-latest", messages);
    } else {
      answer = "This agent has no dashboard-run credential. Configure a credential or use local-run.";
    }
  } catch (e) {
    answer = `Agent error: ${String(e)}`;
  }

  const assistant = await db.chatMessage.create({
    data: { sessionId: session.id, role: "assistant", content: answer },
  });
  await db.chatSession.update({ where: { id: session.id }, data: { updatedAt: new Date(), agentRoleId: role.id } });

  return NextResponse.json({ sessionId: session.id, message: assistant });
}

async function isRoleAvailable(role: { executionModeDefault: string; provider: string; credentialService: string }, workspaceId: string) {
  if (role.executionModeDefault === "local") {
    const devices = await db.bridgeDevice.findMany({
      where: { workspaceId, lastSeenAt: { gte: new Date(Date.now() - 5 * 60_000) } },
      select: { claudeAvailable: true, codexAvailable: true },
    });
    if (role.provider === "claude") return devices.some((device) => device.claudeAvailable);
    if (role.provider === "codex") return devices.some((device) => device.codexAvailable);
    return false;
  }
  if (role.credentialService === "none") return true;
  const key = await getApiKeyByService(role.credentialService, workspaceId);
  return Boolean(key);
}
