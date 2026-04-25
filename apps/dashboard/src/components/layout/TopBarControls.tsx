"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Settings, UserRound } from "lucide-react";

type ActivityItem = {
  taskId: string | null;
  project: string;
  date: string;
  note: string | null;
  commitHash: string | null;
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60_000);
  const hrs = Math.floor(diff / 3_600_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function TopBarControls() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<"notifications" | "account" | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function toggleNotifications() {
    const next = open === "notifications" ? null : "notifications";
    setOpen(next);
    if (next === "notifications") {
      setLoading(true);
      try {
        const res = await fetch("/api/activity/recent");
        const body = await res.json();
        setActivity(Array.isArray(body.items) ? body.items : []);
      } finally {
        setLoading(false);
      }
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative flex items-center gap-3">
      <button
        onClick={toggleNotifications}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-card-hover hover:text-text"
        aria-label="Notifications"
      >
        <Bell size={18} />
      </button>
      <Link
        href="/settings"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-card-hover hover:text-text"
        aria-label="Settings"
      >
        <Settings size={18} />
      </Link>
      <div className="h-6 w-px bg-border" />
      <button
        onClick={() => setOpen(open === "account" ? null : "account")}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/50 bg-card text-xs font-bold text-accent transition-colors hover:bg-card-hover"
        aria-label="Account menu"
      >
        N
      </button>

      {open === "notifications" && (
        <div className="absolute right-12 top-12 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-bold text-white">Notifications</p>
            <p className="text-xs text-text-muted">Recent workspace activity</p>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {loading ? (
              <p className="px-3 py-4 text-sm text-text-muted">Loading...</p>
            ) : activity.length === 0 ? (
              <p className="px-3 py-4 text-sm text-text-muted">No activity yet.</p>
            ) : (
              activity.map((item, index) => (
                <Link
                  key={`${item.taskId ?? "project"}-${index}`}
                  href={item.taskId ? `/tasks/${item.taskId}` : `/projects/${item.project}`}
                  onClick={() => setOpen(null)}
                  className="block rounded-lg px-3 py-2 transition-colors hover:bg-bg-base"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-text">{item.taskId ? "Task update" : "Project event"}</span>
                    <span className="text-[10px] text-text-muted">{timeAgo(item.date)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {item.project} {item.taskId ? `- ${item.taskId}` : ""} {item.note ? `- ${item.note}` : ""}
                  </p>
                </Link>
              ))
            )}
          </div>
          <Link href="/api/activity/export" className="block border-t border-border px-4 py-3 text-center text-xs font-bold text-accent hover:bg-bg-base">
            Export activity
          </Link>
        </div>
      )}

      {open === "account" && (
        <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
                <UserRound size={17} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">GlobalClaudeSkills</p>
                <p className="text-xs text-text-muted">Admin workspace</p>
              </div>
            </div>
          </div>
          <Link href="/settings" onClick={() => setOpen(null)} className="block px-4 py-3 text-sm text-text-muted hover:bg-bg-base hover:text-text">
            Account settings
          </Link>
          <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-blocked hover:bg-blocked/10">
            <LogOut size={15} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
