import type { TaskDetail, TaskLogEntry } from "@/lib/task-detail";

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      <span className="text-xs text-text-muted w-28 shrink-0 pt-0.5">{label}</span>
      <div className="text-sm flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function TaskMetaCard({ task, log }: Props) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold mb-4">{task.name}</h2>
      <div className="flex flex-col">
        <Row label="Task ID">
          <span className="font-mono text-accent text-sm">{task.id}</span>
        </Row>
        <Row label="Status">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[task.status] ?? "bg-border text-text-muted"}`}>
            {task.status}
          </span>
        </Row>
        <Row label="Module">
          <span className="font-mono text-xs text-text-muted mr-2">{task.moduleId}</span>
          <span className="text-sm">{task.moduleName}</span>
        </Row>
        <Row label="Feature">
          <span className="font-mono text-xs text-text-muted mr-2">{task.featureId}</span>
          <span className="text-sm">{task.featureName}</span>
        </Row>
        <Row label="Project">
          <span className="font-mono text-sm">{task.projectName}</span>
        </Row>
        {task.estimate && (
          <Row label="Estimate">
            <span className="rounded px-2 py-0.5 text-xs font-medium bg-accent/10 text-accent">{task.estimate}</span>
          </Row>
        )}
        {task.deps.length > 0 && (
          <Row label="Dependencies">
            <div className="flex flex-wrap gap-1">
              {task.deps.map((d) => (
                <span key={d} className="font-mono text-xs bg-border rounded px-1.5 py-0.5">{d}</span>
              ))}
            </div>
          </Row>
        )}
        {log?.date && (
          <Row label="Completed">
            <span className="text-sm">{log.date}</span>
          </Row>
        )}
        {log?.durationMin && (
          <Row label="Duration">
            <span className="text-sm">{log.durationMin} min</span>
          </Row>
        )}
        {log?.commitHash && (
          <Row label="Commit">
            <span className="font-mono text-xs text-accent">{log.commitHash}</span>
          </Row>
        )}
        {log?.totalTokens && (
          <Row label="Tokens">
            <span className="text-sm">{log.totalTokens.toLocaleString()}</span>
            {log.totalCostUSD != null && (
              <span className="text-xs text-text-muted ml-2">(${log.totalCostUSD.toFixed(4)})</span>
            )}
          </Row>
        )}
        {log?.sessionNotes && (
          <Row label="Session notes">
            <p className="text-xs text-text-muted leading-relaxed">{log.sessionNotes}</p>
          </Row>
        )}
      </div>
    </div>
  );
}
