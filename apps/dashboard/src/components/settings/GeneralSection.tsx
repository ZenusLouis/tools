interface Props {
  name: string;
  projectPath: string;
  mcpProfile: string;
  profiles: string[];
}

export function GeneralSection({ name, projectPath, mcpProfile, profiles }: Props) {
  return (
    <section className="rounded-xl border bg-card p-6 flex flex-col gap-5">
      <h2 className="text-sm font-semibold">General</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Name — read-only */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-muted">Project Name</label>
          <input
            name="name"
            defaultValue={name}
            readOnly
            className="rounded-lg border bg-card-hover px-3 py-2 text-sm text-text-muted cursor-not-allowed focus:outline-none"
          />
        </div>

        {/* MCP Profile — editable */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-muted">MCP Profile</label>
          <select
            name="mcpProfile"
            defaultValue={mcpProfile}
            className="rounded-lg border bg-card-hover px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
          >
            {profiles.length === 0 && <option value="">No profiles</option>}
            {profiles.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Path — read-only, full width */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-muted">Folder Path</label>
        <input
          name="path"
          defaultValue={projectPath}
          readOnly
          className="rounded-lg border bg-card-hover px-3 py-2 text-sm font-mono text-text-muted cursor-not-allowed focus:outline-none"
        />
      </div>
    </section>
  );
}
