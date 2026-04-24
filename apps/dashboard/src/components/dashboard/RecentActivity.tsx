import Link from "next/link";
import { GitCommit, CheckCircle2, RefreshCw, AlertTriangle, History } from "lucide-react";
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
  commit:   { icon: GitCommit,     iconClass: "text-accent",      bgClass: "bg-accent/20",      borderClass: "border-accent/30",      label: "Commit" },
  complete: { icon: CheckCircle2,  iconClass: "text-done",        bgClass: "bg-done/20",        borderClass: "border-done/30",        label: "Task Completed" },
  index:    { icon: RefreshCw,     iconClass: "text-text-muted",  bgClass: "bg-card-hover",     borderClass: "border-border",         label: "Re-indexed" },
  alert:    { icon: AlertTriangle, iconClass: "text-in-progress", bgClass: "bg-in-progress/20", borderClass: "border-in-progress/30", label: "Alert" },
};

function ActivityRow({ item }: { item: ActivityItem }) {
  const type = detectType(item);
  const { icon: Icon, iconClass, bgClass, borderClass, label } = TYPE_CONFIG[type];

  return (
    <div className="relative pl-9">
      <div className={`absolute left-0 top-1 w-7 h-7 ${bgClass} rounded-full flex items-center justify-center border ${borderClass} z-10`}>
        <Icon size={12} className={iconClass} />
      </div>
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm text-text font-medium">
            {label}{" "}
            {item.commitHash && (
              <span className="font-mono text-accent text-xs">{item.commitHash.slice(0, 7)}</span>
            )}
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            {item.project} · <Link href={`/tasks/${item.taskId}`} className="font-mono text-accent hover:underline">{item.taskId}</Link>
          </div>
        </div>
        <span className="text-[10px] text-text-muted whitespace-nowrap ml-2">{timeAgo(item.date)}</span>
      </div>
    </div>
  );
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-text flex items-center gap-2">
          <History size={16} className="text-text-muted" />
          Activity Log
        </h3>
        <button className="text-text-muted hover:text-text transition-colors">
          <RefreshCw size={15} />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No activity today.</p>
      ) : (
        <div className="space-y-6 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-border">
          {items.map((item, i) => (
            <ActivityRow key={`${item.taskId}-${i}`} item={item} />
          ))}
        </div>
      )}

      <button className="w-full mt-8 py-2 text-xs font-medium text-text-muted border border-border rounded-lg hover:bg-card-hover hover:text-text transition-colors">
        View Activity History
      </button>
    </div>
  );
}
