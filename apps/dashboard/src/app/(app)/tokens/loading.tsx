import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/skeleton";

export default function TokensLoading() {
  return (
    <>
      <TopBar title="Token Analytics" />
      <PageShell>
        <div className="flex flex-col gap-6">
          {/* DateRangeTabs */}
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-lg" />
            ))}
          </div>
          {/* Hero metrics */}
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 flex flex-col gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
          {/* Charts */}
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          {/* Sessions table */}
          <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-12 ml-auto" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </PageShell>
    </>
  );
}
