import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      <TopBar title="Dashboard" />
      <PageShell>
        <div className="flex flex-col gap-6">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 flex flex-col gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 flex flex-col gap-6">
              {/* Active projects */}
              <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
                <Skeleton className="h-4 w-32" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-16 ml-auto" />
                  </div>
                ))}
              </div>
              {/* Recent activity */}
              <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
                <Skeleton className="h-4 w-32" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 items-start py-1">
                    <Skeleton className="h-3 w-3 rounded-full mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-1.5 flex-1">
                      <Skeleton className="h-3 w-48" />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Knowledge nuggets */}
            <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
              <Skeleton className="h-4 w-40" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageShell>
    </>
  );
}
