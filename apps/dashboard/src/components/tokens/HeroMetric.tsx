const DEFAULT_BUDGET = 100_000;

interface Props {
  totalTokens: number;
  totalCost: number;
  dailyBudget?: number;
}

export function HeroMetric({ totalTokens, totalCost, dailyBudget = DEFAULT_BUDGET }: Props) {
  const budgetPercent = Math.min((totalTokens / dailyBudget) * 100, 100);
  const barColor = budgetPercent >= 80 ? "bg-in-progress" : budgetPercent >= 50 ? "bg-accent" : "bg-done";

  return (
    <section className="bg-card rounded-2xl p-8 border border-border shadow-2xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -right-24 -top-24 w-64 h-64 bg-accent/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        {/* Left: big number */}
        <div>
          <p className="text-text-muted text-sm font-medium mb-1">Total Consumption</p>
          <h2 className="text-5xl font-black text-text tracking-tight">
            {totalTokens.toLocaleString()}{" "}
            <span className="text-accent text-2xl font-bold">tokens</span>
          </h2>
          <p className="text-text-muted mt-2 font-medium">${totalCost.toFixed(4)} est. cost</p>
        </div>

        {/* Right: daily limit */}
        <div className="w-full md:w-72 space-y-2">
          <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-text-muted">
            <span>Daily Limit</span>
            <span className="text-text">{Math.round(budgetPercent)}%</span>
          </div>
          <div className="h-3 w-full bg-card-hover rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-text-muted text-right italic">
            {(dailyBudget / 1000).toFixed(0)}k daily budget
          </p>
        </div>
      </div>
    </section>
  );
}
