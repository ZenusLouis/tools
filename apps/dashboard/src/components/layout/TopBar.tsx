export function TopBar({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-10 shrink-0">
      <h1 className="text-sm font-semibold tracking-wider text-text uppercase">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
