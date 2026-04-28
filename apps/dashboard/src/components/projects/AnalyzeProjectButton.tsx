"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { analyzeProject } from "@/app/actions/projects";

export function AnalyzeProjectButton({
  projectName,
  label = "Analyze BRD",
  size = "md",
}: {
  projectName: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function run() {
    setFeedback(null);
    setOk(false);
    startTransition(async () => {
      const result = await analyzeProject(projectName);
      if (result.ok) {
        setOk(true);
        setFeedback(`Generated ${result.created ?? 0} tasks.`);
        router.refresh();
      } else {
        setFeedback(result.error ?? "Analysis failed");
      }
    });
  }

  const className = size === "sm"
    ? "inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
    : "inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent/90 disabled:opacity-50";

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={run} disabled={pending} className={className}>
        {pending ? <Loader2 size={size === "sm" ? 10 : 13} className="animate-spin" /> : <Sparkles size={size === "sm" ? 10 : 13} />}
        {label}
      </button>
      {feedback && (
        <span className={ok ? "inline-flex items-center gap-1 text-[11px] text-done" : "inline-flex items-center gap-1 text-[11px] text-blocked"}>
          {ok && <Check size={12} />}
          {feedback}
        </span>
      )}
    </span>
  );
}
