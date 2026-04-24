import { AlertTriangle } from "lucide-react";

interface Props {
  totalTokens: number;
  dailyBudget: number;
  threshold?: number;
}

export function BudgetWarningBanner({ totalTokens, dailyBudget, threshold = 0.8 }: Props) {
  const percent = totalTokens / dailyBudget;
  if (percent < threshold) return null;

  const pct = Math.round(percent * 100);

  return (
    <div className="bg-in-progress/10 border border-in-progress/20 text-in-progress px-4 py-3 rounded-xl flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertTriangle size={20} />
        <span className="font-medium tracking-tight">
          Budget {pct}% used{pct >= 100 ? " — limit exceeded" : ""}
        </span>
      </div>
      <button className="text-xs font-bold uppercase tracking-wider bg-in-progress text-bg-base px-3 py-1 rounded-full">
        Upgrade Plan
      </button>
    </div>
  );
}
