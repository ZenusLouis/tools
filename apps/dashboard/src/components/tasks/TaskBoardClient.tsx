"use client";

import { useState, useMemo } from "react";
import { KanbanBoard, type AddTaskConfig } from "./KanbanBoard";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { FilterBar } from "./FilterBar";
import type { KanbanTask, TaskStatus } from "@/lib/tasks";

interface Props {
  tasks: KanbanTask[];
  completedIdList: string[];
  projectName: string;
  moduleId: string;
}

export function TaskBoardClient({ tasks, completedIdList, projectName, moduleId }: Props) {
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [featureFilter, setFeatureFilter] = useState<string>("all");

  const completedIds = useMemo(() => new Set(completedIdList), [completedIdList]);

  const features = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.featureId))).sort(),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (featureFilter !== "all" && t.featureId !== featureFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, featureFilter]);

  const addTaskConfig: AddTaskConfig = { projectName, moduleId };

  return (
    <>
      <FilterBar
        statusFilter={statusFilter}
        featureFilter={featureFilter}
        features={features}
        onStatusChange={setStatusFilter}
        onFeatureChange={setFeatureFilter}
      />
      <KanbanBoard
        tasks={filteredTasks}
        completedIds={completedIds}
        selectedTaskId={selectedTask?.id ?? null}
        onTaskClick={setSelectedTask}
        addTaskConfig={addTaskConfig}
      />
      <TaskDetailPanel
        task={selectedTask}
        projectName={projectName}
        completedIds={completedIds}
        onClose={() => setSelectedTask(null)}
      />
    </>
  );
}
