import type { ProjectDecisions } from "@/lib/knowledge";

interface Props {
  allDecisions: ProjectDecisions[];
  selectedProject: string;
}

export function DecisionLog({ allDecisions, selectedProject }: Props) {
  const filtered = selectedProject === "all"
    ? allDecisions
    : allDecisions.filter((p) => p.project === selectedProject);

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-text-muted py-6 text-center">
        No decisions recorded yet. Add a <code className="font-mono text-accent">decisions.md</code> to your project folder.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {filtered.map(({ project, decisions }) => (
        <div key={project}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3 flex items-center gap-2">
            <span className="rounded px-2 py-0.5 bg-border text-text-muted font-mono">{project}</span>
            <span>{decisions.length} decision{decisions.length !== 1 ? "s" : ""}</span>
          </h3>
          <div className="flex flex-col gap-2">
            {decisions.map((d) => (
              <div key={d.id} className="rounded-lg border bg-card px-4 py-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-accent font-bold">{d.id}</span>
                  <span className="text-sm font-medium">{d.title}</span>
                </div>
                {d.body && (
                  <p className="text-xs text-text-muted leading-relaxed whitespace-pre-line">{d.body}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
