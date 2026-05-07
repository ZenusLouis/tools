import Link from "next/link";
import { CheckCircle2, Clock3, ExternalLink, Loader2, XCircle } from "lucide-react";
import type { McpActionRow } from "@/lib/mcp";

const LABELS: Record<string, string> = {
  mcp_design_inspection: "Analyze Figma",
  mcp_ui_brief: "Generate UI Brief",
  mcp_design_implementation: "Implement Design",
  mcp_visual_review: "Review Visual Diff",
};

function statusClass(status: string) {
  if (status === "succeeded") return "border-done/30 bg-done/10 text-done";
  if (status === "failed" || status === "expired") return "border-blocked/30 bg-blocked/10 text-blocked";
  if (status === "cancelled") return "border-text-muted/30 bg-text-muted/10 text-text-muted";
  return "border-accent/30 bg-accent/10 text-accent";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "succeeded") return <CheckCircle2 size={12} />;
  if (status === "failed" || status === "expired" || status === "cancelled") return <XCircle size={12} />;
  if (status === "running" || status === "claimed") return <Loader2 size={12} className="animate-spin" />;
  return <Clock3 size={12} />;
}

function timeLabel(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function McpActionTimeline({ actions }: { actions: McpActionRow[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">Tool Plane</p>
          <h2 className="mt-1 text-lg font-bold text-text">Recent MCP Actions</h2>
        </div>
        <span className="rounded border border-border bg-bg-base px-2 py-1 text-[10px] font-bold text-text-muted">
          {actions.length} recent
        </span>
      </div>

      {actions.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-bg-base px-4 py-6 text-center text-xs text-text-muted">
          No MCP project actions queued yet.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {actions.map((action) => (
            <div key={action.id} className="rounded-lg border border-border bg-bg-base p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(action.status)}`}>
                      <StatusIcon status={action.status} />
                      {action.status}
                    </span>
                    <span className="text-sm font-bold text-text">{LABELS[action.actionType] ?? action.actionType}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-text-muted">
                    {action.projectName && <span className="font-mono text-accent">{action.projectName}</span>}
                    {action.server && <span>{action.server}</span>}
                    <span>{timeLabel(action.updatedAt)}</span>
                  </div>
                  {action.artifactPath && (
                    <p className="mt-2 truncate font-mono text-[10px] text-text-muted" title={action.artifactPath}>
                      {action.artifactPath}
                    </p>
                  )}
                  {action.error && <p className="mt-2 line-clamp-2 text-[11px] text-blocked">{action.error}</p>}
                </div>
                {action.projectName && (
                  <Link
                    href={`/projects/${encodeURIComponent(action.projectName)}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:border-accent hover:text-accent"
                  >
                    Open
                    <ExternalLink size={10} />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
