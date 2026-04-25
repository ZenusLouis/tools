import Link from "next/link";
import type { ProjectSummary } from "@/lib/projects";

function CircularProgress({ percent }: { percent: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent === 100 ? "#22c55e" : "#6366f1";

  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <svg className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="transparent" stroke="var(--border)" strokeWidth="4" />
        <circle cx="32" cy="32" r={radius} fill="transparent" stroke={color} strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.7s ease" }} />
      </svg>
      <span className="absolute text-[12px] font-bold text-text">{percent}%</span>
    </div>
  );
}

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const isActive = Boolean(project.activeTask);
  const isComplete = project.progressPercent === 100;

  return (
    <article className="group relative flex min-h-56 flex-col overflow-hidden rounded-xl border border-border bg-card p-6 transition-all hover:border-accent/40 hover:bg-card-hover">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isActive ? "bg-done animate-pulse" : isComplete ? "bg-accent" : "bg-in-progress"}`} />
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-done" : isComplete ? "text-accent" : "text-in-progress"}`}>
            {isActive ? "Active" : isComplete ? "Complete" : "Idle"}
          </span>
        </div>
        {project.lastIndexed && (
          <span className="text-[11px] text-text-muted">
            Last indexed: {project.lastIndexed.split("T")[0].replace(/^\d{4}-/, "").replace("-", "/")}
          </span>
        )}
      </div>

      <h3 className="mb-3 text-xl font-bold text-text">{project.name}</h3>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {project.frameworks.slice(0, 3).map((framework) => (
          <span key={framework} className="rounded border border-border bg-bg-base px-2 py-0.5 font-mono text-[10px] text-text-muted">
            {framework}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-6">
        <CircularProgress percent={project.progressPercent} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-text-muted">Active Task</div>
          <div className="truncate font-mono text-sm text-text">{project.activeTask ?? "--"}</div>
          <div className="mt-1 text-[11px] italic text-text-muted">
            {project.completedTasks}/{project.totalTasks} tasks complete
          </div>
        </div>
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 rounded-xl bg-card/95 opacity-0 transition-opacity group-hover:opacity-100">
        <Link href={`/projects/${project.name}`} className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover">
          Open
        </Link>
        <Link href={`/projects/${project.name}/settings`} className="rounded-lg bg-card-hover px-5 py-2 text-sm font-bold text-text transition-colors hover:bg-border">
          Settings
        </Link>
      </div>
    </article>
  );
}
