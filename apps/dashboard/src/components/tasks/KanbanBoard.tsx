"use client";

import { useCallback, useOptimistic, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { KanbanTask, TaskPagination, TaskStatus } from "@/lib/tasks";
import { AddTaskForm } from "./AddTaskForm";
import { TaskCard } from "./TaskCard";

const COLUMNS: { status: TaskStatus; label: string; accentClass: string; dot: string; pageParam: string; showParam: string }[] = [
  { status: "pending", label: "PENDING", accentClass: "border-t-pending", dot: "bg-pending", pageParam: "pendingPage", showParam: "pendingShow" },
  { status: "in-progress", label: "IN PROGRESS", accentClass: "border-t-in-progress", dot: "bg-in-progress", pageParam: "inProgressPage", showParam: "inProgressShow" },
  { status: "completed", label: "COMPLETED", accentClass: "border-t-done", dot: "bg-done", pageParam: "completedPage", showParam: "completedShow" },
  { status: "blocked", label: "BLOCKED", accentClass: "border-t-blocked", dot: "bg-blocked", pageParam: "blockedPage", showParam: "blockedShow" },
];

export type AddTaskConfig = { projectName: string; moduleId: string };

function KanbanColumn({
  status,
  label,
  accentClass,
  dot,
  pageParam,
  showParam,
  tasks,
  pageInfo,
  completedIds,
  selectedTaskId,
  onTaskClick,
  addTaskConfig,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  status: TaskStatus;
  label: string;
  accentClass: string;
  dot: string;
  pageParam: string;
  showParam: string;
  tasks: KanbanTask[];
  pageInfo?: TaskPagination[TaskStatus];
  completedIds: Set<string>;
  selectedTaskId?: string | null;
  onTaskClick?: (task: KanbanTask) => void;
  addTaskConfig?: AddTaskConfig;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetStatus: TaskStatus) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pushPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(pageParam, String(nextPage));
    params.delete(showParam);
    router.push(`${pathname}?${params.toString()}`);
  }

  function pushShowAll(showAll: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (showAll) params.set(showParam, "all");
    else {
      params.delete(showParam);
      params.set(pageParam, "1");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      className={`flex min-h-96 max-h-[calc(100dvh-18rem)] flex-col rounded-xl border border-t-2 bg-card transition-colors ${accentClass} ${isDragOver ? "border-accent/60 bg-accent/5 ring-1 ring-accent/30" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, status)}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">{label}</span>
        <span className="ml-auto rounded-full bg-border px-1.5 py-0.5 text-xs font-semibold leading-none tabular-nums text-text-muted">
          {pageInfo?.total ?? tasks.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {tasks.length === 0 && !addTaskConfig && (
          <p className={`mt-6 text-center text-xs text-text-muted ${isDragOver ? "opacity-60" : "opacity-40"}`}>
            {isDragOver ? "Drop here" : "--"}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("taskId", task.id);
                e.dataTransfer.setData("fromStatus", task.status);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="cursor-grab active:cursor-grabbing"
            >
              <TaskCard
                task={task}
                completedIds={completedIds}
                isSelected={selectedTaskId === task.id}
                onClick={() => onTaskClick?.(task)}
              />
            </div>
          ))}
        </div>
        {pageInfo && pageInfo.total > pageInfo.pageSize && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {pageInfo.showAll ? (
              <button
                type="button"
                onClick={() => pushShowAll(false)}
                className="col-span-2 rounded-lg border border-border bg-bg-base px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:bg-card-hover hover:text-text"
              >
                Back to pages
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => pushPage(Math.max(1, pageInfo.page - 1))}
                  disabled={pageInfo.page <= 1}
                  className="rounded-lg border border-border bg-bg-base px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:bg-card-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => pushPage(Math.min(pageInfo.totalPages, pageInfo.page + 1))}
                  disabled={pageInfo.page >= pageInfo.totalPages}
                  className="rounded-lg border border-border bg-bg-base px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:bg-card-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => pushShowAll(true)}
                  className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
                >
                  Show all
                </button>
                <span className="rounded-lg border border-border bg-bg-base px-3 py-2 text-center text-xs font-semibold text-text-muted">
                  {pageInfo.page}/{pageInfo.totalPages}
                </span>
              </>
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
  pagination,
}: {
  tasks: KanbanTask[];
  completedIds: Set<string>;
  selectedTaskId?: string | null;
  onTaskClick?: (task: KanbanTask) => void;
  addTaskConfig?: AddTaskConfig;
  pagination?: TaskPagination;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [optimisticTasks, applyOptimistic] = useOptimistic(
    tasks,
    (prev, { taskId, newStatus }: { taskId: string; newStatus: TaskStatus }) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
  );
  const dragCounter = useRef<Partial<Record<TaskStatus, number>>>({});

  const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  }, []);

  const handleDragEnter = useCallback((status: TaskStatus) => {
    dragCounter.current[status] = (dragCounter.current[status] ?? 0) + 1;
    setDragOverStatus(status);
  }, []);

  const handleDragLeave = useCallback((status: TaskStatus) => {
    dragCounter.current[status] = Math.max(0, (dragCounter.current[status] ?? 1) - 1);
    if (dragCounter.current[status] === 0) {
      setDragOverStatus((prev) => (prev === status ? null : prev));
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetStatus: TaskStatus) => {
      e.preventDefault();
      setDragOverStatus(null);
      dragCounter.current = {};
      const taskId = e.dataTransfer.getData("taskId");
      const fromStatus = e.dataTransfer.getData("fromStatus") as TaskStatus;
      if (!taskId || fromStatus === targetStatus) return;

      startTransition(async () => {
        applyOptimistic({ taskId, newStatus: targetStatus });
        await fetch(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });
        router.refresh();
      });
    },
    [applyOptimistic, router],
  );

  const byStatus = (status: TaskStatus) => optimisticTasks.filter((t) => t.status === status);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {COLUMNS.map((column) => (
        <div
          key={column.status}
          className="min-w-72.5 flex-1"
          onDragEnter={() => handleDragEnter(column.status)}
        >
          <KanbanColumn
            {...column}
            tasks={byStatus(column.status)}
            pageInfo={pagination?.[column.status]}
            completedIds={completedIds}
            selectedTaskId={selectedTaskId}
            onTaskClick={onTaskClick}
            addTaskConfig={addTaskConfig}
            isDragOver={dragOverStatus === column.status}
            onDragOver={(e) => handleDragOver(e, column.status)}
            onDragLeave={() => handleDragLeave(column.status)}
            onDrop={handleDrop}
          />
        </div>
      ))}
    </div>
  );
}
