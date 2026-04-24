import { Lightbulb, Shield, Code2, BookOpen } from "lucide-react";
import type { Lesson } from "@/lib/lessons";

type Category = "performance" | "security" | "code" | "general";

function detectCategory(lesson: Lesson): Category {
  const text = (lesson.text + " " + (lesson.framework ?? "")).toLowerCase();
  if (text.includes("secur") || text.includes("jwt") || text.includes("auth") || text.includes("token") || text.includes("xss") || text.includes("inject")) return "security";
  if (text.includes("perf") || text.includes("cache") || text.includes("optim") || text.includes("lazy") || text.includes("memo")) return "performance";
  if (text.includes("pattern") || text.includes("clean") || text.includes("refactor") || text.includes("return") || text.includes("early")) return "code";
  return "general";
}

const CATEGORY_CONFIG: Record<Category, {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  bgClass: string;
  borderClass: string;
  label: string;
}> = {
  performance: { icon: Lightbulb, iconClass: "text-in-progress", bgClass: "bg-in-progress/10", borderClass: "border-in-progress/20", label: "Performance Tip" },
  security:    { icon: Shield,    iconClass: "text-done",         bgClass: "bg-done/10",        borderClass: "border-done/20",        label: "Security Note" },
  code:        { icon: Code2,     iconClass: "text-purple-400",   bgClass: "bg-purple-400/10",  borderClass: "border-purple-400/20",  label: "Clean Code" },
  general:     { icon: BookOpen,  iconClass: "text-accent",       bgClass: "bg-accent/10",      borderClass: "border-accent/20",      label: "Knowledge" },
};

const FW_COLORS: Record<string, string> = {
  nextjs:        "bg-card-hover text-text-muted",
  "next.js":     "bg-card-hover text-text-muted",
  react:         "bg-cyan-900/40 text-cyan-400",
  nestjs:        "bg-red-900/40 text-red-400",
  fastapi:       "bg-emerald-900/40 text-emerald-400",
  django:        "bg-emerald-900/40 text-emerald-400",
  angular:       "bg-rose-900/40 text-rose-400",
  "spring-boot": "bg-green-900/40 text-green-400",
  dotnet:        "bg-purple-900/40 text-purple-400",
  general:       "bg-border text-text-muted",
};

function NuggetCard({ lesson }: { lesson: Lesson }) {
  const category = detectCategory(lesson);
  const { iconClass, bgClass, borderClass, label } = CATEGORY_CONFIG[category];
  const fwKey = (lesson.framework ?? "general").toLowerCase();
  const fwColor = FW_COLORS[fwKey] ?? FW_COLORS.general;

  return (
    <div className={`p-4 ${bgClass} border ${borderClass} rounded-xl`}>
      <div className={`text-[10px] font-bold uppercase mb-2 ${iconClass}`}>{label}</div>
      <p
        className="text-sm text-text leading-relaxed"
        dangerouslySetInnerHTML={{
          __html: lesson.text
            .replace(/\*\*(.+?)\*\*/g, '<strong class="text-text font-semibold">$1</strong>')
            .replace(/`(.+?)`/g, '<code class="font-mono text-[11px] bg-border px-1 rounded text-accent">$1</code>'),
        }}
      />
      {lesson.framework && (
        <span className={`inline-block mt-3 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${fwColor}`}>
          {lesson.framework}
        </span>
      )}
    </div>
  );
}

export function KnowledgeNuggets({ lessons }: { lessons: Lesson[] }) {
  if (lessons.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-text flex items-center gap-2">
        <Lightbulb size={18} className="text-in-progress" />
        Knowledge Nuggets
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {lessons.map((lesson, i) => <NuggetCard key={i} lesson={lesson} />)}
      </div>
    </div>
  );
}
