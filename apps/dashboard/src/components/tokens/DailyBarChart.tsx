"use client";

import { BarChart2, TrendingUp } from "lucide-react";
import type { DailyUsage } from "@/lib/analytics";

interface Props {
  dailyUsage: DailyUsage[];
  isToday?: boolean;
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

// SVG line chart for hourly view
function LineChart({ data }: { data: { label: string; tokens: number }[] }) {
  const W = 600;
  const H = 140;
  const PAD = { t: 20, r: 10, b: 28, l: 42 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const max = Math.max(...data.map((d) => d.tokens), 1);
  const pts = data.map((d, i) => ({
    x: PAD.l + (i / Math.max(data.length - 1, 1)) * iW,
    y: PAD.t + iH - (d.tokens / max) * iH,
    tokens: d.tokens,
    label: d.label,
  }));

  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = [
    `M${pts[0].x},${PAD.t + iH}`,
    ...pts.map((p) => `L${p.x},${p.y}`),
    `L${pts[pts.length - 1].x},${PAD.t + iH}`,
    "Z",
  ].join(" ");

  // Y-axis ticks
  const yTicks = [0, 0.5, 1].map((f) => ({
    y: PAD.t + iH - f * iH,
    label: fmt(Math.round(f * max)),
  }));

  // Show every Nth label to avoid crowding (aim for ~8 labels max)
  const step = Math.max(1, Math.ceil(data.length / 8));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((t) => (
        <g key={t.y}>
          <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="#ffffff08" strokeWidth="1" />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="#6b7280">{t.label}</text>
        </g>
      ))}

      {/* Area fill */}
      <path d={area} fill="url(#areaGrad)" />

      {/* Line */}
      <polyline points={polyline} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots + X labels */}
      {pts.map((p, i) => (
        <g key={i}>
          {p.tokens > 0 && (
            <circle cx={p.x} cy={p.y} r="3" fill="#6366f1" stroke="#080d1b" strokeWidth="1.5" />
          )}
          {i % step === 0 && (
            <text x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="#6b7280">{p.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

// Bar chart for week/month/year
function BarChart({ data }: { data: { label: string; tokens: number; isHighlight: boolean }[] }) {
  const max = Math.max(...data.map((d) => d.tokens), 1);
  return (
    <div className="h-44 flex items-end justify-between gap-1.5 px-1">
      {data.map((entry, i) => {
        const pct = (entry.tokens / max) * 100;
        return (
          <div key={i} className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <div className="w-full relative" style={{ height: 160 }}>
              {entry.isHighlight && entry.tokens > 0 && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-accent font-black text-[10px] whitespace-nowrap">
                  {fmt(entry.tokens)}
                </div>
              )}
              <div
                className={`absolute bottom-0 left-0 right-0 rounded-t transition-all ${entry.isHighlight ? "bg-accent shadow-[0_-4px_20px_rgba(99,102,241,0.3)]" : "bg-card-hover hover:bg-border"}`}
                style={{ height: `${Math.max(pct, 3)}%` }}
              />
            </div>
            <span className={`text-[9px] font-bold uppercase truncate w-full text-center ${entry.isHighlight ? "text-accent" : "text-text-muted"}`}>
              {entry.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DailyBarChart({ dailyUsage, isToday = false }: Props) {
  if (dailyUsage.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-6 border border-border flex items-center justify-center h-48">
        <p className="text-sm text-text-muted">No data</p>
      </div>
    );
  }

  const todayDate = new Date().toISOString().slice(0, 10);
  const nowHour = new Date().getHours();

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-text font-bold flex items-center gap-2">
          {isToday ? <TrendingUp size={16} className="text-accent" /> : <BarChart2 size={16} className="text-accent" />}
          Usage history
        </h3>
        <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest px-2 py-1 bg-bg-base rounded border border-border">
          {isToday ? "Tokens/Min" : "Tokens/Day"}
        </div>
      </div>

      {isToday ? (
        <LineChart data={dailyUsage.map((d) => ({ label: d.label, tokens: d.tokens }))} />
      ) : (
        <BarChart
          data={dailyUsage.map((d) => ({
            label: d.label,
            tokens: d.tokens,
            isHighlight: d.date === todayDate || d.date?.endsWith(`T${nowHour.toString().padStart(2, "0")}`),
          }))}
        />
      )}
    </div>
  );
}
