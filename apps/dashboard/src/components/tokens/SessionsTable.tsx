import { History, Filter, Download } from "lucide-react";
import type { SessionRow } from "@/lib/analytics";

export function SessionsTable({ sessions }: { sessions: SessionRow[] }) {
  return (
    <section className="bg-card rounded-2xl border border-border overflow-hidden shadow-xl">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <h3 className="text-text font-bold flex items-center gap-2">
          <History size={16} className="text-accent" />
          Recent Sessions
        </h3>
        <div className="flex gap-2">
          <button className="bg-bg-base text-text-muted text-xs px-3 py-1.5 rounded-lg border border-border flex items-center gap-1.5 hover:text-text hover:border-border/80 transition-colors">
            <Filter size={12} />
            Filter
          </button>
          <button className="bg-bg-base text-text-muted text-xs px-3 py-1.5 rounded-lg border border-border flex items-center gap-1.5 hover:text-text hover:border-border/80 transition-colors">
            <Download size={12} />
            Export
          </button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No sessions in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bg-base/30 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Tasks</th>
                <th className="px-6 py-4">Tokens</th>
                <th className="px-6 py-4 text-right">Cost</th>
                <th className="px-6 py-4 text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sessions.map((s, i) => (
                <tr key={i} className="hover:bg-card-hover/40 transition-colors group">
                  <td className="px-6 py-4 text-text-muted text-sm">{s.date}</td>
                  <td className="px-6 py-4 font-semibold text-text text-sm">{s.project}</td>
                  <td className="px-6 py-4">
                    {s.tasksCompleted > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-card-hover text-[10px] text-text-muted border border-border">
                        {s.tasksCompleted} done
                      </span>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-accent font-bold">{s.tokens.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-text-muted text-sm">${s.cost.toFixed(4)}</td>
                  <td className="px-6 py-4 text-right text-text-muted text-sm">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-4 bg-bg-base/20 text-center border-t border-border/50">
        <button className="text-xs font-bold text-accent hover:text-text transition-colors uppercase tracking-widest">
          View all history
        </button>
      </div>
    </section>
  );
}
