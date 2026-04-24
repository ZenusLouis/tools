import Link from "next/link";
import { Plus } from "lucide-react";
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
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover transition-colors"
          >
            <Plus size={13} />
            New Project
          </Link>
        }
      />
      <PageShell>
        <div className="flex flex-col gap-6">
          {/* Subtitle */}
          <p className="text-sm text-text-muted -mt-2">
            Welcome back.{" "}
            {projects.length > 0
              ? `${projects.length} active project${projects.length !== 1 ? "s" : ""} tracked.`
              : "No projects yet — add your first one."}
          </p>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Active Projects"
              value={stats.activeProjects}
              variant="projects"
              badge={stats.activeProjects > 0 ? `+${stats.activeProjects}` : undefined}
            />
            <StatCard
              label="Tasks Done Today"
              value={stats.tasksToday}
              variant="tasks"
              badge={stats.tasksToday > 0 ? "100%" : undefined}
            />
            <StatCard
              label="Tokens Today"
              value={stats.tokenCount.toLocaleString()}
              progress={stats.tokenPercent}
              sub={`${stats.tokenPercent.toFixed(1)}% of ${(stats.dailyLimit / 1_000).toFixed(0)}k limit`}
              variant="tokens"
              badge={`${Math.round(stats.tokenPercent)}%`}
            />
            <StatCard
              label="Session Cost"
              value={`$${stats.sessionCost.toFixed(4)}`}
              variant="cost"
              badge="Today"
            />
          </div>

          {/* Main content: 2/3 projects + 1/3 activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ActiveProjectsList projects={projects} />
            </div>
            <div>
              <RecentActivity items={activity} />
            </div>
          </div>

          {/* Knowledge Nuggets — 3 cols at bottom */}
          <KnowledgeNuggets lessons={lessons} />
        </div>
      </PageShell>
    </>
  );
}
