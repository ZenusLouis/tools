import type { KanbanTask, TaskStatus } from "@/lib/tasks";
import { AddTaskForm } from "./AddTaskForm";
import { TaskCard } from "./TaskCard";

const COLUMNS: { status: TaskStatus; label: string; accentClass: string; dot: string }[] = [
  { status: "pending", label: "PENDING", accentClass: "border-t-pending", dot: "bg-pending" },
  { status: "in-progress", label: "IN PROGRESS", accentClass: "border-t-in-progress", dot: "bg-in-progress" },
  { status: "completed", label: "COMPLETED", accentClass: "border-t-done", dot: "bg-done" },
  { status: "blocked", label: "BLOCKED", accentClass: "border-t-blocked", dot: "bg-blocked" },
];

export type AddTaskConfig = { projectName: string; moduleId: string };

function KanbanColumn({
  status,
  label,
  accentClass,
  dot,
  tasks,
  completedIds,
  selectedTaskId,
  onTaskClick,
  addTaskConfig,
}: {
  status: TaskStatus;
  label: string;
  accentClass: string;
  dot: string;
  tasks: KanbanTask[];
  completedIds: Set<string>;
  selectedTaskId?: string | null;
  onTaskClick?: (task: KanbanTask) => void;
  addTaskConfig?: AddTaskConfig;
}) {
  return (
    <div className={`flex min-h-96 flex-col rounded-xl border border-t-2 bg-card ${accentClass}`}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">{label}</span>
        <span className="ml-auto rounded-full bg-border px-1.5 py-0.5 text-xs font-semibold leading-none tabular-nums text-text-muted">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        {tasks.length === 0 && !addTaskConfig && (
          <p className="mt-6 text-center text-xs text-text-muted opacity-40">--</p>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            completedIds={completedIds}
            isSelected={selectedTaskId === task.id}
            onClick={() => onTaskClick?.(task)}
          />
        ))}
        {status === "pending" && addTaskConfig && (
          <div className="mt-auto pt-2">
            <AddTaskForm projectName={addTaskConfig.projectName} moduleId={addTaskConfig.moduleId} />
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  completedIds,
  selectedTaskId,
  onTaskClick,
  addTaskConfig,
}: {
  tasks: KanbanTask[];
  completedIds: Set<string>;
  selectedTaskId?: string | null;
  onTaskClick?: (task: KanbanTask) => void;
  addTaskConfig?: AddTaskConfig;
}) {
  const byStatus = (status: TaskStatus) => tasks.filter((task) => task.status === status);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {COLUMNS.map((column) => (
        <div key={column.status} className="min-w-[290px] flex-1">
          <KanbanColumn
            {...column}
            tasks={byStatus(column.status)}
            completedIds={completedIds}
            selectedTaskId={selectedTaskId}
            onTaskClick={onTaskClick}
            addTaskConfig={addTaskConfig}
          />
        </div>
      ))}
    </div>
  );
}
