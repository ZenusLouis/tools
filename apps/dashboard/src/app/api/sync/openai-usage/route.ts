import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth";
import { getApiKeyByService } from "@/lib/api-keys";
import { db } from "@/lib/db";

const Schema = z.object({ days: z.number().int().min(1).max(90).default(7) });

type OpenAIUsageItem = {
  aggregation_timestamp: number;
  n_requests: number;
  operation: string;
  snapshot_id: string;
  n_context_tokens_total: number;
  n_generated_tokens_total: number;
};

type OpenAIUsageResponse = {
  data?: OpenAIUsageItem[];
  current_usage_usd?: number;
  error?: { message: string };
};

// Newer completions usage API (tracks Codex, gpt-4o, o1, etc.)
type CostBucket = { object: string; start_time: number; end_time: number; results: Array<{ input_tokens: number; output_tokens: number; num_model_requests: number; project_id: string | null; model_id: string | null }> };
type CostResponse = { object: string; data?: CostBucket[]; error?: { message: string } };

async function fetchOpenAICosts(apiKey: string, startTs: number, endTs: number): Promise<CostResponse> {
  const url = `https://api.openai.com/v1/organization/costs?start_time=${startTs}&end_time=${endTs}&bucket_width=1d&limit=10`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  return res.json() as Promise<CostResponse>;
}

async function fetchOpenAIUsage(apiKey: string, date: string): Promise<OpenAIUsageResponse> {
  const res = await fetch(`https://api.openai.com/v1/usage?date=${date}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  return res.json() as Promise<OpenAIUsageResponse>;
}

export async function POST(req: NextRequest) {
  const user = await requireCurrentUser();
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  const days = parsed.success ? parsed.data.days : 7;

  const apiKey = await getApiKeyByService("openai", user.workspaceId);
  if (!apiKey) return NextResponse.json({ error: "No OpenAI API key configured" }, { status: 400 });

  const results: { date: string; tokens: number; cost: number; requests: number; source: string }[] = [];
  const debug: unknown[] = [];
  let totalSynced = 0;

  // Try newer costs API first (covers Codex, o1, gpt-4o, etc.)
  const startTs = Math.floor((Date.now() - days * 86_400_000) / 1000);
  const endTs = Math.floor(Date.now() / 1000);
  try {
    const costsResp = await fetchOpenAICosts(apiKey, startTs, endTs);
    debug.push({ endpoint: "costs", data: costsResp });
    if (!costsResp.error && costsResp.data && costsResp.data.length > 0) {
      for (const bucket of costsResp.data) {
        const dateStr = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
        const totalTokens = bucket.results.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0);
        const totalRequests = bucket.results.reduce((s, r) => s + r.num_model_requests, 0);
        if (totalTokens === 0) continue;
        const costUSD = totalTokens * 3.0 / 1_000_000;
        const notes = `OpenAI costs sync: ${totalRequests} requests. Models: ${[...new Set(bucket.results.map((r) => r.model_id).filter(Boolean))].join(", ")}`;
        const dayDate = new Date(`${dateStr}T00:00:00.000Z`);
        const existing = await db.session.findFirst({ where: { workspaceId: user.workspaceId, provider: "chatgpt", type: "openai-sync", date: dayDate }, select: { id: true } });
        if (existing) await db.session.update({ where: { id: existing.id }, data: { totalTokens, totalCostUSD: costUSD, sessionNotes: notes } });
        else await db.session.create({ data: { workspaceId: user.workspaceId, provider: "chatgpt", model: "openai-api", type: "openai-sync", project: "openai-account", date: dayDate, tasksCompleted: [], totalTokens, totalCostUSD: costUSD, sessionNotes: notes, risks: [] } });
        results.push({ date: dateStr, tokens: totalTokens, cost: costUSD, requests: totalRequests, source: "costs-api" });
        totalSynced++;
      }
      return NextResponse.json({ ok: true, synced: totalSynced, results, debug });
    }
  } catch { /* fallback to legacy */ }

  // Fallback: legacy /v1/usage per day
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86_400_000);
    const dateStr = d.toISOString().slice(0, 10);

    try {
      const usage = await fetchOpenAIUsage(apiKey, dateStr);
      debug.push({ date: dateStr, endpoint: "usage", raw: usage });
      if (usage.error) continue;

      const items = usage.data ?? [];
      const totalTokens = items.reduce(
        (sum, item) => sum + item.n_context_tokens_total + item.n_generated_tokens_total, 0,
      );
      const totalRequests = items.reduce((sum, item) => sum + item.n_requests, 0);
      const costUSD = usage.current_usage_usd ?? (totalTokens * 3.0) / 1_000_000;

      if (totalTokens === 0) continue;

      const dayDate = new Date(`${dateStr}T00:00:00.000Z`);
      const models = [...new Set(items.map((x) => x.snapshot_id))].join(", ");
      const notes = `OpenAI usage sync: ${totalRequests} requests. Models: ${models}`;

      const existing = await db.session.findFirst({
        where: { workspaceId: user.workspaceId, provider: "chatgpt", type: "openai-sync", date: dayDate },
        select: { id: true },
      });

      if (existing) {
        await db.session.update({
          where: { id: existing.id },
          data: { totalTokens, totalCostUSD: costUSD, sessionNotes: notes },
        });
      } else {
        await db.session.create({
          data: {
            workspaceId: user.workspaceId,
            provider: "chatgpt",
            model: "openai-api",
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

      results.push({ date: dateStr, tokens: totalTokens, cost: costUSD, requests: totalRequests, source: "legacy-usage" });
      totalSynced++;
    } catch { /* skip failed days */ }
  }

  return NextResponse.json({ ok: true, synced: totalSynced, results, debug });
}
