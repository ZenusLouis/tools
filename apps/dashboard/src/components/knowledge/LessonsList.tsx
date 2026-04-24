"use client";

import type { Lesson } from "@/lib/knowledge";
import { LessonCard } from "./LessonCard";

interface Props {
  lessons: Lesson[];
  search: string;
  filterFramework: string;
}

export function LessonsList({ lessons, search, filterFramework }: Props) {
  const q = search.toLowerCase();
  const filtered = lessons.filter((l) => {
    const matchFramework = filterFramework === "all" || l.framework === filterFramework;
    const matchSearch = !q || l.text.toLowerCase().includes(q) || l.framework.toLowerCase().includes(q);
    return matchFramework && matchSearch;
  });

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
    <div className="flex flex-col gap-5">
      {[...grouped.entries()].map(([framework, items]) => (
        <div key={framework}>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 flex items-center gap-2">
            <span className="rounded px-2 py-0.5 bg-accent/10 text-accent">{framework}</span>
            <span>{items.length} lesson{items.length !== 1 ? "s" : ""}</span>
          </h3>
          <div className="flex flex-col gap-1.5">
            {items.map((lesson) => (
              <LessonCard key={`${lesson.framework}-${lesson.text}-${lesson.date}`} lesson={lesson} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
