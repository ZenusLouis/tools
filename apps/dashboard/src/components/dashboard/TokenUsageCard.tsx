"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";

type ProviderBreakdown = {
  provider: "claude" | "codex" | "chatgpt";
  tokens: number;
  sessionTokens: number;
  toolTokens: number;
  percent: number;
};

const PROVIDER_UI: Record<ProviderBreakdown["provider"], { label: string; color: string; bar: string }> = {
  claude: { label: "Claude", color: "text-orange-300", bar: "bg-orange-400" },
  codex: { label: "Codex", color: "text-sky-300", bar: "bg-sky-400" },
  chatgpt: { label: "ChatGPT", color: "text-emerald-300", bar: "bg-emerald-400" },
};

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

export function TokenUsageCard({
  total,
  rangeLabel,
  breakdown,
}: {
  total: number;
  rangeLabel: string;
  breakdown: ProviderBreakdown[];
}) {
  const activeBreakdown = breakdown.filter((item) => item.tokens > 0);
  const topProvider = [...breakdown].sort((a, b) => b.tokens - a.tokens)[0];
  const topLabel = topProvider && topProvider.tokens > 0 ? PROVIDER_UI[topProvider.provider].label : "No usage";

  return (
    <motion.div
      className="min-h-[170px] rounded-xl border border-border bg-card p-6 transition-colors hover:border-in-progress/40"
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-in-progress/15 text-in-progress">
          <Zap size={20} fill="currentColor" />
        </div>
        <span className="text-[10px] font-bold text-in-progress">{topLabel}</span>
      </div>

      <p className="text-3xl font-black tracking-tight text-white sm:text-4xl" title={total.toLocaleString()}>
        {compactNumber(total)}
      </p>
      <p className="mt-1 text-xs font-medium text-text-muted">Tokens {rangeLabel}</p>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[10px] font-semibold">
          <span className="text-in-progress">Provider split</span>
          <span className="text-text-muted">no usage limit</span>
        </div>
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-bg-base">
          {breakdown.map((item) => {
            const ui = PROVIDER_UI[item.provider];
            return <div key={item.provider} className={`h-full ${ui.bar}`} style={{ width: `${item.percent}%` }} />;
          })}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {(activeBreakdown.length ? activeBreakdown : breakdown.slice(0, 2)).map((item) => {
          const ui = PROVIDER_UI[item.provider];
          return (
            <div key={item.provider} className="grid grid-cols-[64px_1fr_auto] items-center gap-2 text-[10px]">
              <span className={`font-bold uppercase ${ui.color}`}>{ui.label}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-base">
                <div className={`h-full rounded-full ${ui.bar}`} style={{ width: `${item.percent}%` }} />
              </div>
              <span className="tabular-nums text-text-muted" title={item.tokens.toLocaleString()}>{compactNumber(item.tokens)}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
