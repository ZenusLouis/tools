export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
      {children}
    </main>
  );
}
