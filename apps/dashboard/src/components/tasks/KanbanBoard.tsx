import type { KanbanTask, TaskStatus } from "@/lib/tasks";
import { TaskCard } from "./TaskCard";
import { AddTaskForm } from "./AddTaskForm";

const COLUMNS: { status: TaskStatus; label: string; accentClass: string; dot: string; count?: number }[] = [
  { status: "pending",     label: "PENDING",     accentClass: "border-t-pending",     dot: "bg-pending" },
  { status: "in-progress", label: "IN PROGRESS", accentClass: "border-t-in-progress", dot: "bg-in-progress" },
  { status: "completed",   label: "COMPLETED",   accentClass: "border-t-done",        dot: "bg-done" },
  { status: "blocked",     label: "BLOCKED",     accentClass: "border-t-blocked",     dot: "bg-blocked" },
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
    <div className={`flex flex-col rounded-xl border border-t-2 ${accentClass} bg-card min-h-96`}>
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span className={`h-2 w-2 rounded-full ${dot} shrink-0`} />
        <span className="text-[11px] font-bold tracking-widest text-text-muted uppercase">{label}</span>
        <span className="ml-auto text-xs tabular-nums font-semibold text-text-muted bg-border rounded-full px-1.5 py-0.5 leading-none">
          {tasks.length}
        </span>
      </div>

      {/* Tasks */}
      <div className="flex flex-col gap-2 p-2.5 flex-1">
        {tasks.length === 0 && !addTaskConfig && (
          <p className="text-xs text-text-muted text-center mt-6 opacity-40">—</p>
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
  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.status}
          {...col}
          tasks={byStatus(col.status)}
          completedIds={completedIds}
          selectedTaskId={selectedTaskId}
          onTaskClick={onTaskClick}
          addTaskConfig={addTaskConfig}
        />
      ))}
    </div>
  );
}
