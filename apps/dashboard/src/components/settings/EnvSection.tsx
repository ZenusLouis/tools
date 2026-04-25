"use client";

import { useState } from "react";

interface Props {
  required: string[];
  envFile: string;
}

function MaskedVar({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(name);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card-hover px-3 py-2">
      <span className="flex-1 font-mono text-sm text-text">{name}</span>
      <span className="font-mono text-xs tracking-widest text-text-muted">******</span>
      <button type="button" onClick={handleCopy} className="w-10 text-right text-xs text-accent transition-colors hover:text-accent/80">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function EnvSection({ required, envFile }: Props) {
  const [vars, setVars] = useState<string[]>(required);
  const [newVar, setNewVar] = useState("");

  function addVar() {
    const value = newVar.trim().toUpperCase();
    if (value && !vars.includes(value)) setVars([...vars, value]);
    setNewVar("");
  }

  function removeVar(name: string) {
    setVars(vars.filter((value) => value !== name));
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Environment Variables</h2>
        {envFile && <span className="font-mono text-xs text-text-muted">{envFile}</span>}
      </div>

      <input type="hidden" name="env.required" value={JSON.stringify(vars)} />

      <div className="flex flex-col gap-2">
        {vars.length === 0 && <p className="text-sm text-text-muted">No variables configured.</p>}
        {vars.map((value) => (
          <div key={value} className="flex items-center gap-2">
            <div className="flex-1">
              <MaskedVar name={value} />
            </div>
            <button type="button" onClick={() => removeVar(value)} className="px-2 text-xs text-blocked transition-colors hover:text-blocked/80">
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input type="text" value={newVar} onChange={(event) => setNewVar(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addVar())} placeholder="NEW_VAR_NAME" className="flex-1 rounded-lg border border-border bg-card-hover px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent" />
        <button type="button" onClick={addVar} className="rounded-lg border border-border bg-card-hover px-4 py-2 text-sm text-text transition-colors hover:bg-card">
          Add
        </button>
      </div>
    </section>
  );
}
