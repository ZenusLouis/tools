import { formatCompactNumber, formatCurrency } from "@/lib/format";
import { primaryMeterValue, type MeterTotals } from "@/lib/token-accounting";

interface Props {
  totalTokens: number;
  totalCost: number;
  meterTotals: MeterTotals;
}

export function HeroMetric({ totalTokens, totalCost, meterTotals }: Props) {
  const primary = primaryMeterValue(meterTotals);
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-2xl">
      <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-accent">Token Analytics</p>
          <h2 className="break-words text-4xl font-black tracking-tight text-text md:text-5xl" title={primary.value.toLocaleString()}>
            {formatCompactNumber(primary.value)} <span className="text-2xl font-bold text-accent">{primary.unit}</span>
          </h2>
          <p className="mt-2 text-sm font-medium text-text-muted">{formatCurrency(totalCost)} estimated cost across separated meters</p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-text-muted">
            Primary view: {primary.label}. Total tracked usage rows: {totalTokens.toLocaleString()}. Claude hook estimates, Codex thread-meter tokens, and OpenAI provider-reported usage are tracked separately to avoid misleading mixed totals.
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
