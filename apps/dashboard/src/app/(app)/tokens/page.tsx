import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { HeroMetric } from "@/components/tokens/HeroMetric";
import { DonutChart } from "@/components/tokens/DonutChart";
import { DailyBarChart } from "@/components/tokens/DailyBarChart";
import { SessionsTable } from "@/components/tokens/SessionsTable";
import { ProviderTokenBreakdown } from "@/components/tokens/ProviderTokenBreakdown";
import { getAnalytics, type DateRange } from "@/lib/analytics";
import { requireCurrentUser } from "@/lib/auth";
import { SyncOpenAIButton } from "@/components/tokens/SyncOpenAIButton";
import { ResetUsageButton } from "@/components/tokens/ResetUsageButton";
import { listApiKeys } from "@/lib/api-keys";

const VALID_RANGES = new Set<DateRange>(["today", "week", "month", "year"]);

interface Props {
  searchParams: Promise<{ range?: string; page?: string; provider?: string; source?: string }>;
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function rangeStart(range: DateRange) {
  const now = new Date();
  const start = new Date(now);
  if (range === "today") start.setHours(0, 0, 0, 0);
  if (range === "week") start.setDate(now.getDate() - 6);
  if (range === "month") start.setDate(now.getDate() - 29);
  if (range === "year") start.setDate(now.getDate() - 364);
  if (range !== "today") start.setHours(0, 0, 0, 0);
  return start;
}

export default async function TokensPage({ searchParams }: Props) {
  const { range, page, provider, source } = await searchParams;
  const dateRange: DateRange = VALID_RANGES.has(range as DateRange)
    ? (range as DateRange)
    : "today";
  const sessionPage = Math.max(1, Number(page ?? "1") || 1);
  const sessionProvider = provider ?? "all";
  const sessionSource = source ?? "all";

  const user = await requireCurrentUser();

  // For auto-sync: find when OpenAI usage was last synced
  const { db } = await import("@/lib/db");
  const lastSync = await db.session.findFirst({
    where: { workspaceId: user.workspaceId, type: "openai-sync" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const [analytics, apiKeys] = await Promise.all([
    getAnalytics(dateRange, user.workspaceId, {
      sessionPage,
      sessionPageSize: 12,
      sessionProvider,
      sessionSource,
    }),
    listApiKeys(user.workspaceId),
  ]);
  const runActions = await db.bridgeFileAction.findMany({
    where: {
      workspaceId: user.workspaceId,
      type: "run_task",
      updatedAt: { gte: rangeStart(dateRange) },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { payload: true, result: true, status: true, updatedAt: true },
  });
  const taskRuns = runActions.map((action) => {
    const payload = objectValue(action.payload);
    const result = objectValue(action.result);
    const optimizer = objectValue(payload.optimizer ?? result.optimizer);
    const skillRouting = objectValue(payload.skillRouting ?? result.skillRouting);
    const task = objectValue(payload.task);
    return {
      taskId: typeof payload.taskId === "string" ? payload.taskId : "unknown",
      taskName: typeof task.name === "string" ? task.name : "Task run",
      provider: typeof payload.provider === "string" ? payload.provider : "agent",
      mode: typeof optimizer.mode === "string" ? optimizer.mode : "auto_aggressive",
      contextMode: typeof optimizer.contextMode === "string" ? optimizer.contextMode : "standard",
      estimatedTokens: typeof optimizer.estimatedPromptTokens === "number" ? optimizer.estimatedPromptTokens : 0,
      actualTokens: typeof result.actualTokens === "number" ? result.actualTokens : typeof result.tokens === "number" ? result.tokens : 0,
      selectedSkills: Array.isArray(skillRouting.selected) ? skillRouting.selected.length : 0,
      status: action.status,
      updatedAt: action.updatedAt,
    };
  });
  const topTokenRuns = [...taskRuns].sort((a, b) => b.actualTokens - a.actualTokens).slice(0, 5);
  const estimateTotal = taskRuns.reduce((sum, row) => sum + row.estimatedTokens, 0);
  const actualTotal = taskRuns.reduce((sum, row) => sum + row.actualTokens, 0);
  const contextDistribution = taskRuns.reduce<Record<string, number>>((acc, row) => {
    acc[row.contextMode] = (acc[row.contextMode] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <TopBar
        title="Token Analytics"
        actions={
          <div className="flex flex-wrap items-center gap-3">
          <ResetUsageButton />
          <SyncOpenAIButton lastSyncedAt={lastSync?.createdAt?.toISOString() ?? null} apiKeys={apiKeys} />
          <nav className="flex gap-1">
            {(["today", "week", "month", "year"] as const).map((r) => (
              <Link
                key={r}
                href={`/tokens?range=${r}`}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
                  dateRange === r
                    ? "text-accent border-b-2 border-accent bg-accent/5"
                    : "text-text-muted hover:text-text"
                }`}
              >
                  {r === "today" ? "Today" : r === "week" ? "Week" : r === "month" ? "Month" : "Year"}
              </Link>
            ))}
          </nav>
        </div>
        }
      />
      <PageShell>
        <div className="mx-auto max-w-[1400px] space-y-8">
          <HeroMetric
            totalTokens={analytics.totalTokens}
            totalCost={analytics.totalCost}
          />

          <ProviderTokenBreakdown breakdown={analytics.providerBreakdown} />

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DonutChart breakdown={analytics.toolBreakdown} />
            <DailyBarChart dailyUsage={analytics.dailyUsage} isToday={dateRange === "today"} />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-text">Top token-heavy task runs</h2>
                  <p className="mt-1 text-xs text-text-muted">Local agent runs in the selected range, backed by bridge action telemetry.</p>
                </div>
                <span className="rounded border border-border bg-bg-base px-2 py-1 font-mono text-[10px] text-text-muted">
                  {taskRuns.length} runs
                </span>
              </div>
              {topTokenRuns.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-bg-base p-4 text-center text-xs text-text-muted">
                  No local task-run token telemetry yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {topTokenRuns.map((run) => (
                    <div key={`${run.taskId}-${run.updatedAt.toISOString()}`} className="rounded-xl border border-border bg-bg-base px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-text" title={run.taskName}>{run.taskName}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-text-muted">{run.taskId} · {run.provider} · {run.mode}/{run.contextMode}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm font-black text-accent">{run.actualTokens.toLocaleString()}</p>
                          <p className="text-[10px] text-text-muted">actual tokens</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-text-muted">
                        <span className="rounded border border-border bg-card px-2 py-0.5">est {run.estimatedTokens.toLocaleString()}</span>
                        <span className="rounded border border-border bg-card px-2 py-0.5">{run.selectedSkills} skills</span>
                        <span className="rounded border border-border bg-card px-2 py-0.5">{run.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold text-text">Optimizer savings view</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-bg-base p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Estimated</p>
                  <p className="mt-2 font-mono text-lg font-black text-text">{estimateTotal.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-border bg-bg-base p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Actual</p>
                  <p className="mt-2 font-mono text-lg font-black text-text">{actualTotal.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {Object.entries(contextDistribution).length === 0 ? (
                  <p className="text-xs text-text-muted">No context-mode telemetry yet.</p>
                ) : Object.entries(contextDistribution).map(([mode, count]) => (
                  <div key={mode} className="flex items-center justify-between rounded-lg border border-border bg-bg-base px-3 py-2 text-xs">
                    <span className="font-bold capitalize text-text">{mode}</span>
                    <span className="font-mono text-text-muted">{count} run{count === 1 ? "" : "s"}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <SessionsTable
            sessions={analytics.sessions}
            pagination={analytics.sessionPagination}
            provider={sessionProvider}
            source={sessionSource}
          />
        </div>
      </PageShell>
    </>
  );
}
