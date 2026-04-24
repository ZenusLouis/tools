"use client";

import { useMemo, useState, useTransition } from "react";

type Skill = { id: string; name: string; slug: string; category: string; description: string; isRemote: boolean };
type Role = {
  id: string;
  name: string;
  slug: string;
  description: string;
  provider: "claude" | "codex" | "chatgpt";
  phase: string;
  roleType: string;
  executionModeDefault: "local" | "dashboard";
  credentialService: string;
  rulesMarkdown: string;
  skills: Skill[];
  isBuiltin: boolean;
};

export function CreateRoleClient({ roles, skills, profiles }: { roles: Role[]; skills: Skill[]; profiles: string[] }) {
  const [roleList, setRoleList] = useState(roles);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<Skill[]>([]);
  const [rulesDraft, setRulesDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const groupedSkills = useMemo(() => {
    return skills.reduce<Record<string, Skill[]>>((acc, skill) => {
      acc[skill.category] ??= [];
      acc[skill.category].push(skill);
      return acc;
    }, {});
  }, [skills]);

  function toggleSkill(id: string) {
    setSelectedSkillIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function research(formData: FormData) {
    startTransition(async () => {
      const res = await fetch("/api/roles/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleType: formData.get("roleType"),
          provider: formData.get("provider"),
        }),
      });
      const body = await res.json();
      setSuggested(body.suggestions ?? []);
      setRulesDraft(body.rulesDraft ?? "");
      setSelectedSkillIds((prev) => Array.from(new Set([...prev, ...(body.suggestions ?? []).map((s: Skill) => s.id)])));
    });
  }

  function createRole(formData: FormData) {
    startTransition(async () => {
      const payload = {
        name: formData.get("name"),
        slug: formData.get("slug"),
        description: formData.get("description"),
        provider: formData.get("provider"),
        phase: formData.get("phase"),
        executionModeDefault: formData.get("executionModeDefault"),
        credentialService: formData.get("credentialService"),
        roleType: formData.get("roleType"),
        defaultModel: formData.get("defaultModel") || undefined,
        mcpProfile: formData.get("mcpProfile") || undefined,
        rulesMarkdown: formData.get("rulesMarkdown") || rulesDraft,
        skillIds: selectedSkillIds,
      };
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json();
        setRoleList((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-bold text-text mb-3">Role Library</h2>
        <div className="flex flex-col gap-2">
          {roleList.map((role) => (
            <div key={role.id} className="rounded-lg border border-border bg-bg-base p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-text">{role.name}</p>
                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">{role.provider}</span>
              </div>
              <p className="mt-1 text-xs text-text-muted">{role.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="rounded bg-border px-1.5 py-0.5 text-[10px] text-text-muted">{role.phase}</span>
                <span className="rounded bg-border px-1.5 py-0.5 text-[10px] text-text-muted">{role.executionModeDefault}</span>
                <span className="rounded bg-border px-1.5 py-0.5 text-[10px] text-text-muted">{role.skills.length} skills</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <form action={createRole} className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-text">Custom AI Builder</h2>
            <p className="text-xs text-text-muted">Create a role, attach skills, and preview generated local artifacts.</p>
          </div>
          <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Role</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input name="name" label="Name" placeholder="Backend Reviewer" />
          <Input name="slug" label="Slug" placeholder="backend-reviewer" />
          <Input name="description" label="Description" placeholder="Reviews backend API and DB changes" />
          <Input name="defaultModel" label="Model / version" placeholder="optional" />
          <Select name="provider" label="Provider" options={["claude", "codex", "chatgpt"]} />
          <Select name="phase" label="Phase" options={["analysis", "implementation", "review", "research", "design", "custom"]} />
          <Select name="executionModeDefault" label="Execution mode" options={["local", "dashboard"]} />
          <Select name="credentialService" label="Credential" options={["none", "openai", "anthropic"]} />
          <Select name="roleType" label="Role type" options={["ba", "dev", "reviewer", "qa", "design", "researcher", "custom"]} />
          <Select name="mcpProfile" label="MCP profile" options={["", ...profiles]} />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wide text-text-muted">Rules</label>
            <button formAction={research} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10">
              {pending ? "Researching..." : "Research Skills"}
            </button>
          </div>
          <textarea name="rulesMarkdown" defaultValue={rulesDraft} className="min-h-32 w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent" />
        </div>

        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-text-muted mb-3">Skills</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(groupedSkills).map(([category, list]) => (
              <div key={category} className="rounded-lg border border-border bg-bg-base p-3">
                <p className="mb-2 text-[10px] font-bold uppercase text-accent">{category}</p>
                <div className="flex flex-col gap-1.5">
                  {list.map((skill) => (
                    <label key={skill.id} className="flex items-start gap-2 text-xs">
                      <input type="checkbox" checked={selectedSkillIds.includes(skill.id)} onChange={() => toggleSkill(skill.id)} className="mt-0.5" />
                      <span>
                        <span className="font-semibold text-text">{skill.name}</span>
                        {skill.isRemote && <span className="ml-1 text-[10px] text-in-progress">remote</span>}
                        <span className="block text-text-muted">{skill.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-bg-base p-3 text-xs text-text-muted">
          <p className="font-semibold text-text">Generated preview</p>
          <p><code>agents/roles/&lt;slug&gt;.json</code></p>
          <p><code>.claude/roles/&lt;slug&gt;.md</code></p>
          <p><code>.agents/skills/&lt;slug&gt;/SKILL.md</code></p>
          {suggested.length > 0 && <p className="mt-2 text-accent">{suggested.length} suggested skills selected.</p>}
        </div>
      </form>
    </div>
  );
}

function Input({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</span>
      <input name={name} placeholder={placeholder} className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent" />
    </label>
  );
}

function Select({ name, label, options }: { name: string; label: string; options: string[] }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</span>
      <select name={name} className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent">
        {options.map((option) => <option key={option} value={option}>{option || "none"}</option>)}
      </select>
    </label>
  );
}

