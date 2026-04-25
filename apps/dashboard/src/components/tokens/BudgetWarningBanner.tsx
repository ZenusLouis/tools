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
    <div className="bg-in-progress/10 border border-in-progress/20 text-in-progress px-4 py-3 rounded-xl flex items-center gap-2">
      <AlertTriangle size={16} className="shrink-0" />
      <span className="font-medium tracking-tight text-sm">
        Token budget {pct}% used{pct >= 100 ? " — daily limit reached" : ". Consider running /compact."}
      </span>
    </div>
  );
}
