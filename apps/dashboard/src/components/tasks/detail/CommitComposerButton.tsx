"use client";

import { useState } from "react";
import { GitCommit } from "lucide-react";
import { CommitComposerModal } from "@/components/tasks/CommitComposerModal";
import type { FileChange } from "@/lib/task-detail";

export function CommitComposerButton({
  taskId,
  taskName,
  projectName,
  files,
  agentName,
}: {
  taskId: string;
  taskName: string;
  projectName?: string;
  files: FileChange[];
  agentName?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
      >
        <GitCommit size={15} />
        Commit Composer
      </button>
      <CommitComposerModal
        open={open}
        taskId={taskId}
        taskName={taskName}
        projectName={projectName}
        files={files}
        agentName={agentName}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
