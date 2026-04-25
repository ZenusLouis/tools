interface Props {
  tools: Record<string, string>;
}

const TOOL_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "figma", label: "Figma File URL", placeholder: "https://figma.com/design/..." },
  { key: "github", label: "GitHub Repo URL", placeholder: "https://github.com/org/repo" },
  { key: "linear", label: "Linear Project URL", placeholder: "https://linear.app/team/project/..." },
];

export function ToolsSection({ tools }: Props) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold text-text">Tools & Integrations</h2>
      <div className="flex flex-col gap-4">
        {TOOL_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">{label}</label>
            <input
              name={`tools.${key}`}
              defaultValue={tools[key] ?? ""}
              placeholder={placeholder}
              className="rounded-lg border border-border bg-card-hover px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
