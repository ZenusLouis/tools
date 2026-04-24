import Link from "next/link";
import { Plus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { getActiveProjects } from "@/lib/projects";
import { requireCurrentUser } from "@/lib/auth";

export default async function ProjectsPage() {
  const user = await requireCurrentUser();
  const projects = await getActiveProjects(user.workspaceId);

  return (
    <>
      <TopBar
        title="Projects"
        actions={
          <Link
            href="/projects/new"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
          >
            <Plus size={16} />
            Add New Project
          </Link>
        }
      />
      <PageShell>
        {projects.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <p className="text-text-muted text-sm mb-3">No projects yet.</p>
            <Link href="/projects/new" className="text-accent hover:underline text-sm">
              Add your first project →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.name} project={project} />
            ))}
            {/* Add project placeholder */}
            <Link
              href="/projects/new"
              className="border-2 border-dashed border-border hover:border-accent/50 hover:bg-accent/5 rounded-xl flex flex-col items-center justify-center p-6 transition-all group min-h-50"
            >
              <div className="w-12 h-12 rounded-full bg-border/50 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <Plus size={20} className="text-text-muted group-hover:text-accent transition-colors" />
              </div>
              <span className="text-text-muted font-bold group-hover:text-text transition-colors">New Project</span>
              <span className="text-xs text-muted mt-1">Register a new workspace</span>
            </Link>
          </div>
        )}
      </PageShell>
    </>
  );
}
