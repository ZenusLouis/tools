"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Clock3,
  ExternalLink,
  Loader2,
  RotateCcw,
  TerminalSquare,
  X,
  XCircle,
} from "lucide-react";

type QueueAction = {
  id: string;
  status: string;
  error: string | null;
  taskId: string | null;
  taskName: string | null;
  provider: string | null;
  phase: string | null;
  role: string | null;
  optimizer: OptimizerInfo | null;
  skillRouting: SkillRoutingInfo | null;
  contextPlan: ContextPlanInfo | null;
  deviceName: string | null;
  artifactPath: string | null;
  exitCode: number | null;
  actualTokens: number | null;
  contextReportPath: string | null;
  lastLogLine: string | null;
  logTail: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type QueueActionDetail = {
  id: string;
  status: string;
  error: string | null;
  taskId: string | null;
  provider: string | null;
  phase: string | null;
  role: string | null;
  optimizer: OptimizerInfo | null;
  skillRouting: SkillRoutingInfo | null;
  contextPlan: ContextPlanInfo | null;
  deviceName: string | null;
  artifactPath: string | null;
  exitCode: number | null;
  actualTokens: number | null;
  contextReportPath: string | null;
  contextReport: Record<string, unknown> | null;
  command: string | null;
  log: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type OptimizerInfo = {
  mode?: string;
  contextMode?: string;
  model?: string | null;
  modelSource?: string;
  modelReason?: string;
  estimatedPromptTokens?: number;
  reason?: string;
};

type SkillRoutingInfo = {
  selected?: Array<{ slug?: string; score?: number; reasons?: string[] }>;
  omittedCount?: number;
  tokenCost?: string;
};

type ContextPlanInfo = {
  mode?: string;
  includedBlocks?: string[];
  omittedBlocks?: string[];
};

type QueueFilter = "all" | "live" | "failed" | "done";
type ProviderFilter = "all" | "claude" | "codex";
type PhaseFilter = "all" | "analysis" | "implementation" | "review";
type QueueCounts = Record<QueueFilter, number>;

const FILTERS: Array<{ value: QueueFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "failed", label: "Failed" },
  { value: "done", label: "Done" },
];

const PROVIDERS: Array<{ value: ProviderFilter; label: string }> = [
  { value: "all", label: "All agents" },
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" },
];

const PHASES: Array<{ value: PhaseFilter; label: string }> = [
  { value: "all", label: "All phases" },
  { value: "analysis", label: "Brief" },
  { value: "implementation", label: "Build" },
  { value: "review", label: "Review" },
];

function statusClass(status: string) {
  if (status === "succeeded") return "border-done/30 bg-done/10 text-done";
  if (status === "failed") return "border-blocked/30 bg-blocked/10 text-blocked";
  if (status === "cancelled") return "border-text-muted/30 bg-text-muted/10 text-text-muted";
  if (status === "running") return "border-accent/30 bg-accent/10 text-accent";
  return "border-in-progress/30 bg-in-progress/10 text-in-progress";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "succeeded") return <CheckCircle2 size={12} />;
  if (status === "failed" || status === "cancelled") return <XCircle size={12} />;
  if (status === "running") return <Loader2 size={12} className="animate-spin" />;
  return <Clock3 size={12} />;
}

