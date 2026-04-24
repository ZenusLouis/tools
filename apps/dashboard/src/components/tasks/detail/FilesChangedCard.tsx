import type { FileChange } from "@/lib/task-detail";
import path from "path";

interface Props {
  files: FileChange[];
  projectPath?: string;
}

function vsCodeUri(filePath: string): string {
  return `vscode://file/${filePath.replace(/\\/g, "/")}`;
}

export function FilesChangedCard({ files, projectPath }: Props) {
  if (files.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Files Changed</h3>
        <p className="text-xs text-text-muted italic">Not logged — enrich session entries with a <code className="font-mono text-accent">filesChanged</code> array to enable this.</p>
      </div>
    );
  }

  const totalAdded   = files.reduce((s, f) => s + f.added,   0);
  const totalRemoved = files.reduce((s, f) => s + f.removed, 0);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Files Changed</h3>
        <div className="flex gap-2 text-xs">
          <span className="text-done">+{totalAdded}</span>
          <span className="text-blocked">-{totalRemoved}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {files.map((f) => {
          const absPath = projectPath ? path.join(projectPath, f.path) : f.path;
          return (
            <div key={f.path} className="flex items-center gap-2 text-xs font-mono">
              <a
                href={vsCodeUri(absPath)}
                className="flex-1 truncate text-accent hover:underline"
                title={`Open ${f.path} in VS Code`}
              >
                {f.path}
              </a>
              {(f.added > 0 || f.removed > 0) && (
                <div className="flex gap-1.5 shrink-0">
                  {f.added > 0   && <span className="text-done">+{f.added}</span>}
                  {f.removed > 0 && <span className="text-blocked">-{f.removed}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
