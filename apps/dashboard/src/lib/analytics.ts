import "server-only";
import { db } from "@/lib/db";

export type DateRange = "today" | "week" | "month" | "year";
export type ToolBreakdown = { tool: string; tokens: number; percent: number };
export type ProviderBreakdown = {
  provider: "claude" | "codex" | "chatgpt";
  tokens: number;
  sessionTokens: number;
  toolTokens: number;
  percent: number;
  cost: number;
};
export type DailyUsage = { date: string; label: string; tokens: number; cost: number };
export type SessionRow = { date: string; time: string; timestamp: string; provider: string; role: string | null; model: string | null; project: string; tasksCompleted: number; tokens: number; cost: number; durationMin: number | null; source: "session" | "tool"; tool?: string };
export type SessionPagination = { page: number; pageSize: number; total: number; totalPages: number };
export type AnalyticsData = {
  totalTokens: number;
  totalCost: number;
  providerBreakdown: ProviderBreakdown[];
  toolBreakdown: ToolBreakdown[];
  dailyUsage: DailyUsage[];
  sessions: SessionRow[];
  sessionPagination: SessionPagination;
};

const COST_PER_MILLION = 3.0;

function rangeStart(range: DateRange): Date {
  const now = new Date();
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "week") return new Date(Date.now() - 7 * 86_400_000);
  if (range === "month") return new Date(Date.now() - 30 * 86_400_000);
  return new Date(now.getFullYear(), 0, 1);
}

function usageBucket(date: Date, range: DateRange): { key: string; label: string } {
  if (range === "year") {
    const key = date.toISOString().slice(0, 7);
    return { key, label: date.toLocaleString("en", { month: "short" }) };
  }
  if (range === "today") {
    // Per-minute buckets for today
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    const key = `${date.toISOString().slice(0, 10)}T${h}:${m}`;
    return { key, label: `${h}:${m}` };
  }
  const key = date.toISOString().slice(0, 10);
  return { key, label: date.toLocaleDateString("en", { month: "short", day: "numeric" }) };
}

function sessionTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export async function getAnalytics(
  range: DateRange,
  workspaceId?: string,
  options?: { sessionPage?: number; sessionPageSize?: number; sessionProvider?: string; sessionSource?: string },
): Promise<AnalyticsData> {
  const since = rangeStart(range);

  const [sessions, toolUsage] = await Promise.all([
    db.session.findMany({ where: { date: { gte: since }, ...(workspaceId ? { workspaceId } : {}) }, orderBy: { date: "desc" } }),
    db.toolUsage.findMany({ where: { date: { gte: since }, ...(workspaceId ? { workspaceId } : {}) }, orderBy: { date: "asc" } }),
  ]);

  const providers = ["claude", "codex", "chatgpt"] as const;
  const rawProviderBreakdown = providers.map((provider) => {
    const sessionTokens = sessions
      .filter((session) => session.provider === provider && provider !== "codex")
      .reduce((sum, session) => sum + (session.totalTokens ?? 0), 0);
    const toolTokens = toolUsage
      .filter((usage) => usage.provider === provider)
      .reduce((sum, usage) => sum + usage.tokens, 0);
    return { provider, sessionTokens, toolTokens, tokens: provider === "codex" ? toolTokens : Math.max(sessionTokens, toolTokens) };
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

  // Daily usage — for "today" use exact response timestamps, not time buckets
  let dailyUsage: DailyUsage[];
  if (range === "today") {
    // Each tool call = 1 data point at its actual timestamp
    const points = toolUsage.map((u) => {
      const h = u.date.getHours().toString().padStart(2, "0");
      const m = u.date.getMinutes().toString().padStart(2, "0");
      return {
        date: u.date.toISOString(),
        label: `${h}:${m}`,
        tokens: u.tokens,
        cost: u.tokens * (COST_PER_MILLION / 1_000_000),
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
    dailyUsage = points;
  } else {
    const dayMap = new Map<string, number>();
    const labelMap = new Map<string, string>();
    for (const s of sessions.filter((session) => session.provider !== "codex")) {
      const bucket = usageBucket(s.date, range);
      dayMap.set(bucket.key, (dayMap.get(bucket.key) ?? 0) + (s.totalTokens ?? 0));
      labelMap.set(bucket.key, bucket.label);
    }
    for (const usage of toolUsage) {
      const bucket = usageBucket(usage.date, range);
      dayMap.set(bucket.key, (dayMap.get(bucket.key) ?? 0) + usage.tokens);
      labelMap.set(bucket.key, bucket.label);
    }
    dailyUsage = [...dayMap.entries()]
      .map(([date, tokens]) => ({ date, label: labelMap.get(date) ?? date, tokens, cost: tokens * (COST_PER_MILLION / 1_000_000) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Session rows
  const allSessionRows: SessionRow[] = [
    ...sessions
      .filter((s) => s.provider !== "codex" && (s.totalTokens ?? 0) > 0)
      .map((s) => ({
        date: s.date.toISOString().slice(0, 10),
        time: sessionTime(s.date),
        timestamp: s.date.toISOString(),
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
      time: sessionTime(usage.date),
      timestamp: usage.date.toISOString(),
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
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const filteredSessionRows = allSessionRows.filter((row) => {
    const providerMatches = !options?.sessionProvider || options.sessionProvider === "all" || row.provider === options.sessionProvider;
    const sourceMatches = !options?.sessionSource || options.sessionSource === "all" || row.source === options.sessionSource;
    return providerMatches && sourceMatches;
  });
  const pageSize = Math.min(Math.max(options?.sessionPageSize ?? 12, 1), 100);
  const totalPages = Math.max(1, Math.ceil(filteredSessionRows.length / pageSize));
  const page = Math.min(Math.max(options?.sessionPage ?? 1, 1), totalPages);
  const sessionsPage = filteredSessionRows.slice((page - 1) * pageSize, page * pageSize);
  const sessionPagination = { page, pageSize, total: filteredSessionRows.length, totalPages };

  return { totalTokens, totalCost, providerBreakdown, toolBreakdown, dailyUsage, sessions: sessionsPage, sessionPagination };
}
