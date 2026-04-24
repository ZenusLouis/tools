import Link from "next/link";
import type { ProjectSummary } from "@/lib/projects";

function CircularProgress({ percent }: { percent: number }) {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent === 100 ? "#22c55e" : "#6366f1";

  return (
    <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
      <svg className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="32" cy="32" r={r} fill="transparent" stroke="var(--border)" strokeWidth="4" />
        <circle
          cx="32" cy="32" r={r}
          fill="transparent" stroke={color} strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.7s ease" }}
        />
      </svg>
      <span className="absolute text-[12px] font-bold text-text">{percent}%</span>
    </div>
  );
}

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const isActive = !!project.activeTask;
  const isComplete = project.progressPercent === 100;

  return (
    <div className="relative group bg-card border border-white/5 rounded-xl p-6 flex flex-col transition-all hover:border-accent/30 hover:shadow-2xl hover:shadow-accent/5 overflow-hidden">

      {/* Header: status + last indexed */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isActive ? (
            <>
              <span className="h-2 w-2 rounded-full bg-done animate-pulse" />
              <span className="text-[10px] font-bold text-done uppercase tracking-wider">Active</span>
            </>
          ) : isComplete ? (
            <>
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Complete</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-in-progress" />
              <span className="text-[10px] font-bold text-in-progress uppercase tracking-wider">Idle</span>
            </>
          )}
        </div>
        {project.lastIndexed && (
          <span className="text-[11px] text-text-muted">
            Last Indexed: {project.lastIndexed.split("T")[0].replace(/^\d{4}-/, "").replace("-", "/")}
          </span>
        )}
      </div>

      {/* Name */}
      <h3 className="text-xl font-bold text-text mb-3">{project.name}</h3>

      {/* Framework chips */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {project.frameworks.slice(0, 3).map((fw) => (
          <span key={fw} className="px-2 py-0.5 rounded bg-card-hover border border-border text-[10px] font-mono text-text-muted">
            {fw}
          </span>
        ))}
      </div>

      {/* Progress ring + task info */}
      <div className="flex items-center gap-6 mt-auto">
        <CircularProgress percent={project.progressPercent} />
        <div className="flex-1">
          <div className="text-[10px] text-text-muted uppercase tracking-tighter mb-1">Active Task</div>
          <div className="text-sm font-mono text-text">
            {project.activeTask ?? "—"}
          </div>
          <div className="text-[11px] text-text-muted mt-1 italic">
            {project.completedTasks}/{project.totalTasks} tasks complete
          </div>
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-card/95 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 rounded-xl z-10">
        <Link
          href={`/projects/${project.name}`}
          className="bg-accent text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-accent-hover transition-colors"
        >
          Open
        </Link>
        <Link
          href={`/projects/${project.name}/settings`}
          className="bg-card-hover text-text px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-border transition-colors"
        >
          Settings
        </Link>
      </div>
    </div>
  );
}
