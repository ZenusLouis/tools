"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

export function ResetTasksButton({ projectName }: { projectName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function reset() {
    startTransition(async () => {
      await fetch(`/api/projects/${encodeURIComponent(projectName)}/tasks`, { method: "DELETE" });
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[10px] text-text-muted">Delete all tasks?</span>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg bg-blocked/10 border border-blocked/30 px-2 py-1 text-[10px] font-bold text-blocked hover:bg-blocked/20 disabled:opacity-50"
        >
          {pending ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-[10px] text-text-muted hover:text-text"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-text-muted hover:border-blocked/40 hover:text-blocked transition-colors"
    >
      <Trash2 size={10} />
      Reset
    </button>
  );
}
