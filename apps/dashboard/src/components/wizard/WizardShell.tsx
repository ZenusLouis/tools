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
};

const EMPTY: WizardData = {
  folderPath: "", name: "", framework: [],
  mcpProfile: "", figmaUrl: "", githubUrl: "",
  linearUrl: "", brdPath: "", prdPath: "",
};

const STEPS = ["Path", "Configure", "Index", "Done"];

interface Props {
  mcpProfiles: string[];
}

export function WizardShell({ mcpProfiles }: Props) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(EMPTY);

  function patch(partial: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => {
          const num = i + 1;
          const done = step > num;
          const active = step === num;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2 shrink-0">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${done ? "bg-done/20 text-done" : active ? "bg-accent text-white" : "bg-border text-text-muted"}`}>
                  {done ? "✓" : num}
                </div>
                <span className={`text-xs font-medium ${active ? "text-text" : "text-text-muted"}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-3 ${step > num ? "bg-done/40" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="rounded-xl border bg-card p-6">
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
            onDone={() => setStep(4)}
          />
        )}
        {step === 4 && <Step4Done name={data.name} />}
      </div>
    </div>
  );
}
