"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, Key, Loader2, Plus, Trash2 } from "lucide-react";
import type { ApiKeyRow } from "@/lib/api-keys";

const SERVICE_OPTIONS = [
  { value: "stitch", label: "Stitch Design" },
  { value: "figma", label: "Figma" },
  { value: "github", label: "GitHub" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "custom", label: "Custom" },
];

function ServiceBadge({ service }: { service: string }) {
  const colors: Record<string, string> = {
    stitch: "bg-accent/10 text-accent",
    figma: "bg-in-progress/10 text-in-progress",
    github: "bg-card-hover text-text-muted",
    openai: "bg-done/10 text-done",
    anthropic: "bg-accent/10 text-accent",
  };
  return <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${colors[service] ?? "bg-border text-text-muted"}`}>{service}</span>;
}

function KeyRow({ row, onDelete }: { row: ApiKeyRow; onDelete: (id: string) => void }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleReveal() {
    if (revealed) {
      setRevealed(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/keys/reveal/${row.id}`);
      const data = await res.json();
      if (res.ok) setRevealed(data.value);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch("/api/keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }) });
      onDelete(row.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border bg-bg-base p-3 transition-colors hover:border-border/80">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-card-hover">
        <Key size={14} className="text-text-muted" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-text">{row.name}</span>
          <ServiceBadge service={row.service} />
        </div>
        <div className="mt-0.5 truncate font-mono text-xs text-text-muted">
          {revealed ? <span className="text-done">{revealed}</span> : "********************"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {revealed && (
          <button onClick={handleCopy} className="rounded p-1.5 text-text-muted transition-colors hover:bg-card-hover hover:text-text" title="Copy">
            {copied ? <Check size={13} className="text-done" /> : <Copy size={13} />}
          </button>
        )}
        <button onClick={toggleReveal} disabled={loading} className="rounded p-1.5 text-text-muted transition-colors hover:bg-card-hover hover:text-text" title={revealed ? "Hide" : "Reveal"}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : revealed ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button onClick={handleDelete} disabled={deleting} className="rounded p-1.5 text-text-muted transition-colors hover:bg-blocked/10 hover:text-blocked" title="Delete">
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

function AddKeyForm({ onAdded }: { onAdded: (key: ApiKeyRow) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [service, setService] = useState("stitch");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, service, value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      onAdded(data);
      setName("");
      setService("stitch");
      setValue("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-accent transition-colors hover:text-text">
        <Plus size={15} />
        Add API Key
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-accent/30 bg-bg-base p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-accent">New API Key</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. OpenAI key" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-accent" required />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Service</span>
          <select value={service} onChange={(event) => setService(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-accent">
            {SERVICE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <label className="space-y-1 block">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">API Key Value</span>
        <input type="password" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Paste your API key here" className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm text-text outline-none focus:ring-1 focus:ring-accent" required />
      </label>
      {error && <p className="text-xs text-blocked">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Key size={13} />}
          Save Encrypted
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-card-hover hover:text-text">Cancel</button>
      </div>
    </form>
  );
}

export function ApiKeysPanel({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-text">API Keys</h3>
          <p className="mt-0.5 text-[11px] text-text-muted">Encrypted with AES-256-GCM. Values are never exposed in plaintext.</p>
        </div>
        <span className="rounded border border-border bg-card-hover px-2 py-1 text-[10px] text-text-muted">{keys.length} key{keys.length !== 1 ? "s" : ""}</span>
      </div>

      {keys.length > 0 && (
        <div className="space-y-2">
          {keys.map((key) => <KeyRow key={key.id} row={key} onDelete={(id) => setKeys((prev) => prev.filter((item) => item.id !== id))} />)}
        </div>
      )}

      {keys.length === 0 && <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-text-muted">No API keys yet. Add one to get started.</div>}

      <AddKeyForm onAdded={(key) => setKeys((prev) => [...prev, key])} />
    </div>
  );
}
