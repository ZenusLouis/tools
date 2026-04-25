import Link from "next/link";
import { AlertTriangle, CheckCircle2, GitCommit, History, RefreshCw } from "lucide-react";
import type { ActivityItem } from "@/lib/activity";
import { timeAgo } from "@/lib/activity";

type ActivityType = "commit" | "complete" | "index" | "alert";

function detectType(item: ActivityItem): ActivityType {
  const note = (item.note ?? "").toLowerCase();
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
            {item.project} - <Link href={`/tasks/${item.taskId}`} className="font-mono text-accent hover:underline">{item.taskId}</Link>
          </div>
        </div>
        <span className="ml-2 whitespace-nowrap text-[10px] text-text-muted">{timeAgo(item.date)}</span>
      </div>
    </div>
  );
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <div className="h-full rounded-2xl border border-border bg-card p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-text">
          <History size={16} className="text-text-muted" />
          Activity Log
        </h3>
        <button className="text-text-muted transition-colors hover:text-text">
          <RefreshCw size={15} />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-base px-4 py-8 text-center">
          <p className="text-sm font-medium text-text">No activity today</p>
          <p className="mt-1 text-xs text-text-muted">Run a local bridge or complete a task to populate this feed.</p>
        </div>
      ) : (
        <div className="relative space-y-6 before:absolute before:bottom-2 before:left-3.5 before:top-2 before:w-px before:bg-border">
          {items.map((item, index) => (
            <ActivityRow key={`${item.taskId}-${index}`} item={item} />
          ))}
        </div>
      )}

      <button className="mt-8 w-full rounded-lg border border-border py-2 text-xs font-medium text-text-muted transition-colors hover:bg-card-hover hover:text-text">
        View Activity History
      </button>
    </div>
  );
}
