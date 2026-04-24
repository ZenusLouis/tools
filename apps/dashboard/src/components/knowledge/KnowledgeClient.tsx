"use client";

import { useState } from "react";
import type { Lesson, ProjectDecisions } from "@/lib/knowledge";
import { LessonsList } from "./LessonsList";
import { AddLessonForm } from "./AddLessonForm";
import { DecisionLog } from "./DecisionLog";

type Tab = "lessons" | "decisions";

interface Props {
  lessons: Lesson[];
  frameworks: string[];
  projectDecisions: ProjectDecisions[];
  projectNames: string[];
}

export function KnowledgeClient({ lessons, frameworks, projectDecisions, projectNames }: Props) {
  const [tab, setTab] = useState<Tab>("lessons");
  const [search, setSearch] = useState("");
  const [filterFramework, setFilterFramework] = useState("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");

  const TABS: { key: Tab; label: string }[] = [
    { key: "lessons", label: "Global Lessons" },
    { key: "decisions", label: "Project Decisions" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}

        {/* Project dropdown (decisions tab only) */}
        {tab === "decisions" && (
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="ml-auto rounded-lg border bg-bg-base px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent text-text"
          >
            <option value="all">All Projects</option>
            {projectNames.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
      </div>

      {tab === "lessons" && (
        <>
          {/* Search + filter */}
          <div className="flex gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lessons…"
              className="flex-1 rounded-lg border bg-bg-base px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted"
            />
            <select
              value={filterFramework}
              onChange={(e) => setFilterFramework(e.target.value)}
              className="rounded-lg border bg-bg-base px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent text-text min-w-[140px]"
            >
              <option value="all">All Frameworks</option>
              {frameworks.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <LessonsList
            lessons={lessons}
            search={search}
            filterFramework={filterFramework}
          />

          <AddLessonForm frameworks={frameworks} />
        </>
      )}

      {tab === "decisions" && (
        <DecisionLog
          allDecisions={projectDecisions}
          selectedProject={selectedProject}
        />
      )}
    </div>
  );
}
