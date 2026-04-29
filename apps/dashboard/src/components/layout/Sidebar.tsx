"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, CheckSquare, TerminalSquare,
  BarChart2, BookOpen, Server, Settings2, MessageSquare, Wand2, Library, HelpCircle,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";

const icons = { LayoutDashboard, FolderKanban, CheckSquare, BarChart2, BookOpen, Server, Settings2, MessageSquare, Wand2, Library };

const navItems = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard" },
  { label: "Projects", href: "/projects", icon: "FolderKanban" },
  { label: "Tasks", href: "/tasks", icon: "CheckSquare" },
  { label: "Chat", href: "/chat", icon: "MessageSquare" },
  { label: "Library", href: "/library", icon: "Library" },
  { label: "Create", href: "/create", icon: "Wand2" },
  { label: "Token Stats", href: "/tokens", icon: "BarChart2" },
  { label: "Knowledge", href: "/knowledge", icon: "BookOpen" },
  { label: "MCP Monitor", href: "/mcp", icon: "Server" },
  { label: "Settings", href: "/settings", icon: "Settings2" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-dvh w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-[#080d1b]">
      {/* Brand */}
      <div className="px-6 py-7">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/40 bg-accent text-white shadow-[0_0_24px_rgba(99,102,241,0.25)]">
            <TerminalSquare size={20} />
          </div>
          <div>
            <div className="text-xl font-black leading-none tracking-tight text-accent">GCS Console</div>
            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              v{process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}
            </div>
            {process.env.NEXT_PUBLIC_BUILD_TIME && (
              <div className="text-[9px] text-text-muted/50 tracking-wide">
                {new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2">
        {navItems.map((item) => {
          const Icon = icons[item.icon as keyof typeof icons];
          const active = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-6 py-3 text-sm font-semibold transition-all duration-150",
                active
                  ? "border-r-2 border-accent bg-accent/10 text-accent"
                  : "text-text-muted hover:bg-card/50 hover:text-text"
              )}
            >
              <Icon size={18} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer user */}
      <div className="shrink-0 border-t border-border p-4">
        <div className="mb-3 space-y-1">
          <Link href="/knowledge" className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-text-muted transition-colors hover:text-text">
            <BookOpen size={16} />
            Documentation
          </Link>
          <Link href="/settings" className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-text-muted transition-colors hover:text-text">
            <HelpCircle size={16} />
            Support
          </Link>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-card/40 px-4 py-3 transition-colors hover:bg-card/70">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-accent">N</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-text truncate">{siteConfig.name}</div>
            <div className="text-[11px] text-text-muted truncate">Pro Plan</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
