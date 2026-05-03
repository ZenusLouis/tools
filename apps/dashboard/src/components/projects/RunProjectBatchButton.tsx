"use client";

import { useState, useTransition } from "react";
import { Layers3, Loader2 } from "lucide-react";

type TaskRef = { id: string };

async function queueTask(taskId: string) {
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase: "implementation" }),
  });
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Failed to queue ${taskId}.`);
}

export function RunProjectBatchButton({ projectName, limit = 3 }: { projectName: string; limit?: number }) {
  const [pending, startTransition] = useTransition();
  const [queued, setQueued] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function queueBatch() {
    setError(null);
    setQueued(null);
    startTransition(async () => {
      try {
        const firstRes = await fetch(`/api/projects/${encodeURIComponent(projectName)}/run-next`, { cache: "no-store" });
        const firstBody = await firstRes.json().catch(() => ({})) as { task?: TaskRef | null; error?: string };
        if (!firstRes.ok) throw new Error(firstBody.error ?? "Failed to find next task.");
        if (!firstBody.task?.id) throw new Error("No pending or active task found.");

        const tasks: TaskRef[] = [firstBody.task];
        if (limit > 1) {
          const nextRes = await fetch(`/api/tasks/${encodeURIComponent(firstBody.task.id)}/next-batch?limit=${Math.max(limit - 1, 1)}`, { cache: "no-store" });
          const nextBody = await nextRes.json().catch(() => ({})) as { tasks?: TaskRef[]; error?: string };
          if (!nextRes.ok) throw new Error(nextBody.error ?? "Failed to find next tasks.");
          for (const task of nextBody.tasks ?? []) {
            if (!tasks.some((item) => item.id === task.id)) tasks.push(task);
          }
        }

        for (const task of tasks.slice(0, limit)) {
          await queueTask(task.id);
        }
        setQueued(Math.min(tasks.length, limit));
        window.dispatchEvent(new Event("gcs-run-queue-refresh"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to queue task batch.");
      }
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={queueBatch}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-xs font-bold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
        title={`Queue the next ${limit} pending tasks without leaving this project`}
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Layers3 size={13} />}
        Run Next {limit}
      </button>
      {(error || queued !== null) && (
        <span className={`absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border px-3 py-2 text-xs shadow-xl ${
          error ? "border-blocked/30 bg-bg-base text-blocked" : "border-done/30 bg-bg-base text-done"
        }`}>
          {error ?? `Queued ${queued} task${queued === 1 ? "" : "s"}.`}
        </span>
      )}
    </span>
  );
}
