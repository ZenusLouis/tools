import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { TaskMetaCard } from "@/components/tasks/detail/TaskMetaCard";
import { FilesChangedCard } from "@/components/tasks/detail/FilesChangedCard";
import { RisksCard } from "@/components/tasks/detail/RisksCard";
import { LessonLinkCard } from "@/components/tasks/detail/LessonLinkCard";
import { DiffCard } from "@/components/tasks/detail/DiffCard";
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
      <TopBar title={`Task ${task.id}`} />
      <PageShell>
        <div className="max-w-2xl flex flex-col gap-4">
          <TaskMetaCard task={task} log={log} />
          <FilesChangedCard files={log?.filesChanged ?? []} projectPath={projectPath} />
          <RisksCard risks={log?.risks ?? []} />
          <LessonLinkCard lessonSaved={log?.lessonSaved ?? null} />
          <DiffCard files={log?.filesChanged ?? []} />
        </div>
      </PageShell>
    </>
  );
}
