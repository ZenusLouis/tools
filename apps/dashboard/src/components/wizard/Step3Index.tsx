"use client";

import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Loader } from "lucide-react";
import { createProject } from "@/app/(app)/projects/new/actions";
import type { WizardData } from "./WizardShell";

interface Props {
  data: WizardData;
  onBack: () => void;
  onDone: () => void;
}

type Status = "idle" | "running" | "done" | "error";

const STEPS_LABELS = [
  "Writing context.json",
  "Creating progress.json",
  "Scanning project files",
  "Building code-index.md",
  "Registering project",
];

export function Step3Index({ data, onBack, onDone }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(-1);

  async function run() {
    setStatus("running");
    setError(null);

    // Animate through steps while the server action runs
    let i = 0;
    const interval = setInterval(() => {
      setStepIdx((prev) => {
        i = prev + 1;
        return i < STEPS_LABELS.length - 1 ? i : prev;
      });
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
    setStepIdx(STEPS_LABELS.length - 1);

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
        <h2 className="text-base font-semibold mb-1">Step 3 — Index & Create</h2>
        <p className="text-xs text-text-muted">
          Creating <span className="font-mono text-accent">{data.name}</span> and scanning project files.
        </p>
      </div>

      {status === "idle" && (
        <div className="rounded-lg border bg-bg-base px-4 py-3 flex flex-col gap-2 text-xs text-text-muted">
          <p className="font-medium text-text">Ready to index</p>
          <p>Path: <span className="font-mono">{data.folderPath}</span></p>
          <p>Framework: <span className="font-mono">{data.framework.join(", ") || "none detected"}</span></p>
          {data.mcpProfile && <p>MCP Profile: <span className="font-mono">{data.mcpProfile}</span></p>}
        </div>
      )}

      {(status === "running" || status === "done") && (
        <div className="flex flex-col gap-2">
          {STEPS_LABELS.map((label, i) => {
            const isDone = status === "done" || i < stepIdx;
            const isActive = status === "running" && i === stepIdx;
            return (
              <div key={label} className="flex items-center gap-2.5 text-xs">
                {isDone ? (
                  <CheckCircle className="h-4 w-4 text-done shrink-0" />
                ) : isActive ? (
                  <Loader className="h-4 w-4 text-accent shrink-0 animate-spin" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-border shrink-0" />
                )}
                <span className={isDone ? "text-text" : isActive ? "text-accent" : "text-text-muted"}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg border border-blocked/30 bg-blocked/10 px-4 py-3 flex gap-2">
          <AlertCircle className="h-4 w-4 text-blocked shrink-0 mt-0.5" />
          <p className="text-xs text-blocked">{error}</p>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={status === "running"}
          className="rounded-lg border text-xs font-medium px-4 py-2 hover:bg-card-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        {status === "idle" && (
          <button
            onClick={run}
            className="rounded-lg bg-accent text-white text-xs font-semibold px-4 py-2 hover:bg-accent/90 transition-colors"
          >
            Create Project
          </button>
        )}
        {status === "error" && (
          <button
            onClick={run}
            className="rounded-lg bg-accent text-white text-xs font-semibold px-4 py-2 hover:bg-accent/90 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
