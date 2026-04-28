import { HardDrive, MonitorCheck } from "lucide-react";
import type { ProjectDetail } from "@/lib/projects";

type LocalPath = ProjectDetail["localPaths"][number];

export function LocalDevicePathsCard({ paths }: { paths: LocalPath[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
          <HardDrive size={14} className="text-accent" />
          Local Device Paths
        </h2>
        <span className="rounded border border-border bg-bg-base px-2 py-0.5 font-mono text-[10px] text-text-muted">
          {paths.length}
        </span>
      </div>
      {paths.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-bg-base p-3 text-xs text-text-muted">
          No device path has synced yet. Start the local bridge on the machine that owns this project folder.
        </p>
      ) : (
        <div className="space-y-2">
          {paths.map((item) => (
            <div key={item.deviceId} className="rounded-lg border border-border bg-bg-base p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <MonitorCheck size={13} className={item.online ? "text-done" : "text-text-muted"} />
                <span className="text-xs font-bold text-text">{item.deviceName}</span>
                <span className={item.online ? "rounded bg-done/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-done" : "rounded bg-text-muted/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-text-muted"}>
                  {item.online ? "online" : "offline"}
                </span>
              </div>
              <p className="break-all font-mono text-[11px] text-text">{item.path}</p>
              <p className="mt-1 font-mono text-[10px] text-text-muted">
                {item.deviceKey} · {item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString() : "never synced"}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
