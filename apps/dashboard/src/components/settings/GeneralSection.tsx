import type { LocalProjectPath } from "@/lib/settings";

interface Props {
  name: string;
  projectPath: string;
  localPaths: LocalProjectPath[];
  mcpProfile: string;
  profiles: string[];
}

export function GeneralSection({ name, projectPath, localPaths, mcpProfile, profiles }: Props) {
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
        <span className="text-xs font-medium text-text-muted">Primary Folder Path</span>
        <input name="path" defaultValue={projectPath} readOnly className="cursor-not-allowed rounded-lg border border-border bg-card-hover px-3 py-2 font-mono text-sm text-text-muted focus:outline-none" />
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-muted">Local Device Paths</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {localPaths.length} device{localPaths.length === 1 ? "" : "s"}
          </span>
        </div>
        {localPaths.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card-hover px-3 py-3 text-sm text-text-muted">
            No device-specific path has synced yet. Keep the local bridge running on the machine that owns this project folder.
          </div>
        ) : (
          <div className="grid gap-2">
            {localPaths.map((item) => (
              <div key={item.deviceId} className="rounded-lg border border-border bg-card-hover px-3 py-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text">{item.deviceName}</span>
                  <span className={item.online ? "rounded bg-done/10 px-2 py-0.5 text-[10px] font-bold uppercase text-done" : "rounded bg-text-muted/10 px-2 py-0.5 text-[10px] font-bold uppercase text-text-muted"}>
                    {item.online ? "online" : "offline"}
                  </span>
                  <span className="font-mono text-[10px] text-text-muted">{item.deviceKey}</span>
                </div>
                <p className="break-all font-mono text-xs text-text">{item.path}</p>
                <p className="mt-1 text-[11px] text-text-muted">
                  Last synced: {item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString() : "never"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
