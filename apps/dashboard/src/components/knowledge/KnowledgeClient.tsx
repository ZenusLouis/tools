"use client";

import { useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import type { Lesson, ProjectDecisions } from "@/lib/knowledge";
import { AddLessonForm } from "./AddLessonForm";
import { DecisionLog } from "./DecisionLog";
import { LessonsList } from "./LessonsList";

type Tab = "lessons" | "decisions" | "memory";

type MemoryResult = {
  id: string;
  kind: string;
  projectName: string | null;
  title: string;
  excerpt: string;
  tags: string[];
  reqIds: string[];
};

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
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryResults, setMemoryResults] = useState<MemoryResult[]>([]);
  const [memoryStatus, setMemoryStatus] = useState<string | null>(null);
  const [memoryBusy, setMemoryBusy] = useState(false);

  const tabs: { key: Tab; label: string }[] = [
    { key: "lessons", label: "Global Lessons" },
    { key: "decisions", label: "Project Decisions" },
    { key: "memory", label: "Memory Graph" },
  ];

  async function refreshMemory() {
    setMemoryBusy(true);
    setMemoryStatus(null);
    try {
      const res = await fetch("/api/memory/refresh", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Refresh failed");
      setMemoryStatus(`Refreshed ${Number(body.result?.nodes ?? 0).toLocaleString()} memory nodes with 0 routing tokens.`);
    } catch (error) {
      setMemoryStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setMemoryBusy(false);
    }
  }

  async function searchMemory() {
    setMemoryBusy(true);
    setMemoryStatus(null);
    try {
      const params = new URLSearchParams();
      if (memoryQuery.trim()) params.set("q", memoryQuery.trim());
      if (selectedProject !== "all") params.set("project", selectedProject);
      const res = await fetch(`/api/memory/search?${params.toString()}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      setMemoryResults(Array.isArray(body.results) ? body.results : []);
      setMemoryStatus(`${Number(body.count ?? 0).toLocaleString()} related memories found. Routing tokens: ${body.routingTokens ?? 0}.`);
    } catch (error) {
      setMemoryStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setMemoryBusy(false);
    }
  }

  async function exportObsidian() {
    setMemoryBusy(true);
    setMemoryStatus(null);
    try {
      const res = await fetch("/api/memory/export-obsidian", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Export failed");
      setMemoryStatus(`Exported ${Number(body.result?.files ?? 0).toLocaleString()} Obsidian files to ${body.result?.vaultDir ?? ".gcs/obsidian"}.`);
    } catch (error) {
      setMemoryStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setMemoryBusy(false);
    }
  }

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

        {(tab === "decisions" || tab === "memory") && (
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

      {tab === "memory" && (
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-text">Zero-token Memory Graph</h2>
                <p className="mt-1 text-xs text-text-muted">
                  Builds related memories from lessons, decisions, tasks, run telemetry, and requirement IDs.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={refreshMemory}
                  disabled={memoryBusy}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text transition-colors hover:border-accent/50 disabled:opacity-60"
                >
                  <RefreshCw size={14} className={memoryBusy ? "animate-spin" : ""} />
                  Refresh graph
                </button>
                <button
                  onClick={exportObsidian}
                  disabled={memoryBusy}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text transition-colors hover:border-accent/50 disabled:opacity-60"
                >
                  <Download size={14} />
                  Export Obsidian
                </button>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={memoryQuery}
                onChange={(event) => setMemoryQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void searchMemory();
                }}
                placeholder="Search by task, module, reqId, keyword..."
                className="flex-1 rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                onClick={searchMemory}
                disabled={memoryBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                <Search size={15} />
                Search
              </button>
            </div>
            {memoryStatus && <p className="mt-3 text-xs text-text-muted">{memoryStatus}</p>}
          </section>

          {memoryResults.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
              <p className="text-sm font-bold text-text">No memory results loaded</p>
              <p className="mt-1 text-xs text-text-muted">Refresh the graph, then search by task, requirement ID, or project keyword.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {memoryResults.map((item) => (
                <article key={item.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold text-text">{item.title}</p>
                    <span className="rounded bg-bg-base px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">{item.kind}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{item.projectName ?? "workspace"}</p>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-text-muted">{item.excerpt}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {[...item.reqIds, ...item.tags.slice(0, 4)].map((tag) => (
                      <span key={tag} className="rounded bg-bg-base px-2 py-0.5 font-mono text-[10px] text-accent">{tag}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
