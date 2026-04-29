import { formatCompactNumber, formatCurrency } from "@/lib/format";

interface Props {
  totalTokens: number;
  totalCost: number;
}

export function HeroMetric({ totalTokens, totalCost }: Props) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-2xl">
      <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-accent">Token Analytics</p>
          <h2 className="break-words text-4xl font-black tracking-tight text-text md:text-5xl" title={totalTokens.toLocaleString()}>
            {formatCompactNumber(totalTokens)} <span className="text-2xl font-bold text-accent">tokens</span>
          </h2>
          <p className="mt-2 text-sm font-medium text-text-muted">{formatCurrency(totalCost)} blended estimate across mixed token meters</p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-text-muted">
            Codex credits follow OpenAI&apos;s token-based rate card. Because local Codex currently exposes total thread tokens, rows without token split are shown as input-equivalent credit estimates.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-bg-base px-5 py-4 text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Policy</p>
          <p className="mt-1 text-sm font-bold text-done">No usage limit</p>
        </div>
      </div>
    </section>
  );
}
