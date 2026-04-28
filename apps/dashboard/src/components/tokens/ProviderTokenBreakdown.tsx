import { Bot, Cpu, MessageSquare } from "lucide-react";
import type { ProviderBreakdown } from "@/lib/analytics";
import { formatCompactNumber, formatCurrency } from "@/lib/format";

const PROVIDER_META = {
  claude: { label: "Claude", icon: Bot, color: "bg-done", text: "text-done" },
  codex: { label: "Codex", icon: Cpu, color: "bg-accent", text: "text-accent" },
  chatgpt: { label: "ChatGPT", icon: MessageSquare, color: "bg-in-progress", text: "text-in-progress" },
} satisfies Record<ProviderBreakdown["provider"], { label: string; icon: typeof Bot; color: string; text: string }>;

export function ProviderTokenBreakdown({ breakdown }: { breakdown: ProviderBreakdown[] }) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {breakdown.map((item) => {
        const meta = PROVIDER_META[item.provider];
        const Icon = meta.icon;
        return (
          <article key={item.provider} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-bg-base">
                  <Icon size={18} className={meta.text} />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Provider</p>
                  <h3 className="text-base font-bold text-text">{meta.label}</h3>
                </div>
              </div>
              <span className={`rounded-md bg-bg-base px-2 py-1 font-mono text-xs font-bold ${meta.text}`}>
                {item.percent}%
              </span>
            </div>

            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-black tabular-nums text-text" title={item.tokens.toLocaleString()}>{formatCompactNumber(item.tokens)}</p>
                <p className="mt-1 text-xs text-text-muted">{formatCurrency(item.cost)} estimated</p>
              </div>
              <div className="text-right text-[11px] text-text-muted">
                <p>session {item.sessionTokens.toLocaleString()}</p>
                <p>tool {item.toolTokens.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg-base">
              <div className={`h-full rounded-full ${meta.color}`} style={{ width: `${item.percent}%` }} />
            </div>
          </article>
        );
      })}
    </section>
  );
}
