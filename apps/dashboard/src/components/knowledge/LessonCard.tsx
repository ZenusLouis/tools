"use client";

import { useState, useTransition, useRef } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import type { Lesson } from "@/lib/knowledge";
import { editLessonAction, deleteLessonAction } from "@/app/(app)/knowledge/actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface Props {
  lesson: Lesson;
  isSelected?: boolean;
  onSelect?: (lesson: Lesson) => void;
}

export function LessonCard({ lesson, isSelected = false, onSelect }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editText, setEditText] = useState(lesson.text);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setEditing(true);
    setEditText(lesson.text);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditing(false);
    setEditText(lesson.text);
  }

  function saveEdit() {
    if (!editText.trim() || editText.trim() === lesson.text) { cancelEdit(); return; }
    const fd = new FormData();
    fd.set("original", JSON.stringify(lesson));
    fd.set("text", editText.trim());
    startTransition(async () => {
      await editLessonAction(null, fd);
      setEditing(false);
    });
  }

  function confirmAndDelete() {
    const fd = new FormData();
    fd.set("lesson", JSON.stringify(lesson));
    startTransition(async () => {
      await deleteLessonAction(null, fd);
    });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!editing && !confirmDelete) onSelect?.(lesson);
      }}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !editing && !confirmDelete) onSelect?.(lesson);
      }}
      className={`group flex items-start gap-2 rounded-lg border bg-card px-3.5 py-2.5 transition-all hover:border-border/80 hover:bg-card-hover/40 ${
        isSelected ? "border-accent/60 ring-1 ring-accent/20" : "border-border"
      } ${isPending ? "opacity-50" : ""}`}
    >
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            className="w-full text-sm bg-bg-base border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <p className="text-sm leading-snug"
             dangerouslySetInnerHTML={{
               __html: lesson.text
                 .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                 .replace(/`(.+?)`/g, '<code class="font-mono text-accent text-[11px] bg-accent/10 px-1 rounded">$1</code>')
             }}
          />
        )}
        {lesson.date && !editing && (
          <span className="text-[10px] text-text-muted mt-0.5 block">{lesson.date}</span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <button onClick={(event) => { event.stopPropagation(); saveEdit(); }} disabled={isPending} className="text-done hover:text-done/80 p-1 rounded transition-colors">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={(event) => { event.stopPropagation(); cancelEdit(); }} className="text-text-muted hover:text-text p-1 rounded transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(event) => { event.stopPropagation(); startEdit(); }} className="text-text-muted hover:text-accent p-1 rounded transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={(event) => { event.stopPropagation(); setConfirmDelete(true); }} className="text-text-muted hover:text-blocked p-1 rounded transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete lesson?"
        description="Delete this knowledge lesson from the current workspace. This action cannot be undone."
        confirmLabel="Delete Lesson"
        pending={isPending}
        onClose={() => {
          if (!isPending) setConfirmDelete(false);
        }}
        onConfirm={confirmAndDelete}
      />
    </div>
  );
}
