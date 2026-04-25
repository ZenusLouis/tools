import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <>
      <TopBar title="Task Board" />
      <PageShell>
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
          <Skeleton className="h-12 rounded-xl" />
          <div className="flex gap-4 overflow-hidden pb-2">
            {Array.from({ length: 4 }).map((_, column) => (
              <div key={column} className="min-w-[290px] flex-1 rounded-xl border border-border bg-card p-3">
                <Skeleton className="mb-4 h-4 w-28" />
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex flex-col gap-2 rounded-xl border border-border bg-card-hover p-3.5">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-3/4" />
                      <div className="mt-1 flex gap-2">
                        <Skeleton className="h-5 w-14 rounded" />
                        <Skeleton className="h-5 w-10 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageShell>
    </>
  );
}
