"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { formatCredits, formatNumber } from "@/lib/format";


type ProviderBreakdown = {
  provider: "claude" | "codex" | "chatgpt";
  tokens: number;
  sessionTokens: number;
  toolTokens: number;
  percent: number;
  meterLabel: string;
  meterKind: "provider_reported" | "thread_meter" | "hook_estimate";
  meterDescription: string;
  credits: number;
  creditBasis: string;
  creditNote: string;
};

const PROVIDER_UI: Record<ProviderBreakdown["provider"], { label: string; color: string; bar: string }> = {
  claude: { label: "Claude", color: "text-orange-300", bar: "bg-orange-400" },
  codex: { label: "Codex", color: "text-sky-300", bar: "bg-sky-400" },
  chatgpt: { label: "ChatGPT", color: "text-emerald-300", bar: "bg-emerald-400" },
};

function displayValue(item: ProviderBreakdown) {
  return {
    value: `${formatNumber(item.tokens)} tokens`,
    rawTitle: item.provider === "codex" && item.credits > 0
      ? `${formatNumber(item.tokens)} token equivalent; ${formatCredits(item.credits)}`
      : formatNumber(item.tokens),
  };
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
  const totalCredits = breakdown.reduce((sum, item) => sum + item.credits, 0);
  const primaryValue = formatNumber(total);
  const primaryLabel = `Tokens ${rangeLabel}`;

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

      <p className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl" title={totalCredits > 0 ? `${formatNumber(total)} token equivalent; ${formatCredits(totalCredits)}` : formatNumber(total)}>
        {primaryValue}
      </p>
      <p className="mt-1 text-xs font-medium text-text-muted">{primaryLabel}</p>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[10px] font-semibold">
          <span className="text-in-progress">Provider split</span>
          <span className="text-text-muted">usage</span>
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
          const display = displayValue(item);
          return (
            <div key={item.provider} className="grid grid-cols-[64px_1fr_auto] items-center gap-2 text-[10px]" title={display.rawTitle}>
              <span className={`font-bold uppercase ${ui.color}`}>{ui.label}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-base">
                <div className={`h-full rounded-full ${ui.bar}`} style={{ width: `${item.percent}%` }} />
              </div>
              <span className="tabular-nums text-text-muted">{display.value}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
