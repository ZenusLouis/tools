import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      <TopBar title="Dashboard" />
      <PageShell>
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
          <Skeleton className="h-48 rounded-2xl" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex min-h-36 flex-col gap-3 rounded-xl border border-border bg-card p-5">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </PageShell>
    </>
  );
}
