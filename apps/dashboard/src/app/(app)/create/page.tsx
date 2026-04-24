import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateRoleClient } from "@/components/create/CreateRoleClient";

export default async function CreatePage() {
  const user = await requireCurrentUser();
  const [roles, skills, profiles] = await Promise.all([
    db.agentRole.findMany({ where: { workspaceId: user.workspaceId }, include: { skills: true }, orderBy: { name: "asc" } }),
    db.skillDefinition.findMany({ where: { workspaceId: user.workspaceId }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.mcpProfile.findMany({ orderBy: { profile: "asc" } }),
  ]);

  return (
    <>
      <TopBar title="Create" />
      <PageShell>
        <CreateRoleClient roles={roles} skills={skills} profiles={profiles.map((p) => p.profile)} />
      </PageShell>
    </>
  );
}

