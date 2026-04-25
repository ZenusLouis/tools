import { notFound } from "next/navigation";
import Link from "next/link";
import { Settings, FileText, CheckCircle2, Zap, GitCommit, Palette, GitBranch, LayoutGrid, Database, Layers, PanelRightOpen } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { ProjectActionButtons } from "@/components/projects/ProjectActionButtons";
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

  return (
    <>
      <TopBar
        title={project.name}
        actions={
          <div className="flex items-center gap-2">
            {project.frameworks.slice(0, 3).map((fw) => (
              <span key={fw} className="rounded px-2 py-0.5 text-[10px] font-mono bg-card border border-border text-accent">
                {fw}
              </span>
            ))}
            <Link
              href={`/projects/${project.name}/detail`}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-muted hover:text-text hover:bg-card-hover transition-colors"
            >
              <PanelRightOpen size={13} />
              Detail
            </Link>
            <Link
              href={`/projects/${project.name}/settings`}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-muted hover:text-text hover:bg-card-hover transition-colors"
            >
              <Settings size={13} />
              Settings
            </Link>
            <ProjectActionButtons projectName={project.name} projectPath={project.projectPath} />
          </div>
        }
      />
      <PageShell>
        <div className="mx-auto max-w-[1500px]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card p-5 border border-border rounded-xl">
            <div className="text-text-muted text-xs font-bold uppercase tracking-wider mb-1">
              {project.totalTasks} Tasks Total
            </div>
            <div className="text-2xl font-black text-text">Project Backlog</div>
          </div>
          <div className="bg-card p-5 border border-border rounded-xl">
            <div className="text-text-muted text-xs font-bold uppercase tracking-wider mb-1">
              {project.completedTasks} Done
            </div>
            <div className="flex items-end gap-2">
              <div className="text-2xl font-black text-done">{project.progressPercent}%</div>
              <div className="text-xs text-text-muted pb-1 italic">Completion</div>
            </div>
          </div>
          <div className="bg-card p-5 border border-border rounded-xl">
            <div className="text-text-muted text-xs font-bold uppercase tracking-wider mb-1">Active Status</div>
            <div className="text-xl font-mono text-accent font-bold">{project.activeTask ?? "--"}</div>
          </div>
          <div className="bg-card p-5 border border-border rounded-xl">
            <div className="text-text-muted text-xs font-bold uppercase tracking-wider mb-1">Last Indexed</div>
            <div className="text-xl font-bold text-text">
              {project.lastIndexed ? project.lastIndexed.split("T")[0] : "Never"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: modules + activity */}
          <div className="lg:col-span-8 space-y-6">
            {/* Module Progress */}
            <section className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-bold text-text flex items-center gap-2 mb-6">
                <Layers size={18} className="text-accent" />
                Module Progress
              </h2>
              <div className="space-y-5">
                {project.modules.map((mod) => {
                  const barColor =
                    mod.percent === 100 ? "bg-done" :
                    mod.percent > 0 ? "bg-in-progress" : "bg-border";
                  const textColor =
                    mod.percent === 100 ? "text-done" :
                    mod.percent > 0 ? "text-in-progress" : "text-text-muted";
                  return (
                    <div key={mod.id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-text font-medium">
                          <span className="font-mono text-[10px] text-text-muted mr-1.5">{mod.id}</span>
                          {mod.name}
                        </span>
                        <span className={`font-bold tabular-nums ${textColor}`}>
                          {mod.percent}% ({mod.completed}/{mod.total})
                        </span>
                      </div>
                      <div className="h-2 w-full bg-card-hover rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                          style={{ width: `${mod.percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {project.modules.length === 0 && (
                  <p className="text-xs text-text-muted">No modules found.</p>
                )}
              </div>
            </section>

            {/* Recent Activity */}
            <section className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-bold text-text flex items-center gap-2 mb-6">
                <GitCommit size={18} className="text-accent" />
                Recent Activity
              </h2>
              {activity.length === 0 ? (
                <p className="text-xs text-text-muted">No recent activity.</p>
              ) : (
                <div className="space-y-1">
                  {activity.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-4 p-3 rounded-lg hover:bg-card-hover transition-colors border border-transparent hover:border-border"
                    >
                      <div className={`w-8 h-8 rounded flex items-center justify-center mt-0.5 shrink-0 ${item.commitHash ? "bg-accent/10" : "bg-done/10"}`}>
                        {item.commitHash
                          ? <GitCommit size={13} className="text-accent" />
                          : <CheckCircle2 size={13} className="text-done" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <Link href={`/tasks/${item.taskId}`} className="text-sm font-bold text-text hover:text-accent transition-colors">
                            {item.taskId}
                          </Link>
                          <span className="text-[10px] text-text-muted whitespace-nowrap ml-2">{timeAgo(item.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.commitHash && (
                            <span className="text-[10px] font-mono text-text-muted">#{item.commitHash.slice(0, 7)}</span>
                          )}
                          {item.note && (
                            <span className="text-[10px] text-text-muted truncate">{item.note}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="lg:col-span-4 space-y-6">
            {/* Active task */}
            {project.activeTask && (
              <section className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Active Task</h2>
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-accent shrink-0" />
                  <Link href={`/tasks/${project.activeTask}`} className="font-mono text-sm text-accent hover:underline">
                    {project.activeTask}
                  </Link>
                </div>
              </section>
            )}

            {/* External Links */}
            <section className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">External Links</h2>
              {(!project.links.figma && !project.links.github && !project.links.linear) ? (
                <p className="text-xs text-text-muted">
                  No links.{" "}
                  <Link href={`/projects/${project.name}/settings`} className="text-accent hover:underline">
                    Add in settings
                  </Link>
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {project.links.figma && (
                    <a
                      href={project.links.figma}
                      target="_blank" rel="noopener noreferrer"
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border bg-bg-base hover:border-accent transition-all group"
                    >
                      <Palette size={18} className="text-text-muted group-hover:text-accent transition-colors" />
                      <span className="text-[10px] font-bold text-text-muted group-hover:text-text">Figma</span>
                    </a>
                  )}
                  {project.links.github && (
                    <a
                      href={project.links.github}
                      target="_blank" rel="noopener noreferrer"
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border bg-bg-base hover:border-accent transition-all group"
                    >
                      <GitBranch size={18} className="text-text-muted group-hover:text-accent transition-colors" />
                      <span className="text-[10px] font-bold text-text-muted group-hover:text-text">GitHub</span>
                    </a>
                  )}
                  {project.links.linear && (
                    <a
                      href={project.links.linear}
                      target="_blank" rel="noopener noreferrer"
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border bg-bg-base hover:border-accent transition-all group"
                    >
                      <LayoutGrid size={18} className="text-text-muted group-hover:text-accent transition-colors" />
                      <span className="text-[10px] font-bold text-text-muted group-hover:text-text">Linear</span>
                    </a>
                  )}
                </div>
              )}
            </section>

            {/* Docs */}
            {(project.docs.brd || project.docs.prd || project.docs.apiSpec) && (
              <section className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Documents</h2>
                <div className="space-y-2">
                  {project.docs.brd && <DocRow label="BRD" path={project.docs.brd} />}
                  {project.docs.prd && <DocRow label="PRD" path={project.docs.prd} />}
                  {project.docs.apiSpec && <DocRow label="API Spec" path={project.docs.apiSpec} />}
                </div>
              </section>
            )}

            {/* Code Index */}
            <section className="bg-accent/5 border border-accent/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <Database size={18} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">Code Index Status</h3>
                  <p className="text-xs text-text-muted">
                    {project.codeIndexExists ? "AI Context Ready" : "Not Indexed"}
                  </p>
                </div>
              </div>
              {project.lastIndexed && (
                <div className="bg-bg-base rounded p-4 border border-border mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">Current Build</span>
                    <span className={`text-[10px] font-mono ${project.codeIndexExists ? "text-done" : "text-text-muted"}`}>
                      {project.codeIndexExists ? "Healthy" : "Missing"}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-text">{project.lastIndexed.split("T")[0]}</div>
                </div>
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

function DocRow({ label, path }: { label: string; path: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-text-muted">
      <FileText size={12} className="shrink-0" />
      <span className="font-mono text-[11px] truncate" title={path}>
        {label}: {path.split(/[\\/]/).pop()}
      </span>
    </div>
  );
}
