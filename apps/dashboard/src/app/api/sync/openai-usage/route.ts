import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth";
import { getApiKeyById, getApiKeyByService } from "@/lib/api-keys";
import { db } from "@/lib/db";

const Schema = z.object({
  days: z.number().int().min(1).max(90).default(7),
  apiKeyId: z.string().min(1).optional(),
});

type OpenAIError = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

type CompletionUsageResult = {
  input_tokens?: number;
  input_cached_tokens?: number;
  input_audio_tokens?: number;
  output_tokens?: number;
  output_audio_tokens?: number;
  num_model_requests?: number;
  model?: string | null;
  model_id?: string | null;
};

type CompletionUsageBucket = {
  object: string;
  start_time: number;
  end_time: number;
  results: CompletionUsageResult[];
};

type CompletionUsageResponse = OpenAIError & {
  object?: string;
  data?: CompletionUsageBucket[];
  has_more?: boolean;
  next_page?: string | null;
};

type CostResult = {
  amount?: { value?: number; currency?: string };
  line_item?: string | null;
  project_id?: string | null;
};

type CostBucket = {
  object: string;
  start_time: number;
  end_time: number;
  results: CostResult[];
};

type CostResponse = OpenAIError & {
  object?: string;
  data?: CostBucket[];
  has_more?: boolean;
  next_page?: string | null;
};

type SyncResult = {
  date: string;
  tokens: number;
  cost: number;
  requests: number;
  source: string;
};

