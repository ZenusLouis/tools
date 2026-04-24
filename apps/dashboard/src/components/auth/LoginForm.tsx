"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Login failed");
        return;
      }
      router.replace(nextPath);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Email</span>
        <input name="email" type="email" required className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Password</span>
        <input name="password" type="password" required className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent" />
      </label>
      {error && <p className="rounded-lg border border-blocked/30 bg-blocked/10 px-3 py-2 text-xs text-blocked">{String(error)}</p>}
      <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50">
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

