import "server-only";
import { db } from "@/lib/db";

export type DateRange = "today" | "week" | "month";
export type ToolBreakdown = { tool: string; tokens: number; percent: number };
export type DailyUsage = { date: string; tokens: number; cost: number };
export type SessionRow = { date: string; project: string; tasksCompleted: number; tokens: number; cost: number };
export type AnalyticsData = {
  totalTokens: number;
  totalCost: number;
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

  const totalTokens = sessions.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
  const totalCost = totalTokens * (COST_PER_MILLION / 1_000_000);

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
  const dailyUsage: DailyUsage[] = [...dayMap.entries()]
    .map(([date, tokens]) => ({ date, tokens, cost: tokens * (COST_PER_MILLION / 1_000_000) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Session rows
  const sessionRows: SessionRow[] = sessions.map((s) => ({
    date: s.date.toISOString().slice(0, 10),
    project: s.project,
    tasksCompleted: s.tasksCompleted.length,
    tokens: s.totalTokens ?? 0,
    cost: (s.totalTokens ?? 0) * (COST_PER_MILLION / 1_000_000),
  }));

  return { totalTokens, totalCost, toolBreakdown, dailyUsage, sessions: sessionRows };
}
