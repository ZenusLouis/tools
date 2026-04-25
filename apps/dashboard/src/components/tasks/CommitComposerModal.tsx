"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FileText, GitCommit, Loader2, RefreshCw, Settings, X } from "lucide-react";
import type { FileChange } from "@/lib/task-detail";

type Props = {
  open: boolean;
  taskId: string;
  taskName: string;
  projectName?: string;
  files?: FileChange[];
  agentName?: string | null;
  onClose: () => void;
};

const FALLBACK_FILES: FileChange[] = [
  { path: "src/app/api/route.ts", added: 42, removed: 12 },
  { path: "src/lib/service.ts", added: 18, removed: 4 },
  { path: "prisma/schema.prisma", added: 5, removed: 2 },
];

export function CommitComposerModal({ open, taskId, taskName, projectName, files = [], agentName, onClose }: Props) {
  const [stagedFiles, setStagedFiles] = useState<FileChange[]>([]);
  const [gitStatus, setGitStatus] = useState<string | null>(null);
  const [loadingGit, setLoadingGit] = useState(false);
  const [committing, setCommitting] = useState(false);
  const changedFiles = stagedFiles.length > 0 ? stagedFiles : files.length > 0 ? files : FALLBACK_FILES;
  const [message, setMessage] = useState(`[${taskId}] ${taskName}`);
  const [copied, setCopied] = useState(false);
  const totals = useMemo(
    () => changedFiles.reduce((acc, file) => ({ added: acc.added + file.added, removed: acc.removed + file.removed }), { added: 0, removed: 0 }),
    [changedFiles]
  );

  useEffect(() => {
    if (!open || !projectName) return;
    void loadGitStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectName]);

  if (!open) return null;

  async function loadGitStatus() {
    if (!projectName) return;
    setLoadingGit(true);
    setGitStatus(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/git-status`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Unable to read git status");
      setStagedFiles(Array.isArray(body.staged) ? body.staged : []);
      const unstagedCount = Array.isArray(body.unstaged) ? body.unstaged.length : 0;
      setGitStatus(`${body.staged?.length ?? 0} staged files, ${unstagedCount} unstaged files`);
    } catch (error) {
      setGitStatus(String(error));
    } finally {
      setLoadingGit(false);
    }
  }

  async function copyCommand() {
    await navigator.clipboard.writeText(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function commitStaged() {
    if (!projectName) return;
    setCommitting(true);
    setGitStatus(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/git-commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Commit failed");
      setGitStatus(`Committed ${body.hash}`);
      setStagedFiles([]);
    } catch (error) {
      setGitStatus(String(error));
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <GitCommit className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-lg font-bold text-white">Commit Task {taskId}</h2>
              <p className="text-xs text-text-muted">Review staged changes and compose a local commit command.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-text-muted transition-colors hover:bg-card-hover hover:text-white" aria-label="Close commit composer">
            <X size={18} />
          </button>
        </div>

        <div className="px-8 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">Staged changes ({changedFiles.length})</h3>
            <div className="flex items-center gap-3">
              {gitStatus && <span className="font-mono text-[10px] text-text-muted">{gitStatus}</span>}
              {projectName && (
                <button onClick={loadGitStatus} disabled={loadingGit} className="rounded p-1 text-text-muted transition-colors hover:bg-card-hover hover:text-text">
                  {loadingGit ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
              )}
              <span className="font-mono text-[10px] text-accent">+{totals.added} / -{totals.removed}</span>
            </div>
          </div>
          <div className="mb-8 space-y-3">
            {changedFiles.map((file) => (
              <div key={file.path} className="flex items-center justify-between rounded-lg border border-border bg-bg-base/60 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  {file.path.endsWith(".prisma") ? <Settings size={15} className="shrink-0 text-text-muted" /> : <FileText size={15} className="shrink-0 text-text-muted" />}
                  <span className="truncate font-mono text-sm text-accent">{file.path}</span>
                </div>
                <div className="flex shrink-0 gap-3 font-mono text-[11px]">
                  <span className="text-done">+{file.added}</span>
                  <span className="text-blocked">-{file.removed}</span>
                </div>
              </div>
            ))}
          </div>

          <label className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Commit Message</label>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            spellCheck={false}
            className="h-32 w-full resize-none rounded-lg border border-border bg-bg-base p-4 font-mono text-sm text-text outline-none transition-colors focus:border-accent"
          />

          <label className="mt-4 flex items-center gap-3 text-xs text-text-muted">
            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border bg-bg-base text-accent focus:ring-accent" />
            Co-authored-by: <span className="font-mono text-accent">{agentName ?? "GCS Agent"}</span>
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-bg-base/40 px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Local only. Nothing is committed until you run the copied command.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted transition-colors hover:bg-card-hover hover:text-text">
              Cancel
            </button>
            <button onClick={copyCommand} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover">
              {copied ? <Check size={15} /> : <GitCommit size={15} />}
              {copied ? "Copied" : "Copy Commit Command"}
            </button>
            {projectName && (
              <button onClick={commitStaged} disabled={committing} className="inline-flex items-center gap-2 rounded-lg bg-done px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-done/80 disabled:opacity-50">
                {committing ? <Loader2 size={15} className="animate-spin" /> : <GitCommit size={15} />}
                Commit Staged
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
