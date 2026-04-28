import { Sidebar } from "@/components/layout/Sidebar";
import { PageTransition } from "@/components/layout/PageTransition";
import { BrowserHeartbeat } from "@/components/layout/BrowserHeartbeat";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-bg-base">
      <Sidebar />
      <PageTransition>{children}</PageTransition>
      <BrowserHeartbeat />
    </div>
  );
}
