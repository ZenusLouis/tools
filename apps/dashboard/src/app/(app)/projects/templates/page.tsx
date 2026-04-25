import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { TemplateScaffoldForm } from "@/components/projects/TemplateScaffoldForm";

export default function ProjectTemplatesPage() {
  return (
    <>
      <TopBar title="Project Templates" />
      <PageShell>
        <TemplateScaffoldForm />
      </PageShell>
    </>
  );
}
