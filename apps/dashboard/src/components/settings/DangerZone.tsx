"use client";

import { useState } from "react";
import { removeProject } from "@/app/(app)/projects/[name]/settings/actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DangerZone({ projectName }: { projectName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleRemove() {
    setPending(true);
    await removeProject(projectName);
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-blocked/40 bg-card p-6">
      <h2 className="text-sm font-semibold text-blocked">Danger Zone</h2>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-text">Remove project from registry</p>
          <p className="mt-0.5 text-xs text-text-muted">Removes from dashboard only. It does not delete any files on disk.</p>
        </div>
        <button type="button" onClick={() => setConfirming(true)} disabled={pending} className="rounded-lg border border-blocked/40 px-4 py-2 text-sm text-blocked transition-colors hover:bg-blocked/10 disabled:opacity-50">
          {pending ? "Removing..." : "Remove Project"}
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Remove project?"
        description={
          <>
            Remove <span className="font-semibold text-text">{projectName}</span> from the dashboard registry. This does not delete files on any local device.
          </>
        }
        confirmLabel="Remove Project"
        pending={pending}
        onClose={() => {
          if (!pending) setConfirming(false);
        }}
        onConfirm={handleRemove}
      />
    </section>
  );
}
