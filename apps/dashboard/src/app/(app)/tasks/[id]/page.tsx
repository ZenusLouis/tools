import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { TaskMetaCard } from "@/components/tasks/detail/TaskMetaCard";
import { FilesChangedCard } from "@/components/tasks/detail/FilesChangedCard";
import { RisksCard } from "@/components/tasks/detail/RisksCard";
import { LessonLinkCard } from "@/components/tasks/detail/LessonLinkCard";
import { DiffCard } from "@/components/tasks/detail/DiffCard";
import { ArtifactsCard } from "@/components/tasks/detail/ArtifactsCard";
import { CommitComposerButton } from "@/components/tasks/detail/CommitComposerButton";
import { findTaskDetail, getTaskLogEntry } from "@/lib/task-detail";
import { getProjectContext } from "@/lib/settings";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: Props) {
  const { id } = await params;

  const [task, log] = await Promise.all([
    findTaskDetail(id),
    getTaskLogEntry(id),
  ]);

  if (!task) notFound();

  const projectCtx = await getProjectContext(task.projectName).catch(() => null);
  const projectPath = projectCtx?.path ?? undefined;

  return (
    <>
      <TopBar
        title={`Task ${task.id}`}
        actions={
          <CommitComposerButton
            taskId={task.id}
            taskName={task.name}
            projectName={task.projectName}
            files={log?.filesChanged ?? []}
            agentName={task.devRoleName}
          />
        }
      />
      <PageShell>
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex flex-col gap-4">
            <TaskMetaCard task={task} log={log} />
            <ArtifactsCard task={task} />
            <FilesChangedCard files={log?.filesChanged ?? []} projectPath={projectPath} />
          </div>
          <div className="flex flex-col gap-4">
            <RisksCard risks={log?.risks ?? []} />
            <LessonLinkCard lessonSaved={log?.lessonSaved ?? null} />
            <DiffCard files={log?.filesChanged ?? []} />
          </div>
        </div>
      </PageShell>
    </>
  );
}
