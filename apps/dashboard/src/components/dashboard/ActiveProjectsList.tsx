import Link from "next/link";
import { ListChecks, Activity } from "lucide-react";
import type { ProjectSummary } from "@/lib/projects";

function ProjectCard({ project }: { project: ProjectSummary }) {
  const pct = project.progressPercent;
  const isComplete = pct === 100;
  const isActive = !!project.activeTask;

  return (
    <Link
      href={`/projects/${project.name}`}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 hover:bg-card-hover hover:border-accent/30 transition-colors"
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <h4 className="font-bold text-text">{project.name}</h4>
        <div className="flex gap-2">
          {project.frameworks.slice(0, 1).map((fw) => (
            <span key={fw} className="px-2 py-0.5 bg-card-hover rounded text-[10px] text-text-muted font-mono border border-border">
              {fw}
            </span>
          ))}
          {isActive && (
            <span className="px-2 py-0.5 bg-done/10 rounded text-[10px] text-done font-mono border border-done/20">
              active
            </span>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-text-muted">Build Progress</span>
          <span className={`font-medium ${isComplete ? "text-done" : "text-accent"}`}>{pct}%</span>
        </div>
        <div className="w-full bg-bg-base h-2 rounded-full overflow-hidden border border-border">
          <div
            className={`h-full rounded-full transition-all duration-700 ${isComplete ? "bg-done" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Active task chip */}
      <div className="flex items-center justify-between text-xs py-2 px-3 bg-bg-base rounded-lg border border-border">
        <span className="text-text-muted">Active Task</span>
        {project.activeTask ? (
          <span className="font-mono text-accent">{project.activeTask}</span>
        ) : (
          <span className="text-text-muted italic">none</span>
        )}
      </div>

      {/* Last indexed */}
      {project.lastIndexed && (
        <div className="flex items-center gap-2 text-[10px] text-text-muted">
          <Activity size={11} className="shrink-0" />
          Last indexed: {project.lastIndexed.split("T")[0]}
        </div>
      )}
    </Link>
  );
}

export function ActiveProjectsList({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-text-muted text-sm">
        No projects yet.{" "}
        <Link href="/projects/new" className="text-accent hover:underline">
          Add your first project →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text flex items-center gap-2">
          <ListChecks size={18} className="text-accent" />
          Active Projects
        </h3>
        <Link href="/projects" className="text-sm text-accent hover:underline">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <ProjectCard key={p.name} project={p} />
        ))}
      </div>
    </div>
  );
}
