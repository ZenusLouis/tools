"use client";

import { useState } from "react";
import { removeProject } from "@/app/(app)/projects/[name]/settings/actions";

interface Props {
  projectName: string;
}

export function DangerZone({ projectName }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleRemove() {
    setPending(true);
    await removeProject(projectName);
  }

  return (
    <section className="rounded-xl border border-red-900/50 bg-card p-6 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text">Remove project from registry</p>
          <p className="text-xs text-text-muted mt-0.5">
            Removes from dashboard only — does not delete any files on disk.
          </p>
        </div>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-red-900/50 px-4 py-2 text-sm text-red-400 hover:bg-red-950/30 transition-colors"
          >
            Remove Project
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Are you sure?</span>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border px-3 py-1.5 text-xs text-text hover:bg-card-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-xs text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {pending ? "Removing…" : "Confirm Remove"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
