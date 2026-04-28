import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Settings, CheckCircle2, Zap, GitCommit, Palette,
  GitBranch, LayoutGrid, Database, Layers, PanelRightOpen,
  AlertTriangle, BookOpen, Sparkles, ListTodo,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { ProjectActionButtons } from "@/components/projects/ProjectActionButtons";
import { LocalDevicePathsCard } from "@/components/projects/LocalDevicePathsCard";
import { getProjectDetail } from "@/lib/projects";
import { getRecentActivity, timeAgo } from "@/lib/activity";
import { requireCurrentUser } from "@/lib/auth";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const user = await requireCurrentUser();
  const project = await getProjectDetail(name, user.workspaceId);
  if (!project) notFound();

  const allActivity = await getRecentActivity(50);
  const activity = allActivity.filter((a) => a.project === name).slice(0, 5);

  const hasDocs = !!(project.docs.brd || project.docs.prd || project.docs.apiSpec);
  const isNewProject = project.totalTasks === 0;
  const encodedName = encodeURIComponent(project.name);

  return (
    <>
      <TopBar
        title={project.name}
        actions={
          <div className="flex items-center gap-2">
            {project.frameworks.filter((f) => f !== "unknown").slice(0, 3).map((fw) => (
              <span key={fw} className="rounded px-2 py-0.5 text-[10px] font-mono bg-card border border-border text-accent">
                {fw}
              </span>
            ))}
            <Link href={`/projects/${encodedName}/detail`} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-muted hover:text-text hover:bg-card-hover transition-colors">
              <PanelRightOpen size={13} /> Detail
            </Link>
            <Link href={`/projects/${encodedName}/settings`} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-muted hover:text-text hover:bg-card-hover transition-colors">
              <Settings size={13} /> Settings
            </Link>
            <ProjectActionButtons projectName={project.name} projectPath={project.projectPath} />
          </div>
        }
      />
      <PageShell>
        <div className="mx-auto max-w-[1500px] space-y-6">

          {/* Onboarding banner — new project with no tasks */}
          {isNewProject && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <Sparkles size={18} className="text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-text text-sm">Project registered — ready to plan</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {hasDocs
                      ? "You have a document linked. Analyze it to auto-generate modules and tasks."
                      : "Add a BRD/PRD in Settings, then analyze it to generate your task backlog."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasDocs && (
                  <Link href={`/projects/${encodedName}/detail`} className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white hover:bg-accent/90 transition-colors">
                    <Sparkles size={13} /> Analyze BRD
                  </Link>
                )}
                <Link href={`/projects/${encodedName}/settings`} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-text-muted hover:text-text hover:bg-card-hover transition-colors">
                  <Settings size={13} /> Settings
                </Link>
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Tasks"
              value={project.totalTasks > 0 ? String(project.totalTasks) : "—"}
              sub={project.totalTasks > 0 ? "in backlog" : "No tasks yet"}
              icon={<ListTodo size={16} className="text-accent" />}
            />
            <StatCard
              label="Completed"
              value={project.totalTasks > 0 ? `${project.progressPercent}%` : "—"}
              sub={project.totalTasks > 0 ? `${project.completedTasks} / ${project.totalTasks} done` : "Add tasks to track"}
              valueClass={project.progressPercent === 100 ? "text-done" : "text-text"}
              icon={<CheckCircle2 size={16} className="text-done" />}
            />
            <StatCard
              label="Active Task"
              value={project.activeTask ?? "—"}
              sub={project.activeTask ? "in progress" : "None running"}
              valueClass="text-accent font-mono text-base"
              icon={<Zap size={16} className="text-accent" />}
            />
            <StatCard
              label="Last Indexed"
              value={project.lastIndexed ? project.lastIndexed.split("T")[0] : "Never"}
              sub={project.codeIndexStatus === "empty" ? "No files found" : project.codeIndexStatus === "healthy" ? "Index healthy" : "Not indexed yet"}
              icon={<Database size={16} className={project.codeIndexStatus === "healthy" ? "text-done" : "text-text-muted"} />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: modules + activity */}
            <div className="lg:col-span-8 space-y-6">

              {/* Module Progress */}
              <section className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-sm font-bold text-text flex items-center gap-2 mb-5">
                  <Layers size={16} className="text-accent" />
                  Module Progress
                </h2>
                {project.modules.length > 0 ? (
                  <div className="space-y-5">
                    {project.modules.map((mod) => {
                      const barColor = mod.percent === 100 ? "bg-done" : mod.percent > 0 ? "bg-in-progress" : "bg-border";
                      const textColor = mod.percent === 100 ? "text-done" : mod.percent > 0 ? "text-in-progress" : "text-text-muted";
                      return (
                        <div key={mod.id} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-text font-medium">
                              <span className="font-mono text-[10px] text-text-muted mr-1.5">{mod.id}</span>
                              {mod.name}
                            </span>
                            <span className={`font-bold tabular-nums text-xs ${textColor}`}>
                              {mod.percent}% ({mod.completed}/{mod.total})
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-bg-base rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${mod.percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-bg-base p-6 text-center">
                    <ListTodo size={24} className="mx-auto mb-3 text-text-muted" />
                    <p className="text-sm font-medium text-text">No modules yet</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {hasDocs
                        ? "Analyze your linked document to auto-generate modules and tasks."
                        : "Link a BRD or PRD in Settings, then analyze it to build your backlog."}
                    </p>
                    {hasDocs && (
                      <Link href={`/projects/${encodedName}/detail`} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-4 py-2 text-xs font-bold text-accent hover:bg-accent/20 transition-colors">
                        <Sparkles size={13} /> Analyze Document
                      </Link>
                    )}
                  </div>
                )}
              </section>

              {/* Recent Activity */}
              <section className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-sm font-bold text-text flex items-center gap-2 mb-5">
                  <GitCommit size={16} className="text-accent" />
                  Recent Activity
                </h2>
                {activity.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-bg-base p-6 text-center">
                    <GitCommit size={24} className="mx-auto mb-3 text-text-muted" />
                    <p className="text-sm font-medium text-text">No activity yet</p>
                    <p className="mt-1 text-xs text-text-muted">Completed tasks and commits will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {activity.map((item, i) => (
                      <Link
                        key={i}
                        href={item.taskId ? `/tasks/${item.taskId}` : `/projects/${encodedName}/detail`}
                        className="flex items-start gap-4 p-3 rounded-lg hover:bg-card-hover transition-colors border border-transparent hover:border-border"
                      >
                        <div className={`w-7 h-7 rounded flex items-center justify-center mt-0.5 shrink-0 ${item.commitHash ? "bg-accent/10" : "bg-done/10"}`}>
                          {item.commitHash ? <GitCommit size={12} className="text-accent" /> : <CheckCircle2 size={12} className="text-done" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between">
                            <span className="text-sm font-bold text-text">{item.taskId ?? "Project event"}</span>
                            <span className="text-[10px] text-text-muted whitespace-nowrap ml-2">{timeAgo(item.date)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.commitHash && <span className="text-[10px] font-mono text-text-muted">#{item.commitHash.slice(0, 7)}</span>}
                            {item.note && <span className="text-[10px] text-text-muted truncate">{item.note}</span>}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right column */}
            <div className="lg:col-span-4 space-y-5">

              {/* Active task */}
              {project.activeTask && (
                <section className="bg-card border border-border rounded-xl p-5">
                  <h2 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Active Task</h2>
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-accent shrink-0" />
                    <Link href={`/tasks/${project.activeTask}`} className="font-mono text-sm text-accent hover:underline">{project.activeTask}</Link>
                  </div>
                </section>
              )}

              <LocalDevicePathsCard paths={project.localPaths} />

              {/* External Links */}
              <section className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">External Links</h2>
                {(!project.links.figma && !project.links.github && !project.links.linear) ? (
                  <p className="text-xs text-text-muted">
                    No links.{" "}
                    <Link href={`/projects/${encodedName}/settings`} className="text-accent hover:underline">Add in settings</Link>
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {project.links.figma && <LinkChip href={project.links.figma} icon={<Palette size={16} />} label="Figma" />}
                    {project.links.github && <LinkChip href={project.links.github} icon={<GitBranch size={16} />} label="GitHub" />}
                    {project.links.linear && <LinkChip href={project.links.linear} icon={<LayoutGrid size={16} />} label="Linear" />}
                  </div>
                )}
              </section>

              {/* Documents */}
              <section className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Documents</h2>
                {hasDocs ? (
                  <div className="space-y-2">
                    {project.docs.brd && <DocRow label="BRD" path={project.docs.brd} analyzeHref={`/projects/${encodedName}/detail`} />}
                    {project.docs.prd && <DocRow label="PRD" path={project.docs.prd} analyzeHref={`/projects/${encodedName}/detail`} />}
                    {project.docs.apiSpec && <DocRow label="API Spec" path={project.docs.apiSpec} />}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">
                    No documents.{" "}
                    <Link href={`/projects/${encodedName}/settings`} className="text-accent hover:underline">Add in settings</Link>
                  </p>
                )}
              </section>

              {/* Code Index */}
              <section className={`rounded-xl border p-5 ${
                project.codeIndexStatus === "healthy" ? "bg-done/5 border-done/20" :
                project.codeIndexStatus === "empty" ? "bg-in-progress/5 border-in-progress/20" :
                "bg-card border-border"
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    project.codeIndexStatus === "healthy" ? "bg-done/10" :
                    project.codeIndexStatus === "empty" ? "bg-in-progress/10" : "bg-bg-base"
                  }`}>
                    {project.codeIndexStatus === "empty"
                      ? <AlertTriangle size={16} className="text-in-progress" />
                      : <Database size={16} className={project.codeIndexStatus === "healthy" ? "text-done" : "text-text-muted"} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text">Code Index</h3>
                    <p className={`text-xs ${
                      project.codeIndexStatus === "healthy" ? "text-done" :
                      project.codeIndexStatus === "empty" ? "text-in-progress" : "text-text-muted"
                    }`}>
                      {project.codeIndexStatus === "healthy" ? "AI Context Ready" :
                       project.codeIndexStatus === "empty" ? "Folder not accessible — index empty" :
                       "Not indexed yet"}
                    </p>
                  </div>
                </div>
                {project.codeIndexStatus === "empty" && (
                  <p className="mb-4 text-[11px] text-text-muted rounded-lg border border-border bg-bg-base p-3">
                    Run the local bridge to let Claude scan <span className="font-mono">{project.projectPath ?? "your project folder"}</span> and build a real index.
                  </p>
                )}
                <ProjectActionButtons projectName={project.name} projectPath={project.projectPath} />
              </section>

            </div>
          </div>
        </div>
      </PageShell>
    </>
  );
}

function StatCard({ label, value, sub, icon, valueClass = "text-text" }: {
  label: string; value: string; sub: string; icon: React.ReactNode; valueClass?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</span>
        {icon}
      </div>
      <div>
        <div className={`text-xl font-black truncate ${valueClass}`}>{value}</div>
        <div className="text-[11px] text-text-muted mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function LinkChip({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-border bg-bg-base hover:border-accent transition-all group">
      <span className="text-text-muted group-hover:text-accent transition-colors">{icon}</span>
      <span className="text-[10px] font-bold text-text-muted group-hover:text-text">{label}</span>
    </a>
  );
}

function DocRow({ label, path, analyzeHref }: { label: string; path: string; analyzeHref?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg-base px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <BookOpen size={12} className="shrink-0 text-text-muted" />
        <span className="text-[11px] text-text-muted font-bold">{label}</span>
        <span className="text-[11px] text-text truncate font-mono" title={path}>{path.split(/[\\/]/).pop()}</span>
      </div>
      {analyzeHref && (
        <Link href={analyzeHref} className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-accent hover:underline">
          <Sparkles size={10} /> Analyze
        </Link>
      )}
    </div>
  );
}
