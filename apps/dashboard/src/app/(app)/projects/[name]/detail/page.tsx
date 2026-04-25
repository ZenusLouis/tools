import { notFound } from "next/navigation";
import Link from "next/link";
import { Activity, ArrowLeft, CheckCircle2, Code2, Layers, Settings, ShieldCheck, TerminalSquare } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { ProjectActionButtons } from "@/components/projects/ProjectActionButtons";
import { getProjectDetail } from "@/lib/projects";
import { getRecentActivity, timeAgo } from "@/lib/activity";
import { requireCurrentUser } from "@/lib/auth";

export default async function ProjectDetailConsolePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const user = await requireCurrentUser();
  const project = await getProjectDetail(name, user.workspaceId);
  if (!project) notFound();

  const activity = (await getRecentActivity(20, user.workspaceId)).filter((item) => item.project === name).slice(0, 6);

  return (
    <>
      <TopBar
        title={`${project.name} Detail`}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/projects/${project.name}`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-card-hover hover:text-text">
              Overview
            </Link>
            <Link href={`/projects/${project.name}/settings`} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-hover">
              <Settings size={13} />
              Settings
            </Link>
            <ProjectActionButtons projectName={project.name} projectPath={project.projectPath} />
          </div>
        }
      />
      <PageShell>
        <div className="mx-auto max-w-[1500px] space-y-8">
          <Link href={`/projects/${project.name}`} className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text">
            <ArrowLeft size={15} />
            Back to overview
          </Link>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-accent">Project Console</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{project.name}</h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.frameworks.map((fw) => (
                    <span key={fw} className="rounded border border-accent/20 bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">{fw}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Metric label="Tasks" value={`${project.completedTasks}/${project.totalTasks}`} />
                <Metric label="Progress" value={`${project.progressPercent}%`} tone="done" />
                <Metric label="Active" value={project.activeTask ?? "--"} tone="accent" />
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="rounded-xl border border-border bg-card p-6 lg:col-span-8">
              <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-white">
                <Layers size={18} className="text-accent" />
                Module Execution Map
              </h2>
              <div className="space-y-5">
                {project.modules.map((mod) => (
                  <div key={mod.id} className="rounded-xl border border-border bg-bg-base p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">{mod.id}</p>
                        <h3 className="text-sm font-bold text-white">{mod.name}</h3>
                      </div>
                      <span className={mod.percent === 100 ? "font-mono text-sm font-bold text-done" : "font-mono text-sm font-bold text-in-progress"}>{mod.percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-card-hover">
                      <div className={mod.percent === 100 ? "h-full rounded-full bg-done" : "h-full rounded-full bg-accent"} style={{ width: `${mod.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <aside className="space-y-6 lg:col-span-4">
              <StatusCard title="Runtime Health" icon={ShieldCheck} lines={["Bridge sync ready", "Code index available", "Artifacts tracked"]} />
              <StatusCard title="Developer Actions" icon={TerminalSquare} lines={["Copy CLI command", "Open local path", "Reindex project"]} />
              <section className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                  <Activity size={17} className="text-text-muted" />
                  Project Activity
                </h2>
                {activity.length === 0 ? (
                  <p className="text-sm text-text-muted">No project events yet.</p>
                ) : (
                  <div className="space-y-3">
                    {activity.map((item, index) => (
                      <div key={`${item.taskId}-${index}`} className="rounded-lg border border-border bg-bg-base p-3">
                        <div className="flex items-center justify-between">
                          {item.taskId ? (
                            <Link href={`/tasks/${item.taskId}`} className="font-mono text-xs font-bold text-accent">{item.taskId}</Link>
                          ) : (
                            <span className="font-mono text-xs font-bold text-accent">project event</span>
                          )}
                          <span className="text-[10px] text-text-muted">{timeAgo(item.date)}</span>
                        </div>
                        <p className="mt-1 text-xs text-text-muted">{item.note ?? item.commitHash ?? "Task event synced"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      </PageShell>
    </>
  );
}

function Metric({ label, value, tone = "text" }: { label: string; value: string; tone?: "text" | "done" | "accent" }) {
  const color = tone === "done" ? "text-done" : tone === "accent" ? "text-accent" : "text-white";
  return (
    <div className="min-w-28 rounded-xl border border-border bg-bg-base p-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
      <p className={`mt-2 truncate text-xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function StatusCard({ title, icon: Icon, lines }: { title: string; icon: typeof Code2; lines: string[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
        <Icon size={17} className="text-accent" />
        {title}
      </h2>
      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line} className="flex items-center gap-2 rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-muted">
            <CheckCircle2 size={13} className="text-done" />
            {line}
          </div>
        ))}
      </div>
    </section>
  );
}
