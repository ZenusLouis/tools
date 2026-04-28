import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { TaskBoardSelectors } from "@/components/tasks/TaskBoardSelectors";
import { TaskBoardClient } from "@/components/tasks/TaskBoardClient";
import { getProjectOptions, getModuleOptions, getModuleProgress, getModuleTasks, getCompletedTaskIds, getTaskPagination, type TaskStatus } from "@/lib/tasks";
import { requireCurrentUser } from "@/lib/auth";

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

const TASK_PAGE_SIZE = 6;
const STATUS_PAGE_PARAM: Record<TaskStatus, string> = {
  pending: "pendingPage",
  "in-progress": "inProgressPage",
  completed: "completedPage",
  blocked: "blockedPage",
};
const STATUS_SHOW_PARAM: Record<TaskStatus, string> = {
  pending: "pendingShow",
  "in-progress": "inProgressShow",
  completed: "completedShow",
  blocked: "blockedShow",
};

function pageFor(params: Record<string, string | undefined>, status: TaskStatus) {
  return Math.max(1, Number(params[STATUS_PAGE_PARAM[status]] ?? "1") || 1);
}

export default async function TasksPage({ searchParams }: Props) {
  const params = await searchParams;
  const { project, module: mod } = params;
  const user = await requireCurrentUser();

  const projects = await getProjectOptions(user.workspaceId);
  const selectedProject = project ?? projects[0]?.name ?? "";
  const modules = selectedProject ? await getModuleOptions(selectedProject) : [];
  const selectedModule = mod ?? "all";

  const statuses: TaskStatus[] = ["pending", "in-progress", "completed", "blocked"];
  const pageByStatus = Object.fromEntries(statuses.map((status) => [status, pageFor(params, status)])) as Partial<Record<TaskStatus, number>>;
  const showAllByStatus = Object.fromEntries(statuses.map((status) => [status, params[STATUS_SHOW_PARAM[status]] === "all"])) as Partial<Record<TaskStatus, boolean>>;

  const [moduleProgress, tasks, completedIdsSet, taskPagination] = await Promise.all([
    selectedProject && selectedModule ? getModuleProgress(selectedProject, selectedModule, user.workspaceId) : Promise.resolve(null),
    selectedProject && selectedModule ? getModuleTasks(selectedProject, selectedModule, user.workspaceId, { pageSize: TASK_PAGE_SIZE, pageByStatus, showAllByStatus }) : Promise.resolve([]),
    selectedProject ? getCompletedTaskIds(selectedProject, user.workspaceId) : Promise.resolve(new Set<string>()),
    selectedProject && selectedModule ? getTaskPagination(selectedProject, selectedModule, user.workspaceId, TASK_PAGE_SIZE, pageByStatus, showAllByStatus) : Promise.resolve(null),
  ]);

  return (
    <>
      <TopBar title="Task Board" />
      <PageShell>
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
          <TaskBoardSelectors
            projects={projects}
            modules={modules}
            selectedProject={selectedProject}
            selectedModule={selectedModule}
            progress={moduleProgress ?? undefined}
          />

          <TaskBoardClient
            tasks={tasks}
            completedIdList={Array.from(completedIdsSet)}
            projectName={selectedProject}
            moduleId={selectedModule === "all" ? modules[0]?.id ?? "" : selectedModule}
            pagination={taskPagination ?? undefined}
          />
        </div>
      </PageShell>
    </>
  );
}