function timeLabel(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function commandFromLog(action: QueueAction) {
  return action.logTail.find((line) => line.startsWith("CMD: "))?.slice(5) ?? null;
}

function contextReportObject(report: Record<string, unknown> | null | undefined, key: string) {
  return report && typeof report[key] === "object" && report[key] !== null && !Array.isArray(report[key])
    ? report[key] as Record<string, unknown>
    : null;
}

export function RunQueueCard({ projectName }: { projectName: string }) {
  const [actions, setActions] = useState<QueueAction[]>([]);
  const [visibleLimit, setVisibleLimit] = useState(8);
  const [totalActions, setTotalActions] = useState(0);
  const [counts, setCounts] = useState<QueueCounts>({ all: 0, live: 0, failed: 0, done: 0 });
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);
  const [detailAction, setDetailAction] = useState<QueueActionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const hasLiveAction = useMemo(
    () => actions.some((action) => action.status === "pending" || action.status === "running"),
    [actions],
  );
  const liveActions = useMemo(
    () => actions.filter((action) => action.taskId && (action.status === "pending" || action.status === "running")),
    [actions],
  );
  const retryableActions = useMemo(
    () => actions.filter((action) => action.taskId && (action.status === "failed" || action.status === "cancelled")),
    [actions],
  );

  const loadQueue = useCallback(async (active = true) => {
      try {
        const params = new URLSearchParams({
          limit: String(visibleLimit),
          status: filter,
          provider: providerFilter,
          phase: phaseFilter,
        });
        const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/run-queue?${params.toString()}`, { cache: "no-store" });
        const body = await res.json().catch(() => ({})) as { actions?: QueueAction[]; total?: number; counts?: Partial<QueueCounts>; error?: string };
        if (!active) return;
        if (!res.ok) {
          setError(body.error ?? "Failed to load run queue.");
          return;
        }
        setActions(body.actions ?? []);
        setTotalActions(body.total ?? body.actions?.length ?? 0);
        setCounts({
          all: body.counts?.all ?? 0,
          live: body.counts?.live ?? 0,
          failed: body.counts?.failed ?? 0,
          done: body.counts?.done ?? 0,
        });
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load run queue.");
      } finally {
        if (active) setLoading(false);
      }
  }, [filter, phaseFilter, projectName, providerFilter, visibleLimit]);

  useEffect(() => {
    let active = true;

    function refreshQueue() {
      void loadQueue(active);
    }

    const initialTimer = window.setTimeout(() => void loadQueue(active), 0);
    const timer = window.setInterval(() => void loadQueue(active), hasLiveAction ? 10000 : 20000);
    window.addEventListener("gcs-run-queue-refresh", refreshQueue);
    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      window.removeEventListener("gcs-run-queue-refresh", refreshQueue);
    };
  }, [hasLiveAction, loadQueue]);

  async function cancelTaskRun(action: QueueAction) {
    if (!action.taskId) return;
    setBusyActionId(action.id);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(action.taskId)}/run/cancel`, { method: "POST" });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) setError(body.error ?? "Failed to cancel task run.");
      await loadQueue();
    } finally {
      setBusyActionId(null);
    }
  }

  async function retryTaskRun(action: QueueAction) {
    if (!action.taskId) return;
    setBusyActionId(action.id);
    setError(null);
    try {
      const phase = action.phase === "analysis" || action.phase === "review" || action.phase === "implementation"
        ? action.phase
        : "implementation";
      const provider = action.provider === "claude" || action.provider === "codex" ? action.provider : undefined;
      const res = await fetch(`/api/tasks/${encodeURIComponent(action.taskId)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, provider }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) setError(body.error ?? "Failed to retry task run.");
      await loadQueue();
    } finally {
      setBusyActionId(null);
    }
  }

  async function cancelLiveRuns() {
    if (liveActions.length === 0) return;
    setBusyActionId("bulk-cancel");
    setError(null);
    try {
      for (const action of liveActions) {
        await cancelTaskRun(action);
      }
      await loadQueue();
    } finally {
      setBusyActionId(null);
    }
  }

  async function retryFailedRuns() {
    if (retryableActions.length === 0) return;
    setBusyActionId("bulk-retry");
    setError(null);
    try {
      for (const action of retryableActions.slice(0, 5)) {
        await retryTaskRun(action);
      }
      await loadQueue();
    } finally {
      setBusyActionId(null);
    }
  }

  async function copyCommand(action: QueueAction) {
    const command = commandFromLog(action);
    if (!command) return;
    await navigator.clipboard.writeText(command);
    setCopiedActionId(action.id);
    window.setTimeout(() => setCopiedActionId((current) => current === action.id ? null : current), 1500);
  }

  async function openFullLog(action: QueueAction) {
    setDetailLoading(true);
    setDetailError(null);
    setDetailAction(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/run-queue/${encodeURIComponent(action.id)}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({})) as { action?: QueueActionDetail; error?: string };
      if (!res.ok || !body.action) {
        setDetailError(body.error ?? "Failed to load full run log.");
        return;
      }
      setDetailAction(body.action);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load full run log.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
          <TerminalSquare size={13} className="text-accent" />
          Run Queue
        </h2>
        <div className="flex items-center gap-1.5">
          {liveActions.length > 0 && (
            <button
              type="button"
              onClick={() => void cancelLiveRuns()}
              disabled={busyActionId === "bulk-cancel"}
              className="inline-flex items-center gap-1 rounded border border-blocked/30 px-2 py-1 text-[10px] font-bold text-blocked hover:bg-blocked/10 disabled:opacity-50"
            >
              {busyActionId === "bulk-cancel" ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
              Cancel Live
            </button>
          )}
          {retryableActions.length > 0 && (
            <button
              type="button"
              onClick={() => void retryFailedRuns()}
              disabled={busyActionId === "bulk-retry"}
              className="inline-flex items-center gap-1 rounded border border-accent/30 px-2 py-1 text-[10px] font-bold text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {busyActionId === "bulk-retry" ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
              Retry Failed
            </button>
          )}
          <span className="rounded border border-border bg-bg-base px-2 py-0.5 text-[10px] font-mono text-text-muted">
            {loading ? "..." : `${actions.length}/${totalActions}`}
          </span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setFilter(item.value);
              setVisibleLimit(8);
              setExpandedActionId(null);
            }}
            className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
              filter === item.value
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-bg-base text-text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {item.label}
            <span className={`ml-1 rounded px-1.5 py-0.5 font-mono ${
              filter === item.value ? "bg-accent/20 text-accent" : "bg-card text-text-muted"
            }`}>
              {counts[item.value]}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          value={providerFilter}
          onChange={(event) => {
            setProviderFilter(event.target.value as ProviderFilter);
            setVisibleLimit(8);
            setExpandedActionId(null);
          }}
          className="rounded-lg border border-border bg-bg-base px-2.5 py-2 text-xs font-bold text-text outline-none transition-colors hover:border-accent focus:border-accent"
          aria-label="Filter run queue by provider"
        >
          {PROVIDERS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <select
          value={phaseFilter}
          onChange={(event) => {
            setPhaseFilter(event.target.value as PhaseFilter);
            setVisibleLimit(8);
            setExpandedActionId(null);
          }}
          className="rounded-lg border border-border bg-bg-base px-2.5 py-2 text-xs font-bold text-text outline-none transition-colors hover:border-accent focus:border-accent"
          aria-label="Filter run queue by phase"
        >
          {PHASES.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-blocked/30 bg-blocked/10 px-3 py-2 text-xs text-blocked">
          {error}
        </div>
      )}

      {!error && actions.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-bg-base p-4 text-center">
          <Activity size={18} className="mx-auto mb-2 text-text-muted" />
          <p className="text-xs font-medium text-text">No task runs yet</p>
          <p className="mt-1 text-[11px] text-text-muted">Queued local Claude/Codex task runs will appear here.</p>
        </div>
      )}

      {!error && actions.length > 0 && (
        <div className="space-y-2">
          {actions.map((action) => (
            <div key={action.id} className="rounded-lg border border-border bg-bg-base p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(action.status)}`}>
                      <StatusIcon status={action.status} />
                      {action.status}
                    </span>
                    {action.taskId ? (
                      <Link href={`/tasks/${encodeURIComponent(action.taskId)}`} className="font-mono text-xs font-bold text-accent hover:underline">
                        {action.taskId}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-text-muted">unknown task</span>
                    )}
                  </div>
                  {action.taskName && (
                    <p className="mt-1 truncate text-xs font-medium text-text" title={action.taskName}>
                      {action.taskName}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-text-muted">
                    {action.provider && <span className="font-bold uppercase text-text">{action.provider}</span>}
                    {action.phase && <span>{action.phase}</span>}
                    {action.deviceName && <span>{action.deviceName}</span>}
                    {action.optimizer && <span>{action.optimizer.mode ?? "auto"} / {action.optimizer.contextMode ?? action.contextPlan?.mode ?? "standard"}</span>}
                    {action.optimizer?.model && <span>{action.optimizer.model}</span>}
                    {typeof action.actualTokens === "number" && <span>{action.actualTokens.toLocaleString()} tokens</span>}
                    <span>{timeLabel(action.updatedAt)}</span>
                  </div>
                  {action.skillRouting?.selected?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {action.skillRouting.selected.slice(0, 5).map((skill) => (
                        <span key={skill.slug} className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[9px] text-text-muted" title={(skill.reasons ?? []).join(", ")}>
                          {skill.slug}{typeof skill.score === "number" ? ` ${skill.score}` : ""}
                        </span>
                      ))}
                      {typeof action.skillRouting.omittedCount === "number" && (
                        <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[9px] text-text-muted">
                          {action.skillRouting.omittedCount} omitted
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {(action.logTail.length > 0 || action.artifactPath) && (
                    <button
                      type="button"
                      onClick={() => setExpandedActionId((current) => current === action.id ? null : action.id)}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:border-accent hover:text-accent"
                    >
                      {expandedActionId === action.id ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                      Log
                    </button>
                  )}
                  {(action.logTail.length > 0 || action.artifactPath || action.error) && (
                    <button
                      type="button"
                      onClick={() => void openFullLog(action)}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:border-accent hover:text-accent"
                    >
                      Full
                    </button>
                  )}
                  {action.taskId && (action.status === "pending" || action.status === "running") && (
                    <button
                      type="button"
                      onClick={() => void cancelTaskRun(action)}
                      disabled={busyActionId === action.id}
                      className="inline-flex items-center gap-1 rounded border border-blocked/30 px-2 py-1 text-[10px] font-bold text-blocked hover:bg-blocked/10 disabled:opacity-50"
                    >
                      {busyActionId === action.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                      Cancel
                    </button>
                  )}
                  {action.taskId && (action.status === "failed" || action.status === "cancelled") && (
                    <button
                      type="button"
                      onClick={() => void retryTaskRun(action)}
                      disabled={busyActionId === action.id}
                      className="inline-flex items-center gap-1 rounded border border-accent/30 px-2 py-1 text-[10px] font-bold text-accent hover:bg-accent/10 disabled:opacity-50"
                    >
                      {busyActionId === action.id ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                      Retry
                    </button>
                  )}
                  {action.taskId && (
                    <Link
                      href={`/tasks/${encodeURIComponent(action.taskId)}`}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:border-accent hover:text-accent"
                    >
                      Open <ExternalLink size={10} />
                    </Link>
                  )}
                </div>
              </div>
              {(action.lastLogLine || action.error) && (
                <p className="mt-2 line-clamp-2 rounded border border-border bg-card px-2 py-1.5 font-mono text-[10px] text-text-muted">
                  {action.error ?? action.lastLogLine}
                </p>
              )}
              {expandedActionId === action.id && (
                <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Process Tail</span>
                    <div className="flex items-center gap-2">
                      {action.artifactPath && (
                        <span className="hidden max-w-[220px] truncate font-mono text-[10px] text-done sm:block" title={action.artifactPath}>
                          {action.artifactPath}
                        </span>
                      )}
                      {commandFromLog(action) && (
                        <button
                          type="button"
                          onClick={() => void copyCommand(action)}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:border-accent hover:text-accent"
                        >
                          <Clipboard size={10} />
                          {copiedActionId === action.id ? "Copied" : "Copy CMD"}
                        </button>
                      )}
                    </div>
                  </div>
                  {action.logTail.length > 0 ? (
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[10px] leading-relaxed text-text-muted">
                      {action.logTail.join("\n")}
                    </pre>
                  ) : (
                    <p className="px-3 py-2 text-[11px] text-text-muted">No process output captured yet.</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {actions.length < totalActions && (
            <button
              type="button"
              onClick={() => setVisibleLimit((current) => Math.min(current + 8, 50))}
              className="w-full rounded-lg border border-dashed border-border bg-bg-base px-3 py-2 text-xs font-bold text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              Show more runs ({totalActions - actions.length} hidden)
            </button>
          )}
        </div>
      )}
      {(detailAction || detailLoading || detailError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-bg-base shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-text">Run Log Detail</h3>
                <p className="mt-1 truncate font-mono text-[11px] text-text-muted">
                  {detailAction?.taskId ?? "loading"} {detailAction?.provider ? `- ${detailAction.provider}` : ""} {detailAction?.phase ? `- ${detailAction.phase}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {detailAction?.command && (
                  <button
                    type="button"
                    onClick={() => void copyText(detailAction.command ?? "")}
                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:border-accent hover:text-accent"
                  >
                    <Clipboard size={10} /> Copy CMD
                  </button>
                )}
                {detailAction?.log.length ? (
                  <button
                    type="button"
                    onClick={() => void copyText(detailAction.log.join("\n"))}
                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:border-accent hover:text-accent"
                  >
                    <Clipboard size={10} /> Copy Log
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setDetailAction(null);
                    setDetailError(null);
                    setDetailLoading(false);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:border-blocked hover:text-blocked"
                >
                  <X size={10} /> Close
                </button>
              </div>
            </div>
            {detailLoading && (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-text-muted">
                <Loader2 size={16} className="animate-spin" /> Loading full log...
              </div>
            )}
            {detailError && (
              <div className="m-4 rounded-lg border border-blocked/30 bg-blocked/10 px-3 py-2 text-xs text-blocked">
                {detailError}
              </div>
            )}
            {detailAction && (
              <div className="min-h-0 overflow-auto p-4">
                <div className="mb-3 grid grid-cols-2 gap-2 text-[11px] text-text-muted md:grid-cols-4">
                  <span>Status: <b className="text-text">{detailAction.status}</b></span>
                  <span>Device: <b className="text-text">{detailAction.deviceName ?? "unknown"}</b></span>
                  <span>Exit: <b className="text-text">{detailAction.exitCode ?? "--"}</b></span>
                  <span>Lines: <b className="text-text">{detailAction.log.length}</b></span>
                  <span>Optimizer: <b className="text-text">{detailAction.optimizer?.mode ?? "--"}</b></span>
                  <span>Context: <b className="text-text">{detailAction.optimizer?.contextMode ?? detailAction.contextPlan?.mode ?? "--"}</b></span>
                  <span>Model: <b className="text-text">{detailAction.optimizer?.model ?? "--"}</b></span>
                  <span>Estimate: <b className="text-text">{detailAction.optimizer?.estimatedPromptTokens?.toLocaleString() ?? "--"}</b></span>
                  <span>Actual: <b className="text-text">{detailAction.actualTokens?.toLocaleString() ?? "--"}</b></span>
                </div>
                {detailAction.skillRouting?.selected?.length ? (
                  <div className="mb-3 rounded border border-border bg-card px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      Skill Router - {detailAction.skillRouting.tokenCost ?? "0 LLM tokens used for routing"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {detailAction.skillRouting.selected.map((skill) => (
                        <span key={skill.slug} className="rounded border border-border bg-bg-base px-2 py-1 font-mono text-[10px] text-text-muted" title={(skill.reasons ?? []).join(", ")}>
                          {skill.slug}{typeof skill.score === "number" ? ` (${skill.score})` : ""}
                        </span>
                      ))}
                      {typeof detailAction.skillRouting.omittedCount === "number" && (
                        <span className="rounded border border-border bg-bg-base px-2 py-1 text-[10px] text-text-muted">
                          {detailAction.skillRouting.omittedCount} omitted
                        </span>
                      )}
                    </div>
                    {detailAction.optimizer?.reason && <p className="mt-2 text-[11px] text-text-muted">{detailAction.optimizer.reason}</p>}
                    {detailAction.optimizer?.modelReason && <p className="mt-1 text-[11px] text-text-muted">{detailAction.optimizer.modelReason}</p>}
                    {contextReportObject(detailAction.contextReport, "previousFailure") && (
                      <p className="mt-2 rounded border border-in-progress/30 bg-in-progress/10 px-2 py-1 text-[11px] text-in-progress">
                        Retry context attached from previous failed run.
                      </p>
                    )}
                  </div>
                ) : null}
                {detailAction.artifactPath && (
                  <p className="mb-3 truncate rounded border border-border bg-card px-3 py-2 font-mono text-[11px] text-done" title={detailAction.artifactPath}>
                    {detailAction.artifactPath}
                  </p>
                )}
                {detailAction.contextReportPath && (
                  <p className="mb-3 truncate rounded border border-border bg-card px-3 py-2 font-mono text-[11px] text-text-muted" title={detailAction.contextReportPath}>
                    Context report: {detailAction.contextReportPath}
                  </p>
                )}
                {detailAction.contextReport && (
                  <details className="mb-3 rounded border border-border bg-card px-3 py-2">
                    <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-accent">
                      View Context Report JSON
                    </summary>
                    {typeof detailAction.contextReport.promptPreview === "string" && (
                      <details className="mt-2 rounded-lg border border-border bg-bg-base px-3 py-2">
                        <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-text-muted">
                          View Prompt Preview
                        </summary>
                        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-card p-3 font-mono text-[10px] leading-relaxed text-text-muted">
                          {detailAction.contextReport.promptPreview}
                        </pre>
                      </details>
                    )}
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg-base p-3 font-mono text-[10px] leading-relaxed text-text-muted">
                      {JSON.stringify(detailAction.contextReport, null, 2)}
                    </pre>
                  </details>
                )}
                <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-card p-3 font-mono text-[11px] leading-relaxed text-text-muted">
                  {detailAction.log.length ? detailAction.log.join("\n") : detailAction.error ?? "No process output captured."}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
