"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Clipboard, ExternalLink, Settings, TerminalSquare } from "lucide-react";

export function ProjectConsoleActions({ projectName, projectPath }: { projectName: string; projectPath?: string | null }) {
  const [copied, setCopied] = useState(false);
  const command = `gcs project open ${projectName}`;
  const vscodeHref = projectPath ? `vscode://file/${projectPath.replace(/\\/g, "/")}` : null;

  function copyCommand() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
        <TerminalSquare size={17} className="text-accent" />
        Developer Actions
      </h2>

      <div className="space-y-3">
        <button
          type="button"
          onClick={copyCommand}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-muted transition-colors hover:bg-card-hover hover:text-text"
        >
          <span className="flex items-center gap-2">
            {copied ? <Check size={14} className="text-done" /> : <Clipboard size={14} className="text-accent" />}
            Copy CLI command
          </span>
          <code className="max-w-44 truncate rounded bg-card px-2 py-0.5 text-[10px] text-accent">{command}</code>
        </button>

        {vscodeHref ? (
          <a
            href={vscodeHref}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-muted transition-colors hover:bg-card-hover hover:text-text"
          >
            <span className="flex items-center gap-2">
              <TerminalSquare size={14} className="text-accent" />
              Open local path
            </span>
            <ExternalLink size={13} />
          </a>
        ) : (
          <div className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-muted">
            Local path is not registered for this project.
          </div>
        )}

        <Link
          href={`/projects/${projectName}/settings`}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-muted transition-colors hover:bg-card-hover hover:text-text"
        >
          <span className="flex items-center gap-2">
            <Settings size={14} className="text-accent" />
            Project settings
          </span>
          <ExternalLink size={13} />
        </Link>
      </div>
    </section>
  );
}
