import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { DangerZone } from "@/components/settings/DangerZone";
import { getProjectContext, getMcpProfiles } from "@/lib/settings";

interface Props {
  params: Promise<{ name: string }>;
}

export default async function ProjectSettingsPage({ params }: Props) {
  const { name } = await params;
  const [ctx, profiles] = await Promise.all([
    getProjectContext(name),
    getMcpProfiles(),
  ]);

  if (!ctx) notFound();

  return (
    <>
      <TopBar title={`${ctx.name} — Settings`} />
      <PageShell>
        <div className="flex flex-col gap-6 max-w-2xl">
          <SettingsForm
            projectName={ctx.name}
            projectPath={ctx.path}
            mcpProfile={ctx.mcpProfile ?? ""}
            profiles={profiles}
            docs={ctx.docs ?? {}}
            tools={ctx.tools ?? {}}
            envRequired={ctx.env?.required ?? []}
            envFile={ctx.env?.envFile ?? ""}
          />
          <DangerZone projectName={ctx.name} />
        </div>
      </PageShell>
    </>
  );
}
