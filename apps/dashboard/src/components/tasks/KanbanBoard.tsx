import type { KanbanTask, TaskStatus } from "@/lib/tasks";
import { AddTaskForm } from "./AddTaskForm";
import { TaskCard } from "./TaskCard";
import { useState } from "react";

const COLUMNS: { status: TaskStatus; label: string; accentClass: string; dot: string }[] = [
  { status: "pending", label: "PENDING", accentClass: "border-t-pending", dot: "bg-pending" },
  { status: "in-progress", label: "IN PROGRESS", accentClass: "border-t-in-progress", dot: "bg-in-progress" },
  { status: "completed", label: "COMPLETED", accentClass: "border-t-done", dot: "bg-done" },
  { status: "blocked", label: "BLOCKED", accentClass: "border-t-blocked", dot: "bg-blocked" },
];
const INITIAL_VISIBLE = 6;
const PAGE_SIZE = 6;

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
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [showAll, setShowAll] = useState(false);
  const visibleTasks = showAll ? tasks : tasks.slice(0, visibleCount);
  const hasHidden = visibleTasks.length < tasks.length;

  return (
    <div className={`flex min-h-96 max-h-[calc(100dvh-18rem)] flex-col rounded-xl border border-t-2 bg-card ${accentClass}`}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">{label}</span>
        <span className="ml-auto rounded-full bg-border px-1.5 py-0.5 text-xs font-semibold leading-none tabular-nums text-text-muted">
          {tasks.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {tasks.length === 0 && !addTaskConfig && (
          <p className="mt-6 text-center text-xs text-text-muted opacity-40">--</p>
        )}
        <div className="flex flex-col gap-2">
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              completedIds={completedIds}
              isSelected={selectedTaskId === task.id}
              onClick={() => onTaskClick?.(task)}
            />
          ))}
        </div>
        {tasks.length > INITIAL_VISIBLE && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {hasHidden ? (
              <>
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, tasks.length))}
                  className="rounded-lg border border-border bg-bg-base px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:bg-card-hover hover:text-text"
                >
                  Load more
                </button>
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
                >
                  Show all
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowAll(false);
                  setVisibleCount(INITIAL_VISIBLE);
                }}
                className="col-span-2 rounded-lg border border-border bg-bg-base px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:bg-card-hover hover:text-text"
              >
                Collapse to {INITIAL_VISIBLE}
              </button>
            )}
          </div>
        )}
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
