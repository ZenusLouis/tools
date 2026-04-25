import "server-only";
import { db } from "@/lib/db";

export type ActivityItem = {
  taskId: string | null;
  project: string;
  date: string;
  commitHash: string | null;
  note: string | null;
};

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  const hrs = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export async function getRecentActivity(limit = 5, workspaceId?: string, since?: Date): Promise<ActivityItem[]> {
  const start = since ?? new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const sessions = await db.session.findMany({
    where: { date: { gte: start }, ...(workspaceId ? { workspaceId } : {}) },
    orderBy: { date: "desc" },
    take: limit * 3,
  });

  const items: ActivityItem[] = [];
  for (const s of sessions) {
    if (s.tasksCompleted.length === 0) {
      items.push({
        taskId: null,
        project: s.project,
        date: s.date.toISOString(),
        commitHash: s.commitHash,
        note: s.sessionNotes ?? s.type,
      });
      if (items.length >= limit) return items;
      continue;
    }
    for (const taskId of s.tasksCompleted) {
      items.push({
        taskId,
        project: s.project,
        date: s.date.toISOString(),
        commitHash: s.commitHash,
        note: s.sessionNotes,
      });
      if (items.length >= limit) return items;
    }
  }
  return items;
}
