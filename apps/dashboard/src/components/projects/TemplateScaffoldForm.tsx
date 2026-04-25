"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { scaffoldTemplate } from "@/app/actions/templates";

export function TemplateScaffoldForm() {
  const [state, action, pending] = useActionState(scaffoldTemplate, { ok: false });

  return (
    <form action={action} className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-400/10 text-purple-300">
          <Sparkles size={20} />
        </div>
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">Template Scaffold</p>
          <h2 className="text-xl font-black text-white">Start from Template</h2>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-bold text-text-muted">Project name</span>
          <input name="name" required placeholder="my-gcs-app" className="rounded-lg border border-border bg-bg-base px-3 py-2 text-text outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-bold text-text-muted">Framework</span>
          <select name="framework" className="rounded-lg border border-border bg-bg-base px-3 py-2 text-text outline-none focus:border-accent">
            <option value="nextjs">Next.js</option>
            <option value="nestjs">NestJS</option>
            <option value="fastapi">FastAPI</option>
            <option value="django">Django</option>
          </select>
        </label>
      </div>
      <button disabled={pending} className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        {pending ? "Scaffolding..." : "Scaffold Project"}
      </button>
      {state.error && <p className="mt-4 rounded-lg border border-blocked/30 bg-blocked/10 px-3 py-2 text-sm text-blocked">{state.error}</p>}
      {state.ok && state.name && (
        <p className="mt-4 rounded-lg border border-done/30 bg-done/10 px-3 py-2 text-sm text-done">
          Created {state.name}. <Link href={`/projects/${state.name}`} className="underline">Open project</Link>
        </p>
      )}
    </form>
  );
}
