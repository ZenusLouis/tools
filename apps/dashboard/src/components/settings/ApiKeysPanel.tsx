"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Eye, EyeOff, Trash2, Key, Copy, Check, Loader2 } from "lucide-react";
import type { ApiKeyRow } from "@/lib/api-keys";

const SERVICE_OPTIONS = [
  { value: "stitch",   label: "Stitch Design" },
  { value: "figma",    label: "Figma" },
  { value: "github",   label: "GitHub" },
  { value: "openai",   label: "OpenAI" },
  { value: "anthropic",label: "Anthropic" },
  { value: "custom",   label: "Custom" },
];

function ServiceBadge({ service }: { service: string }) {
  const colors: Record<string, string> = {
    stitch:    "bg-purple-400/10 text-purple-400",
    figma:     "bg-pink-400/10 text-pink-400",
    github:    "bg-card-hover text-text-muted",
    openai:    "bg-done/10 text-done",
    anthropic: "bg-accent/10 text-accent",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${colors[service] ?? "bg-border text-text-muted"}`}>
      {service}
    </span>
  );
}

function KeyRow({ row, onDelete }: { row: ApiKeyRow; onDelete: (id: string) => void }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleReveal() {
    if (revealed) { setRevealed(null); return; }
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
    <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-base border border-border hover:border-border/80 transition-colors group">
      <div className="w-8 h-8 rounded bg-card-hover flex items-center justify-center shrink-0">
        <Key size={14} className="text-text-muted" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">{row.name}</span>
          <ServiceBadge service={row.service} />
        </div>
        <div className="font-mono text-xs text-text-muted mt-0.5 truncate">
          {revealed
            ? <span className="text-done">{revealed}</span>
            : "●●●●●●●●●●●●●●●●●●●●"}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {revealed && (
          <button onClick={handleCopy} className="p-1.5 rounded hover:bg-card-hover text-text-muted hover:text-text transition-colors" title="Copy">
            {copied ? <Check size={13} className="text-done" /> : <Copy size={13} />}
          </button>
        )}
        <button onClick={toggleReveal} disabled={loading} className="p-1.5 rounded hover:bg-card-hover text-text-muted hover:text-text transition-colors" title={revealed ? "Hide" : "Reveal"}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : revealed ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button onClick={handleDelete} disabled={deleting} className="p-1.5 rounded hover:bg-blocked/10 text-text-muted hover:text-blocked transition-colors" title="Delete">
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, service, value }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      onAdded(data);
      setName(""); setService("stitch"); setValue(""); setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-accent hover:text-text transition-colors">
        <Plus size={15} />
        Add API Key
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-bg-base border border-accent/30 rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-accent uppercase tracking-wider">New API Key</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] text-text-muted uppercase tracking-wider font-bold">Name</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Stitch Design Key"
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:ring-1 focus:ring-accent outline-none"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-text-muted uppercase tracking-wider font-bold">Service</label>
          <select
            value={service} onChange={(e) => setService(e.target.value)}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:ring-1 focus:ring-accent outline-none"
          >
            {SERVICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] text-text-muted uppercase tracking-wider font-bold">API Key Value</label>
        <input
          type="password"
          value={value} onChange={(e) => setValue(e.target.value)}
          placeholder="Paste your API key here"
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text font-mono focus:ring-1 focus:ring-accent outline-none"
          required
        />
      </div>

      {error && <p className="text-xs text-blocked">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-accent-hover transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Key size={13} />}
          Save Encrypted
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-text-muted hover:text-text hover:bg-card-hover transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ApiKeysPanel({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);

  function handleAdded(key: ApiKeyRow) {
    setKeys((prev) => [...prev, key]);
  }

  function handleDeleted(id: string) {
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-text">API Keys</h3>
          <p className="text-[11px] text-text-muted mt-0.5">Encrypted with AES-256-GCM. Values are never exposed in plaintext.</p>
        </div>
        <span className="text-[10px] text-text-muted bg-card-hover px-2 py-1 rounded border border-border">
          {keys.length} key{keys.length !== 1 ? "s" : ""}
        </span>
      </div>

      {keys.length > 0 && (
        <div className="space-y-2">
          {keys.map((k) => (
            <KeyRow key={k.id} row={k} onDelete={handleDeleted} />
          ))}
        </div>
      )}

      {keys.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-text-muted">
          No API keys yet. Add one to get started.
        </div>
      )}

      <AddKeyForm onAdded={handleAdded} />
    </div>
  );
}
