"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { ProjectOption, ModuleOption } from "@/lib/tasks";

const TASK_PAGINATION_PARAMS = [
  "pendingPage",
  "pendingShow",
  "inProgressPage",
  "inProgressShow",
  "completedPage",
  "completedShow",
  "blockedPage",
  "blockedShow",
];

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
  const [openMenu, setOpenMenu] = useState<"project" | "module" | null>(null);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    if (key === "project") params.delete("module");
    TASK_PAGINATION_PARAMS.forEach((param) => params.delete(param));
    router.push(`${pathname}?${params.toString()}`);
  }

  const selectedModuleLabel = modules.find((module) => module.id === selectedModule);
  const moduleOptions = [{ value: "all", label: "All Modules" }, ...modules.map((module) => ({ value: module.id, label: `${module.id} - ${module.name}` }))];

  return (
    <div className="flex flex-wrap items-stretch rounded-xl border bg-card shadow-sm shadow-black/10">
      <Picker
        label="Project"
        value={selectedProject || "No projects"}
        open={openMenu === "project"}
        onToggle={() => setOpenMenu(openMenu === "project" ? null : "project")}
        options={projects.map((project) => ({ value: project.name, label: project.name }))}
        onSelect={(value) => {
          setParam("project", value);
          setOpenMenu(null);
        }}
      />

      <Picker
        label="Module"
        value={selectedModule === "all" ? "All Modules" : selectedModuleLabel ? `${selectedModuleLabel.id} - ${selectedModuleLabel.name}` : "No modules"}
        open={openMenu === "module"}
        disabled={modules.length === 0}
        onToggle={() => setOpenMenu(openMenu === "module" ? null : "module")}
        options={moduleOptions}
        onSelect={(value) => {
          setParam("module", value);
          setOpenMenu(null);
        }}
      />

      {progress && (
        <div className="flex min-w-72 flex-1 items-center gap-3 px-4 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Progress</span>
          <span className="text-sm font-semibold tabular-nums text-text">
            {progress.completed}/{progress.total}
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
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

function Picker({
  label,
  value,
  options,
  open,
  disabled,
  onToggle,
  onSelect,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="relative min-w-64 border-r border-border last:border-r-0">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className="flex h-full w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{value}</span>
        <ChevronDown size={13} className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-2 top-full z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-bg-base shadow-2xl shadow-black/40">
          <div className="max-h-80 overflow-y-auto p-1.5">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-muted">No options</div>
            ) : options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSelect(option.value)}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-text-muted transition-colors hover:bg-accent/10 hover:text-text"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
