"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/(app)/projects/[name]/settings/actions";
import { GeneralSection } from "./GeneralSection";
import { DocumentsSection } from "./DocumentsSection";
import { ToolsSection } from "./ToolsSection";
import { EnvSection } from "./EnvSection";

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
    <form action={action} className="flex flex-col gap-6 max-w-2xl">
      <input type="hidden" name="projectName" value={projectName} />

      <GeneralSection
        name={projectName}
        projectPath={projectPath}
        mcpProfile={mcpProfile}
        profiles={profiles}
      />
      <DocumentsSection docs={docs} />
      <ToolsSection tools={tools} />
      <EnvSection required={envRequired} envFile={envFile} />

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {pending ? "Saving…" : "Save Changes"}
        </button>
        {state?.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}
        {state?.saved && !pending && (
          <p className="text-sm text-green-400">Saved!</p>
        )}
      </div>
    </form>
  );
}
