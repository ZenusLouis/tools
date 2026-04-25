"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, Loader } from "lucide-react";
import { createProject } from "@/app/(app)/projects/new/actions";
import type { WizardData } from "./WizardShell";

interface Props {
  data: WizardData;
  onBack: () => void;
  onDone: () => void;
}

type Status = "idle" | "running" | "done" | "error";

const STEP_LABELS = [
  "Writing context.json",
  "Creating progress.json",
  "Scanning project files",
  "Building code-index.md",
  "Registering project",
];

export function Step3Index({ data, onBack, onDone }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(-1);

  async function run() {
    setStatus("running");
    setError(null);

    const interval = setInterval(() => {
      setStepIndex((prev) => (prev < STEP_LABELS.length - 1 ? prev + 1 : prev));
    }, 600);

    const result = await createProject({
      name: data.name,
      folderPath: data.folderPath,
      framework: data.framework,
      mcpProfile: data.mcpProfile,
      docs: {
        brd: data.brdPath || undefined,
        prd: data.prdPath || undefined,
      },
      tools: {
        figma: data.figmaUrl || undefined,
        github: data.githubUrl || undefined,
        linear: data.linearUrl || undefined,
      },
    });

    clearInterval(interval);
    setStepIndex(STEP_LABELS.length - 1);

    if (result.error) {
      setStatus("error");
      setError(result.error);
    } else {
      setStatus("done");
      setTimeout(onDone, 800);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Step 3</p>
        <h2 className="mt-1 text-base font-semibold text-text">Index and Create</h2>
        <p className="mt-1 text-xs text-text-muted">
          Creating <span className="font-mono text-accent">{data.name}</span> and scanning project files.
        </p>
      </div>

      {status === "idle" && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg-base px-4 py-3 text-xs text-text-muted">
          <p className="font-medium text-text">Ready to index</p>
          <p>Path: <span className="font-mono">{data.folderPath}</span></p>
          <p>Framework: <span className="font-mono">{data.framework.join(", ") || "none detected"}</span></p>
          {data.mcpProfile && <p>MCP Profile: <span className="font-mono">{data.mcpProfile}</span></p>}
        </div>
      )}

      {(status === "running" || status === "done") && (
        <div className="flex flex-col gap-2">
          {STEP_LABELS.map((label, index) => {
            const isDone = status === "done" || index < stepIndex;
            const isActive = status === "running" && index === stepIndex;
            return (
              <div key={label} className="flex items-center gap-2.5 text-xs">
                {isDone ? <CheckCircle className="h-4 w-4 shrink-0 text-done" /> : isActive ? <Loader className="h-4 w-4 shrink-0 animate-spin text-accent" /> : <div className="h-4 w-4 shrink-0 rounded-full border border-border" />}
                <span className={isDone ? "text-text" : isActive ? "text-accent" : "text-text-muted"}>{label}</span>
              </div>
            );
          })}
        </div>
      )}

      {status === "error" && (
        <div className="flex gap-2 rounded-lg border border-blocked/30 bg-blocked/10 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blocked" />
          <p className="text-xs text-blocked">{error}</p>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} disabled={status === "running"} className="rounded-lg border border-border px-4 py-2 text-xs font-medium transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-40">Back</button>
        {status === "idle" && <button onClick={run} className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent/90">Create Project</button>}
        {status === "error" && <button onClick={run} className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent/90">Retry</button>}
      </div>
    </div>
  );
}
