import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  const { next } = await searchParams;
  if (user) redirect(next && next.startsWith("/") ? next : "/");

  return (
    <main className="min-h-screen bg-bg-base flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl shadow-accent/10">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">GCS Dashboard</p>
          <h1 className="mt-2 text-2xl font-black text-text">Sign in</h1>
          <p className="mt-1 text-sm text-text-muted">Access your multi-agent workspace.</p>
        </div>
        <LoginForm nextPath={next && next.startsWith("/") ? next : "/"} />
      </div>
    </main>
  );
}

