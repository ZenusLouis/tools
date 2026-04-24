"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ToolBreakdown } from "@/lib/analytics";

const TOOL_COLORS: Record<string, string> = {
  Read:   "#6366f1",
  Write:  "#22c55e",
  Bash:   "#eab308",
  Grep:   "#f97316",
  Glob:   "#ec4899",
  Agent:  "#06b6d4",
  Edit:   "#8b5cf6",
};

function getColor(tool: string, idx: number): string {
  if (TOOL_COLORS[tool]) return TOOL_COLORS[tool];
  const fallbacks = ["#94a3b8", "#64748b", "#475569", "#334155"];
  return fallbacks[idx % fallbacks.length];
}

function getPercent(payload: unknown): number {
  if (payload && typeof payload === "object" && "percent" in payload) {
    const percent = payload.percent;
    return typeof percent === "number" ? percent : 0;
  }
  return 0;
}

interface Props {
  breakdown: ToolBreakdown[];
}

export function DonutChart({ breakdown }: Props) {
  if (breakdown.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 flex items-center justify-center h-64">
        <p className="text-sm text-text-muted">No data</p>
      </div>
    );
  }

  const data = breakdown.map((b) => ({ name: b.tool, value: b.tokens, percent: b.percent }));

  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Token Split by Tool</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, idx) => (
              <Cell key={entry.name} fill={getColor(entry.name, idx)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 8, fontSize: 12 }}
            itemStyle={{ color: "#e2e8f0" }}
            formatter={(value) => {
              const tokens = typeof value === "number" ? value : Number(value ?? 0);
              return [`${tokens.toLocaleString()} tokens`, ""];
            }}
          />
          <Legend
            formatter={(value, entry) => `${String(value)} (${getPercent(entry.payload)}%)`}
            wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
