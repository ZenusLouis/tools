"use client";

import { useMemo, useState } from "react";
import { Download, Filter, History, X } from "lucide-react";
import type { SessionRow } from "@/lib/analytics";

export function SessionsTable({ sessions }: { sessions: SessionRow[] }) {
  const [provider, setProvider] = useState("all");
  const [source, setSource] = useState("all");
  const [selected, setSelected] = useState<SessionRow | null>(sessions[0] ?? null);

  const providers = useMemo(() => {
    return Array.from(new Set(sessions.map((session) => session.provider))).sort();
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const providerMatches = provider === "all" || session.provider === provider;
      const sourceMatches = source === "all" || session.source === source;
      return providerMatches && sourceMatches;
    });
  }, [provider, sessions, source]);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-6">
        <h3 className="flex items-center gap-2 font-bold text-text">
          <History size={16} className="text-accent" />
          Recent Sessions
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-base px-2 py-1.5 text-xs text-text-muted">
            <Filter size={12} />
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="bg-transparent text-xs font-semibold text-text outline-none"
              aria-label="Filter token sessions by provider"
            >
              <option value="all">All providers</option>
              {providers.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="rounded-lg border border-border bg-bg-base px-3 py-1.5 text-xs font-semibold text-text outline-none"
            aria-label="Filter token sessions by source"
          >
            <option value="all">All sources</option>
            <option value="session">Sessions</option>
            <option value="tool">Tool usage</option>
          </select>
          <a href="/api/activity/export" className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-base px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-border/80 hover:text-text">
            <Download size={12} />
            Export
          </a>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
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
              {filteredSessions.map((session, index) => (
                <tr
                  key={`${session.date}-${session.project}-${session.source}-${session.tool ?? "session"}-${index}`}
                  onClick={() => setSelected(session)}
                  className={`cursor-pointer transition-colors hover:bg-card-hover/40 ${selected === session ? "bg-card-hover/50" : ""}`}
                >
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

      {selected && (
        <div className="border-t border-border/50 bg-bg-base/30 p-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Session Detail</p>
                <h4 className="mt-1 text-lg font-bold text-text">
                  {selected.provider.toUpperCase()} · {selected.source === "tool" ? selected.tool ?? "tool usage" : selected.project}
                </h4>
                <p className="mt-1 text-sm text-text-muted">
                  {selected.date} · {selected.role ?? selected.model ?? "No role/model metadata"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-border p-2 text-text-muted transition-colors hover:bg-card-hover hover:text-text"
                aria-label="Close session detail"
              >
                <X size={14} />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-bg-base p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Tokens</p>
                <p className="mt-2 text-2xl font-bold text-text">{selected.tokens.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg-base p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Cost</p>
                <p className="mt-2 text-2xl font-bold text-text">${selected.cost.toFixed(4)}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg-base p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Source</p>
                <p className="mt-2 text-sm font-semibold text-text">{selected.source === "tool" ? selected.tool ?? "tool" : "session"}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg-base p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Duration</p>
                <p className="mt-2 text-sm font-semibold text-text">{selected.durationMin != null ? `${selected.durationMin}m` : "Not reported"}</p>
              </div>
            </div>
          </div>
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
