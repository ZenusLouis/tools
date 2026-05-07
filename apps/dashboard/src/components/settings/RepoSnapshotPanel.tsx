"use client";

import { useEffect, useState } from "react";
import { DatabaseBackup, Download, RefreshCw, UploadCloud } from "lucide-react";

type Snapshot = {
  id: string;
  kind: string;
  projectName: string | null;
  hash: string;
  status: string;
  exportedAt: string;
};

type ImportResult = {
  projects: number;
  modules: number;
  features: number;
  tasks: number;
  decisions: number;
  lessons: number;
  mcpServers: number;
  mcpProfiles: number;
  sessions: number;
  toolUsages: number;
  skills: number;
  roles: number;
};

type SnapshotImportSummary = {
  projects: number;
  modules: number;
  features: number;
  tasks: number;
  roles: number;
  skills: number;
  memories: number;
  skippedLocalPaths: number;
};

function totalImported(result: ImportResult) {
  return Object.values(result).reduce((sum, value) => sum + value, 0);
}

function summarizeSnapshotImport(summary: SnapshotImportSummary) {
  const total = summary.projects
    + summary.modules
    + summary.features
    + summary.tasks
    + summary.roles
    + summary.skills
    + summary.memories;
  const skipped = summary.skippedLocalPaths > 0
    ? ` Skipped ${summary.skippedLocalPaths.toLocaleString()} machine-specific local path(s).`
    : "";
  return `Imported ${total.toLocaleString()} snapshot records into DB.${skipped}`;
}

export function RepoSnapshotPanel() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingSnapshot, setImportingSnapshot] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSnapshots() {
    setLoadingSnapshots(true);
    try {
      const res = await fetch("/api/snapshots", { cache: "no-store" });
      const body = await res.json();
      setSnapshots(Array.isArray(body.snapshots) ? body.snapshots : []);
    } finally {
      setLoadingSnapshots(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/snapshots", { cache: "no-store" })
      .then((res) => res.json())
      .then((body) => {
        if (active) setSnapshots(Array.isArray(body.snapshots) ? body.snapshots : []);
      })
      .catch(() => {
        if (active) setSnapshots([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function importRepo() {
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/import/repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeLogs }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Import failed");
      const result = body.result as ImportResult;
      setMessage(`Imported ${totalImported(result).toLocaleString()} records from repo JSON into DB.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  async function importSnapshotFile(file: File | null) {
    if (!file) return;
    setImportingSnapshot(true);
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      const snapshot = JSON.parse(text) as unknown;
      const res = await fetch("/api/import/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Snapshot import failed");
      setMessage(summarizeSnapshotImport(body.summary as SnapshotImportSummary));
      await loadSnapshots();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImportingSnapshot(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <DatabaseBackup size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="font-bold text-text">DB Snapshots</h3>
              <p className="text-xs text-text-muted">DB is runtime source of truth. Repo JSON is import/export only.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={importRepo}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? <RefreshCw size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            Import repo JSON
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-bg-base px-3 py-2 text-xs font-bold text-text transition-colors hover:border-accent/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
            {importingSnapshot ? <RefreshCw size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            Import snapshot
            <input
              type="file"
              accept="application/json,.json"
              disabled={importingSnapshot}
              onChange={(event) => {
                void importSnapshotFile(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
              className="sr-only"
            />
          </label>
          <a
            href="/api/export/workspace"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-hover"
          >
            <Download size={14} />
            Export workspace
          </a>
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-xs text-text-muted">
        <input
          type="checkbox"
          checked={includeLogs}
          onChange={(event) => setIncludeLogs(event.target.checked)}
          className="h-4 w-4 rounded border-border bg-bg-base accent-accent"
        />
        Include logs and token history when importing repo JSON
      </label>

      {message && <p className="mt-4 rounded-lg border border-done/30 bg-done/10 px-3 py-2 text-xs text-done">{message}</p>}
      {error && <p className="mt-4 rounded-lg border border-blocked/30 bg-blocked/10 px-3 py-2 text-xs text-blocked">{error}</p>}

      <div className="mt-6 border-t border-border pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Recent exports</p>
          <button onClick={loadSnapshots} className="text-text-muted hover:text-text" aria-label="Refresh snapshots">
            <RefreshCw size={14} className={loadingSnapshots ? "animate-spin" : ""} />
          </button>
        </div>
        {snapshots.length === 0 ? (
          <p className="text-xs text-text-muted">No snapshots exported yet.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {snapshots.slice(0, 6).map((snapshot) => (
              <div key={snapshot.id} className="rounded-lg border border-border bg-bg-base px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-xs font-bold text-text">{snapshot.projectName ?? "workspace"}</p>
                  <span className="rounded bg-card-hover px-2 py-0.5 text-[10px] text-text-muted">{snapshot.kind}</span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-text-muted">{snapshot.hash.slice(0, 16)}</p>
                <p className="mt-1 text-[10px] text-text-muted">{new Date(snapshot.exportedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
