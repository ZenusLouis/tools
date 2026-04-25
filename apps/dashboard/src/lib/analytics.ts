import "server-only";
import { db } from "@/lib/db";

export type DateRange = "today" | "week" | "month";
export type ToolBreakdown = { tool: string; tokens: number; percent: number };
export type ProviderBreakdown = {
  provider: "claude" | "codex" | "chatgpt";
  tokens: number;
  sessionTokens: number;
  toolTokens: number;
  percent: number;
  cost: number;
};
export type DailyUsage = { date: string; tokens: number; cost: number };
export type SessionRow = { date: string; provider: string; role: string | null; model: string | null; project: string; tasksCompleted: number; tokens: number; cost: number; durationMin: number | null; source: "session" | "tool"; tool?: string };
export type AnalyticsData = {
  totalTokens: number;
  totalCost: number;
  providerBreakdown: ProviderBreakdown[];
  toolBreakdown: ToolBreakdown[];
  dailyUsage: DailyUsage[];
  sessions: SessionRow[];
};

const COST_PER_MILLION = 3.0;

function rangeStart(range: DateRange): Date {
  const now = new Date();
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "week") return new Date(Date.now() - 7 * 86_400_000);
  return new Date(Date.now() - 30 * 86_400_000);
}

export async function getAnalytics(range: DateRange, workspaceId?: string): Promise<AnalyticsData> {
  const since = rangeStart(range);

  const [sessions, toolUsage] = await Promise.all([
    db.session.findMany({ where: { date: { gte: since }, ...(workspaceId ? { workspaceId } : {}) }, orderBy: { date: "desc" } }),
    db.toolUsage.findMany({ where: { date: { gte: since }, ...(workspaceId ? { workspaceId } : {}) }, orderBy: { date: "asc" } }),
  ]);

  const providers = ["claude", "codex", "chatgpt"] as const;
  const rawProviderBreakdown = providers.map((provider) => {
    const sessionTokens = sessions
      .filter((session) => session.provider === provider)
      .reduce((sum, session) => sum + (session.totalTokens ?? 0), 0);
    const toolTokens = toolUsage
      .filter((usage) => usage.provider === provider)
      .reduce((sum, usage) => sum + usage.tokens, 0);
    return { provider, sessionTokens, toolTokens, tokens: Math.max(sessionTokens, toolTokens) };
  });
  const totalTokens = rawProviderBreakdown.reduce((sum, row) => sum + row.tokens, 0);
  const totalCost = totalTokens * (COST_PER_MILLION / 1_000_000);
  const providerBreakdown: ProviderBreakdown[] = rawProviderBreakdown.map((row) => ({
    ...row,
    percent: totalTokens > 0 ? Math.round((row.tokens / totalTokens) * 100) : 0,
    cost: row.tokens * (COST_PER_MILLION / 1_000_000),
  }));

  // Tool breakdown
  const toolMap = new Map<string, number>();
  for (const t of toolUsage) {
    toolMap.set(t.tool, (toolMap.get(t.tool) ?? 0) + t.tokens);
  }
  const totalToolTokens = [...toolMap.values()].reduce((a, b) => a + b, 0) || 1;
  const toolBreakdown: ToolBreakdown[] = [...toolMap.entries()]
    .map(([tool, tokens]) => ({ tool, tokens, percent: Math.round((tokens / totalToolTokens) * 100) }))
    .sort((a, b) => b.tokens - a.tokens);

  // Daily usage
  const dayMap = new Map<string, number>();
  for (const s of sessions) {
    const day = s.date.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + (s.totalTokens ?? 0));
  }
  for (const usage of toolUsage) {
    const day = usage.date.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + usage.tokens);
  }
  const dailyUsage: DailyUsage[] = [...dayMap.entries()]
    .map(([date, tokens]) => ({ date, tokens, cost: tokens * (COST_PER_MILLION / 1_000_000) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Session rows
  const sessionRows: SessionRow[] = [
    ...sessions
      .filter((s) => (s.totalTokens ?? 0) > 0)
      .map((s) => ({
        date: s.date.toISOString().slice(0, 10),
        provider: s.provider,
        role: s.role,
        model: s.model,
        project: s.project,
        tasksCompleted: s.tasksCompleted.length,
        tokens: s.totalTokens ?? 0,
        cost: (s.totalTokens ?? 0) * (COST_PER_MILLION / 1_000_000),
        durationMin: s.durationMin ?? null,
        source: "session" as const,
      })),
    ...toolUsage.map((usage) => ({
      date: usage.date.toISOString().slice(0, 10),
      provider: usage.provider,
      role: usage.role,
      model: usage.model,
      project: "tool usage",
      tasksCompleted: 0,
      tokens: usage.tokens,
      cost: usage.tokens * (COST_PER_MILLION / 1_000_000),
      durationMin: null,
      source: "tool" as const,
      tool: usage.tool,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return { totalTokens, totalCost, providerBreakdown, toolBreakdown, dailyUsage, sessions: sessionRows };
}