function openAIHeaders(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}` };
}

async function readOpenAIJson<T extends OpenAIError>(res: Response, endpoint: string): Promise<T> {
  const text = await res.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    return {
      error: {
        message: `OpenAI ${endpoint} returned non-JSON response (${res.status}).`,
        code: String(res.status),
      },
    } as T;
  }

  if (!res.ok && !data.error) {
    return {
      ...data,
      error: { message: `OpenAI ${endpoint} failed with status ${res.status}.`, code: String(res.status) },
    };
  }

  return data;
}

function permissionMessage(resp: OpenAIError) {
  const message = resp.error?.message ?? "";
  if (!message.toLowerCase().includes("insufficient permissions") && !message.includes("api.usage.read")) return null;
  return "OpenAI usage sync needs an Organization Admin key or a restricted key with api.usage.read scope. Add it in Settings as OpenAI Usage/Admin.";
}

async function fetchOpenAICompletionsUsage(apiKey: string, startTs: number, endTs: number, page?: string): Promise<CompletionUsageResponse> {
  const url = new URL("https://api.openai.com/v1/organization/usage/completions");
  url.searchParams.set("start_time", String(startTs));
  url.searchParams.set("end_time", String(endTs));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "31");
  url.searchParams.append("group_by", "model");
  if (page) url.searchParams.set("page", page);

  const res = await fetch(url, {
    headers: openAIHeaders(apiKey),
    signal: AbortSignal.timeout(20_000),
  });
  return readOpenAIJson<CompletionUsageResponse>(res, "organization usage");
}

async function fetchOpenAICosts(apiKey: string, startTs: number, endTs: number, page?: string): Promise<CostResponse> {
  const url = new URL("https://api.openai.com/v1/organization/costs");
  url.searchParams.set("start_time", String(startTs));
  url.searchParams.set("end_time", String(endTs));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "31");
  if (page) url.searchParams.set("page", page);

  const res = await fetch(url, {
    headers: openAIHeaders(apiKey),
    signal: AbortSignal.timeout(20_000),
  });
  return readOpenAIJson<CostResponse>(res, "organization costs");
}

async function collectUsageBuckets(apiKey: string, startTs: number, endTs: number, debug: unknown[]) {
  const buckets: CompletionUsageBucket[] = [];
  let page: string | undefined;

  do {
    const usageResp = await fetchOpenAICompletionsUsage(apiKey, startTs, endTs, page);
    debug.push({ endpoint: "organization/usage/completions", page: page ?? null, data: usageResp });
    const permission = permissionMessage(usageResp);
    if (permission) return { buckets, error: permission, status: 403 };
    if (usageResp.error) return { buckets, error: usageResp.error.message ?? "OpenAI usage sync failed", status: 502 };

    buckets.push(...(usageResp.data ?? []));
    page = usageResp.has_more && usageResp.next_page ? usageResp.next_page : undefined;
  } while (page);

  return { buckets };
}

async function collectCostByDate(apiKey: string, startTs: number, endTs: number, debug: unknown[]) {
  const costByDate = new Map<string, number>();
  const warnings: string[] = [];
  let page: string | undefined;

  do {
    const costsResp = await fetchOpenAICosts(apiKey, startTs, endTs, page);
    debug.push({ endpoint: "organization/costs", page: page ?? null, data: costsResp });
    const permission = permissionMessage(costsResp);
    if (permission) {
      warnings.push(`${permission} Token usage can still sync if the usage endpoint is allowed; cost will use a local estimate.`);
      break;
    }
    if (costsResp.error) {
      warnings.push(costsResp.error.message ?? "OpenAI costs sync failed; cost will use estimate.");
      break;
    }

    for (const bucket of costsResp.data ?? []) {
      const dateStr = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
      const cost = bucket.results.reduce((sum, result) => sum + (result.amount?.value ?? 0), 0);
      if (cost > 0) costByDate.set(dateStr, (costByDate.get(dateStr) ?? 0) + cost);
    }
    page = costsResp.has_more && costsResp.next_page ? costsResp.next_page : undefined;
  } while (page);

  return { costByDate, warnings };
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const parsed = Schema.safeParse(await req.json().catch(() => ({})));
    const days = parsed.success ? parsed.data.days : 7;
    const selectedApiKeyId = parsed.success ? parsed.data.apiKeyId : undefined;

    const apiKey = selectedApiKeyId
      ? await getApiKeyById(selectedApiKeyId, user.workspaceId)
      : await getApiKeyByService("openai_admin", user.workspaceId) ??
        await getApiKeyByService("openai_usage", user.workspaceId) ??
        await getApiKeyByService("openai", user.workspaceId);
    if (!apiKey) {
      return NextResponse.json(
        { error: selectedApiKeyId ? "Selected API key was not found in this workspace." : "No OpenAI Usage/Admin API key configured. Add service openai_admin in Settings." },
        { status: 400 },
      );
    }

    const debug: unknown[] = [];
    const warnings: string[] = [];
    const startTs = Math.floor((Date.now() - days * 86_400_000) / 1000);
    const endTs = Math.floor(Date.now() / 1000);

    const usage = await collectUsageBuckets(apiKey, startTs, endTs, debug);
    if (usage.error) {
      return NextResponse.json({ ok: false, error: usage.error, debug }, { status: usage.status ?? 502 });
    }

    const costs = await collectCostByDate(apiKey, startTs, endTs, debug);
    warnings.push(...costs.warnings);

    const results: SyncResult[] = [];
    let totalSynced = 0;

    for (const bucket of usage.buckets) {
      const dateStr = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
      const totalTokens = bucket.results.reduce(
        (sum, item) =>
          sum +
          (item.input_tokens ?? 0) +
          (item.input_audio_tokens ?? 0) +
          (item.output_tokens ?? 0) +
          (item.output_audio_tokens ?? 0),
        0,
      );
      const cachedTokens = bucket.results.reduce((sum, item) => sum + (item.input_cached_tokens ?? 0), 0);
      const totalRequests = bucket.results.reduce((sum, item) => sum + (item.num_model_requests ?? 0), 0);
      if (totalTokens === 0 && totalRequests === 0) continue;

      const models = [...new Set(bucket.results.map((item) => item.model ?? item.model_id).filter(Boolean))].join(", ");
      const costUSD = costs.costByDate.get(dateStr) ?? (totalTokens * 3.0) / 1_000_000;
      const notes = [
        `OpenAI organization usage sync: ${totalRequests} requests.`,
        `Input/output tokens: ${totalTokens.toLocaleString()}.`,
        cachedTokens > 0 ? `Cached input tokens included in provider response: ${cachedTokens.toLocaleString()}.` : null,
        models ? `Models: ${models}.` : null,
        costs.costByDate.has(dateStr) ? "Cost source: OpenAI organization costs endpoint." : "Cost source: local estimate; costs endpoint unavailable or empty.",
      ].filter(Boolean).join(" ");
      const dayDate = new Date(`${dateStr}T00:00:00.000Z`);

      const existing = await db.session.findFirst({
        where: { workspaceId: user.workspaceId, provider: "chatgpt", type: "openai-sync", date: dayDate },
        select: { id: true },
      });

      if (existing) {
        await db.session.update({
          where: { id: existing.id },
          data: { totalTokens, totalCostUSD: costUSD, sessionNotes: notes, model: models || "openai-api" },
        });
      } else {
        await db.session.create({
          data: {
            workspaceId: user.workspaceId,
            provider: "chatgpt",
            model: models || "openai-api",
            type: "openai-sync",
            project: "openai-account",
            date: dayDate,
            tasksCompleted: [],
            totalTokens,
            totalCostUSD: costUSD,
            sessionNotes: notes,
            risks: [],
          },
        });
      }

      results.push({ date: dateStr, tokens: totalTokens, cost: costUSD, requests: totalRequests, source: "organization-usage-completions" });
      totalSynced++;
    }

    return NextResponse.json({
      ok: true,
      synced: totalSynced,
      results,
      warnings,
      debug,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: `OpenAI usage sync failed: ${message}` }, { status: 500 });
  }
}
