import Link from "next/link";
import { Activity, ArrowRight, MoreVertical, Terminal } from "lucide-react";
import type { ProjectSummary } from "@/lib/projects";

function ProjectCard({ project }: { project: ProjectSummary }) {
  const pct = project.progressPercent;
  const isComplete = pct === 100;
  const isActive = Boolean(project.activeTask);

  return (
    <Link
      href={`/projects/${project.name}`}
      className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-accent/40 hover:bg-card-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-base text-text-muted transition-colors group-hover:text-accent">
            <Terminal size={19} />
          </div>
          <div>
            <h4 className="font-bold text-text">{project.name}</h4>
            <p className="mt-1 font-mono text-[11px] uppercase text-text-muted">ID: {project.name.slice(0, 3).toUpperCase()}-{project.totalTasks || 0}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project.frameworks.slice(0, 1).map((fw) => (
            <span key={fw} className="rounded border border-border bg-bg-base px-2 py-0.5 font-mono text-[10px] text-text-muted">
              {fw}
            </span>
          ))}
          {isActive && (
            <span className="rounded border border-done/20 bg-done/10 px-2 py-0.5 font-mono text-[10px] text-done">
              active
            </span>
          )}
          <MoreVertical size={15} className="text-text-muted" />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="mb-1.5 flex justify-between text-xs">
          <span className="text-text-muted">Build Progress</span>
          <span className={`font-medium ${isComplete ? "text-done" : "text-accent"}`}>{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg-base">
          <div className={`h-full rounded-full transition-all duration-700 ${isComplete ? "bg-done" : "bg-accent"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-bg-base px-3 py-2 text-xs">
        <span className="text-text-muted">Active Task</span>
        {project.activeTask ? <span className="font-mono text-accent">{project.activeTask}</span> : <span className="italic text-text-muted">none</span>}
      </div>

      {project.lastIndexed && (
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span className="flex items-center gap-2">
            <Activity size={11} className="shrink-0" />
            Last indexed: {project.lastIndexed.split("T")[0]}
          </span>
          <ArrowRight size={13} className="text-accent opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      )}
    </Link>
  );
}

export function ActiveProjectsList({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-text-muted">
        No projects yet.{" "}
        <Link href="/projects/new" className="text-accent hover:underline">
          Add your first project
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-3 text-lg font-bold text-white">
          <span className="h-5 w-1 rounded-full bg-accent" />
          Active Projects
        </h3>
        <Link href="/projects" className="font-mono text-xs uppercase tracking-wider text-accent hover:underline">
          View_all_repos
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.name} project={project} />
        ))}
      </div>
    </div>
  );
}
