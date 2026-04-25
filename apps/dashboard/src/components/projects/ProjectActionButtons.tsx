"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink, Loader2, Rocket, RotateCw, TerminalSquare } from "lucide-react";
import { deployProject, reindexProject } from "@/app/actions/projects";

export function ProjectActionButtons({ projectName, projectPath }: { projectName: string; projectPath?: string | null }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function run(action: "deploy" | "reindex") {
    setFeedback(null);
    startTransition(async () => {
      const result = action === "deploy"
        ? await deployProject(projectName)
        : await reindexProject(projectName);
      setFeedback(result.ok ? `${action === "deploy" ? "Deploy" : "Reindex"} event recorded.` : (result.error ?? "Action failed"));
    });
  }

  const vscodeHref = projectPath ? `vscode://file/${projectPath.replace(/\\/g, "/")}` : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => run("deploy")}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
        Deploy
      </button>
      <button
        onClick={() => run("reindex")}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-card-hover hover:text-text disabled:opacity-50"
      >
        <RotateCw size={13} />
        Reindex
      </button>
      {vscodeHref && (
        <a
          href={vscodeHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-card-hover hover:text-text"
        >
          <TerminalSquare size={13} />
          Open Local
          <ExternalLink size={11} />
        </a>
      )}
      {feedback && (
        <span className="inline-flex items-center gap-1 rounded-lg bg-done/10 px-2 py-1 text-[11px] text-done">
          <Check size={12} />
          {feedback}
        </span>
      )}
    </div>
  );
}
