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
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border bg-bg-base px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted"
      />
    </div>
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

  function patch(k: keyof typeof cfg, v: string) {
    setCfg((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold mb-1">Step 2 — Configure</h2>
        <p className="text-xs text-text-muted">All fields optional. You can update these later in Project Settings.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-muted uppercase tracking-wide">MCP Profile</label>
        <select
          value={cfg.mcpProfile}
          onChange={(e) => patch("mcpProfile", e.target.value)}
          className="rounded-lg border bg-bg-base px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent text-text"
        >
          <option value="">— none —</option>
          {mcpProfiles.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Tools & Integrations</p>
        <Field label="Figma URL" value={cfg.figmaUrl} onChange={(v) => patch("figmaUrl", v)} placeholder="https://figma.com/file/..." />
        <Field label="GitHub URL" value={cfg.githubUrl} onChange={(v) => patch("githubUrl", v)} placeholder="https://github.com/org/repo" />
        <Field label="Linear URL" value={cfg.linearUrl} onChange={(v) => patch("linearUrl", v)} placeholder="https://linear.app/..." />
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Documents</p>
        <Field label="BRD Path" value={cfg.brdPath} onChange={(v) => patch("brdPath", v)} placeholder="D:\docs\BRD.md" />
        <Field label="PRD Path" value={cfg.prdPath} onChange={(v) => patch("prdPath", v)} placeholder="D:\docs\PRD.md" />
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="rounded-lg border text-xs font-medium px-4 py-2 hover:bg-card-hover transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={() => onNext(cfg)}
          className="rounded-lg bg-accent text-white text-xs font-semibold px-4 py-2 hover:bg-accent/90 transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
