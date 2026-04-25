import type { TaskDetail } from "@/lib/task-detail";

export function ArtifactsCard({ task }: { task: TaskDetail }) {
  const items = [
    { label: "BA Brief", value: task.analysisBriefPath, fallback: "Waiting for BA phase" },
    { label: "Implementation Log", value: task.implementationLogPath, fallback: "Waiting for Codex implementation" },
    { label: "Review Notes", value: task.reviewPath, fallback: "Optional review not synced" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Artifacts</h3>
      <div className="flex flex-col gap-2">
        <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs">
          <span className="font-semibold text-accent">Phase:</span> <span className="text-text">{task.phase}</span>
        </div>
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-bg-base px-3 py-2 text-xs">
            <div className="font-semibold text-text">{item.label}</div>
            <div className="mt-1 font-mono text-text-muted">{item.value ?? item.fallback}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
