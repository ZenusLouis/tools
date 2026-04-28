"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { DateRange } from "@/lib/analytics";

const TABS: { value: DateRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week",  label: "7 Days" },
  { value: "month", label: "30 Days" },
  { value: "year", label: "Year" },
];

export function DateRangeTabs({ current }: { current: DateRange }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function setRange(range: DateRange) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 self-start">
      {TABS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setRange(value)}
          className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
            current === value
              ? "bg-accent text-white"
              : "text-text-muted hover:text-text"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
