import Link from "next/link";
import { ArrowLeft, Braces, CircuitBoard, RadioTower, TerminalSquare } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import type { LabMetrics } from "@/lib/lab-metrics";

type ConceptKind = "obsidian" | "protocol" | "terminal" | "premium";

const CONFIG: Record<ConceptKind, {
  title: string;
  eyebrow: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
  copy: string;
}> = {
  obsidian: {
    title: "Obsidian Logic",
    eyebrow: "Knowledge graph runtime",
    icon: Braces,
    accent: "text-purple-300",
    copy: "A live workspace for linking lessons, project decisions, role memory, and source artifacts into a navigable agent graph.",
  },
  protocol: {
    title: "Void Protocol",
    eyebrow: "Agent operations layer",
    icon: RadioTower,
    accent: "text-accent",
    copy: "A protocol view for queued role handoffs, bridge heartbeats, event streams, and long-running multi-agent execution.",
  },
  terminal: {
    title: "Void Terminal",
    eyebrow: "Local command cockpit",
    icon: TerminalSquare,
    accent: "text-done",
    copy: "A terminal-style monitoring page for local Claude/Codex wrappers, bridge sync, context capture, and token event ingestion.",
  },
  premium: {
    title: "Premium Dashboard",
    eyebrow: "Workspace plan console",
    icon: CircuitBoard,
    accent: "text-in-progress",
    copy: "A capability overview for advanced multi-agent features, role libraries, bridge devices, and workspace automation.",
  },
};

export function ConceptScreen({ kind, metrics }: { kind: ConceptKind; metrics: LabMetrics }) {
  const cfg = CONFIG[kind];
  const Icon = cfg.icon;

  return (
    <>
      <TopBar title={cfg.title} />
      <PageShell>
        <div className="mx-auto max-w-[1400px] space-y-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text">
            <ArrowLeft size={15} />
            Back to Dashboard
          </Link>

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid gap-8 p-8 lg:grid-cols-[1fr_420px]">
              <div>
                <p className={`font-mono text-xs font-bold uppercase tracking-[0.24em] ${cfg.accent}`}>{cfg.eyebrow}</p>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-white">{cfg.title}</h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-muted">{cfg.copy}</p>
                <div className="mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
                  <Metric label="Signals" value={(metrics.sessions + metrics.toolEvents).toLocaleString()} />
                  <Metric label="Agents" value={metrics.roles.toLocaleString()} />
                  <Metric label="Devices" value={metrics.bridgeDevices.toLocaleString()} />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-bg-base p-6">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10">
                    <Icon size={30} className={cfg.accent} />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">Runtime Status</p>
                    <p className="mt-1 text-lg font-bold text-white">Connected to workspace data</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    `${metrics.projects} projects tracked`,
                    `${metrics.skills} skills indexed`,
                    `${metrics.sessions} synced sessions`,
                  ].map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                      <span className="text-sm text-text">{item}</span>
                      <span className="rounded bg-done/15 px-2 py-0.5 font-mono text-[10px] font-bold text-done">done</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Panel title="Runtime Feed" lines={metrics.recentEvents.length ? metrics.recentEvents.map((event) => `${event.label}: ${event.detail}`) : ["No runtime events yet"]} />
            <Panel title="Agent Graph" lines={[`${metrics.roles} roles available`, `${metrics.skills} skills attached`, `${metrics.bridgeDevices} bridge devices registered`]} />
            <Panel title="Artifacts" lines={metrics.recentEvents.length ? metrics.recentEvents.map((event) => `${event.date.slice(0, 10)} - ${event.label}`) : ["No synced artifacts yet"]} />
          </section>
        </div>
      </PageShell>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-base p-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Panel({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-accent">{title}</h2>
      <div className="mt-4 space-y-2">
        {lines.map((line) => (
          <div key={line} className="rounded-lg border border-border bg-bg-base px-3 py-2 font-mono text-xs text-text-muted">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
