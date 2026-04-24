import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";

interface Props {
  lessonSaved: string | null;
}

export function LessonLinkCard({ lessonSaved }: Props) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Lesson Saved</h3>
      {lessonSaved ? (
        <div className="flex items-start gap-3 rounded-lg bg-done/5 border border-done/20 px-3 py-2.5">
          <BookOpen className="h-4 w-4 text-done shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-snug">{lessonSaved}</p>
            <Link
              href="/knowledge"
              className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-accent hover:underline"
            >
              View in Knowledge Base <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted italic">No lesson saved for this task.</p>
          <Link
            href="/knowledge"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" /> Knowledge Base
          </Link>
        </div>
      )}
    </div>
  );
}
