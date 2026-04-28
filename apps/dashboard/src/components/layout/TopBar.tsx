import Link from "next/link";
import { TopBarControls } from "./TopBarControls";
import { PageDocumentTitle } from "./PageDocumentTitle";

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
      <PageDocumentTitle title={title} />
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
        <TopBarControls />
      </div>
    </header>
  );
}
