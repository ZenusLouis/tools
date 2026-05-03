"use client";

import { useState, useTransition } from "react";
import { Loader2, Play, TerminalSquare } from "lucide-react";
import { useRouter } from "next/navigation";

export function RunProjectTaskButton({
  projectName,
  compact = false,
  queue = false,
}: {
  projectName: string;
  compact?: boolean;
  queue?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openNextTask() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/run-next`, { cache: "no-store" });
      const body = await res.json().catch(() => ({})) as { task?: { id: string } | null; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Failed to find next task.");
        return;
      }
      if (!body.task?.id) {
        setError("No pending or active task found.");
        return;
      }
      if (queue) {
        const runRes = await fetch(`/api/tasks/${encodeURIComponent(body.task.id)}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phase: "implementation" }),
        });
        if (!runRes.ok) {
          const runBody = await runRes.json().catch(() => ({})) as { error?: string };
          setError(runBody.error ?? "Failed to queue next task.");
          return;
        }
      }
      router.push(`/tasks/${encodeURIComponent(body.task.id)}`);
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={openNextTask}
        disabled={pending}
        className={compact
          ? "inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          : "inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"}
        title={queue ? "Queue and open the active or next pending task" : "Open the active or next pending task"}
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : compact ? <Play size={13} fill="currentColor" /> : <TerminalSquare size={13} />}
        {compact ? "Run" : queue ? "Run Next" : "Run Task"}
      </button>
      {error && (
        <span className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-blocked/30 bg-bg-base px-3 py-2 text-xs text-blocked shadow-xl">
          {error}
        </span>
      )}
    </span>
  );
}
