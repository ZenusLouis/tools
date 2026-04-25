"use client";

import { useState } from "react";
import type { WizardData } from "./WizardShell";

interface Props {
  data: WizardData;
  mcpProfiles: string[];
  onBack: () => void;
  onNext: (cfg: Partial<WizardData>) => void;
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent" />
    </label>
  );
}

export function Step2Config({ data, mcpProfiles, onBack, onNext }: Props) {
  const [cfg, setCfg] = useState({
    mcpProfile: data.mcpProfile,
    figmaUrl: data.figmaUrl,
    githubUrl: data.githubUrl,
    linearUrl: data.linearUrl,
    brdPath: data.brdPath,
    prdPath: data.prdPath,
  });

  function patch(key: keyof typeof cfg, value: string) {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Step 2</p>
        <h2 className="mt-1 text-base font-semibold text-text">Configure</h2>
        <p className="mt-1 text-xs text-text-muted">All fields optional. You can update these later in Project Settings.</p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">MCP Profile</span>
        <select value={cfg.mcpProfile} onChange={(event) => patch("mcpProfile", event.target.value)} className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent">
          <option value="">none</option>
          {mcpProfiles.map((profile) => <option key={profile} value={profile}>{profile}</option>)}
        </select>
      </label>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Tools and Integrations</p>
        <Field label="Figma URL" value={cfg.figmaUrl} onChange={(value) => patch("figmaUrl", value)} placeholder="https://figma.com/file/..." />
        <Field label="GitHub URL" value={cfg.githubUrl} onChange={(value) => patch("githubUrl", value)} placeholder="https://github.com/org/repo" />
        <Field label="Linear URL" value={cfg.linearUrl} onChange={(value) => patch("linearUrl", value)} placeholder="https://linear.app/..." />
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Documents</p>
        <Field label="BRD Path" value={cfg.brdPath} onChange={(value) => patch("brdPath", value)} placeholder="D:\\docs\\BRD.md" />
        <Field label="PRD Path" value={cfg.prdPath} onChange={(value) => patch("prdPath", value)} placeholder="D:\\docs\\PRD.md" />
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="rounded-lg border border-border px-4 py-2 text-xs font-medium transition-colors hover:bg-card-hover">Back</button>
        <button onClick={() => onNext(cfg)} className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent/90">Continue</button>
      </div>
    </div>
  );
}
