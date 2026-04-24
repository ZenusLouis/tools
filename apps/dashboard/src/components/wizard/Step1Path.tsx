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
      if (res.error) {
        setError(res.error);
      } else {
        setResult({ name: res.name, framework: res.framework });
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold mb-1">Step 1 — Project Folder</h2>
        <p className="text-xs text-text-muted">Enter the absolute path to your project folder.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Folder Path</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={folderPath}
            onChange={(e) => { setFolderPath(e.target.value); setResult(null); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="e.g. D:\projects\my-app"
            className="flex-1 rounded-lg border bg-bg-base px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted"
          />
          <button
            onClick={handleScan}
            disabled={isPending || !folderPath.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium px-3 py-2 hover:bg-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FolderSearch className="h-4 w-4" />
            {isPending ? "Scanning…" : "Scan"}
          </button>
        </div>
        {error && <p className="text-xs text-blocked">{error}</p>}
      </div>

      {result && (
        <div className="rounded-lg border border-done/30 bg-done/5 px-4 py-3 flex flex-col gap-2">
          <p className="text-xs font-medium text-done">Project detected</p>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-text-muted text-xs">Name:</span>
            <span className="font-mono font-medium">{result.name}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-text-muted text-xs">Framework:</span>
            {result.framework.map((f) => (
              <span key={f} className="rounded px-2 py-0.5 text-[10px] font-medium bg-accent/10 text-accent">{f}</span>
            ))}
            {result.framework.length === 0 && (
              <span className="text-xs text-text-muted italic">none detected</span>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => result && onNext(folderPath.trim(), result.name, result.framework)}
          disabled={!result}
          className="rounded-lg bg-accent text-white text-xs font-semibold px-4 py-2 hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
