"use client";

import { useState } from "react";
import type { Lesson, ProjectDecisions } from "@/lib/knowledge";
import { AddLessonForm } from "./AddLessonForm";
import { DecisionLog } from "./DecisionLog";
import { LessonsList } from "./LessonsList";

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
  const [selectedProject, setSelectedProject] = useState("all");

  const tabs: { key: Tab; label: string }[] = [
    { key: "lessons", label: "Global Lessons" },
    { key: "decisions", label: "Project Decisions" },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              tab === item.key ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {item.label}
          </button>
        ))}

        {tab === "decisions" && (
          <select
            value={selectedProject}
            onChange={(event) => setSelectedProject(event.target.value)}
            className="ml-auto rounded-lg border border-border bg-bg-base px-3 py-1.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="all">All Projects</option>
            {projectNames.map((project) => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
        )}
      </div>

      {tab === "lessons" && (
        <>
          <div className="flex gap-3">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search lessons..."
              className="flex-1 rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <select
              value={filterFramework}
              onChange={(event) => setFilterFramework(event.target.value)}
              className="min-w-[160px] rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Frameworks</option>
              {frameworks.map((framework) => (
                <option key={framework} value={framework}>{framework}</option>
              ))}
            </select>
          </div>

          <LessonsList lessons={lessons} search={search} filterFramework={filterFramework} />
          <AddLessonForm frameworks={frameworks} />
        </>
      )}

      {tab === "decisions" && (
        <DecisionLog allDecisions={projectDecisions} selectedProject={selectedProject} />
      )}
    </div>
  );
}
