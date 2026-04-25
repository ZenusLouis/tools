import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText, Link2, Settings, SlidersHorizontal, TerminalSquare, TriangleAlert } from "lucide-react";
import { DangerZone } from "@/components/settings/DangerZone";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { PageShell } from "@/components/layout/PageShell";
import { TopBar } from "@/components/layout/TopBar";
import { getMcpProfiles, getProjectContext } from "@/lib/settings";

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
      <TopBar title={`${ctx.name} Settings`} />
      <PageShell>
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-2 lg:sticky lg:top-24 lg:self-start">
            <SettingsNavItem icon={SlidersHorizontal} label="General" active />
            <SettingsNavItem icon={FileText} label="Documents" />
            <SettingsNavItem icon={Link2} label="Tools & Links" />
            <SettingsNavItem icon={TerminalSquare} label="Environment" />
            <SettingsNavItem icon={TriangleAlert} label="Danger Zone" danger />
            <Link href={`/projects/${ctx.name}`} className="mt-4 block rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:bg-card-hover hover:text-text">
              Back to project
            </Link>
          </aside>
          <div className="flex flex-col gap-6">
            <section className="rounded-xl border border-border bg-card p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Settings size={20} />
                </div>
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">Project Settings</p>
                  <h2 className="text-xl font-black tracking-tight text-white">{ctx.name}</h2>
                </div>
              </div>
              <SettingsForm
                projectName={ctx.name}
                projectPath={ctx.path ?? ""}
                mcpProfile={ctx.mcpProfile ?? ""}
                profiles={profiles}
                docs={ctx.docs ?? {}}
                tools={ctx.tools ?? {}}
                envRequired={ctx.env?.required ?? []}
                envFile={ctx.env?.envFile ?? ""}
              />
            </section>
            <DangerZone projectName={ctx.name} />
          </div>
        </div>
      </PageShell>
    </>
  );
}

function SettingsNavItem({
  icon: Icon,
  label,
  active,
  danger,
}: {
  icon: typeof Settings;
  label: string;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={
        active
          ? "flex items-center gap-3 rounded-lg bg-accent/10 px-4 py-2.5 text-accent"
          : danger
            ? "flex items-center gap-3 rounded-lg px-4 py-2.5 text-blocked/80"
            : "flex items-center gap-3 rounded-lg px-4 py-2.5 text-text-muted"
      }
    >
      <Icon size={18} />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}
