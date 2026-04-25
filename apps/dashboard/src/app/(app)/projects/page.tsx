import Link from "next/link";
import { Plus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { OnboardingEmptyState } from "@/components/projects/OnboardingEmptyState";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { requireCurrentUser } from "@/lib/auth";
import { getActiveProjects } from "@/lib/projects";

export default async function ProjectsPage() {
  const user = await requireCurrentUser();
  const projects = await getActiveProjects(user.workspaceId);

  return (
    <>
      <TopBar
        title="Projects"
        actions={
          <Link href="/projects/new" className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover">
            <Plus size={16} />
            Add New Project
          </Link>
        }
      />
      <PageShell>
        <div className="mx-auto max-w-[1400px]">
          {projects.length === 0 ? (
            <OnboardingEmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.name} project={project} />
              ))}
              <Link href="/projects/new" className="group flex min-h-56 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 transition-all hover:border-accent/50 hover:bg-accent/5">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-border/50 transition-colors group-hover:bg-accent/20">
                  <Plus size={20} className="text-text-muted transition-colors group-hover:text-accent" />
                </div>
                <span className="font-bold text-text-muted transition-colors group-hover:text-text">New Project</span>
                <span className="mt-1 text-xs text-text-muted">Register a new workspace</span>
              </Link>
            </div>
          )}
        </div>
      </PageShell>
    </>
  );
}
