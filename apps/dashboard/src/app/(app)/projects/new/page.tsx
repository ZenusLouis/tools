import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { WizardShell } from "@/components/wizard/WizardShell";
import { getMcpProfiles } from "@/lib/settings";

export default async function NewProjectPage() {
  const mcpProfiles = await getMcpProfiles();

  return (
    <>
      <TopBar title="Add Project" />
      <PageShell>
        <WizardShell mcpProfiles={mcpProfiles} />
      </PageShell>
    </>
  );
}
