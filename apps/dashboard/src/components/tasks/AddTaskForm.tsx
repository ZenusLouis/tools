"use client";

import { useState, useTransition, useRef } from "react";
import { Plus } from "lucide-react";
import { addTask } from "@/app/actions/tasks";

interface Props {
  projectName: string;
  moduleId: string;
}

export function AddTaskForm({ projectName, moduleId }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleCancel() {
    setOpen(false);
    setValue("");
    setError(null);
  }

  function handleSubmit() {
    if (!value.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addTask(projectName, moduleId, value);
      if (!result.ok) {
        setError(result.error ?? "Error");
      } else {
        setValue("");
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 w-full rounded-lg border border-dashed border-border px-3 py-2 text-xs text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add task
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-accent/40 bg-card-hover p-2 flex flex-col gap-2">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") handleCancel(); }}
        placeholder="Task name…"
        className="w-full rounded bg-card px-2 py-1.5 text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        disabled={isPending}
      />
      {error && <p className="text-[10px] text-blocked">{error}</p>}
      <div className="flex gap-1.5">
        <button
          onClick={handleSubmit}
          disabled={isPending || !value.trim()}
          className="flex-1 rounded bg-accent/15 text-accent text-[11px] font-medium py-1 hover:bg-accent/25 transition-colors disabled:opacity-40"
        >
          Save
        </button>
        <button
          onClick={handleCancel}
          className="flex-1 rounded bg-border text-text-muted text-[11px] font-medium py-1 hover:text-text transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
