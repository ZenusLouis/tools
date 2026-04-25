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
          <h2 className="font-mono text-5xl font-black tracking-tight text-text">
            {totalTokens.toLocaleString()} <span className="text-2xl font-bold text-accent">tokens</span>
          </h2>
          <p className="mt-2 text-sm font-medium text-text-muted">${totalCost.toFixed(4)} estimated cost across connected agents</p>
        </div>

        <div className="rounded-xl border border-border bg-bg-base px-5 py-4 text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Policy</p>
          <p className="mt-1 font-mono text-sm font-bold text-done">No usage limit</p>
        </div>
      </div>
    </section>
  );
}
