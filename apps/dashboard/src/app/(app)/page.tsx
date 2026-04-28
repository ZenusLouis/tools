import Link from "next/link";
import { Bot, MessageSquare, Play, Plus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { TokenUsageCard } from "@/components/dashboard/TokenUsageCard";
import { ActiveProjectsList } from "@/components/dashboard/ActiveProjectsList";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { KnowledgeNuggets } from "@/components/dashboard/KnowledgeNuggets";
import { AutoRefresh } from "@/components/dashboard/AutoRefresh";
import { OnboardingEmptyState } from "@/components/projects/OnboardingEmptyState";
import { getDashboardStats } from "@/lib/stats";
import { getActiveProjects } from "@/lib/projects";
import { getRecentActivity } from "@/lib/activity";
import { getRandomLessons } from "@/lib/lessons";
import { requireCurrentUser } from "@/lib/auth";
import type { DashboardRange } from "@/lib/stats";
import { formatCurrency, formatNumber } from "@/lib/format";

export const revalidate = 30;

const VALID_RANGES = new Set<DashboardRange>(["today", "week", "month"]);
const RANGE_LABEL: Record<DashboardRange, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
};
const RANGE_COPY: Record<DashboardRange, string> = {
  today: "today",
  week: "this week",
  month: "this month",
};

function rangeStart(range: DashboardRange): Date {
  const now = new Date();
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "week") return new Date(Date.now() - 7 * 86_400_000);
  return new Date(Date.now() - 30 * 86_400_000);
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const selectedRange: DashboardRange = VALID_RANGES.has(range as DashboardRange) ? (range as DashboardRange) : "today";
  const label = RANGE_LABEL[selectedRange];
  const copy = RANGE_COPY[selectedRange];
  const user = await requireCurrentUser();
  const [stats, projects, activity, lessons] = await Promise.all([
    getDashboardStats(user.workspaceId, selectedRange),
    getActiveProjects(user.workspaceId),
    getRecentActivity(8, user.workspaceId, rangeStart(selectedRange)),
    getRandomLessons(3),
  ]);

  return (
    <>
      <AutoRefresh intervalMs={30_000} />
      <TopBar
        title="Dashboard"
        range={selectedRange}
        rangeBasePath="/"
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
        {projects.length === 0 ? (
          <OnboardingEmptyState />
        ) : (
        <div className="flex flex-col gap-6">
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-[32px] font-black tracking-tight text-white">Good morning, Dev.</h1>
                <p className="mt-3 flex flex-wrap items-center gap-3 font-mono text-sm text-text-muted">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    {projects.length} active projects
                  </span>
                  <span className="text-border">/</span>
                  <span>{formatNumber(stats.tokenCount)} tokens used {copy}</span>
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted">
                  {projects.length > 0
                    ? `${projects.length} active project tracked. ${stats.tasksCompleted} tasks completed ${copy}.`
                    : "No projects tracked yet. Add a project to start building the workspace graph."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/projects/new" className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover">
                  <Plus size={17} />
                  New Project
                </Link>
                <Link href="/tasks" className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text transition-colors hover:border-text-muted hover:bg-card-hover">
                  <Play size={16} fill="currentColor" />
                  Run Task
                </Link>
                <Link href="/chat" className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-text-muted transition-colors hover:text-text">
                  <MessageSquare size={16} />
                  Chat
                </Link>
                <Link href="/create" className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-text-muted transition-colors hover:text-text">
                  <Bot size={16} />
                  Bots
                </Link>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Active Projects" value={stats.activeProjects} variant="projects" badge={stats.activeProjects > 0 ? `+${stats.activeProjects}` : undefined} />
            <StatCard label={`Tasks Done ${label}`} value={stats.tasksCompleted} variant="tasks" badge={stats.tasksCompleted > 0 ? "done" : undefined} />
            <TokenUsageCard
              total={stats.tokenCount}
              rangeLabel={label}
              breakdown={stats.tokenBreakdown}
            />
            <StatCard label="Session Cost" value={formatCurrency(stats.sessionCost)} variant="cost" badge={label.toLowerCase()} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <ActiveProjectsList projects={projects} />
              <KnowledgeNuggets lessons={lessons} />
            </div>
            <RecentActivity items={activity} />
          </div>
        </div>
        )}
      </PageShell>
    </>
  );
}
