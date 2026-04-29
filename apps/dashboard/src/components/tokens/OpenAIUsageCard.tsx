import Link from "next/link";
import { TrendingUp } from "lucide-react";

interface Props {
  sessions: Array<{ date: string; totalTokens: number | null; totalCostUSD: number | null; sessionNotes: string | null }>;
}

export function OpenAIUsageCard({ sessions }: Props) {
  if (sessions.length === 0) return null;

  const totalTokens = sessions.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
  const totalCost = sessions.reduce((s, r) => s + (r.totalCostUSD ?? 0), 0);

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-text">
          <TrendingUp size={16} className="text-emerald-400" />
          OpenAI Account Usage
          <span className="rounded bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">SYNCED</span>
        </h3>
        <Link href="/tokens?source=openai-sync" className="text-xs text-accent hover:underline">
          View sessions →
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Total Tokens</p>
          <p className="mt-1 text-2xl font-black text-text">{totalTokens.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Estimated Cost</p>
          <p className="mt-1 text-2xl font-black text-text">${totalCost.toFixed(4)}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {sessions.slice(0, 7).map((s) => {
          const tokens = s.totalTokens ?? 0;
          const maxTokens = Math.max(...sessions.map((x) => x.totalTokens ?? 0), 1);
          return (
            <div key={s.date} className="grid grid-cols-[80px_1fr_64px] items-center gap-3 text-xs">
              <span className="font-mono text-text-muted">{s.date}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-base">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(tokens / maxTokens) * 100}%` }} />
              </div>
              <span className="tabular-nums text-right text-text-muted">{tokens.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
