"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, GitBranch, RefreshCw, Search } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { TopBar } from "@/components/layout/TopBar";

type MemoryResult = {
  id: string;
  kind: string;
  projectName: string | null;
  title: string;
  excerpt: string;
  tags: string[];
  reqIds: string[];
  score?: number;
  reasons?: string[];
};

type ObsidianLogicProps = {
  stats: {
    nodes: number;
    edges: number;
    projects: number;
    requirements: number;
    skills: number;
    runs: number;
    kinds: Array<{ kind: string; count: number }>;
    recent: Array<{
      id: string;
      kind: string;
      title: string;
      projectName: string | null;
      updatedAt: string;
      reqIds: string[];
    }>;
  };
  projectNames: string[];
};

export function ObsidianLogicClient({ stats, projectNames }: ObsidianLogicProps) {
  const [project, setProject] = useState("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemoryResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshGraph() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/memory/refresh", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to refresh memory graph.");
      setMessage(`Refreshed ${Number(body.result?.nodes ?? 0).toLocaleString()} nodes and ${Number(body.result?.edges ?? 0).toLocaleString()} edges with 0 routing tokens.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function exportVault() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/memory/export-obsidian", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to export Obsidian vault.");
      setMessage(`Exported ${Number(body.result?.files ?? 0).toLocaleString()} files and ${Number(body.result?.edges ?? 0).toLocaleString()} edges to ${body.result?.vaultDir ?? ".gcs/obsidian"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function searchMemory() {
    setBusy(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (project !== "all") params.set("project", project);
      const res = await fetch(`/api/memory/search?${params.toString()}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to search memory graph.");
      const nextResults = Array.isArray(body.results) ? body.results : [];
      setResults(nextResults);
      setMessage(`${Number(body.count ?? nextResults.length).toLocaleString()} memories found. Routing tokens: ${body.routingTokens ?? 0}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="Obsidian Logic" />
      <PageShell>
        <div className="mx-auto max-w-[1500px] space-y-6">
          <Link href="/knowledge" className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text">
            <ArrowLeft size={15} />
            Back to Knowledge
          </Link>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-accent">Runtime memory graph</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-white">Obsidian Logic</h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-muted">
                  Zero-token graph built from project structure, requirement IDs, lessons, decisions, task runs, selected skills, and telemetry.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={refreshGraph}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-base px-4 py-2 text-sm font-bold text-text transition-colors hover:border-accent/60 disabled:opacity-60"
                >
                  <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
                  Refresh Graph
                </button>
                <button
                  onClick={exportVault}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                >
                  <Download size={15} />
                  Export Vault
                </button>
              </div>
            </div>
            {message && <p className="mt-4 rounded-xl border border-border bg-bg-base px-3 py-2 text-xs text-text-muted">{message}</p>}
          </section>

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            <Metric label="Nodes" value={stats.nodes} />
            <Metric label="Edges" value={stats.edges} />
            <Metric label="Projects" value={stats.projects} />
            <Metric label="Req IDs" value={stats.requirements} />
            <Metric label="Skills" value={stats.skills} />
            <Metric label="Runs" value={stats.runs} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <select
                  value={project}
                  onChange={(event) => setProject(event.target.value)}
                  className="rounded-xl border border-border bg-bg-base px-3 py-2 text-sm font-semibold text-text outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="all">All projects</option>
                  {projectNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void searchMemory();
                  }}
                  placeholder="Search by reqId, task, module, skill, keyword..."
                  className="min-w-0 flex-1 rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text placeholder:text-text-muted outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  onClick={searchMemory}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                >
                  <Search size={15} />
                  Search
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {(results.length ? results : stats.recent).map((item) => (
                  <article key={item.id} className="rounded-xl border border-border bg-bg-base p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-text">{item.title}</p>
                        <p className="mt-1 text-xs text-text-muted">{item.projectName ?? "workspace"}</p>
                      </div>
                      <span className="rounded bg-card px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                        {item.kind}{"score" in item && typeof item.score === "number" ? ` · ${item.score}` : ""}
                      </span>
                    </div>
                    {"reasons" in item && item.reasons?.length ? (
                      <p className="mt-2 text-[11px] text-in-progress">{item.reasons.slice(0, 3).join(" · ")}</p>
                    ) : null}
                    {"excerpt" in item && <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-text-muted">{item.excerpt}</p>}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {item.reqIds.slice(0, 8).map((reqId) => (
                        <span key={reqId} className="rounded bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">{reqId}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <GitBranch size={16} className="text-accent" />
                  <h2 className="text-sm font-bold text-text">Node Kinds</h2>
                </div>
                <div className="mt-4 space-y-2">
                  {stats.kinds.map((item) => (
                    <div key={item.kind} className="flex items-center justify-between rounded-lg border border-border bg-bg-base px-3 py-2">
                      <span className="font-mono text-xs text-text-muted">{item.kind}</span>
                      <span className="text-sm font-bold text-text">{item.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-bold text-text">Runtime Contract</h2>
                <div className="mt-4 space-y-2 text-xs text-text-muted">
                  <p>Routing: 0 LLM tokens.</p>
                  <p>Task prompts receive only related snippets, never the full graph.</p>
                  <p>Obsidian export writes `.gcs/obsidian/*.md` with relations and backlinks.</p>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </PageShell>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
      <p className="mt-3 text-3xl font-black text-white">{value.toLocaleString()}</p>
    </div>
  );
}
