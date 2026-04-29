"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Edit2, Search, Sparkles, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Skill = { id: string; name: string; slug: string; category: string; description: string; isRemote: boolean };
type Role = {
  id: string;
  name: string;
  slug: string;
  description: string;
  provider: "claude" | "codex" | "chatgpt";
  defaultModel?: string | null;
  phase: string;
  executionModeDefault: "local" | "dashboard";
  skills: Skill[];
};

const MODEL_OPTIONS: Record<Role["provider"], string[]> = {
  claude: ["", "claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-opus-4-1-20250805"],
  codex: ["", "gpt-5.2-codex", "gpt-5.1-codex", "gpt-5.1-codex-max", "gpt-5-codex"],
  chatgpt: ["", "gpt-5.2", "gpt-5.2-pro", "gpt-5.1", "gpt-5", "gpt-4.1", "gpt-4o-mini"],
};

function modelOptionsFor(provider: Role["provider"], liveModels: string[] = []) {
  return Array.from(new Set([...MODEL_OPTIONS[provider], ...liveModels])).filter((model) => model === "" || !!model);
}

export function CreateRoleClient({ roles, skills, profiles }: { roles: Role[]; skills: Skill[]; profiles: string[] }) {
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [roleList, setRoleList] = useState(roles);
  const [skillList] = useState(skills);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<Skill[]>([]);
  const [rulesDraft, setRulesDraft] = useState("");
  const [savedName, setSavedName] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedRole, setSelectedRole] = useState<Role | null>(roleList[0] ?? null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [providerDraft, setProviderDraft] = useState<Role["provider"]>("claude");
  const [modelDraft, setModelDraft] = useState("");
  const [modelOptions, setModelOptions] = useState(MODEL_OPTIONS.claude);
  const [deletingSlug, setDeletingSlug] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [pending, startTransition] = useTransition();

  const categories = useMemo(() => ["all", ...Array.from(new Set(skillList.map((skill) => skill.category))).sort()], [skillList]);
  const selectedSkills = useMemo(() => skillList.filter((skill) => selectedSkillIds.includes(skill.id)), [skillList, selectedSkillIds]);
  const filteredSkills = useMemo(() => {
    const query = skillQuery.trim().toLowerCase();
    return skillList.filter((skill) => {
      if (activeCategory !== "all" && skill.category !== activeCategory) return false;
      if (!query) return true;
      return `${skill.name} ${skill.description} ${skill.category}`.toLowerCase().includes(query);
    });
  }, [activeCategory, skillList, skillQuery]);
  const groupedSkills = useMemo(() => {
    return filteredSkills.reduce<Record<string, Skill[]>>((acc, skill) => {
      acc[skill.category] ??= [];
      acc[skill.category].push(skill);
      return acc;
    }, {});
  }, [filteredSkills]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/models?provider=${encodeURIComponent(providerDraft)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((body: { models?: string[] } | null) => {
        if (cancelled) return;
        const nextOptions = modelOptionsFor(providerDraft, body?.models ?? []);
        setModelOptions(nextOptions);
        setModelDraft((current) => nextOptions.includes(current) ? current : "");
      })
      .catch(() => {
        if (cancelled) return;
        setModelOptions(MODEL_OPTIONS[providerDraft]);
        setModelDraft((current) => MODEL_OPTIONS[providerDraft].includes(current) ? current : "");
      });

    return () => {
      cancelled = true;
    };
  }, [providerDraft]);

  function toggleSkill(id: string) {
    setSelectedSkillIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function startEdit(role: Role) {
    setEditingRole(role);
    setProviderDraft(role.provider);
    setModelOptions(MODEL_OPTIONS[role.provider]);
    setModelDraft(role.defaultModel ?? "");
    setSelectedSkillIds(role.skills.map((s) => s.id));
    setRulesDraft("");
    setMode("edit");
  }

  function deleteRole(slug: string) {
    setDeletingSlug(slug);
    startTransition(async () => {
      await fetch("/api/roles", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      setRoleList((prev) => prev.filter((r) => r.slug !== slug));
      if (selectedRole?.slug === slug) setSelectedRole(null);
      setDeletingSlug("");
      setDeleteTarget(null);
    });
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
        setRoleList((prev) => [saved, ...prev.filter((role) => role.id !== saved.id)]);
        setSavedName(saved.name);
        setMode("list");
      }
    });
  }

  const isEditing = mode === "edit" && editingRole;

  if (mode === "list") {
    return (
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Agent Studio</p>
              <h2 className="mt-1 text-xl font-bold text-text">Current Bot Roles</h2>
              <p className="mt-1 text-sm text-text-muted">View existing bots here. Create a new custom AI only when you press the button.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingRole(null);
                setProviderDraft("claude");
                setModelOptions(MODEL_OPTIONS.claude);
                setModelDraft("");
                setSelectedSkillIds([]);
                setRulesDraft("");
                setMode("create");
              }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Create Custom AI
            </button>
          </div>
        </section>

        {savedName && (
          <div className="rounded-lg border border-done/30 bg-done/10 px-3 py-2 text-sm text-done">
            Created {savedName}. It is available in Library and Chat when its provider is connected.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
          {roleList.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={`rounded-2xl border p-5 text-left transition-colors hover:border-accent/40 hover:bg-card-hover ${
                selectedRole?.id === role.id ? "border-accent/50 bg-accent/10" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-text">{role.name}</h3>
                  <p className="mt-1 text-xs text-text-muted">@{role.slug}</p>
                </div>
                <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase text-accent">{role.provider}</span>
              </div>
              <p className="mt-3 min-h-10 text-sm leading-relaxed text-text-muted">{role.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded bg-bg-base px-2 py-1 text-[10px] text-text-muted">{role.phase}</span>
                <span className="rounded bg-bg-base px-2 py-1 text-[10px] text-text-muted">{role.executionModeDefault}</span>
                <span className="rounded bg-bg-base px-2 py-1 text-[10px] text-text-muted">{role.skills.length} skills</span>
              </div>
            </button>
          ))}
        </div>

        {selectedRole && (
          <section className="rounded-2xl border border-accent/30 bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Bot Detail</p>
                <h2 className="mt-1 text-xl font-bold text-text">{selectedRole.name}</h2>
                <p className="mt-1 text-sm text-text-muted">@{selectedRole.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(selectedRole)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 transition-colors"
                >
                  <Edit2 size={13} /> Edit
                </button>
                {deletingSlug === selectedRole.slug ? (
                  <span className="text-xs text-text-muted">Deleting...</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(selectedRole)}
                    className="flex items-center gap-1.5 rounded-lg border border-blocked/40 px-3 py-1.5 text-xs font-semibold text-blocked hover:bg-blocked/10 transition-colors"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
                <button type="button" onClick={() => setSelectedRole(null)} className="rounded-lg p-1.5 text-text-muted hover:bg-card-hover hover:text-text">
                  <X size={16} />
                </button>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">{selectedRole.description}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Detail label="Provider" value={selectedRole.provider} />
              <Detail label="Model" value={selectedRole.defaultModel || "provider default"} />
              <Detail label="Phase" value={selectedRole.phase} />
              <Detail label="Execution" value={selectedRole.executionModeDefault} />
              <Detail label="Skills" value={`${selectedRole.skills.length}`} />
            </div>
            <div className="mt-4 rounded-lg border border-border bg-bg-base p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-text-muted">Attached Skills</p>
              {selectedRole.skills.length === 0 ? (
                <p className="text-xs text-text-muted">No skills attached.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedRole.skills.map((skill) => (
                    <span key={skill.id} className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-text-muted">
                      {skill.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete bot role?"
          description={
            <>
              Delete <span className="font-semibold text-text">{deleteTarget?.name}</span>. This removes the role from the dashboard and generated registry artifacts.
            </>
          }
          confirmLabel="Delete Role"
          pending={pending && !!deletingSlug}
          onClose={() => {
            if (!deletingSlug) setDeleteTarget(null);
          }}
          onConfirm={() => {
            if (deleteTarget) deleteRole(deleteTarget.slug);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
      <form action={createRole} className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-text">{isEditing ? `Edit: ${editingRole.name}` : "Custom AI Builder"}</h2>
            <p className="text-xs text-text-muted">{isEditing ? "Update role configuration and skills." : "Create a role, assign a provider, attach skills, and generate local artifacts."}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setMode("list"); setEditingRole(null); }} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted hover:bg-card-hover">Cancel</button>
            <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {pending ? "Saving..." : isEditing ? "Save Changes" : "Create Role"}
            </button>
          </div>
        </div>

        {savedName && (
          <div className="mb-4 rounded-lg border border-done/30 bg-done/10 px-3 py-2 text-xs text-done">
            Saved {savedName}. It is now available in Library and Chat when its provider is connected.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input name="name" label="Name" placeholder="Backend Reviewer" defaultValue={editingRole?.name} />
          <Input name="slug" label="Slug" placeholder="backend-reviewer" defaultValue={editingRole?.slug} readOnly={!!editingRole} />
          <Input name="description" label="Description" placeholder="Reviews backend API and DB changes" defaultValue={editingRole?.description} />
          <ModelSelect options={modelOptions} value={modelDraft} onChange={setModelDraft} />
          <Select
            name="provider"
            label="Provider"
            options={["claude", "codex", "chatgpt"]}
            defaultValue={editingRole?.provider}
            onChange={(value) => {
              const nextProvider = value as Role["provider"];
              setProviderDraft(nextProvider);
              setModelOptions(MODEL_OPTIONS[nextProvider]);
              setModelDraft((current) => MODEL_OPTIONS[nextProvider].includes(current) ? current : "");
            }}
          />
          <Select name="phase" label="Phase" options={["analysis", "implementation", "review", "research", "design", "custom"]} defaultValue={editingRole?.phase} />
          <Select name="executionModeDefault" label="Execution mode" options={["local", "dashboard"]} defaultValue={editingRole?.executionModeDefault} />
          <Select name="credentialService" label="Credential" options={["none", "openai", "anthropic"]} />
          <Select name="roleType" label="Role type" options={["ba", "dev", "reviewer", "qa", "design", "researcher", "custom"]} />
          <Select name="mcpProfile" label="MCP profile" options={["", ...profiles]} />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wide text-text-muted">Rules</label>
            <button formAction={research} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10">
              {pending ? "Researching..." : "Suggest Skills"}
            </button>
          </div>
          <textarea name="rulesMarkdown" defaultValue={rulesDraft} className="min-h-40 w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent" />
        </div>

        <div className="mt-5 rounded-xl border border-border bg-bg-base/60 p-4">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-bold text-text">Attach Skills</h3>
              <p className="text-xs text-text-muted">{selectedSkillIds.length} selected from {skillList.length} available skills.</p>
            </div>
            <div className="relative w-full lg:w-80">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={skillQuery}
                onChange={(event) => setSkillQuery(event.target.value)}
                placeholder="Search skills..."
                className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-text outline-none transition-colors focus:border-accent"
              />
            </div>
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  activeCategory === category
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border bg-card text-text-muted hover:text-text"
                }`}
              >
                {category === "all" ? "All" : category}
              </button>
            ))}
          </div>

          {selectedSkills.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {selectedSkills.slice(0, 12).map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/25"
                >
                  {skill.name}
                </button>
              ))}
              {selectedSkills.length > 12 && <span className="rounded-full bg-card px-2.5 py-1 text-xs text-text-muted">+{selectedSkills.length - 12} more</span>}
            </div>
          )}

          <div className="grid max-h-[38rem] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
            {Object.entries(groupedSkills).length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-bg-base p-3 text-xs text-text-muted">
                No skills in database yet. Open Library after the repo sync finishes.
              </div>
            ) : Object.entries(groupedSkills).map(([category, list]) => (
              <div key={category} className="rounded-lg border border-border bg-card p-3">
                <p className="mb-2 text-[10px] font-bold uppercase text-accent">{category}</p>
                <div className="grid gap-2">
                  {list.map((skill) => (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => toggleSkill(skill.id)}
                      className={`group flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selectedSkillIds.includes(skill.id)
                          ? "border-accent/60 bg-accent/10"
                          : "border-border bg-bg-base hover:border-accent/40"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        selectedSkillIds.includes(skill.id) ? "border-accent bg-accent text-white" : "border-border bg-card"
                      }`}>
                        {selectedSkillIds.includes(skill.id) && <Check size={11} />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-semibold text-text">
                          {skill.name}
                          {skill.isRemote && <span className="rounded bg-in-progress/15 px-1.5 py-0.5 text-[10px] text-in-progress">remote</span>}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-text-muted">{skill.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>

      <aside className="rounded-xl border border-border bg-card p-4 text-xs text-text-muted">
        <p className="flex items-center gap-2 font-semibold text-text"><Sparkles size={14} className="text-accent" /> Generated artifacts</p>
        <div className="mt-3 space-y-1">
          <p><code>agents/roles/&lt;slug&gt;.json</code></p>
          <p><code>.claude/roles/&lt;slug&gt;.md</code></p>
          <p><code>.codex/skills/&lt;slug&gt;/SKILL.md</code></p>
          <p><code>.agents/providers/chatgpt/roles/&lt;slug&gt;.md</code></p>
          <p><code>agents/learning/role-feedback.md</code></p>
        </div>
        {suggested.length > 0 && <p className="mt-4 text-accent">{suggested.length} suggested skills selected.</p>}
        <a href="/library" className="mt-4 inline-block text-accent">Browse Library</a>
      </aside>
    </div>
  );
}

function Input({ name, label, placeholder, defaultValue, readOnly }: { name: string; label: string; placeholder?: string; defaultValue?: string; readOnly?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        readOnly={readOnly}
        className={`rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent ${readOnly ? "opacity-60 cursor-not-allowed" : ""}`}
      />
    </label>
  );
}

function ModelSelect({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-text-muted">Model / version</span>
      <select
        name="defaultModel"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent"
      >
        {options.map((option) => (
          <option key={option || "default"} value={option}>
            {option || "optional / provider default"}
          </option>
        ))}
      </select>
    </label>
  );
}

function Select({ name, label, options, defaultValue, onChange }: { name: string; label: string; options: string[]; defaultValue?: string; onChange?: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</span>
      <select name={name} defaultValue={defaultValue} onChange={(event) => onChange?.(event.target.value)} className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent">
        {options.map((option) => <option key={option} value={option}>{option || "none"}</option>)}
      </select>
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-base p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text">{value}</p>
    </div>
  );
}
