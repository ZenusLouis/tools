"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { ProjectOption, ModuleOption } from "@/lib/tasks";

interface Props {
  projects: ProjectOption[];
  modules: ModuleOption[];
  selectedProject: string;
  selectedModule: string;
  progress?: { completed: number; total: number; percent: number } | null;
}

export function TaskBoardSelectors({ projects, modules, selectedProject, selectedModule, progress }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    if (key === "project") params.delete("module");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-0 rounded-xl border bg-card overflow-hidden">
      {/* PROJECT */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-r border-border">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Project</span>
        <div className="relative flex items-center">
          <select
            value={selectedProject}
            onChange={(e) => setParam("project", e.target.value)}
            className="appearance-none bg-transparent text-sm font-semibold text-text focus:outline-none cursor-pointer pr-4"
          >
            {projects.length === 0 && <option value="">No projects</option>}
            {projects.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-0 text-text-muted pointer-events-none" />
        </div>
      </div>

      {/* MODULE */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-r border-border">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Module</span>
        <div className="relative flex items-center">
          <select
            value={selectedModule}
            onChange={(e) => setParam("module", e.target.value)}
            disabled={modules.length === 0}
            className="appearance-none bg-transparent text-sm font-semibold text-text focus:outline-none cursor-pointer pr-4 disabled:opacity-40"
          >
            {modules.length === 0 && <option value="">—</option>}
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.id} — {m.name}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-0 text-text-muted pointer-events-none" />
        </div>
      </div>

      {/* PROGRESS */}
      {progress && (
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Progress</span>
          <span className="text-sm font-semibold tabular-nums text-text">
            {progress.completed}/{progress.total}
          </span>
          <div className="w-24 h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progress.percent === 100 ? "bg-done" : "bg-accent"}`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className={`text-xs font-bold tabular-nums ${progress.percent === 100 ? "text-done" : "text-accent"}`}>
            {progress.percent}%
          </span>
        </div>
      )}
    </div>
  );
}
