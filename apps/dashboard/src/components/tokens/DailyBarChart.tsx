"use client";

import { BarChart2 } from "lucide-react";
import type { DailyUsage } from "@/lib/analytics";

interface Props {
  dailyUsage: DailyUsage[];
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}

export function DailyBarChart({ dailyUsage }: Props) {
  if (dailyUsage.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-6 border border-border flex items-center justify-center h-48">
        <p className="text-sm text-text-muted">No data</p>
      </div>
    );
  }

  const data = dailyUsage.map((d) => ({
    date: d.date,
    label: getDayLabel(d.date),
    tokens: d.tokens,
    today: isToday(d.date),
  }));

  const maxTokens = Math.max(...data.map((d) => d.tokens), 1);

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <div className="flex justify-between items-start mb-8">
        <h3 className="text-text font-bold flex items-center gap-2">
          <BarChart2 size={16} className="text-accent" />
          7-day usage history
        </h3>
        <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest px-2 py-1 bg-bg-base rounded border border-border">
          Tokens/Day
        </div>
      </div>

      <div className="h-44 flex items-end justify-between gap-2 px-2">
        {data.map((entry) => {
          const heightPct = (entry.tokens / maxTokens) * 100;
          return (
            <div key={entry.date} className="flex flex-col items-center gap-3 w-full">
              <div className="w-full relative" style={{ height: "160px" }}>
                {entry.today && entry.tokens > 0 && (
                  <div
                    className="absolute -top-7 left-1/2 -translate-x-1/2 text-accent font-black text-xs whitespace-nowrap"
                  >
                    {entry.tokens >= 1000 ? `${(entry.tokens / 1000).toFixed(0)}k` : entry.tokens}
                  </div>
                )}
                <div
                  className={`absolute bottom-0 left-0 right-0 rounded-t transition-all ${
                    entry.today
                      ? "bg-accent shadow-[0_-4px_20px_rgba(99,102,241,0.3)]"
                      : "bg-card-hover hover:bg-border"
                  }`}
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                />
              </div>
              <span className={`text-[10px] font-bold uppercase ${entry.today ? "text-accent" : "text-text-muted"}`}>
                {entry.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
