"use client";

import { useState } from "react";
import { Zap, Network, SlidersHorizontal } from "lucide-react";
import { AUTO_REFRESH_KEY } from "@/components/dashboard/AutoRefresh";
import type { McpProfile } from "@/lib/mcp";

const BUDGET_KEY = "token-daily-budget";
const MCP_PROFILE_KEY = "default-mcp-profile";
const DATE_FORMAT_KEY = "date-format";
const DEFAULT_BUDGET = 100_000;

interface Props {
  profiles: McpProfile[];
}

export function GlobalSettingsClient({ profiles }: Props) {
  const [budgetInput, setBudgetInput] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_BUDGET.toLocaleString();
    const budget = localStorage.getItem(BUDGET_KEY);
    return budget ? parseInt(budget, 10).toLocaleString() : DEFAULT_BUDGET.toLocaleString();
  });
  const [budgetSaved, setBudgetSaved] = useState(false);
  const [currentUsage] = useState(() => {
    if (typeof window === "undefined") return 0;
    const statsKey = `token-count-${new Date().toISOString().slice(0, 10)}`;
    const stored = localStorage.getItem(statsKey);
    return stored ? parseInt(stored, 10) || 0 : 0;
  });
  const [selectedProfile, setSelectedProfile] = useState(() => {
    if (typeof window === "undefined") return "fullstack";
    return localStorage.getItem(MCP_PROFILE_KEY) ?? "fullstack";
  });
  const [autoRefresh, setAutoRefresh] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(AUTO_REFRESH_KEY) !== "false";
  });
  const [dateFormat, setDateFormat] = useState<"iso" | "relative">(() => {
    if (typeof window === "undefined") return "iso";
    return localStorage.getItem(DATE_FORMAT_KEY) === "relative" ? "relative" : "iso";
  });

  function saveBudget() {
    const n = parseInt(budgetInput.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(n) && n > 0) {
      localStorage.setItem(BUDGET_KEY, String(n));
      setBudgetInput(n.toLocaleString());
      setBudgetSaved(true);
      setTimeout(() => setBudgetSaved(false), 2000);
    }
  }

  function saveProfile(value: string) {
    setSelectedProfile(value);
    localStorage.setItem(MCP_PROFILE_KEY, value);
  }

  function toggleAutoRefresh() {
    const next = !autoRefresh;
    setAutoRefresh(next);
    localStorage.setItem(AUTO_REFRESH_KEY, String(next));
  }

  function setDateFormatAndSave(fmt: "iso" | "relative") {
    setDateFormat(fmt);
    localStorage.setItem(DATE_FORMAT_KEY, fmt);
  }

  const budget = parseInt(budgetInput.replace(/[^0-9]/g, ""), 10) || DEFAULT_BUDGET;
  const usagePct = Math.min((currentUsage / budget) * 100, 100);
  const selectedProfileData = profiles.find((p) => p.profile === selectedProfile);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Card 1: Token Budget */}
      <section className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between shadow-2xl shadow-accent/5">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Zap size={18} className="text-accent" />
            </div>
            <h3 className="font-bold text-text">Token Budget</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider font-bold text-text-muted">Daily limit</label>
              <input
                type="text"
                inputMode="numeric"
                value={budgetInput}
                onChange={(e) => { setBudgetInput(e.target.value); setBudgetSaved(false); }}
                onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                className="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-accent font-mono focus:ring-1 focus:ring-accent outline-none"
              />
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Current Usage</span>
                <span className="text-accent font-semibold">
                  {currentUsage.toLocaleString()} / {(budget / 1000).toFixed(0)}k
                </span>
              </div>
              <div className="w-full h-2 bg-card-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-500"
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={saveBudget}
          className={`mt-8 w-full py-2 rounded-lg font-semibold text-sm transition-all shadow-lg active:scale-[0.98] ${
            budgetSaved
              ? "bg-done/15 text-done"
              : "bg-accent hover:bg-accent-hover text-white shadow-accent/20"
          }`}
        >
          {budgetSaved ? "Saved!" : "Save Changes"}
        </button>
      </section>

      {/* Card 2: Default MCP Profile */}
      <section className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between shadow-2xl shadow-accent/5">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-done/10 flex items-center justify-center shrink-0">
              <Network size={18} className="text-done" />
            </div>
            <h3 className="font-bold text-text">Default MCP Profile</h3>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <select
                value={selectedProfile}
                onChange={(e) => saveProfile(e.target.value)}
                className="w-full bg-bg-base border border-border rounded-lg px-4 py-2 text-text appearance-none focus:ring-1 focus:ring-accent outline-none cursor-pointer"
              >
                <option value="">— none —</option>
                {profiles.map((p) => (
                  <option key={p.profile} value={p.profile}>{p.profile}</option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-xs">▼</span>
            </div>

            {selectedProfileData ? (
              <div className="p-3 bg-card-hover rounded-lg border border-border/50">
                <p className="text-xs text-text-muted leading-relaxed">
                  Includes pre-configured servers:{" "}
                  {selectedProfileData.servers.map((s, i) => (
                    <span key={s}>
                      <span className="text-accent font-medium">{s}</span>
                      {i < selectedProfileData.servers.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              </div>
            ) : (
              <p className="text-xs text-text-muted">Select a profile to see included servers.</p>
            )}
          </div>
        </div>
        <p className="text-[10px] text-text-muted italic mt-4">Active profile applied to all new CLI sessions.</p>
      </section>

      {/* Card 3: Dashboard Settings */}
      <section className="bg-card border border-border rounded-xl p-6 shadow-2xl shadow-accent/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-in-progress/10 flex items-center justify-center shrink-0">
            <SlidersHorizontal size={18} className="text-in-progress" />
          </div>
          <h3 className="font-bold text-text">Dashboard Settings</h3>
        </div>

        <div className="space-y-6">
          {/* Auto-refresh toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">Auto-refresh (30s)</p>
              <p className="text-[11px] text-text-muted">Live data polling</p>
            </div>
            <button
              onClick={toggleAutoRefresh}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                autoRefresh ? "bg-accent" : "bg-border"
              }`}
              role="switch"
              aria-checked={autoRefresh}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${autoRefresh ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Date format */}
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-wider font-bold text-text-muted">Date Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDateFormatAndSave("iso")}
                className={`px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${
                  dateFormat === "iso"
                    ? "bg-accent/20 border border-accent/50 text-accent"
                    : "bg-bg-base border border-border text-text-muted hover:text-text"
                }`}
              >
                ISO 8601
              </button>
              <button
                onClick={() => setDateFormatAndSave("relative")}
                className={`px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${
                  dateFormat === "relative"
                    ? "bg-accent/20 border border-accent/50 text-accent"
                    : "bg-bg-base border border-border text-text-muted hover:text-text"
                }`}
              >
                Relative
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
