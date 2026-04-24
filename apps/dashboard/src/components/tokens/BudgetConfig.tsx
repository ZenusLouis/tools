"use client";

import { useState, useEffect } from "react";
import { BudgetWarningBanner } from "./BudgetWarningBanner";

const STORAGE_KEY = "token-daily-budget";
const DEFAULT_BUDGET = 100_000;

interface Props {
  totalTokens: number;
}

export function BudgetConfig({ totalTokens }: Props) {
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [input, setInput] = useState(String(DEFAULT_BUDGET));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n > 0) {
        setBudget(n);
        setInput(String(n));
      }
    }
  }, []);

  function handleSave() {
    const n = parseInt(input.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(n) && n > 0) {
      setBudget(n);
      localStorage.setItem(STORAGE_KEY, String(n));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <BudgetWarningBanner totalTokens={totalTokens} dailyBudget={budget} />

      <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <label className="text-xs font-medium text-text-muted whitespace-nowrap">
          Daily budget limit
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={input}
          onChange={(e) => { setInput(e.target.value); setSaved(false); }}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="flex-1 min-w-0 rounded-lg border bg-card-hover px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent tabular-nums"
          placeholder="100000"
        />
        <span className="text-xs text-text-muted shrink-0">tokens</span>
        <button
          onClick={handleSave}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors shrink-0 ${
            saved
              ? "bg-done/15 text-done"
              : "bg-accent/15 text-accent hover:bg-accent/25"
          }`}
        >
          {saved ? "Saved!" : "Save"}
        </button>
      </div>
    </div>
  );
}
