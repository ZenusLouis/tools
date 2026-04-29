import type { TaskDetail, TaskLogEntry } from "@/lib/task-detail";
import Link from "next/link";
import { Box, CalendarClock, CheckCircle2, ClipboardCheck, Clock3, FileText, GitCommit, Layers, ListChecks, Route, ShieldAlert, WalletCards } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  pending:       "bg-pending/15 text-pending",
  "in-progress": "bg-in-progress/15 text-in-progress",
  completed:     "bg-done/15 text-done",
  blocked:       "bg-blocked/15 text-blocked",
};

interface Props {
  task: TaskDetail;
  log: TaskLogEntry | null;
}

function Row({ label, children, icon: Icon }: { label: string; children: React.ReactNode; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-base/60 px-3 py-3">
      <Icon size={15} className="mt-0.5 shrink-0 text-text-muted" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{label}</p>
        <div className="mt-1 text-sm text-text">{children}</div>
      </div>
    </div>
  );
}

export function TaskMetaCard({ task, log }: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border bg-bg-base/35 p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 font-mono text-xs font-bold text-accent">{task.id}</span>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-bold capitalize ${STATUS_STYLES[task.status] ?? "bg-border text-text-muted"}`}>
                {task.status}
              </span>
              <span className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-text-muted">{task.phase}</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">{task.name}</h2>
            {task.summary && <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{task.summary}</p>}
            <p className="mt-2 text-sm text-text-muted">
              {task.moduleName} / {task.featureName}
            </p>
          </div>
          <Link href={`/projects/${task.projectName}`} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text-muted transition-colors hover:bg-card-hover hover:text-text">
            Open project
          </Link>
        </div>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-2">
        <Row label="Project" icon={Box}>
          <Link href={`/projects/${task.projectName}`} className="font-semibold text-accent hover:underline">{task.projectName}</Link>
        </Row>
        <Row label="Module" icon={Layers}>
          <span className="font-mono text-xs text-text-muted">{task.moduleId}</span>{" "}
          <span>{task.moduleName}</span>
        </Row>
        <Row label="Feature" icon={Route}>
          <span className="font-mono text-xs text-text-muted">{task.featureId}</span>{" "}
          <span>{task.featureName}</span>
        </Row>
        <Row label="Estimate" icon={Clock3}>
          {task.estimate ? <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">{task.estimate}</span> : <span className="text-text-muted">Not estimated</span>}
        </Row>
        {task.priority && (
          <Row label="Priority" icon={ClipboardCheck}>
            <span className="rounded bg-in-progress/10 px-2 py-0.5 text-xs font-bold uppercase text-in-progress">{task.priority}</span>
          </Row>
        )}
        {task.details && (
          <Row label="Implementation detail" icon={FileText}>
            <p className="text-sm leading-6 text-text-muted">{task.details}</p>
          </Row>
        )}
        {task.acceptanceCriteria.length > 0 && (
          <Row label="Acceptance criteria" icon={ListChecks}>
            <ul className="list-disc space-y-1 pl-4 text-sm leading-6 text-text-muted">
              {task.acceptanceCriteria.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </Row>
        )}
        {task.steps.length > 0 && (
          <Row label="Suggested steps" icon={Route}>
            <ol className="list-decimal space-y-1 pl-4 text-sm leading-6 text-text-muted">
              {task.steps.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </Row>
        )}
        {task.risk && (
          <Row label="Risk note" icon={ShieldAlert}>
            <p className="text-sm leading-6 text-in-progress">{task.risk}</p>
          </Row>
        )}
        {task.deps.length > 0 && (
          <Row label="Dependencies" icon={ShieldAlert}>
            <div className="flex flex-wrap gap-1">
              {task.deps.map((d) => (
                <span key={d} className="rounded bg-border px-1.5 py-0.5 font-mono text-xs">{d}</span>
              ))}
            </div>
          </Row>
        )}
        {log?.date && (
          <Row label="Completed" icon={CalendarClock}>
            <span className="text-sm">{log.date}</span>
          </Row>
        )}
        {log?.durationMin && (
          <Row label="Duration" icon={Clock3}>
            <span className="text-sm">{log.durationMin} min</span>
          </Row>
        )}
        {log?.commitHash && (
          <Row label="Commit" icon={GitCommit}>
            <span className="font-mono text-xs text-accent">{log.commitHash}</span>
          </Row>
        )}
        {log?.totalTokens && (
          <Row label="Tokens" icon={WalletCards}>
            <span className="text-sm">{log.totalTokens.toLocaleString()}</span>
            {log.totalCostUSD != null && (
              <span className="text-xs text-text-muted ml-2">(${log.totalCostUSD.toFixed(4)})</span>
            )}
          </Row>
        )}
        {log?.sessionNotes && (
          <Row label="Session notes" icon={FileText}>
            <p className="text-xs text-text-muted leading-relaxed">{log.sessionNotes}</p>
          </Row>
        )}
        {!log && (
          <div className="rounded-lg border border-dashed border-border bg-bg-base/60 px-3 py-3 md:col-span-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-text">
              <CheckCircle2 size={15} className="text-text-muted" />
              No execution log yet
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Run this task via local Claude/Codex or dashboard-run agent. Session data will appear here when the bridge syncs it into the database.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
