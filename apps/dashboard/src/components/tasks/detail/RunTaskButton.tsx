"use client";

import { useEffect, useState, useTransition } from "react";
import { Bot, Check, Clipboard, Loader2, Play, TerminalSquare, X } from "lucide-react";
import { useRouter } from "next/navigation";

type RunStatus = {
  id: string;
  status: string;
  error: string | null;
  log: string[];
  artifactPath: string | null;
  exitCode: number | null;
  actualTokens?: number | null;
  providerTokens?: number | null;
  codexCredits?: number | null;
  normalizedCostUsd?: number | null;
  tokenMeter?: string | null;
  optimizer?: OptimizerInfo | null;
  skillRouting?: SkillRoutingInfo | null;
  contextPlan?: ContextPlanInfo | null;
  contextReportPath?: string | null;
  contextReport?: Record<string, unknown> | null;
} | null;

type OptimizerInfo = {
  mode?: string;
  provider?: string;
  model?: string | null;
  modelSource?: string;
  modelReason?: string;
  contextMode?: string;
  reason?: string;
  estimatedPromptTokens?: number;
  promptBudgetTokens?: number;
  retryEscalation?: {
    enabled?: boolean;
    retryCount?: number;
    previousFailureAttached?: boolean;
    helperSkill?: string | null;
    reason?: string;
  };
};

type SkillRouteItem = {
  slug?: string;
  name?: string;
  score?: number;
  reasons?: string[];
  sourceType?: string | null;
  sourcePriority?: number | null;
};

type SkillRoutingInfo = {
  selected?: SkillRouteItem[];
  topCandidates?: SkillRouteItem[];
  omittedCount?: number;
  availableCount?: number;
  tokenCost?: string;
};

type ContextPlanInfo = {
  mode?: string;
  includedBlocks?: string[];
  omittedBlocks?: string[];
  retryEscalation?: string | null;
  relatedMemoryCount?: number;
};

type RunPreview = {
  provider?: string;
  role?: string | null;
  optimizer?: OptimizerInfo | null;
  skillRouting?: SkillRoutingInfo | null;
  contextPlan?: ContextPlanInfo | null;
} | null;

function getContextReportValue(report: Record<string, unknown> | null | undefined, key: string) {
  return report && typeof report[key] === "object" && report[key] !== null && !Array.isArray(report[key])
    ? report[key] as Record<string, unknown>
    : null;
}

function statusUsageLabel(status: RunStatus, provider: string | undefined) {
  if (!status || typeof status.actualTokens !== "number") return null;
  if (provider === "codex" || status.tokenMeter === "thread_meter") {
    const cost = typeof status.normalizedCostUsd === "number" ? ` / $${status.normalizedCostUsd.toFixed(4)}` : "";
    return `${status.actualTokens.toLocaleString()} thread tokens${cost}`;
  }
  if (status.tokenMeter === "provider_reported") {
    return `${(status.providerTokens ?? status.actualTokens).toLocaleString()} provider tokens`;
  }
  return `${status.actualTokens.toLocaleString()} hook tokens`;
}

const PHASE_OPTIONS = [
  { value: "implementation", label: "Implement" },
  { value: "analysis", label: "Prepare Brief" },
  { value: "review", label: "Review" },
] as const;

const PROVIDER_OPTIONS = [
  { value: "auto", label: "Auto provider" },
  { value: "claude", label: "Claude local" },
  { value: "codex", label: "Codex local" },
  { value: "gemini", label: "Gemini local" },
] as const;

const OPTIMIZER_OPTIONS = [
  { value: "auto_aggressive", label: "Auto aggressive" },
  { value: "balanced", label: "Balanced" },
  { value: "quality", label: "Quality" },
  { value: "manual", label: "Manual" },
] as const;

const CONTEXT_OPTIONS = [
  { value: "minimal", label: "Minimal" },
  { value: "standard", label: "Standard" },
  { value: "deep", label: "Deep" },
] as const;

