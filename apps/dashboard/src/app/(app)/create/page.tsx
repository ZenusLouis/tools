import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateRoleClient } from "@/components/create/CreateRoleClient";
import { ensureWorkspaceAgentDefaults } from "@/lib/agent-bootstrap";

export default async function CreatePage() {
  const user = await requireCurrentUser();
  await ensureWorkspaceAgentDefaults(user.workspaceId);
  const [skills, profiles] = await Promise.all([
    db.skillDefinition.findMany({ where: { workspaceId: user.workspaceId }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.mcpProfile.findMany({ orderBy: { profile: "asc" } }),
  ]);

  return (
    <>
      <TopBar title="Create" />
      <PageShell>
        <CreateRoleClient skills={skills} profiles={profiles.map((p) => p.profile)} />
      </PageShell>
    </>
  );
}
