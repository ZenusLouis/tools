"use client";

import { useMemo, useState } from "react";
import { BookOpen, Calendar, Tag } from "lucide-react";
import type { Lesson } from "@/lib/knowledge";
import { LessonCard } from "./LessonCard";

interface Props {
  lessons: Lesson[];
  search: string;
  filterFramework: string;
}

export function LessonsList({ lessons, search, filterFramework }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const q = search.toLowerCase();
  const filtered = lessons.filter((l) => {
    const matchFramework = filterFramework === "all" || l.framework === filterFramework;
    const matchSearch = !q || l.text.toLowerCase().includes(q) || l.framework.toLowerCase().includes(q);
    return matchFramework && matchSearch;
  });

  const selectedLesson = useMemo(() => {
    return filtered.find((lesson) => lessonKey(lesson) === selectedKey) ?? filtered[0] ?? null;
  }, [filtered, selectedKey]);

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-text-muted py-4 text-center">
        {lessons.length === 0 ? "No lessons yet. Add the first one below." : "No lessons match your filters."}
      </p>
    );
  }

  // Group by framework
  const grouped = new Map<string, Lesson[]>();
  for (const lesson of filtered) {
    if (!grouped.has(lesson.framework)) grouped.set(lesson.framework, []);
    grouped.get(lesson.framework)!.push(lesson);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-5">
        {[...grouped.entries()].map(([framework, items]) => (
          <div key={framework}>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 flex items-center gap-2">
              <span className="rounded px-2 py-0.5 bg-accent/10 text-accent">{framework}</span>
              <span>{items.length} lesson{items.length !== 1 ? "s" : ""}</span>
            </h3>
            <div className="flex flex-col gap-1.5">
              {items.map((lesson) => {
                const key = lessonKey(lesson);
                return (
                  <LessonCard
                    key={key}
                    lesson={lesson}
                    isSelected={selectedLesson ? lessonKey(selectedLesson) === key : false}
                    onSelect={() => setSelectedKey(key)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedLesson && (
        <aside className="h-fit rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              <BookOpen size={18} className="text-accent" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Lesson Detail</p>
              <h3 className="text-lg font-bold text-text">{selectedLesson.framework}</h3>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-bg-base p-4">
            <p
              className="text-sm leading-relaxed text-text"
              dangerouslySetInnerHTML={{
                __html: selectedLesson.text
                  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                  .replace(/`(.+?)`/g, '<code class="font-mono text-accent text-[11px] bg-accent/10 px-1 rounded">$1</code>')
              }}
            />
          </div>
          <div className="mt-4 grid gap-2 text-xs text-text-muted">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-base p-3">
              <Tag size={13} className="text-accent" />
              <span>{selectedLesson.framework}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-base p-3">
              <Calendar size={13} className="text-accent" />
              <span>{selectedLesson.date ?? "No date metadata"}</span>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function lessonKey(lesson: Lesson) {
  return `${lesson.framework}-${lesson.text}-${lesson.date ?? ""}`;
}
