"use client";

import { useActionState, useState } from "react";
import { Plus, Save } from "lucide-react";
import { registerMcpServer, saveMcpProfile } from "@/app/actions/mcp";

export function RegisterMcpServerForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(registerMcpServer, { ok: false });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-hover">
        <Plus size={14} />
        Register Server
      </button>
    );
  }

  return (
    <form action={action} className="rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" placeholder="server name" className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent" />
        <select name="type" className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent">
          <option value="http">http</option>
          <option value="stdio">stdio</option>
          <option value="sse">sse</option>
        </select>
        <input name="url" placeholder="https://..." className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent" />
        <input name="command" placeholder="command for stdio" className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent" />
        <input name="args" placeholder="optional args" className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent sm:col-span-2" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button disabled={pending} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Save</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted">Cancel</button>
        {state.error && <span className="text-xs text-blocked">{state.error}</span>}
        {state.ok && <span className="text-xs text-done">Saved</span>}
      </div>
    </form>
  );
}

export function McpProfileForm({ serverNames }: { serverNames: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveMcpProfile, { ok: false });
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-accent text-[10px] font-bold hover:underline">
        Manage profile
      </button>
    );
  }
  return (
    <form action={action} className="mt-3 rounded-xl border border-border bg-bg-base p-3">
      <div className="grid gap-2">
        <input name="profile" placeholder="profile name" className="rounded border border-border bg-card px-2 py-1.5 text-xs text-text outline-none focus:border-accent" />
        <input name="description" placeholder="description" className="rounded border border-border bg-card px-2 py-1.5 text-xs text-text outline-none focus:border-accent" />
        <input name="useWhen" placeholder="use when..." className="rounded border border-border bg-card px-2 py-1.5 text-xs text-text outline-none focus:border-accent" />
        <input name="servers" placeholder={serverNames.join(", ") || "server1, server2"} className="rounded border border-border bg-card px-2 py-1.5 text-xs text-text outline-none focus:border-accent" />
      </div>
      <div className="mt-2 flex gap-2">
        <button disabled={pending} className="inline-flex items-center gap-1 rounded bg-accent px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50">
          <Save size={11} />
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-border px-2 py-1 text-[10px] text-text-muted">Cancel</button>
        {state.error && <span className="text-[10px] text-blocked">{state.error}</span>}
        {state.ok && <span className="text-[10px] text-done">Saved</span>}
      </div>
    </form>
  );
}