export function RunTaskButton({ taskId, disabled }: { taskId: string; disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState<(typeof PHASE_OPTIONS)[number]["value"]>("implementation");
  const [provider, setProvider] = useState<(typeof PROVIDER_OPTIONS)[number]["value"]>("auto");
  const [model, setModel] = useState<string>("");
  const [models, setModels] = useState<string[]>([]);
  const [optimizerMode, setOptimizerMode] = useState<(typeof OPTIMIZER_OPTIONS)[number]["value"]>("auto_aggressive");
  const [contextMode, setContextMode] = useState<(typeof CONTEXT_OPTIONS)[number]["value"]>("standard");
  const [preview, setPreview] = useState<RunPreview>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run/status`, { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json() as { action?: RunStatus };
      if (cancelled) return;
      setStatus(body.action ?? null);
      if (body.action?.id) setActionId(body.action.id);
    }
    load();
    return () => { cancelled = true; };
  }, [taskId]);

  useEffect(() => {
    if (!actionId) return;
    if (status?.status && !["pending", "claimed", "running"].includes(status.status)) return;
    const timer = window.setInterval(async () => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run/status`, { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json() as { action?: RunStatus };
      setStatus(body.action ?? null);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [actionId, status?.status, taskId]);

  useEffect(() => {
    if (status?.status === "succeeded") {
      router.refresh();
    }
  }, [status?.status, router]);

  useEffect(() => {
    if (provider === "auto") return;
    const providerKey = provider === "claude" ? "claude" : provider === "gemini" ? "gemini" : "codex";
    fetch(`/api/models?provider=${providerKey}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((body: { models?: string[] }) => {
        const list = body.models ?? [];
        setModels(list);
        setModel((prev) => (list.includes(prev) ? prev : ""));
      })
      .catch(() => { setModels([]); setModel(""); });
  }, [provider]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const params = new URLSearchParams({
          phase,
          provider,
          optimizerMode,
          ...(optimizerMode === "manual" ? { contextMode } : {}),
        });
        const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run/preview?${params.toString()}`, { cache: "no-store" });
        const body = await res.json().catch(() => ({})) as RunPreview & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setPreview(null);
          return;
        }
        setPreview(body);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [contextMode, optimizerMode, phase, provider, taskId]);

  function runTask() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase,
          ...(provider !== "auto" ? { provider } : {}),
          ...(model ? { model } : {}),
          optimizerMode,
          ...(optimizerMode === "manual" ? { contextMode } : {}),
        }),
      });
      const body = await res.json().catch(() => ({})) as {
        actionId?: string;
        error?: string;
        provider?: string;
        device?: string;
        optimizer?: OptimizerInfo;
        skillRouting?: SkillRoutingInfo;
        contextPlan?: ContextPlanInfo;
      };
      if (!res.ok) {
        setMessage(body.error ?? "Failed to queue task.");
        return;
      }
      setActionId(body.actionId ?? null);
      setStatus({
        id: body.actionId ?? "",
        status: "pending",
        error: null,
        log: [
          `Queued ${phase} with ${body.provider ?? "agent"} on ${body.device ?? "local bridge"}.`,
          `Optimizer: ${body.optimizer?.mode ?? optimizerMode} / ${body.optimizer?.contextMode ?? contextMode}.`,
          `Skill router: ${(body.skillRouting?.selected ?? []).map((skill) => skill.slug).filter(Boolean).join(", ") || "none"}; omitted ${body.skillRouting?.omittedCount ?? 0}; 0 LLM tokens used for routing.`,
        ],
        artifactPath: null,
        exitCode: null,
        optimizer: body.optimizer ?? null,
        skillRouting: body.skillRouting ?? null,
        contextPlan: body.contextPlan ?? null,
      });
    });
  }

  function cancelTask() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run/cancel`, { method: "POST" });
      const body = await res.json().catch(() => ({})) as { error?: string; cancelled?: number };
      if (!res.ok) {
        setMessage(body.error ?? "Failed to cancel task.");
        return;
      }
      setStatus((current) => current ? {
        ...current,
        status: "cancelled",
        log: [...current.log, `Cancellation requested for ${body.cancelled ?? 0} action(s).`],
      } : current);
    });
  }

  function copyCommand() {
    const cmd = status?.log.find((line) => line.startsWith("CMD: "))?.slice(5);
    if (!cmd) return;
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }

  function runNextTask() {
    setMessage(null);
    startTransition(async () => {
      const nextRes = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/next`, { cache: "no-store" });
      const nextBody = await nextRes.json().catch(() => ({})) as { task?: { id: string } | null; error?: string };
      if (!nextRes.ok || !nextBody.task?.id) {
        setMessage(nextBody.error ?? "No next pending task found.");
        return;
      }
      const runRes = await fetch(`/api/tasks/${encodeURIComponent(nextBody.task.id)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase,
          ...(provider !== "auto" ? { provider } : {}),
          ...(model ? { model } : {}),
          optimizerMode,
          ...(optimizerMode === "manual" ? { contextMode } : {}),
        }),
      });
      if (!runRes.ok) {
        const runBody = await runRes.json().catch(() => ({})) as { error?: string };
        setMessage(runBody.error ?? "Failed to queue next task.");
        return;
      }
      router.push(`/tasks/${encodeURIComponent(nextBody.task.id)}`);
    });
  }

  function runNextBatch() {
    setMessage(null);
    startTransition(async () => {
      const nextRes = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/next-batch?limit=3`, { cache: "no-store" });
      const nextBody = await nextRes.json().catch(() => ({})) as { tasks?: Array<{ id: string }> | null; error?: string };
      const tasks = nextBody.tasks ?? [];
      if (!nextRes.ok || tasks.length === 0) {
        setMessage(nextBody.error ?? "No next pending tasks found.");
        return;
      }
      for (const task of tasks) {
        const runRes = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase,
            ...(provider !== "auto" ? { provider } : {}),
            optimizerMode,
            ...(optimizerMode === "manual" ? { contextMode } : {}),
          }),
        });
        if (!runRes.ok) {
          const runBody = await runRes.json().catch(() => ({})) as { error?: string };
          setMessage(`Queued ${tasks.indexOf(task)} task(s), then failed: ${runBody.error ?? "unknown error"}`);
          return;
        }
      }
      setMessage(`Queued ${tasks.length} task(s). Opening first queued task.`);
      router.push(`/tasks/${encodeURIComponent(tasks[0].id)}`);
    });
  }

  const running = isPending || status?.status === "pending" || status?.status === "running";
  const done = status?.status === "succeeded";
  const failed = status?.status === "failed";
  const cancelled = status?.status === "cancelled";
  const cmd = status?.log.find((line) => line.startsWith("CMD: "))?.slice(5);
  const showingLiveRun = running || done || failed || cancelled;
  const displayOptimizer = showingLiveRun ? (status?.optimizer ?? null) : (preview?.optimizer ?? null);
  const displaySkillRouting = showingLiveRun ? (status?.skillRouting ?? null) : (preview?.skillRouting ?? null);
  const displayContextPlan = showingLiveRun ? (status?.contextPlan ?? null) : (preview?.contextPlan ?? null);
  const displayProvider = showingLiveRun ? (status?.optimizer?.provider ?? provider) : (preview?.provider ?? provider);
  const displayUsage = statusUsageLabel(status, displayProvider);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-text">
            <Bot size={15} className="text-accent" />
            Local Agent Run
          </p>
          <p className="mt-1 text-xs text-text-muted">Queue this task to the local bridge and sync implementation artifacts back here.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={phase}
            onChange={(event) => setPhase(event.target.value as typeof phase)}
            disabled={running}
            className="rounded-xl border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text outline-none transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
            title="Run phase"
          >
            {PHASE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select
            value={provider}
            onChange={(event) => {
              const nextProvider = event.target.value as typeof provider;
              setProvider(nextProvider);
              if (nextProvider === "auto") {
                setModels([]);
                setModel("");
              }
            }}
            disabled={running}
            className="rounded-xl border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text outline-none transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
            title="Local provider"
          >
            {PROVIDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {provider !== "auto" && (
            models.length > 0 ? (
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                disabled={running}
                className="rounded-xl border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text outline-none transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
                title="Model override"
              >
                <option value="">Auto model</option>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                disabled={running}
                placeholder="Auto model"
                className="w-36 rounded-xl border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text outline-none transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-text-muted placeholder:font-normal"
                title="Model override"
              />
            )
          )}
          <select
            value={optimizerMode}
            onChange={(event) => setOptimizerMode(event.target.value as typeof optimizerMode)}
            disabled={running}
            className="rounded-xl border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text outline-none transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
            title="Token optimizer mode"
          >
            {OPTIMIZER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select
            value={contextMode}
            onChange={(event) => setContextMode(event.target.value as typeof contextMode)}
            disabled={running || optimizerMode !== "manual"}
            className="rounded-xl border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text outline-none transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
            title="Manual context mode"
          >
            {CONTEXT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {cmd && (
            <button
              type="button"
              onClick={copyCommand}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-muted transition-colors hover:bg-card-hover hover:text-text"
            >
              {copied ? <Check size={14} className="text-done" /> : <Clipboard size={14} />}
              {copied ? "Copied" : "Copy CMD"}
            </button>
          )}
          {running && (
            <button
              type="button"
              onClick={cancelTask}
              className="inline-flex items-center gap-2 rounded-xl border border-blocked/40 bg-blocked/10 px-3 py-2 text-xs font-bold text-blocked transition-colors hover:bg-blocked/20"
            >
              <X size={14} />
              Cancel
            </button>
          )}
          {done && (
            <button
              type="button"
              onClick={runNextTask}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-done/40 bg-done/10 px-3 py-2 text-xs font-bold text-done transition-colors hover:bg-done/20 disabled:opacity-50"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
              Run Next
            </button>
          )}
          {done && (
            <button
              type="button"
              onClick={runNextBatch}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-bold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
              Run Next 3
            </button>
          )}
          <button
            type="button"
            onClick={runTask}
            disabled={disabled || running}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
            {running ? "Running..." : status ? "Run Again" : "Run Task"}
          </button>
        </div>
      </div>

      {message && <p className="mt-3 rounded-lg border border-blocked/30 bg-blocked/10 px-3 py-2 text-xs text-blocked">{message}</p>}
      {cmd && (
        <div className="mt-3 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Command</p>
          <code className="mt-1 block overflow-x-auto whitespace-pre py-1 font-mono text-[11px] text-text-muted">{cmd}</code>
        </div>
      )}
      {(displayOptimizer || displaySkillRouting || displayContextPlan) && (
        <div className="mt-3 rounded-xl border border-border bg-bg-base p-3">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
            <span>{status ? "Run Optimizer" : "Optimizer Preview"}</span>
            <span className="rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent">
              {displayOptimizer?.mode ?? "auto_aggressive"} / {displayOptimizer?.contextMode ?? displayContextPlan?.mode ?? "standard"}
            </span>
            <span>{displayProvider}</span>
            <span>{displayOptimizer?.model ? `model ${displayOptimizer.model}` : "provider model default"}</span>
            <span>{displayOptimizer?.estimatedPromptTokens ? `${displayOptimizer.estimatedPromptTokens.toLocaleString()} est tokens` : "estimate pending"}</span>
            <span>{displayContextPlan?.relatedMemoryCount ?? 0} memory</span>
            {displayUsage ? <span>{displayUsage}</span> : null}
            <span>{displaySkillRouting?.tokenCost ?? "0 LLM tokens used for routing"}</span>
            {previewLoading && !status && <span>refreshing...</span>}
          </div>
          {displayOptimizer?.reason && <p className="mt-2 text-xs text-text-muted">{displayOptimizer.reason}</p>}
          {displayOptimizer?.modelReason && <p className="mt-1 text-xs text-text-muted">{displayOptimizer.modelReason}</p>}
          {(displayOptimizer?.retryEscalation?.enabled || displayContextPlan?.retryEscalation) && (
            <p className="mt-2 rounded-lg border border-in-progress/30 bg-in-progress/10 px-3 py-2 text-xs text-in-progress">
              {displayOptimizer?.retryEscalation?.reason ?? displayContextPlan?.retryEscalation}
              {displayOptimizer?.retryEscalation?.helperSkill ? ` Helper skill: ${displayOptimizer.retryEscalation.helperSkill}.` : ""}
            </p>
          )}
          {getContextReportValue(status?.contextReport, "previousFailure") && (
            <p className="mt-2 rounded-lg border border-in-progress/30 bg-in-progress/10 px-3 py-2 text-xs text-in-progress">
              Retry context attached from previous failed run.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(displaySkillRouting?.selected ?? []).slice(0, 8).map((skill) => (
              <span key={skill.slug ?? skill.name} className="rounded border border-border bg-card px-2 py-1 font-mono text-[10px] text-text-muted" title={(skill.reasons ?? []).join(", ")}>
                {skill.slug ?? skill.name} {typeof skill.score === "number" ? `(${skill.score})` : ""}
                {skill.sourceType ? ` · ${skill.sourceType}` : ""}
              </span>
            ))}
            {typeof displaySkillRouting?.omittedCount === "number" && (
              <span className="rounded border border-border bg-card px-2 py-1 text-[10px] text-text-muted">
                {displaySkillRouting.omittedCount} omitted
              </span>
            )}
          </div>
          {displaySkillRouting?.topCandidates?.length ? (
            <details className="mt-2 rounded-lg border border-border bg-card px-3 py-2">
              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-text-muted">
                Top omitted candidates
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {displaySkillRouting.topCandidates.slice(0, 8).map((skill) => (
                  <span key={skill.slug ?? skill.name} className="rounded border border-border bg-bg-base px-2 py-1 font-mono text-[10px] text-text-muted" title={(skill.reasons ?? []).join(", ")}>
                    {skill.slug ?? skill.name} {typeof skill.score === "number" ? `(${skill.score})` : ""}
                    {skill.sourceType ? ` · ${skill.sourceType}` : ""}
                  </span>
                ))}
              </div>
            </details>
          ) : null}
          {status?.contextReportPath && (
            <p className="mt-2 font-mono text-[10px] text-text-muted">Context report: {status.contextReportPath}</p>
          )}
          {status?.contextReport && (
            <details className="mt-2 rounded-lg border border-border bg-card px-3 py-2">
              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-accent">
                View Context Report JSON
              </summary>
              {typeof status.contextReport.promptPreview === "string" && (
                <details className="mt-2 rounded-lg border border-border bg-bg-base px-3 py-2">
                  <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    View Prompt Preview
                  </summary>
                  <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-text-muted">
                    {status.contextReport.promptPreview}
                  </pre>
                </details>
              )}
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-text-muted">
                {JSON.stringify(status.contextReport, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
      {status && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-bg-base">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
              <TerminalSquare size={13} />
              {status.status}
            </span>
            {done && <span className="text-xs font-bold text-done">Done</span>}
            {failed && <span className="text-xs font-bold text-blocked">Failed</span>}
            {cancelled && <span className="text-xs font-bold text-blocked">Cancelled</span>}
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 py-3 font-mono text-[11px] leading-5 text-text-muted">
            {(status.log.length ? status.log : ["Waiting for local bridge..."]).join("\n")}
            {status.error ? `\n${status.error}` : ""}
            {status.artifactPath ? `\nArtifact: ${status.artifactPath}` : ""}
          </pre>
        </div>
      )}
    </div>
  );
}
