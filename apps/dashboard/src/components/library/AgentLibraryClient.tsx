"use client";

import { useState, useTransition } from "react";

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
  const [pending, startTransition] = useTransition();

  function importSkill(skill: SourceSummary["recommended"][number]) {
    setImportingSkill(skill.name);
    startTransition(async () => {
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceName: skill.sourceName, name: skill.name, sourcePath: skill.sourcePath }),
      });
      if (res.ok) {
        const next = await fetch("/api/skills").then((r) => r.json());
        if (Array.isArray(next)) setSkillList(next);
      }
      setImportingSkill("");
    });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
      <section className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-text">Role Library</h2>
          <a href="/create" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10">Create Role</a>
        </div>
        <div className="flex max-h-[calc(100vh-12rem)] flex-col gap-2 overflow-y-auto pr-1">
          {roles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-bg-base p-3 text-xs text-text-muted">
              No roles found yet.
            </div>
          ) : roles.map((role) => (
            <div key={role.id} className="rounded-lg border border-border bg-bg-base p-3">
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
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-6">
        <section className="rounded-xl border bg-card p-4">
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

        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-bold text-text">Recommended Imports</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {sourceSummary.recommended.map((skill) => (
              <div key={`${skill.sourceName}-${skill.name}`} className="rounded-lg border border-border bg-bg-base p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-text">{skill.name}</p>
                  <div className="flex items-center gap-1">
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">{skill.score}</span>
                    <button
                      type="button"
                      onClick={() => importSkill(skill)}
                      disabled={pending || importingSkill === skill.name}
                      className="rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-50"
                    >
                      {importingSkill === skill.name ? "Adding" : "Add"}
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-text-muted">{skill.sourceName}</p>
                <p className="mt-1 max-h-10 overflow-hidden text-xs text-text-muted">{skill.description}</p>
                <p className="mt-2 text-[10px] text-text-muted">{skill.recommendedFor.slice(0, 3).join(", ")}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-bold text-text">Installed Skills</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {skillList.slice(0, 80).map((skill) => (
              <span key={skill.id} className="rounded-lg border border-border bg-bg-base px-2 py-1 text-xs text-text-muted">
                {skill.name}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
