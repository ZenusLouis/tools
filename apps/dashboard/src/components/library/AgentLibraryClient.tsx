"use client";

import { useState, useTransition, useRef } from "react";
import { X, Search, Loader2 } from "lucide-react";
import type { SearchResult } from "@/app/api/skills/search/route";

type Skill = { id: string; name: string; slug: string; category: string; description: string; isRemote: boolean; sourcePath?: string | null };
type Role = {
  id: string;
  name: string;
  description: string;
  provider: "claude" | "codex" | "chatgpt";
  phase: string;
  executionModeDefault: "local" | "dashboard";
  skills: Skill[];
};
type SourceSummary = {
  sources: Array<{ name: string; url: string; kind: string; why: string; recommendedFor?: string[] }>;
  marketplaceCount: number;
  wrappedCount: number;
  cachedSourceCount: number;
  cachedSkillCount: number;
  recommendedCount: number;
  recommendedCandidates: number;
  recommended: Array<{ name: string; sourceName: string; sourcePath: string; description: string; recommendedFor: string[]; score: number }>;
};

export function AgentLibraryClient({ roles, skills, sourceSummary }: { roles: Role[]; skills: Skill[]; sourceSummary: SourceSummary }) {
  const [skillList, setSkillList] = useState(skills);
  const [importingSkill, setImportingSkill] = useState("");
  const [importError, setImportError] = useState<Record<string, string>>({});
  const [importDone, setImportDone] = useState<Set<string>>(new Set(skills.map((s) => s.slug)));
  const [selectedRole, setSelectedRole] = useState<Role | null>(roles[0] ?? null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function triggerSearch(q: string) {
    setSearchQuery(q);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!q.trim()) { setSearchResults(null); setSearchError(""); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const res = await fetch("/api/skills/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q.trim() }),
        });
        const data = await res.json() as { results?: SearchResult[]; error?: string };
        if (!res.ok) { setSearchError(data.error ?? "Search failed"); setSearchResults(null); }
        else setSearchResults(data.results ?? []);
      } catch { setSearchError("Network error"); }
      finally { setSearchLoading(false); }
    }, 500);
  }

  function importSearchResult(result: SearchResult) {
    importSkill({ name: result.name, sourceName: result.sourceName, sourcePath: result.sourcePath, description: result.description, recommendedFor: [], score: 0 });
  }

  function importSkill(skill: { name: string; sourceName: string; sourcePath: string; description: string; recommendedFor: string[]; score: number }) {
    setImportingSkill(skill.name);
    setImportError((prev) => { const next = { ...prev }; delete next[skill.name]; return next; });
    startTransition(async () => {
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceName: skill.sourceName, name: skill.name, sourcePath: skill.sourcePath }),
      });
      if (res.ok) {
        const next = await fetch("/api/skills").then((r) => r.json());
        if (Array.isArray(next)) setSkillList(next);
        setImportDone((prev) => new Set([...prev, skill.name]));
      } else {
        const body = await res.json().catch(() => ({})) as { error?: unknown };
        setImportError((prev) => ({ ...prev, [skill.name]: String(body.error ?? "Import failed") }));
      }
      setImportingSkill("");
    });
  }

  return (
    <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Library</p>
            <h2 className="text-sm font-bold text-text">Active Bot Roles</h2>
          </div>
          <a href="/create" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10">Create Role</a>
        </div>
        <div className="flex max-h-[calc(100vh-12rem)] flex-col gap-2 overflow-y-auto pr-1">
          {roles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-bg-base p-3 text-xs text-text-muted">
              No roles found yet.
            </div>
          ) : roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => {
                setSelectedRole(role);
                setSelectedSkill(null);
              }}
              className={`rounded-lg border p-3 text-left transition-colors hover:border-accent/40 ${
                selectedRole?.id === role.id ? "border-accent/50 bg-accent/10" : "border-border bg-bg-base"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-text">{role.name}</p>
                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">{role.provider}</span>
              </div>
              <p className="mt-1 text-xs text-text-muted">{role.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="rounded bg-border px-1.5 py-0.5 text-[10px] text-text-muted">{role.phase}</span>
                <span className="rounded bg-border px-1.5 py-0.5 text-[10px] text-text-muted">{role.executionModeDefault}</span>
                <span className="rounded bg-border px-1.5 py-0.5 text-[10px] text-text-muted">{role.skills.length} skills</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-6">
        {(selectedRole || selectedSkill) && (
          <section className="rounded-xl border border-accent/30 bg-card p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
                  {selectedRole ? "Role Detail" : "Skill Detail"}
                </p>
                <h2 className="mt-1 text-lg font-bold text-text">{selectedRole?.name ?? selectedSkill?.name}</h2>
                <p className="mt-1 text-sm text-text-muted">{selectedRole?.description ?? selectedSkill?.description}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole(null);
                  setSelectedSkill(null);
                }}
                className="rounded-lg p-1.5 text-text-muted hover:bg-card-hover hover:text-text"
              >
                <X size={16} />
              </button>
            </div>
            {selectedRole && (
              <div className="grid gap-3 md:grid-cols-3">
                <Detail label="Provider" value={selectedRole.provider} />
                <Detail label="Phase" value={selectedRole.phase} />
                <Detail label="Execution" value={selectedRole.executionModeDefault} />
                <div className="rounded-lg border border-border bg-bg-base p-3 md:col-span-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-text-muted">Skills</p>
                  {selectedRole.skills.length === 0 ? (
                    <p className="text-xs text-text-muted">No skills attached.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedRole.skills.map((skill) => (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => {
                            setSelectedSkill(skill);
                            setSelectedRole(null);
                          }}
                          className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-text-muted hover:border-accent/40 hover:text-text"
                        >
                          {skill.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {selectedSkill && (
              <div className="grid gap-3 md:grid-cols-3">
                <Detail label="Slug" value={selectedSkill.slug} />
                <Detail label="Category" value={selectedSkill.category} />
                <Detail label="Source" value={selectedSkill.isRemote ? "remote" : "local"} />
                {selectedSkill.sourcePath && <Detail label="Path" value={selectedSkill.sourcePath} wide />}
              </div>
            )}
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-text">Skill Sources</h2>
              <p className="text-xs text-text-muted">
                {sourceSummary.sources.length} GitHub sources, {sourceSummary.marketplaceCount} marketplace skills, {sourceSummary.wrappedCount} local wrappers
              </p>
              <p className="text-xs text-text-muted">
                {sourceSummary.cachedSourceCount} cached sources, {sourceSummary.cachedSkillCount} discovered upstream skills
              </p>
              <p className="text-xs text-text-muted">
                {sourceSummary.recommendedCount} recommended imports from {sourceSummary.recommendedCandidates} scored candidates
              </p>
            </div>
            <a href="/api/skills/sources" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10">JSON</a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sourceSummary.sources.slice(0, 6).map((source) => (
              <div key={source.name} className="rounded-lg border border-border bg-bg-base p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-text">{source.name}</p>
                  <span className="rounded bg-border px-1.5 py-0.5 text-[10px] text-text-muted">{source.kind}</span>
                </div>
                <p className="mt-1 text-xs text-text-muted">{source.why}</p>
                <p className="mt-2 truncate text-[10px] text-accent">{source.url}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Search</p>
          <h2 className="mt-1 text-sm font-bold text-text">Find Skills</h2>
          <p className="mt-0.5 text-xs text-text-muted">Enter a keyword or paste a GitHub repo URL to discover skills</p>
          <div className="relative mt-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => triggerSearch(e.target.value)}
              placeholder="e.g. browser automation  or  https://github.com/owner/repo"
              className="w-full rounded-lg border border-border bg-bg-base py-2 pl-8 pr-4 text-sm text-text placeholder:text-text-muted focus:border-accent/60 focus:outline-none"
            />
            {searchLoading && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-accent" />}
          </div>
          {searchError && <p className="mt-2 text-xs text-red-400">{searchError}</p>}
          {searchResults !== null && (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {searchResults.length === 0 ? (
                <p className="col-span-2 text-xs text-text-muted">No skills found.</p>
              ) : searchResults.map((result) => (
                <div key={`${result.sourceName}-${result.name}`} className="rounded-lg border border-border bg-bg-base p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-text">{result.name}</p>
                    {importDone.has(result.name) ? (
                      <span className="rounded border border-done/30 bg-done/10 px-2 py-0.5 text-[10px] font-semibold text-done">Added</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => importSearchResult(result)}
                        disabled={importingSkill === result.name}
                        className="rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-50"
                      >
                        {importingSkill === result.name ? "Adding..." : "Add"}
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-text-muted">{result.sourceName}</p>
                  <p className="mt-1 max-h-10 overflow-hidden text-xs text-text-muted">{result.description}</p>
                  {importError[result.name] && <p className="mt-1 text-[10px] text-red-400">{importError[result.name]}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Top Candidates</p>
          <h2 className="mt-1 text-sm font-bold text-text">Recommended Imports</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {sourceSummary.recommended.map((skill) => (
              <div key={`${skill.sourceName}-${skill.name}`} className="rounded-lg border border-border bg-bg-base p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-text">{skill.name}</p>
                  <div className="flex items-center gap-1">
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">{skill.score}</span>
                    {importDone.has(skill.name) ? (
                      <span className="rounded border border-done/30 bg-done/10 px-2 py-0.5 text-[10px] font-semibold text-done">Added</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => importSkill(skill)}
                        disabled={importingSkill === skill.name}
                        className="rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-50"
                      >
                        {importingSkill === skill.name ? "Adding..." : "Add"}
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-text-muted">{skill.sourceName}</p>
                <p className="mt-1 max-h-10 overflow-hidden text-xs text-text-muted">{skill.description}</p>
                {importError[skill.name] && (
                  <p className="mt-1 text-[10px] text-red-400">{importError[skill.name]}</p>
                )}
                <p className="mt-2 text-[10px] text-text-muted">{skill.recommendedFor.slice(0, 3).join(", ")}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Installed</p>
          <h2 className="mt-1 text-sm font-bold text-text">Installed Skills</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {skillList.slice(0, 80).map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => {
                  setSelectedSkill(skill);
                  setSelectedRole(null);
                }}
                className="rounded-lg border border-border bg-bg-base px-2 py-1 text-left text-xs text-text-muted transition-colors hover:border-accent/40 hover:text-text"
              >
                {skill.name}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-lg border border-border bg-bg-base p-3 ${wide ? "md:col-span-3" : ""}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-text">{value || "none"}</p>
    </div>
  );
}
