"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/(app)/projects/[name]/settings/actions";
import { DocumentsSection } from "./DocumentsSection";
import { EnvSection } from "./EnvSection";
import { GeneralSection } from "./GeneralSection";
import { TechStackSection } from "./TechStackSection";
import { ToolsSection } from "./ToolsSection";
import type { LocalProjectPath } from "@/lib/settings";

interface Props {
  projectName: string;
  projectPath: string;
  localPaths: LocalProjectPath[];
  mcpProfile: string;
  profiles: string[];
  frameworks: string[];
  docs: Record<string, string>;
  tools: Record<string, string>;
  envRequired: string[];
  envFile: string;
}

export function SettingsForm({
  projectName,
  projectPath,
  localPaths,
  mcpProfile,
  profiles,
  frameworks,
  docs,
  tools,
  envRequired,
  envFile,
}: Props) {
  const [state, action, pending] = useActionState(saveSettings, { saved: false });

  return (
    <form action={action} className="flex w-full flex-col gap-6">
      <input type="hidden" name="projectName" value={projectName} />
      <div id="general"><GeneralSection name={projectName} projectPath={projectPath} localPaths={localPaths} mcpProfile={mcpProfile} profiles={profiles} /></div>
      <div id="stack"><TechStackSection frameworks={frameworks} /></div>
      <div id="documents"><DocumentsSection docs={docs} /></div>
      <div id="tools"><ToolsSection tools={tools} /></div>
      <div id="environment"><EnvSection required={envRequired} envFile={envFile} /></div>

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
