import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { TaskBoardSelectors } from "@/components/tasks/TaskBoardSelectors";
import { TaskBoardClient } from "@/components/tasks/TaskBoardClient";
import { getProjectOptions, getModuleOptions, getModuleProgress, getModuleTasks, getCompletedTaskIds } from "@/lib/tasks";

interface Props {
  searchParams: Promise<{ project?: string; module?: string }>;
}

export default async function TasksPage({ searchParams }: Props) {
  const { project, module: mod } = await searchParams;

  const projects = await getProjectOptions();
  const selectedProject = project ?? projects[0]?.name ?? "";
  const modules = selectedProject ? await getModuleOptions(selectedProject) : [];
  const selectedModule = mod ?? modules[0]?.id ?? "";

  const [moduleProgress, tasks, completedIdsSet] = await Promise.all([
    selectedProject && selectedModule ? getModuleProgress(selectedProject, selectedModule) : Promise.resolve(null),
    selectedProject && selectedModule ? getModuleTasks(selectedProject, selectedModule) : Promise.resolve([]),
    selectedProject ? getCompletedTaskIds(selectedProject) : Promise.resolve(new Set<string>()),
  ]);

  return (
    <>
      <TopBar title="Task Board" />
      <PageShell>
        <div className="flex flex-col gap-4">
          {/* Breadcrumb bar with inline progress */}
          <TaskBoardSelectors
            projects={projects}
            modules={modules}
            selectedProject={selectedProject}
            selectedModule={selectedModule}
            progress={moduleProgress ?? undefined}
          />

          {/* Kanban board + slide-out detail panel */}
          <TaskBoardClient
            tasks={tasks}
            completedIdList={Array.from(completedIdsSet)}
            projectName={selectedProject}
            moduleId={selectedModule}
          />
        </div>
      </PageShell>
    </>
  );
}
