import Link from "next/link";
import { Bot, MessageSquare, Plus, Radio } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActiveProjectsList } from "@/components/dashboard/ActiveProjectsList";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { KnowledgeNuggets } from "@/components/dashboard/KnowledgeNuggets";
import { AutoRefresh } from "@/components/dashboard/AutoRefresh";
import { getDashboardStats } from "@/lib/stats";
import { getActiveProjects } from "@/lib/projects";
import { getRecentActivity } from "@/lib/activity";
import { getRandomLessons } from "@/lib/lessons";
import { requireCurrentUser } from "@/lib/auth";

export const revalidate = 30;

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const [stats, projects, activity, lessons] = await Promise.all([
    getDashboardStats(user.workspaceId),
    getActiveProjects(user.workspaceId),
    getRecentActivity(8),
    getRandomLessons(3),
  ]);

  return (
    <>
      <AutoRefresh intervalMs={30_000} />
      <TopBar
        title="Dashboard"
        actions={
          <Link
            href="/projects/new"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Plus size={13} />
            New Project
          </Link>
        }
      />
      <PageShell>
        <div className="flex flex-col gap-6">
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent">
                  <Radio size={13} />
                  Workspace Live
                </div>
                <h1 className="mt-3 text-2xl font-bold text-text">GlobalClaudeSkills control room</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
                  {projects.length > 0
                    ? `${projects.length} active project tracked. ${stats.tasksToday} tasks completed today.`
                    : "No projects tracked yet. Add a project to start building the workspace graph."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/chat" className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
                    <MessageSquare size={15} />
                    Open Chat
                  </Link>
                  <Link href="/create" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text-muted hover:bg-card-hover hover:text-text">
                    <Bot size={15} />
                    Manage Bots
                  </Link>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-bg-base p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Today</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniMetric label="Tokens" value={stats.tokenCount.toLocaleString()} />
                  <MiniMetric label="Cost" value={`$${stats.sessionCost.toFixed(4)}`} />
                  <MiniMetric label="Projects" value={stats.activeProjects} />
                  <MiniMetric label="Done" value={stats.tasksToday} />
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Active Projects" value={stats.activeProjects} variant="projects" badge={stats.activeProjects > 0 ? `+${stats.activeProjects}` : undefined} />
            <StatCard label="Tasks Done Today" value={stats.tasksToday} variant="tasks" badge={stats.tasksToday > 0 ? "100%" : undefined} />
            <StatCard
              label="Tokens Today"
              value={stats.tokenCount.toLocaleString()}
              progress={stats.tokenPercent}
              sub={`${stats.tokenPercent.toFixed(1)}% of ${(stats.dailyLimit / 1_000).toFixed(0)}k limit`}
              variant="tokens"
              badge={`${Math.round(stats.tokenPercent)}%`}
            />
            <StatCard label="Session Cost" value={`$${stats.sessionCost.toFixed(4)}`} variant="cost" badge="Today" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ActiveProjectsList projects={projects} />
            </div>
            <RecentActivity items={activity} />
          </div>

          <KnowledgeNuggets lessons={lessons} />
        </div>
      </PageShell>
    </>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-text">{value}</p>
    </div>
  );
}
