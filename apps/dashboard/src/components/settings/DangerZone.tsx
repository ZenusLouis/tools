"use client";

import { useState } from "react";
import { removeProject } from "@/app/(app)/projects/[name]/settings/actions";

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
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-blocked/40 px-4 py-2 text-sm text-blocked transition-colors hover:bg-blocked/10">
            Remove Project
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Are you sure?</span>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text transition-colors hover:bg-card-hover">Cancel</button>
            <button type="button" onClick={handleRemove} disabled={pending} className="rounded-lg bg-blocked px-3 py-1.5 text-xs text-white transition-colors hover:bg-blocked/80 disabled:opacity-50">
              {pending ? "Removing..." : "Confirm Remove"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
