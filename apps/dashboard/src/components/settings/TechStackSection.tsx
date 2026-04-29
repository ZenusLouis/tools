"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";

const PRESETS: Record<string, string[]> = {
  Frontend: ["nextjs", "react", "angular", "vue", "nuxt", "svelte", "astro", "react-native", "expo"],
  Backend:  ["nestjs", "express", "fastapi", "django", "spring-boot", "dotnet", "go", "laravel", "rails"],
  Database: ["postgresql", "mysql", "mongodb", "redis", "sqlite", "supabase", "prisma", "drizzle"],
  DevOps:   ["docker", "kubernetes", "github-actions", "vercel", "railway", "aws", "nginx"],
};

const LAYER_LABELS: Record<string, string> = {
  Frontend: "FE",
  Backend: "BE",
  Database: "DB",
  DevOps: "Ops",
};

interface Props {
  frameworks: string[];
}

export function TechStackSection({ frameworks: initial }: Props) {
  const [tags, setTags] = useState<string[]>(initial.filter((f) => f !== "unknown"));
  const [custom, setCustom] = useState("");

  function add(tag: string) {
    const t = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
  }

  function remove(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleCustom(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(custom);
      setCustom("");
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Tech Stack</h2>
        <span className="text-[10px] text-text-muted">{tags.length} selected</span>
      </div>

      {/* Hidden input for form submission */}
      <input type="hidden" name="frameworks" value={JSON.stringify(tags)} />

      {/* Current tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
              {tag}
              <button type="button" onClick={() => remove(tag)} className="text-accent/60 hover:text-accent">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Presets by category */}
      <div className="space-y-3">
        {Object.entries(PRESETS).map(([layer, options]) => (
          <div key={layer}>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-bg-base px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted">
                {LAYER_LABELS[layer]}
              </span>
              <span className="text-[11px] text-text-muted">{layer}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {options.map((opt) => {
                const active = tags.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => active ? remove(opt) : add(opt)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border bg-bg-base text-text-muted hover:border-accent/30 hover:text-text"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Custom input */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-muted">Custom framework / tool</span>
        <div className="flex gap-2">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={handleCustom}
            placeholder="e.g. stripe, elasticsearch... (Enter to add)"
            className="flex-1 rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => { add(custom); setCustom(""); }}
            disabled={!custom.trim()}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-40"
          >
            <Plus size={13} /> Add
          </button>
        </div>
      </label>
    </section>
  );
}
