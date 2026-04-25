"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { addLessonAction } from "@/app/(app)/knowledge/actions";

export function AddLessonForm({ frameworks }: { frameworks: string[] }) {
  const [open, setOpen] = useState(false);
  const [customFramework, setCustomFramework] = useState("");
  const [selectedFramework, setSelectedFramework] = useState("_custom");
  const [state, formAction, isPending] = useActionState(addLessonAction, null);
  const effectiveFramework = selectedFramework === "_custom" ? customFramework : selectedFramework;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent">
        <Plus className="h-4 w-4" />
        Add lesson
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        formData.set("framework", effectiveFramework);
        await formAction(formData);
        if (!state?.error) {
          setOpen(false);
          setCustomFramework("");
          setSelectedFramework("_custom");
        }
      }}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">New Lesson</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-text-muted">Framework / Category</span>
        <div className="flex gap-2">
          <select value={selectedFramework} onChange={(event) => setSelectedFramework(event.target.value)} className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent">
            <option value="_custom">Custom</option>
            {frameworks.map((framework) => <option key={framework} value={framework}>{framework}</option>)}
          </select>
          {selectedFramework === "_custom" && (
            <input type="text" value={customFramework} onChange={(event) => setCustomFramework(event.target.value)} placeholder="e.g. React" className="flex-1 rounded-lg border border-border bg-bg-base px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent" />
          )}
        </div>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-text-muted">Lesson text</span>
        <input name="text" type="text" required placeholder="Use **bold** and `code` formatting" className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent" />
      </label>
      {state?.error && <p className="text-xs text-blocked">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-card-hover">Cancel</button>
        <button type="submit" disabled={isPending || !effectiveFramework.trim()} className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40">
          {isPending ? "Saving..." : "Save Lesson"}
        </button>
      </div>
    </form>
  );
}
