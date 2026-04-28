"use client";

import { useEffect } from "react";

async function sendHeartbeat() {
  try {
    await fetch("/api/bridge/heartbeat/session", { method: "POST" });
  } catch { /* silent */ }
}

export function BrowserHeartbeat() {
  useEffect(() => {
    sendHeartbeat();
    const id = setInterval(sendHeartbeat, 60_000);
    return () => clearInterval(id);
  }, []);

  return null;
}
