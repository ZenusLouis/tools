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

const VALID_RANGES = new Set<DateRange>(["today", "week", "month", "year"]);

interface Props {
  searchParams: Promise<{ range?: string; page?: string; provider?: string; source?: string }>;
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
  const analytics = await getAnalytics(dateRange, user.workspaceId, {
    sessionPage,
    sessionPageSize: 12,
    sessionProvider,
    sessionSource,
  });

  return (
    <>
      <TopBar
        title="Token Analytics"
        actions={
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
