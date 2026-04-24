"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { addLessonAction } from "@/app/(app)/knowledge/actions";

interface Props {
  frameworks: string[];
}

export function AddLessonForm({ frameworks }: Props) {
  const [open, setOpen] = useState(false);
  const [customFramework, setCustomFramework] = useState("");
  const [selectedFramework, setSelectedFramework] = useState("_custom");
  const [state, formAction, isPending] = useActionState(addLessonAction, null);

  const effectiveFramework = selectedFramework === "_custom" ? customFramework : selectedFramework;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-text-muted hover:border-accent hover:text-accent transition-colors w-full"
      >
        <Plus className="h-4 w-4" />
        Add lesson
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        fd.set("framework", effectiveFramework);
        await formAction(fd);
        if (!state?.error) {
          setOpen(false);
          setCustomFramework("");
          setSelectedFramework("_custom");
        }
      }}
      className="rounded-lg border bg-card p-4 flex flex-col gap-3"
    >
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">New Lesson</p>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-text-muted">Framework / Category</label>
        <div className="flex gap-2">
          <select
            value={selectedFramework}
            onChange={(e) => setSelectedFramework(e.target.value)}
            className="rounded-lg border bg-bg-base px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent text-text"
          >
            <option value="_custom">Custom…</option>
            {frameworks.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          {selectedFramework === "_custom" && (
            <input
              type="text"
              value={customFramework}
              onChange={(e) => setCustomFramework(e.target.value)}
              placeholder="e.g. React"
              className="flex-1 rounded-lg border bg-bg-base px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-text-muted">Lesson text</label>
        <input
          name="text"
          type="text"
          required
          placeholder="Use **bold** and `code` formatting"
          className="rounded-lg border bg-bg-base px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted"
        />
      </div>

      {state?.error && <p className="text-xs text-blocked">{state.error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-card-hover transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !effectiveFramework.trim()}
          className="rounded-lg bg-accent text-white text-xs font-semibold px-4 py-1.5 hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : "Save Lesson"}
        </button>
      </div>
    </form>
  );
}
