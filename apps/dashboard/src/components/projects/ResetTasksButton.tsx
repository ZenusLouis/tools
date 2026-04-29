"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-text-muted hover:border-blocked/40 hover:text-blocked transition-colors"
      >
        {pending ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
        Reset
      </button>
      <ConfirmDialog
        open={confirming}
        title="Reset project backlog?"
        description={
          <>
            Delete all generated modules, features, and tasks for <span className="font-semibold text-text">{projectName}</span>. Project settings and source paths stay intact.
          </>
        }
        confirmLabel="Reset Backlog"
        pending={pending}
        onClose={() => {
          if (!pending) setConfirming(false);
        }}
        onConfirm={reset}
      />
    </>
  );
}
