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
    <div className="flex items-center gap-2 rounded-lg border bg-card-hover px-3 py-2">
      <span className="flex-1 text-sm font-mono text-text">{name}</span>
      <span className="text-xs font-mono text-text-muted tracking-widest">••••••</span>
      <button
        type="button"
        onClick={handleCopy}
        className="text-xs text-accent hover:text-accent/80 transition-colors w-10 text-right"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function EnvSection({ required, envFile }: Props) {
  const [vars, setVars] = useState<string[]>(required);
  const [newVar, setNewVar] = useState("");

  function addVar() {
    const v = newVar.trim().toUpperCase();
    if (v && !vars.includes(v)) {
      setVars([...vars, v]);
    }
    setNewVar("");
  }

  function removeVar(name: string) {
    setVars(vars.filter((v) => v !== name));
  }

  return (
    <section className="rounded-xl border bg-card p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Environment Variables</h2>
        {envFile && (
          <span className="text-xs font-mono text-text-muted">{envFile}</span>
        )}
      </div>

      {/* Hidden input to submit current vars list */}
      <input type="hidden" name="env.required" value={JSON.stringify(vars)} />

      <div className="flex flex-col gap-2">
        {vars.length === 0 && (
          <p className="text-sm text-text-muted">No variables configured.</p>
        )}
        {vars.map((v) => (
          <div key={v} className="flex items-center gap-2">
            <div className="flex-1">
              <MaskedVar name={v} />
            </div>
            <button
              type="button"
              onClick={() => removeVar(v)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors px-2"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newVar}
          onChange={(e) => setNewVar(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addVar())}
          placeholder="NEW_VAR_NAME"
          className="flex-1 rounded-lg border bg-card-hover px-3 py-2 text-sm font-mono text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          onClick={addVar}
          className="rounded-lg border bg-card-hover px-4 py-2 text-sm text-text hover:bg-card transition-colors"
        >
          Add
        </button>
      </div>
    </section>
  );
}
