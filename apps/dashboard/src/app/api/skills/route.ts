import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureWorkspaceAgentDefaults } from "@/lib/agent-bootstrap";

export async function GET() {
  const user = await requireCurrentUser();
  await ensureWorkspaceAgentDefaults(user.workspaceId);
  const skills = await db.skillDefinition.findMany({
    where: { workspaceId: user.workspaceId },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      sourceType: true,
      sourcePriority: true,
      contentHash: true,
      importMode: true,
      trustedSourceSlug: true,
      sourcePath: true,
      compactGuidance: true,
      description: true,
      providerCompatibility: true,
      roleCompatibility: true,
      tags: true,
      isImported: true,
      isRemote: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(skills);
}
