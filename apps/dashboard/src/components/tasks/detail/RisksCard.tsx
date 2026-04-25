import { AlertTriangle } from "lucide-react";

interface Props {
  risks: string[];
}

export function RisksCard({ risks }: Props) {
  if (risks.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Risks & Assessment</h3>
        <p className="text-xs text-text-muted italic">No risks logged for this task.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Risks & Assessment</h3>
      <div className="flex flex-col gap-2">
        {risks.map((risk, i) => (
          <div key={i} className="flex gap-2 rounded-lg bg-blocked/5 border border-blocked/20 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-blocked shrink-0 mt-0.5" />
            <p className="text-xs text-text-muted leading-snug">{risk}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
