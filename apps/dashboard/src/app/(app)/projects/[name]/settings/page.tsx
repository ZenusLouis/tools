import { notFound } from "next/navigation";
import Link from "next/link";
import { Cpu, FileText, Link2, Settings, SlidersHorizontal, TerminalSquare, TriangleAlert } from "lucide-react";
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
          <aside className="space-y-1 lg:sticky lg:top-24 lg:self-start">
            <SettingsNavItem icon={SlidersHorizontal} label="General"      href="#general" />
            <SettingsNavItem icon={Cpu}               label="Tech Stack"   href="#stack" />
            <SettingsNavItem icon={FileText}          label="Documents"    href="#documents" />
            <SettingsNavItem icon={Link2}             label="Tools & Links" href="#tools" />
            <SettingsNavItem icon={TerminalSquare}    label="Environment"  href="#environment" />
            <SettingsNavItem icon={TriangleAlert}     label="Danger Zone"  href="#danger" danger />
            <Link href={`/projects/${encodeURIComponent(ctx.name)}`} className="mt-3 block rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:bg-card-hover hover:text-text">
              Back to project
            </Link>
          </aside>
          <div className="flex flex-col gap-6">
            <section id="general" className="rounded-xl border border-border bg-card p-6">
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
                localPaths={ctx.localPaths}
                mcpProfile={ctx.mcpProfile ?? ""}
                profiles={profiles}
                frameworks={ctx.frameworks ?? []}
                docs={ctx.docs ?? {}}
                tools={ctx.tools ?? {}}
                envRequired={ctx.env?.required ?? []}
                envFile={ctx.env?.envFile ?? ""}
              />
            </section>
            <div id="danger"><DangerZone projectName={ctx.name} /></div>
          </div>
        </div>
      </PageShell>
    </>
  );
}

function SettingsNavItem({
  icon: Icon,
  label,
  href,
  danger,
}: {
  icon: typeof Settings;
  label: string;
  href: string;
  danger?: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-card-hover ${
        danger ? "text-blocked/80 hover:text-blocked" : "text-text-muted hover:text-text"
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </a>
  );
}
