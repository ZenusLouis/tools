import { ObsidianLogicClient } from "@/components/labs/ObsidianLogicClient";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ObsidianLogicPage() {
  const user = await requireCurrentUser();
  const [nodes, edges, projects, requirements, skills, runs, kinds, recent] = await Promise.all([
    db.memoryNode.count({ where: { workspaceId: user.workspaceId } }),
    db.memoryEdge.count({ where: { workspaceId: user.workspaceId } }),
    db.project.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    db.memoryNode.count({ where: { workspaceId: user.workspaceId, kind: "requirement" } }),
    db.memoryNode.count({ where: { workspaceId: user.workspaceId, kind: "skill" } }),
    db.memoryNode.count({ where: { workspaceId: user.workspaceId, kind: "run-telemetry" } }),
    db.memoryNode.groupBy({
      by: ["kind"],
      where: { workspaceId: user.workspaceId },
      _count: { kind: true },
      orderBy: { _count: { kind: "desc" } },
      take: 12,
    }),
    db.memoryNode.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        kind: true,
        title: true,
        projectName: true,
        updatedAt: true,
        reqIds: true,
      },
    }),
  ]);

  return (
    <ObsidianLogicClient
      projectNames={projects.map((project) => project.name)}
      stats={{
        nodes,
        edges,
        projects: projects.length,
        requirements,
        skills,
        runs,
        kinds: kinds.map((item) => ({ kind: item.kind, count: item._count.kind })),
        recent: recent.map((item) => ({
          id: item.id,
          kind: item.kind,
          title: item.title,
          projectName: item.projectName,
          updatedAt: item.updatedAt.toISOString(),
          reqIds: item.reqIds,
        })),
      }}
    />
  );
}
