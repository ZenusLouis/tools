"use client";

import { useState, useTransition } from "react";
import { Check, FileText, Loader2, Palette, PenTool, ScanSearch } from "lucide-react";

type FigmaAction = {
  actionType: "mcp_design_inspection" | "mcp_ui_brief" | "mcp_design_implementation" | "mcp_visual_review";
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const ACTIONS: FigmaAction[] = [
  { actionType: "mcp_design_inspection", label: "Analyze", icon: Palette },
  { actionType: "mcp_ui_brief", label: "Brief", icon: FileText },
  { actionType: "mcp_design_implementation", label: "Implement", icon: PenTool },
  { actionType: "mcp_visual_review", label: "Review", icon: ScanSearch },
];

export function FigmaDesignButton({ projectName }: { projectName: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function queueInspection(action: FigmaAction) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/figma/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: action.actionType }),
      });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setMessage(result.error ?? "Figma inspection failed to queue.");
        return;
      }
      setMessage(`${action.label} queued.`);
      window.dispatchEvent(new Event("gcs-run-queue-refresh"));
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.actionType}
            type="button"
            onClick={() => queueInspection(action)}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:bg-card-hover hover:text-text disabled:opacity-50"
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
            {action.label}
          </button>
        );
      })}
      {message && (
        <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
          {message.includes("queued") && <Check size={12} className="text-done" />}
          {message}
        </span>
      )}
    </span>
  );
}
