import "server-only";
import { db } from "@/lib/db";

const COST_PER_MILLION = 3.0;

export type DashboardRange = "today" | "week" | "month";

export type DashboardStats = {
  activeProjects: number;
  tasksCompleted: number;
  tokenCount: number;
  sessionCost: number;
  tokenBreakdown: Array<{
    provider: "claude" | "codex" | "chatgpt";
    tokens: number;
    sessionTokens: number;
    toolTokens: number;
    percent: number;
  }>;
};

function getRangeStart(range: DashboardRange): Date {
  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (range === "week") {
    return new Date(Date.now() - 7 * 86_400_000);
  }
  return new Date(Date.now() - 30 * 86_400_000);
}

export async function getDashboardStats(workspaceId?: string, range: DashboardRange = "today"): Promise<DashboardStats> {
  const since = getRangeStart(range);

  const [projectCount, sessions, toolUsage] = await Promise.all([
    db.project.count({ where: workspaceId ? { workspaceId } : undefined }),
    db.session.findMany({ where: { date: { gte: since }, ...(workspaceId ? { workspaceId } : {}) } }),
    db.toolUsage.findMany({ where: { date: { gte: since }, ...(workspaceId ? { workspaceId } : {}) } }),
  ]);

  const tasksCompleted = sessions.reduce((sum, session) => sum + session.tasksCompleted.length, 0);
  const providers = ["claude", "codex", "chatgpt"] as const;
  const tokenBreakdown = providers.map((provider) => {
    const sessionTokens = sessions
      .filter((session) => session.provider === provider && provider !== "codex")
      .reduce((sum, session) => sum + (session.totalTokens ?? 0), 0);
    const toolTokens = toolUsage
      .filter((usage) => usage.provider === provider)
      .reduce((sum, usage) => sum + usage.tokens, 0);
    return {
      provider,
      sessionTokens,
      toolTokens,
      // Codex exposes thread-level totals in its local SQLite. The bridge
      // converts that to ToolUsage deltas; session totals are metadata only.
      // Claude can stream tool usage before Stop emits a session summary.
      // Taking the max keeps today's dashboard live without double-counting
      // when both tool rows and session summaries exist for the same work.
      tokens: provider === "codex" ? toolTokens : Math.max(sessionTokens, toolTokens),
      percent: 0,
    };
  });
  const tokenCount = tokenBreakdown.reduce((sum, item) => sum + item.tokens, 0);
  const sessionCost = tokenCount * (COST_PER_MILLION / 1_000_000);
  const breakdownWithPercent = tokenBreakdown.map((item) => ({
    ...item,
    percent: tokenCount > 0 ? Math.round((item.tokens / tokenCount) * 100) : 0,
  }));

  return {
    activeProjects: projectCount,
    tasksCompleted,
    tokenCount,
    sessionCost,
    tokenBreakdown: breakdownWithPercent,
  };
}
