import Link from "next/link";
import { Bell, Settings } from "lucide-react";

export type TopBarRange = "today" | "week" | "month";

export function TopBar({
  title,
  actions,
  range,
  rangeBasePath,
}: {
  title: string;
  actions?: React.ReactNode;
  range?: TopBarRange;
  rangeBasePath?: string;
}) {
  const ranges: Array<{ key: TopBarRange; label: string }> = [
    { key: "today", label: "TODAY" },
    { key: "week", label: "WEEK" },
    { key: "month", label: "MONTH" },
  ];

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-bg-base/85 px-8 backdrop-blur-md">
      <div className="flex h-full items-center gap-8">
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {range && rangeBasePath && (
          <nav className="hidden h-full items-center md:flex">
            {ranges.map((item) => {
              const active = item.key === range;
              return (
                <Link
                  key={item.key}
                  href={`${rangeBasePath}?range=${item.key}`}
                  className={`flex h-full items-center border-b-2 px-4 text-sm tracking-wide transition-colors ${
                    active
                      ? "border-accent font-bold text-accent"
                      : "border-transparent text-text-muted hover:text-text"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <button className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-card-hover hover:text-text" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <button className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-card-hover hover:text-text" aria-label="Settings">
          <Settings size={18} />
        </button>
        <div className="h-6 w-px bg-border" />
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/50 bg-card font-mono text-xs font-bold text-accent">N</div>
      </div>
    </header>
  );
}
