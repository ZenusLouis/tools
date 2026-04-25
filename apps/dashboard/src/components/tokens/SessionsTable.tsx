import { Download, Filter, History } from "lucide-react";
import type { SessionRow } from "@/lib/analytics";

export function SessionsTable({ sessions }: { sessions: SessionRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border p-6">
        <h3 className="flex items-center gap-2 font-bold text-text">
          <History size={16} className="text-accent" />
          Recent Sessions
        </h3>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-base px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-border/80 hover:text-text">
            <Filter size={12} />
            Filter
          </button>
          <a href="/api/activity/export" className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-base px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-border/80 hover:text-text">
            <Download size={12} />
            Export
          </a>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">No sessions in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bg-base/30 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Provider</th>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Tasks</th>
                <th className="px-6 py-4">Tokens</th>
                <th className="px-6 py-4 text-right">Cost</th>
                <th className="px-6 py-4 text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sessions.map((session, index) => (
                <tr key={`${session.date}-${session.project}-${index}`} className="transition-colors hover:bg-card-hover/40">
                  <td className="px-6 py-4 text-sm text-text-muted">{session.date}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold uppercase text-accent">{session.provider}</span>
                      <span className="max-w-36 truncate text-[10px] text-text-muted">{session.role ?? session.model ?? "--"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-text">{session.project}</span>
                      <span className="text-[10px] text-text-muted">{session.source === "tool" ? session.tool : "session"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {session.tasksCompleted > 0 ? (
                      <span className="rounded border border-border bg-card-hover px-2 py-0.5 text-[10px] text-text-muted">
                        {session.tasksCompleted} done
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">--</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold text-accent">{session.tokens.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm text-text-muted">${session.cost.toFixed(4)}</td>
                  <td className="px-6 py-4 text-right text-sm text-text-muted">{session.durationMin != null ? `${session.durationMin}m` : "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-border/50 bg-bg-base/20 p-4 text-center">
        <a href="/api/activity/export" className="text-xs font-bold uppercase tracking-widest text-accent transition-colors hover:text-text">
          View all history
        </a>
      </div>
    </section>
  );
}
