import Link from "next/link";
import { ArrowRight, FolderPlus, Sparkles, TerminalSquare } from "lucide-react";

export function OnboardingEmptyState() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center px-4 py-16 text-center">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/20">
        <TerminalSquare size={42} />
      </div>
      <p className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-accent">GCS Developer Workspace</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-white">Welcome to GCS</h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-text-muted">
        Add a project, connect local Claude/Codex bridges, and start tracking tasks, skills, sessions, and token telemetry from one control plane.
      </p>

      <div className="mt-12 grid w-full grid-cols-1 gap-5 md:grid-cols-2">
        <Link href="/projects/new" className="group flex min-h-56 flex-col rounded-xl border border-border bg-card p-8 text-left transition-all hover:border-accent/50 hover:bg-card-hover">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <FolderPlus size={26} />
          </div>
          <h3 className="text-xl font-bold text-white">Add Existing Project</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">
            Register a codebase already on this machine or in Git, then sync its modules, tasks, and project context into the dashboard.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-accent">
            Add Project
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <Link href="/projects/templates" className="group flex min-h-56 flex-col rounded-xl border border-border bg-card p-8 text-left transition-all hover:border-purple-400/50 hover:bg-card-hover">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-400/10 text-purple-300">
            <Sparkles size={26} />
          </div>
          <h3 className="text-xl font-bold text-white">Start from Template</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">
            Scaffold a local starter project, register it in the workspace, and create the first task/module records automatically.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-text">
            Browse Templates
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-8 text-center sm:grid-cols-3">
        <Meta label="Active Runtime" value="node-v23 local" />
        <Meta label="API Status" value="operational" dot />
        <Meta label="Bridge Mode" value="Claude + Codex" />
      </div>
    </section>
  );
}

function Meta({ label, value, dot }: { label: string; value: string; dot?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
      <p className="mt-1 flex items-center justify-center gap-2 font-mono text-xs text-text">
        {dot && <span className="h-1.5 w-1.5 rounded-full bg-done" />}
        {value}
      </p>
    </div>
  );
}
