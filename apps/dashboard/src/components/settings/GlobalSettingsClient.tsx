"use client";

import { useEffect, useState } from "react";
import { Activity, Network, Server, SlidersHorizontal } from "lucide-react";
import { AUTO_REFRESH_KEY } from "@/components/dashboard/AutoRefresh";
import type { McpProfile } from "@/lib/mcp";

const MCP_PROFILE_KEY = "default-mcp-profile";
const DATE_FORMAT_KEY = "date-format";

export function GlobalSettingsClient({ profiles }: { profiles: McpProfile[] }) {
  const [coreRuntime, setCoreRuntime] = useState<{
    enabled: boolean;
    reachable: boolean;
    runtimeMode: string | null;
    url: string | null;
    contractVersion: number | null;
    error: string | null;
  } | null>(null);
  const [coreSmoke, setCoreSmoke] = useState<{
    running: boolean;
    ok: boolean | null;
    actionId?: string | null;
    steps: Array<{ name: string; ok: boolean; status?: string | null; detail?: string | null }>;
    error?: string | null;
  }>({ running: false, ok: null, steps: [] });
  const [currentUsage] = useState(() => {
    if (typeof window === "undefined") return 0;
    const statsKey = `token-count-${new Date().toISOString().slice(0, 10)}`;
    return parseInt(localStorage.getItem(statsKey) ?? "0", 10) || 0;
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

  function saveProfile(value: string) {
    setSelectedProfile(value);
    localStorage.setItem(MCP_PROFILE_KEY, value);
  }

  function toggleAutoRefresh() {
    const next = !autoRefresh;
    setAutoRefresh(next);
    localStorage.setItem(AUTO_REFRESH_KEY, String(next));
  }

  function setDateFormatAndSave(format: "iso" | "relative") {
    setDateFormat(format);
    localStorage.setItem(DATE_FORMAT_KEY, format);
  }

  async function runCoreSmoke() {
    setCoreSmoke({ running: true, ok: null, steps: [] });
    try {
      const response = await fetch("/api/core-runtime/smoke", { method: "POST" });
      const payload = await response.json();
      setCoreSmoke({
        running: false,
        ok: !!payload.ok,
        actionId: payload.actionId ?? null,
        steps: Array.isArray(payload.steps) ? payload.steps : [],
        error: payload.error ?? null,
      });
    } catch (error) {
      setCoreSmoke({
        running: false,
        ok: false,
        steps: [],
        error: error instanceof Error ? error.message : "Failed to run Core API smoke test",
      });
    }
  }

  const selectedProfileData = profiles.find((profile) => profile.profile === selectedProfile);

  useEffect(() => {
    let mounted = true;

    fetch("/api/core-runtime", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (mounted) setCoreRuntime(payload.status ?? null);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setCoreRuntime({
          enabled: false,
          reachable: false,
          runtimeMode: "unknown",
          url: "",
          contractVersion: null,
          error: error instanceof Error ? error.message : "Failed to load Core API status",
        });
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <section className="flex flex-col justify-between rounded-xl border border-border bg-card p-6">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              <Activity size={18} className="text-accent" />
            </div>
            <h3 className="font-bold text-text">Token Telemetry</h3>
          </div>
          <p className="font-mono text-3xl font-black text-text">{currentUsage.toLocaleString()}</p>
          <p className="mt-1 text-xs text-text-muted">Tracked locally today. No usage limit is enforced.</p>
        </div>
        <div className="mt-8 rounded-lg border border-border bg-bg-base px-3 py-2 text-xs text-done">
          Unlimited tracking mode
        </div>
      </section>

      <section className="flex flex-col justify-between rounded-xl border border-border bg-card p-6">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-done/10">
              <Network size={18} className="text-done" />
            </div>
            <h3 className="font-bold text-text">Default MCP Profile</h3>
          </div>

          <div className="space-y-4">
            <select value={selectedProfile} onChange={(event) => saveProfile(event.target.value)} className="w-full cursor-pointer appearance-none rounded-lg border border-border bg-bg-base px-4 py-2 text-text outline-none focus:ring-1 focus:ring-accent">
              <option value="">none</option>
              {profiles.map((profile) => <option key={profile.profile} value={profile.profile}>{profile.profile}</option>)}
            </select>

            {selectedProfileData ? (
              <div className="rounded-lg border border-border/50 bg-card-hover p-3">
                <p className="text-xs leading-relaxed text-text-muted">
                  Includes servers: {selectedProfileData.servers.join(", ")}
                </p>
              </div>
            ) : (
              <p className="text-xs text-text-muted">Select a profile to see included servers.</p>
            )}
          </div>
        </div>
        <p className="mt-4 text-[10px] italic text-text-muted">Active profile applied to all new CLI sessions.</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-in-progress/10">
            <SlidersHorizontal size={18} className="text-in-progress" />
          </div>
          <h3 className="font-bold text-text">Dashboard Settings</h3>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">Auto-refresh (30s)</p>
              <p className="text-[11px] text-text-muted">Live data polling</p>
            </div>
            <button onClick={toggleAutoRefresh} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoRefresh ? "bg-accent" : "bg-border"}`} role="switch" aria-checked={autoRefresh}>
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${autoRefresh ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Date Format</label>
            <div className="grid grid-cols-2 gap-2">
              {(["iso", "relative"] as const).map((format) => (
                <button key={format} onClick={() => setDateFormatAndSave(format)} className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-colors ${dateFormat === format ? "border-accent/50 bg-accent/20 text-accent" : "border-border bg-bg-base text-text-muted hover:text-text"}`}>
                  {format === "iso" ? "ISO 8601" : "Relative"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
            <Server size={18} className="text-accent" />
          </div>
          <h3 className="font-bold text-text">Core API Runtime</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-bg-base px-3 py-2">
            <span className="text-xs text-text-muted">Status</span>
            <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${coreRuntime?.reachable ? "bg-done/15 text-done" : coreRuntime?.enabled ? "bg-blocked/15 text-blocked" : "bg-text-muted/10 text-text-muted"}`}>
              {coreRuntime?.reachable ? "online" : coreRuntime?.enabled ? "offline" : "disabled"}
            </span>
          </div>

          <div className="rounded-lg border border-border/50 bg-card-hover p-3 text-xs leading-relaxed text-text-muted">
            <p>Mode: <span className="font-mono text-text">{coreRuntime?.runtimeMode ?? "loading"}</span></p>
            <p>URL: <span className="font-mono text-text">{coreRuntime?.url || "not configured"}</span></p>
            <p>Contract: <span className="font-mono text-text">{coreRuntime?.contractVersion ?? "n/a"}</span></p>
            {coreRuntime?.error ? <p className="mt-2 text-blocked">{coreRuntime.error}</p> : null}
          </div>

          <button
            type="button"
            onClick={runCoreSmoke}
            disabled={!coreRuntime?.reachable || coreSmoke.running}
            className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text transition-colors hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {coreSmoke.running ? "Running Lifecycle Smoke..." : "Run Lifecycle Smoke"}
          </button>

          {coreSmoke.ok !== null || coreSmoke.error ? (
            <div className={`rounded-lg border p-3 text-xs ${coreSmoke.ok ? "border-done/40 bg-done/10" : "border-blocked/40 bg-blocked/10"}`}>
              <p className={`font-bold ${coreSmoke.ok ? "text-done" : "text-blocked"}`}>
                {coreSmoke.ok ? "Smoke passed" : "Smoke failed"}
              </p>
              {coreSmoke.actionId ? <p className="mt-1 font-mono text-text-muted">Action: {coreSmoke.actionId}</p> : null}
              {coreSmoke.error ? <p className="mt-1 text-blocked">{coreSmoke.error}</p> : null}
              {coreSmoke.steps.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {coreSmoke.steps.map((step) => (
                    <div key={step.name} className="flex items-center justify-between gap-2">
                      <span className="font-mono text-text-muted">{step.name}</span>
                      <span className={step.ok ? "text-done" : "text-blocked"}>{step.status ?? step.detail ?? (step.ok ? "ok" : "failed")}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
