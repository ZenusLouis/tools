import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { getApiKeyByService } from "@/lib/api-keys";

type Provider = "claude" | "codex" | "chatgpt";
const PROVIDERS: Provider[] = ["claude", "codex", "chatgpt"];

// Fallback models for local CLI providers (no API key needed)
const LOCAL_MODELS: Record<string, string[]> = {
  claude: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001"],
  codex: ["gpt-5.2-codex", "gpt-5.1-codex", "gpt-5.1-codex-max", "gpt-5-codex"],
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

export async function GET(req: NextRequest) {
  const user = await requireCurrentUser();
  const rawProvider = req.nextUrl.searchParams.get("provider") ?? "chatgpt";
  const provider = (PROVIDERS.includes(rawProvider as Provider) ? rawProvider : "chatgpt") as Provider;

  let live: string[] = [];
  try {
    if (provider === "claude") {
      const key = await getApiKeyByService("anthropic", user.workspaceId);
      if (key) live = await fetchAnthropicModels(key);
    } else {
      const key = await getApiKeyByService("openai", user.workspaceId);
      if (key) live = await fetchOpenAIModels(key, provider);
    }
  } catch {
    live = [];
  }

  const fallback = LOCAL_MODELS[provider] ?? [];
  const models = live.length > 0 ? [...new Set([...live, ...fallback])] : fallback;
  return NextResponse.json({
    provider,
    source: live.length > 0 ? "live" : "local",
    models,
  });
}
