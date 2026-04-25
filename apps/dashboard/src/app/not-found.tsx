export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-6">
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-accent">404</p>
        <h1 className="mt-2 text-xl font-bold text-text">Page not found</h1>
        <p className="mt-1 text-sm text-text-muted">The requested dashboard route does not exist.</p>
      </div>
    </main>
  );
}
