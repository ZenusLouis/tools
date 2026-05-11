import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DesignBoardClient } from "@/components/design/DesignBoardClient";
import type { DesignTaskItem } from "@/components/design/DesignTaskCard";

export default async function ProjectDesignPage({ params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name: projectName } = await params;

  const project = await db.project.findFirst({
    where: { name: projectName, OR: [{ workspaceId: user.workspaceId }, { workspaceId: null }] },
    select: { name: true },
  });
  if (!project) notFound();

  const designTasks = await db.designTask.findMany({
    where: { workspaceId: user.workspaceId, projectName },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      screenName: true,
      screenDesc: true,
      status: true,
      provider: true,
      outputUrl: true,
      linkedTaskIds: true,
      reqIds: true,
    },
  });

  const items: DesignTaskItem[] = designTasks.map((t) => ({
    id: t.id,
    screenName: t.screenName,
    screenDesc: t.screenDesc,
    status: t.status,
    provider: t.provider,
    outputUrl: t.outputUrl,
    linkedTaskIds: t.linkedTaskIds,
    reqIds: t.reqIds,
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-text">Design Screens</h1>
        <p className="mt-1 text-sm text-text-muted">
          Generate UI designs from BRD. Completed screens are automatically linked to FE tasks.
        </p>
      </div>
      <DesignBoardClient projectName={projectName} initialTasks={items} />
    </div>
  );
}
