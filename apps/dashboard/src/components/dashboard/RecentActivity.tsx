import Link from "next/link";
import { AlertTriangle, CheckCircle2, GitCommit, History, RefreshCw } from "lucide-react";
import type { ActivityItem } from "@/lib/activity";
import { timeAgo } from "@/lib/activity";

type ActivityType = "commit" | "complete" | "project" | "index" | "alert";

function detectType(item: ActivityItem): ActivityType {
  const note = (item.note ?? "").toLowerCase();
  if (!item.taskId) return "project";
  if (item.commitHash) return "commit";
  if (note.includes("rate limit") || note.includes("error") || note.includes("blocked")) return "alert";
  if (note.includes("index") || note.includes("indexed") || note.includes("code-index")) return "index";
  return "complete";
}

const TYPE_CONFIG: Record<ActivityType, {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  bgClass: string;
  borderClass: string;
  label: string;
}> = {
  commit: { icon: GitCommit, iconClass: "text-accent", bgClass: "bg-accent/20", borderClass: "border-accent/30", label: "Commit" },
  complete: { icon: CheckCircle2, iconClass: "text-done", bgClass: "bg-done/20", borderClass: "border-done/30", label: "Task Completed" },
  project: { icon: RefreshCw, iconClass: "text-accent", bgClass: "bg-accent/20", borderClass: "border-accent/30", label: "Project Event" },
  index: { icon: RefreshCw, iconClass: "text-text-muted", bgClass: "bg-card-hover", borderClass: "border-border", label: "Re-indexed" },
  alert: { icon: AlertTriangle, iconClass: "text-in-progress", bgClass: "bg-in-progress/20", borderClass: "border-in-progress/30", label: "Alert" },
};

function ActivityRow({ item }: { item: ActivityItem }) {
  const type = detectType(item);
  const { icon: Icon, iconClass, bgClass, borderClass, label } = TYPE_CONFIG[type];

  return (
    <div className="relative pl-9">
      <div className={`absolute left-0 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border ${bgClass} ${borderClass}`}>
        <Icon size={12} className={iconClass} />
      </div>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-text">
            {label}{" "}
            {item.commitHash && <span className="font-mono text-xs text-accent">{item.commitHash.slice(0, 7)}</span>}
          </div>
          <div className="mt-0.5 text-xs text-text-muted">
            {item.project}{" "}
            {item.taskId ? (
              <>
                - <Link href={`/tasks/${item.taskId}`} className="font-mono text-accent hover:underline">{item.taskId}</Link>
              </>
            ) : (
              <Link href={`/projects/${item.project}/detail`} className="font-mono text-accent hover:underline">project event</Link>
            )}
          </div>
        </div>
        <span className="ml-2 whitespace-nowrap text-[10px] text-text-muted">{timeAgo(item.date)}</span>
      </div>
    </div>
  );
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <div className="h-full overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-6 py-5">
        <h3 className="flex items-center gap-2 text-lg font-bold text-white">
          <History size={16} className="text-text-muted" />
          Activity Log
        </h3>
        <p className="mt-1 text-xs text-text-muted">Live stream of system events</p>
      </div>
      <div className="flex items-center justify-end px-6 pt-4">
        <Link href="/" className="text-text-muted transition-colors hover:text-text" aria-label="Refresh dashboard activity">
          <RefreshCw size={15} />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mx-6 mb-6 mt-2 rounded-xl border border-dashed border-border bg-bg-base px-4 py-8 text-center">
          <p className="text-sm font-medium text-text">No activity today</p>
          <p className="mt-1 text-xs text-text-muted">Run a local bridge or complete a task to populate this feed.</p>
        </div>
      ) : (
        <div className="relative mx-6 mb-6 mt-2 space-y-7 before:absolute before:bottom-2 before:left-3.5 before:top-2 before:w-px before:bg-border">
          {items.map((item, index) => (
            <ActivityRow key={`${item.taskId ?? "project"}-${index}`} item={item} />
          ))}
        </div>
      )}

      <a href="/api/activity/export" className="block w-full border-t border-border py-4 text-center font-mono text-xs font-bold uppercase tracking-wider text-text-muted transition-colors hover:bg-card-hover hover:text-text">
        Download_logs.json
      </a>
    </div>
  );
}
