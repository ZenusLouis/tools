"use client";

import { useState, useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";

type ProjectTarget = {
  name: string;
  activeTask: string | null;
  totalTasks: number;
  completedTasks: number;
};

export function RunDashboardTaskButton({ projects }: { projects: ProjectTarget[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function runNext() {
    setError(null);
    startTransition(async () => {
      const target = projects.find((project) => project.activeTask)
        ?? projects.find((project) => project.totalTasks > project.completedTasks)
        ?? projects[0];
      if (!target) {
        setError("No project available.");
        return;
      }

      const nextRes = await fetch(`/api/projects/${encodeURIComponent(target.name)}/run-next`, { cache: "no-store" });
      const nextBody = await nextRes.json().catch(() => ({})) as { task?: { id: string } | null; error?: string };
      if (!nextRes.ok || !nextBody.task?.id) {
        setError(nextBody.error ?? "No runnable task found.");
        return;
      }

      const runRes = await fetch(`/api/tasks/${encodeURIComponent(nextBody.task.id)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "implementation" }),
      });
      if (!runRes.ok) {
        const runBody = await runRes.json().catch(() => ({})) as { error?: string };
        setError(runBody.error ?? "Failed to queue task.");
        return;
      }
      router.push(`/tasks/${encodeURIComponent(nextBody.task.id)}`);
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={runNext}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text transition-colors hover:border-text-muted hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
        {pending ? "Queueing..." : "Run Task"}
      </button>
      {error && (
        <span className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-blocked/30 bg-bg-base px-3 py-2 text-xs text-blocked shadow-xl">
          {error}
        </span>
      )}
    </span>
  );
}
