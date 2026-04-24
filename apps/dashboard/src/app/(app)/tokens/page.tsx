import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { HeroMetric } from "@/components/tokens/HeroMetric";
import { BudgetWarningBanner } from "@/components/tokens/BudgetWarningBanner";
import { DonutChart } from "@/components/tokens/DonutChart";
import { DailyBarChart } from "@/components/tokens/DailyBarChart";
import { SessionsTable } from "@/components/tokens/SessionsTable";
import { getAnalytics, type DateRange } from "@/lib/analytics";
import { requireCurrentUser } from "@/lib/auth";

const VALID_RANGES = new Set<DateRange>(["today", "week", "month"]);
const DEFAULT_BUDGET = 100_000;

interface Props {
  searchParams: Promise<{ range?: string }>;
}

export default async function TokensPage({ searchParams }: Props) {
  const { range } = await searchParams;
  const dateRange: DateRange = VALID_RANGES.has(range as DateRange)
    ? (range as DateRange)
    : "today";

  const user = await requireCurrentUser();
  const analytics = await getAnalytics(dateRange, user.workspaceId);

  return (
    <>
      <TopBar
        title="Token Analytics"
        actions={
          <nav className="flex gap-1">
            {(["today", "week", "month"] as const).map((r) => (
              <Link
                key={r}
                href={`/tokens?range=${r}`}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
                  dateRange === r
                    ? "text-accent border-b-2 border-accent bg-accent/5"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {r === "today" ? "Today" : r === "week" ? "Week" : "Month"}
              </Link>
            ))}
          </nav>
        }
      />
      <PageShell>
        <div className="space-y-8">
          {/* Budget warning */}
          <BudgetWarningBanner totalTokens={analytics.totalTokens} dailyBudget={DEFAULT_BUDGET} />

          {/* Hero metric */}
          <HeroMetric
            totalTokens={analytics.totalTokens}
            totalCost={analytics.totalCost}
            dailyBudget={DEFAULT_BUDGET}
          />

          {/* Charts: 2-col grid */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DonutChart breakdown={analytics.toolBreakdown} />
            <DailyBarChart dailyUsage={analytics.dailyUsage} />
          </section>

          {/* Sessions table */}
          <SessionsTable sessions={analytics.sessions} />
        </div>
      </PageShell>
    </>
  );
}
