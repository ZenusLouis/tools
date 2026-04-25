import Link from "next/link";
import { CheckCircle } from "lucide-react";

export function Step4Done({ name }: { name: string }) {
  const created = [
    `projects/${name}/context.json`,
    `projects/${name}/progress.json`,
    `projects/${name}/code-index.md`,
    "projects/registry.json",
  ];

  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-done/10">
        <CheckCircle className="h-8 w-8 text-done" />
      </div>

      <div>
        <h2 className="mb-1 text-base font-semibold text-text">Project Added</h2>
        <p className="text-xs text-text-muted">
          <span className="font-mono text-accent">{name}</span> has been indexed and registered.
        </p>
      </div>

      <div className="w-full rounded-lg border border-border bg-bg-base px-4 py-3 text-left text-xs text-text-muted">
        <p className="mb-2 font-medium text-text">What was created</p>
        <ul className="flex flex-col gap-1">
          {created.map((item) => (
            <li key={item}>OK <span className="font-mono">{item}</span></li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3">
        <Link href="/" className="rounded-lg bg-accent px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-accent/90">
          Go to Dashboard
        </Link>
        <Link href={`/projects/${name}/settings`} className="rounded-lg border border-border px-5 py-2.5 text-xs font-medium transition-colors hover:bg-card-hover">
          Project Settings
        </Link>
      </div>
    </div>
  );
}
