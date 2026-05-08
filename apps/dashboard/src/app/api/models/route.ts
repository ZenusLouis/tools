import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { getApiKeyByService } from "@/lib/api-keys";
import { db } from "@/lib/db";

type Provider = "claude" | "codex" | "chatgpt" | "gemini";
const PROVIDERS: Provider[] = ["claude", "codex", "chatgpt", "gemini"];

// Fallback models for local CLI providers (no API key needed)
const LOCAL_MODELS: Record<string, string[]> = {
  claude: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001"],
  codex: ["gpt-5.2-codex", "gpt-5.1-codex", "gpt-5.1-codex-max", "gpt-5-codex"],
  gemini: [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite-preview-02-05",
    "gemini-2.0-pro-exp-02-05",
    "gemini-2.0-flash-thinking-exp-01-21",
    "gemini-exp-1206",
    "gemini-1.5-pro-latest",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-8b",
    "gemini-1.0-pro"
  ],
};

async function fetchOpenAIModels(apiKey: string, provider: Provider) {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const body = await res.json() as { data?: Array<{ id?: string }> };
  const ids = (body.data ?? []).map((model) => model.id).filter((id): id is string => !!id);
  if (provider === "codex") return ids.filter((id) => /codex/i.test(id) || /^gpt-5/i.test(id));
  return ids.filter((id) => /^gpt-|^o\d|^chatgpt/i.test(id));
}

async function fetchAnthropicModels(apiKey: string) {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const body = await res.json() as { data?: Array<{ id?: string }> };
  return (body.data ?? []).map((model) => model.id).filter((id): id is string => !!id);
}

async function fetchGeminiModels(apiKey: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const body = await res.json() as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
  return (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter((id): id is string => !!id);
}

export async function GET(req: NextRequest) {
  const user = await requireCurrentUser();
  const rawProvider = req.nextUrl.searchParams.get("provider") ?? "chatgpt";
  const provider = (PROVIDERS.includes(rawProvider as Provider) ? rawProvider : "chatgpt") as Provider;

  let live: string[] = [];
  try {
    if (provider === "claude") {
      const key = await getApiKeyByService("anthropic", user.workspaceId);
      if (key) live = await fetchAnthropicModels(key);
    } else if (provider === "gemini") {
      const key = await getApiKeyByService("google", user.workspaceId);
      if (key) live = await fetchGeminiModels(key);
    } else {
      const key = await getApiKeyByService("openai", user.workspaceId);
      if (key) live = await fetchOpenAIModels(key, provider);
    }
  } catch {
    live = [];
  }

  const fallback = LOCAL_MODELS[provider] ?? [];
  
  // Also fetch models reported by local bridge devices
  let reported: string[] = [];
  try {
    const devices = await db.bridgeDevice.findMany({
      where: {
        workspaceId: user.workspaceId,
        lastSeenAt: { gte: new Date(Date.now() - 5 * 60_000) }, // Active in last 5 mins
        OR: [
          { providerCompatibility: { has: provider } }, // If we add this later
          { claudeAvailable: provider === "claude" ? true : undefined },
          { codexAvailable: provider === "codex" ? true : undefined },
          { geminiAvailable: provider === "gemini" ? true : undefined },
        ].filter(v => Object.values(v)[0] !== undefined) as any,
      }
    });
    for (const d of devices) {
      const models = (d.reportedModels as any)?.[provider] as string[];
      if (Array.isArray(models)) reported = [...reported, ...models];
    }
  } catch {
    // Ignore db errors
  }

  const models = [...new Set([...live, ...reported, ...fallback])];
  return NextResponse.json({
    provider,
    source: live.length > 0 ? "live" : "local",
    models,
  });
}
