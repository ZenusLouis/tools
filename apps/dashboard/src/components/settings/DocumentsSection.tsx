interface Props {
  docs: Record<string, string>;
}

const DOC_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "brd", label: "BRD File Path", placeholder: "d:\\project\\docs\\BRD.md" },
  { key: "prd", label: "PRD File Path", placeholder: "d:\\project\\docs\\PRD.md" },
  { key: "apiSpec", label: "API Spec File Path", placeholder: "d:\\project\\docs\\openapi.yaml" },
];

export function DocumentsSection({ docs }: Props) {
  return (
    <section className="rounded-xl border bg-card p-6 flex flex-col gap-5">
      <h2 className="text-sm font-semibold">Documents</h2>
      <div className="flex flex-col gap-4">
        {DOC_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">{label}</label>
            <input
              name={`docs.${key}`}
              defaultValue={docs[key] ?? ""}
              placeholder={placeholder}
              className="rounded-lg border bg-card-hover px-3 py-2 text-sm font-mono text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
