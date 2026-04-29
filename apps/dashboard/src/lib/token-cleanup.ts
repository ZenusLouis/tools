import "server-only";
import { db } from "@/lib/db";

export async function resetCodexUsage(workspaceId: string) {
  const [deletedTools, deletedSessions] = await db.$transaction([
    db.toolUsage.deleteMany({ where: { workspaceId, provider: "codex" } }),
    db.session.deleteMany({
      where: {
        workspaceId,
        provider: "codex",
        type: { in: ["session", "token-cleanup"] },
      },
    }),
  ]);

  await db.session.create({
    data: {
      workspaceId,
      provider: "codex",
      type: "token-reset",
      project: "codex",
      date: new Date(),
      tasksCompleted: [],
      sessionNotes: `Codex usage reset. Deleted ${deletedTools.count} tool rows and ${deletedSessions.count} session rows; new Codex rows will use the current baseline/rate-card behavior.`,
      risks: [],
    },
  });

  return {
    deletedToolUsage: deletedTools.count,
    deletedSessions: deletedSessions.count,
  };
}
