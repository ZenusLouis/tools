import "server-only";
import { db } from "@/lib/db";

export type ActivityItem = {
  taskId: string | null;
  project: string;
  projectExists: boolean;
  href: string;
  date: string;
  commitHash: string | null;
  note: string | null;
  sessionType: string | null;
  provider: string | null;
  auditEvent?: string | null;
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

  const [sessions, chatSessions, auditLogs, projects] = await Promise.all([
    db.session.findMany({
      where: { date: { gte: start }, ...(workspaceId ? { workspaceId } : {}) },
      orderBy: { date: "desc" },
      take: limit * 3,
    }),
    db.chatSession.findMany({
      where: { updatedAt: { gte: start }, ...(workspaceId ? { workspaceId } : {}) },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    db.auditLog.findMany({
      where: { createdAt: { gte: start }, ...(workspaceId ? { workspaceId } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit * 3,
    }),
    db.project.findMany({
      where: workspaceId ? { OR: [{ workspaceId }, { workspaceId: null }] } : undefined,
      select: { name: true },
    }),
  ]);
  const projectNames = new Set(projects.map((project) => project.name));

  const items: ActivityItem[] = [];
  const seen = new Set<string>(); // dedup key: type+project+day

  for (const chat of chatSessions) {
    items.push({
      taskId: null,
      project: chat.title || "Workspace chat",
      projectExists: false,
      href: `/chat?sessionId=${encodeURIComponent(chat.id)}`,
      date: chat.updatedAt.toISOString(),
      commitHash: null,
      note: chat.messages[0]?.content?.slice(0, 120) ?? null,
      sessionType: "chat",
      provider: chat.provider ?? null,
      auditEvent: null,
    });
  }

  for (const audit of auditLogs) {
    const targetProject = audit.targetType === "Project" && audit.targetId ? audit.targetId : "Workspace";
    const projectExists = projectNames.has(targetProject);
    items.push({
      taskId: null,
      project: targetProject,
      projectExists,
      href: projectExists ? `/projects/${encodeURIComponent(targetProject)}` : "/settings",
      date: audit.createdAt.toISOString(),
      commitHash: null,
      note: audit.event.replace(/_/g, " "),
      sessionType: "audit",
      provider: audit.actorType,
      auditEvent: audit.event,
    });
  }

  for (const s of sessions) {
    const dedupKey = `${s.type}:${s.project}:${s.date.toISOString().slice(0, 10)}`;
    if (s.type === "openai-sync" || s.type === "project-event") {
      if (seen.has(dedupKey)) continue; // show only one per project per day
      seen.add(dedupKey);
    }

    if (s.tasksCompleted.length === 0) {
      const projectExists = projectNames.has(s.project);
      items.push({
        taskId: null,
        project: s.project,
        projectExists,
        href: projectExists ? `/projects/${encodeURIComponent(s.project)}` : `/tokens?source=session`,
        date: s.date.toISOString(),
        commitHash: s.commitHash,
        note: s.sessionNotes ?? null,
        sessionType: s.type,
        provider: s.provider,
        auditEvent: null,
      });
      continue;
    }
    for (const taskId of s.tasksCompleted) {
      const projectExists = projectNames.has(s.project);
      items.push({
        taskId,
        project: s.project,
        projectExists,
        href: `/tasks/${encodeURIComponent(taskId)}`,
        date: s.date.toISOString(),
        commitHash: s.commitHash,
        note: s.sessionNotes,
        sessionType: s.type,
        provider: s.provider,
        auditEvent: null,
      });
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
