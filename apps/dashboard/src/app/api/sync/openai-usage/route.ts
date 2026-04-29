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

async function fetchOpenAIUsage(apiKey: string, date: string): Promise<OpenAIUsageResponse> {
  const res = await fetch(`https://api.openai.com/v1/usage?date=${date}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "OpenAI-Organization": "" },
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

  const results: { date: string; tokens: number; cost: number; requests: number }[] = [];
  let totalSynced = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86_400_000);
    const dateStr = d.toISOString().slice(0, 10);

    try {
      const usage = await fetchOpenAIUsage(apiKey, dateStr);
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

      results.push({ date: dateStr, tokens: totalTokens, cost: costUSD, requests: totalRequests });
      totalSynced++;
    } catch { /* skip failed days */ }
  }

  return NextResponse.json({ ok: true, synced: totalSynced, results });
}
