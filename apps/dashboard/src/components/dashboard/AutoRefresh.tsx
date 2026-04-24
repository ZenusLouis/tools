"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const AUTO_REFRESH_KEY = "auto-refresh-enabled";

export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const enabled = localStorage.getItem(AUTO_REFRESH_KEY) !== "false";
    if (!enabled) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
