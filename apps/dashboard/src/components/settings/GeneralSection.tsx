interface Props {
  name: string;
  projectPath: string;
  mcpProfile: string;
  profiles: string[];
}

export function GeneralSection({ name, projectPath, mcpProfile, profiles }: Props) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold text-text">General</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Project Name</span>
          <input name="name" defaultValue={name} readOnly className="cursor-not-allowed rounded-lg border border-border bg-card-hover px-3 py-2 text-sm text-text-muted focus:outline-none" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">MCP Profile</span>
          <select name="mcpProfile" defaultValue={mcpProfile} className="cursor-pointer rounded-lg border border-border bg-card-hover px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent">
            {profiles.length === 0 && <option value="">No profiles</option>}
            {profiles.map((profile) => <option key={profile} value={profile}>{profile}</option>)}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-muted">Folder Path</span>
        <input name="path" defaultValue={projectPath} readOnly className="cursor-not-allowed rounded-lg border border-border bg-card-hover px-3 py-2 font-mono text-sm text-text-muted focus:outline-none" />
      </label>
    </section>
  );
}
