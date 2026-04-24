import Link from "next/link";
import { CheckCircle } from "lucide-react";

export function Step4Done({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="h-14 w-14 rounded-full bg-done/10 flex items-center justify-center">
        <CheckCircle className="h-8 w-8 text-done" />
      </div>

      <div>
        <h2 className="text-base font-semibold mb-1">Project Added</h2>
        <p className="text-xs text-text-muted">
          <span className="font-mono text-accent">{name}</span> has been indexed and registered.
        </p>
      </div>

      <div className="rounded-lg border bg-bg-base px-4 py-3 text-xs text-text-muted text-left w-full">
        <p className="font-medium text-text mb-2">What was created</p>
        <ul className="flex flex-col gap-1">
          <li>✓ <span className="font-mono">projects/{name}/context.json</span></li>
          <li>✓ <span className="font-mono">projects/{name}/progress.json</span></li>
          <li>✓ <span className="font-mono">projects/{name}/code-index.md</span></li>
          <li>✓ Added to <span className="font-mono">projects/registry.json</span></li>
        </ul>
      </div>

      <div className="flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-accent text-white text-xs font-semibold px-5 py-2.5 hover:bg-accent/90 transition-colors"
        >
          Go to Dashboard →
        </Link>
        <Link
          href={`/projects/${name}/settings`}
          className="rounded-lg border text-xs font-medium px-5 py-2.5 hover:bg-card-hover transition-colors"
        >
          Project Settings
        </Link>
      </div>
    </div>
  );
}
