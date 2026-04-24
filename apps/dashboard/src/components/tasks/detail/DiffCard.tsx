import type { FileChange } from "@/lib/task-detail";

interface Props {
  files: FileChange[];
}

function DiffBar({ added, removed }: { added: number; removed: number }) {
  const total = added + removed;
  if (total === 0) return null;
  const addPct = Math.round((added / total) * 100);
  return (
    <div className="h-1.5 rounded-full overflow-hidden bg-border flex w-20">
      <div className="h-full bg-done/70" style={{ width: `${addPct}%` }} />
      <div className="h-full bg-blocked/70 flex-1" />
    </div>
  );
}

export function DiffCard({ files }: Props) {
  if (files.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Diff Summary</h3>
        <p className="text-xs text-text-muted italic">Not logged — add <code className="font-mono text-accent">filesChanged</code> with +/- counts to session entries.</p>
      </div>
    );
  }

  const totalAdded   = files.reduce((s, f) => s + f.added,   0);
  const totalRemoved = files.reduce((s, f) => s + f.removed, 0);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Diff Summary</h3>
        <span className="text-xs text-text-muted">
          <span className="text-done font-mono">+{totalAdded}</span>
          {" / "}
          <span className="text-blocked font-mono">-{totalRemoved}</span>
          {" across "}{files.length} file{files.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {files.map((f) => (
          <div key={f.path} className="flex items-center gap-3 text-xs">
            <span className="font-mono text-text-muted flex-1 truncate min-w-0">{f.path}</span>
            <span className="text-done w-10 text-right tabular-nums shrink-0">+{f.added}</span>
            <span className="text-blocked w-10 text-right tabular-nums shrink-0">-{f.removed}</span>
            <DiffBar added={f.added} removed={f.removed} />
          </div>
        ))}
      </div>
    </div>
  );
}
