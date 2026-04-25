export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-y-auto p-8 w-full">
      {children}
    </main>
  );
}
