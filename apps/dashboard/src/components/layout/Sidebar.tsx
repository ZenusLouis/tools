"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, CheckSquare,
  BarChart2, BookOpen, Server, Settings2, Terminal, MessageSquare, Wand2, Library,
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
    <aside className="flex flex-col w-60 min-h-screen shrink-0 border-r border-border bg-bg-base">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 mb-2">
        <div className="w-8 h-8 rounded bg-accent flex items-center justify-center shrink-0">
          <Terminal size={16} className="text-white" />
        </div>
        <div>
          <div className="text-xl font-black text-accent tracking-tight leading-none">GCS</div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold mt-0.5">Developer Tools</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1 px-2">
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
                "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-accent/10 text-accent border-r-2 border-accent"
                  : "text-text-muted hover:text-text hover:bg-card/60 rounded-lg"
              )}
            >
              <Icon size={18} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer user */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-card/60 transition-colors cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-accent">N</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-text truncate">{siteConfig.name}</div>
            <div className="text-[10px] text-text-muted truncate">Premium Plan</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
