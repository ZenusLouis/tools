import "server-only";
import { db } from "@/lib/db";

const DAILY_TOKEN_LIMIT = 100_000;
const COST_PER_MILLION = 3.0;

export type DashboardStats = {
  activeProjects: number;
  tasksToday: number;
  tokenCount: number;
  sessionCost: number;
  tokenPercent: number;
  dailyLimit: number;
};

export async function getDashboardStats(workspaceId?: string): Promise<DashboardStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [projectCount, todaySessions] = await Promise.all([
    db.project.count({ where: workspaceId ? { workspaceId } : undefined }),
    db.session.findMany({ where: { date: { gte: todayStart }, ...(workspaceId ? { workspaceId } : {}) } }),
  ]);

  const tasksToday = todaySessions.reduce((s, r) => s + r.tasksCompleted.length, 0);
  const tokenCount = todaySessions.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
  const sessionCost = tokenCount * (COST_PER_MILLION / 1_000_000);
  const tokenPercent = Math.min((tokenCount / DAILY_TOKEN_LIMIT) * 100, 100);

  return { activeProjects: projectCount, tasksToday, tokenCount, sessionCost, tokenPercent, dailyLimit: DAILY_TOKEN_LIMIT };
}
