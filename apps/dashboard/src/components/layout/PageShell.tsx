export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-0 w-full flex-1 overflow-y-auto p-8">
      {children}
    </main>
  );
}
