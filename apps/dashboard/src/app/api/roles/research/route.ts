import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const ResearchSchema = z.object({
  roleType: z.string().default("custom"),
  provider: z.enum(["claude", "codex", "chatgpt"]).optional(),
  framework: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireCurrentUser();
  const parsed = ResearchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const roleType = parsed.data.roleType.toLowerCase();
  const skills = await db.skillDefinition.findMany({
    where: {
      workspaceId: user.workspaceId,
      OR: [
        { roleCompatibility: { has: roleType } },
        { tags: { has: roleType } },
        ...(parsed.data.framework ? [{ slug: parsed.data.framework }] : []),
      ],
    },
    orderBy: [{ isRemote: "asc" }, { name: "asc" }],
    take: 12,
  });

  return NextResponse.json({
    suggestions: skills,
    rulesDraft: `# ${roleType} role\n\nUse project context first, keep changes scoped, log artifacts back to GCS, and ask before destructive work.\n`,
  });
}

