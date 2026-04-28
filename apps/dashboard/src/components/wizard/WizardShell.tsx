"use client";

import { useState } from "react";
import { Step1Path } from "./Step1Path";
import { Step2Config } from "./Step2Config";
import { Step3Index } from "./Step3Index";
import { Step4Done } from "./Step4Done";

export type WizardData = {
  folderPath: string;
  name: string;
  framework: string[];
  mcpProfile: string;
  figmaUrl: string;
  githubUrl: string;
  linearUrl: string;
  brdPath: string;
  prdPath: string;
  localSyncQueued: boolean;
};

const EMPTY: WizardData = {
  folderPath: "",
  name: "",
  framework: [],
  mcpProfile: "",
  figmaUrl: "",
  githubUrl: "",
  linearUrl: "",
  brdPath: "",
  prdPath: "",
  localSyncQueued: false,
};

const STEPS = ["Path", "Configure", "Index", "Done"];

export function WizardShell({ mcpProfiles }: { mcpProfiles: string[] }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(EMPTY);

  function patch(partial: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-0">
          {STEPS.map((label, index) => {
            const num = index + 1;
            const done = step > num;
            const active = step === num;
            return (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <div className="flex shrink-0 items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${done ? "bg-done/20 text-done" : active ? "bg-accent text-white" : "bg-border text-text-muted"}`}>
                    {done ? "OK" : num}
                  </div>
                  <span className={`text-xs font-medium ${active ? "text-text" : "text-text-muted"}`}>{label}</span>
                </div>
                {index < STEPS.length - 1 && <div className={`mx-3 h-px flex-1 ${step > num ? "bg-done/40" : "bg-border"}`} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        {step === 1 && (
          <Step1Path
            initial={data.folderPath}
            onNext={(folderPath, name, framework) => {
              patch({ folderPath, name, framework });
              setStep(2);
            }}
          />
        )}
        {step === 2 && (
          <Step2Config
            data={data}
            mcpProfiles={mcpProfiles}
            onBack={() => setStep(1)}
            onNext={(cfg) => {
              patch(cfg);
              setStep(3);
            }}
          />
        )}
        {step === 3 && (
          <Step3Index
            data={data}
            onBack={() => setStep(2)}
            onDone={(name, localSyncQueued) => {
              patch({ ...(name ? { name } : {}), localSyncQueued: Boolean(localSyncQueued) });
              setStep(4);
            }}
          />
        )}
        {step === 4 && <Step4Done name={data.name} folderPath={data.folderPath} localSyncQueued={data.localSyncQueued} />}
      </div>
    </div>
  );
}
