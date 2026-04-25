"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/(app)/projects/[name]/settings/actions";
import { DocumentsSection } from "./DocumentsSection";
import { EnvSection } from "./EnvSection";
import { GeneralSection } from "./GeneralSection";
import { ToolsSection } from "./ToolsSection";

interface Props {
  projectName: string;
  projectPath: string;
  mcpProfile: string;
  profiles: string[];
  docs: Record<string, string>;
  tools: Record<string, string>;
  envRequired: string[];
  envFile: string;
}

export function SettingsForm({
  projectName,
  projectPath,
  mcpProfile,
  profiles,
  docs,
  tools,
  envRequired,
  envFile,
}: Props) {
  const [state, action, pending] = useActionState(saveSettings, { saved: false });

  return (
    <form action={action} className="flex w-full flex-col gap-6">
      <input type="hidden" name="projectName" value={projectName} />
      <GeneralSection name={projectName} projectPath={projectPath} mcpProfile={mcpProfile} profiles={profiles} />
      <DocumentsSection docs={docs} />
      <ToolsSection tools={tools} />
      <EnvSection required={envRequired} envFile={envFile} />

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50">
          {pending ? "Saving..." : "Save Changes"}
        </button>
        {state?.error && <p className="text-sm text-blocked">{state.error}</p>}
        {state?.saved && !pending && <p className="text-sm text-done">Saved!</p>}
      </div>
    </form>
  );
}
