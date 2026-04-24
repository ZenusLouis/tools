import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <>
      <TopBar title="Task Board" />
      <PageShell>
        <div className="flex flex-col gap-4">
          {/* Selectors */}
          <div className="flex gap-3">
            <Skeleton className="h-9 w-40 rounded-lg" />
            <Skeleton className="h-9 w-40 rounded-lg" />
          </div>
          {/* Progress bar */}
          <Skeleton className="h-8 w-full rounded-lg" />
          {/* Kanban columns */}
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, col) => (
              <div key={col} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2.5 w-2.5 rounded-full" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl border bg-card p-3.5 flex flex-col gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-3/4" />
                    <div className="flex gap-2 mt-1">
                      <Skeleton className="h-5 w-14 rounded" />
                      <Skeleton className="h-5 w-10 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </PageShell>
    </>
  );
}
