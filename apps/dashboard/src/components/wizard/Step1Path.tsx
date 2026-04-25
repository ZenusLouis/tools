"use client";

import { useState, useTransition } from "react";
import { FolderSearch } from "lucide-react";
import { scanProject } from "@/app/(app)/projects/new/actions";

interface Props {
  initial: string;
  onNext: (folderPath: string, name: string, framework: string[]) => void;
}

export function Step1Path({ initial, onNext }: Props) {
  const [folderPath, setFolderPath] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; framework: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleScan() {
    if (!folderPath.trim()) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await scanProject(folderPath.trim());
      if (res.error) setError(res.error);
      else setResult({ name: res.name, framework: res.framework });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Step 1</p>
        <h2 className="mt-1 text-base font-semibold text-text">Project Folder</h2>
        <p className="mt-1 text-xs text-text-muted">Enter the absolute path to your project folder.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-text-muted">Folder Path</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={folderPath}
            onChange={(event) => {
              setFolderPath(event.target.value);
              setResult(null);
              setError(null);
            }}
            onKeyDown={(event) => event.key === "Enter" && handleScan()}
            placeholder="e.g. D:\\projects\\my-app"
            className="flex-1 rounded-lg border border-border bg-bg-base px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button onClick={handleScan} disabled={isPending || !folderPath.trim()} className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40">
            <FolderSearch className="h-4 w-4" />
            {isPending ? "Scanning..." : "Scan"}
          </button>
        </div>
        {error && <p className="text-xs text-blocked">{error}</p>}
      </div>

      {result && (
        <div className="flex flex-col gap-2 rounded-lg border border-done/30 bg-done/5 px-4 py-3">
          <p className="text-xs font-medium text-done">Project detected</p>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-xs text-text-muted">Name:</span>
            <span className="font-mono font-medium text-text">{result.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">Framework:</span>
            {result.framework.map((framework) => (
              <span key={framework} className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">{framework}</span>
            ))}
            {result.framework.length === 0 && <span className="text-xs italic text-text-muted">none detected</span>}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => result && onNext(folderPath.trim(), result.name, result.framework)} disabled={!result} className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40">
          Continue
        </button>
      </div>
    </div>
  );
}
