import "server-only";
import { db } from "@/lib/db";

export type LabMetrics = {
  projects: number;
  sessions: number;
  toolEvents: number;
  roles: number;
  skills: number;
  bridgeDevices: number;
  recentEvents: Array<{ label: string; detail: string; date: string }>;
};

export async function getLabMetrics(workspaceId: string): Promise<LabMetrics> {
  const [projects, sessions, toolEvents, roles, skills, bridgeDevices, recentSessions] = await Promise.all([
    db.project.count({ where: { workspaceId } }),
    db.session.count({ where: { workspaceId } }),
    db.toolUsage.count({ where: { workspaceId } }),
    db.agentRole.count({ where: { workspaceId } }),
    db.skillDefinition.count({ where: { workspaceId } }),
    db.bridgeDevice.count({ where: { workspaceId } }),
    db.session.findMany({ where: { workspaceId }, orderBy: { date: "desc" }, take: 5 }),
  ]);

  return {
    projects,
    sessions,
    toolEvents,
    roles,
    skills,
    bridgeDevices,
    recentEvents: recentSessions.map((session) => ({
      label: session.type,
      detail: session.sessionNotes ?? `${session.provider} ${session.role ?? "agent"}`,
      date: session.date.toISOString(),
    })),
  };
}
