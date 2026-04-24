import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import fs from "fs/promises";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolvePath } from "@/lib/fs/resolve";

const RoleSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().default(""),
  provider: z.enum(["claude", "codex", "chatgpt"]),
  defaultModel: z.string().optional(),
  phase: z.enum(["analysis", "implementation", "review", "research", "design", "custom"]),
  executionModeDefault: z.enum(["local", "dashboard"]).default("local"),
  credentialService: z.string().default("none"),
  roleType: z.string().default("custom"),
  rulesMarkdown: z.string().default(""),
  mcpProfile: z.string().optional(),
  skillIds: z.array(z.string()).default([]),
});

export async function GET() {
  const user = await requireCurrentUser();
  const roles = await db.agentRole.findMany({
    where: { workspaceId: user.workspaceId },
    include: { skills: true },
    orderBy: [{ isBuiltin: "desc" }, { name: "asc" }],
  });
  return NextResponse.json(roles);
}

export async function POST(req: NextRequest) {
  const user = await requireCurrentUser();
  const parsed = RoleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const generatedPaths = {
    shared: `agents/roles/${parsed.data.slug}.json`,
    claude: `.claude/roles/${parsed.data.slug}.md`,
    codex: `.agents/skills/${parsed.data.slug}/SKILL.md`,
  };

  const role = await db.agentRole.upsert({
    where: { workspaceId_slug: { workspaceId: user.workspaceId, slug: parsed.data.slug } },
    create: {
      workspaceId: user.workspaceId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      provider: parsed.data.provider,
      defaultModel: parsed.data.defaultModel,
      phase: parsed.data.phase,
      executionModeDefault: parsed.data.executionModeDefault,
      credentialService: parsed.data.credentialService,
      roleType: parsed.data.roleType,
      rulesMarkdown: parsed.data.rulesMarkdown,
      mcpProfile: parsed.data.mcpProfile,
      generatedPaths,
      skills: { connect: parsed.data.skillIds.map((id) => ({ id })) },
    },
    update: {
      name: parsed.data.name,
      description: parsed.data.description,
      provider: parsed.data.provider,
      defaultModel: parsed.data.defaultModel,
      phase: parsed.data.phase,
      executionModeDefault: parsed.data.executionModeDefault,
      credentialService: parsed.data.credentialService,
      roleType: parsed.data.roleType,
      rulesMarkdown: parsed.data.rulesMarkdown,
      mcpProfile: parsed.data.mcpProfile,
      skills: { set: parsed.data.skillIds.map((id) => ({ id })) },
    },
    include: { skills: true },
  });

  await writeGeneratedRoleFiles(role.slug, {
    name: role.name,
    description: role.description,
    provider: role.provider,
    phase: role.phase,
    rulesMarkdown: role.rulesMarkdown,
    skillRefs: role.skills.map((skill) => skill.slug),
    generatedPaths,
  }).catch(() => null);

  return NextResponse.json(role, { status: 201 });
}

async function writeGeneratedRoleFiles(slug: string, data: Record<string, unknown>) {
  const header = "# Managed by GCS Dashboard. Regenerate from /create.\n\n";
  const sharedPath = resolvePath("agents", "roles", `${slug}.json`);
  const claudePath = resolvePath(".claude", "roles", `${slug}.md`);
  const codexPath = resolvePath(".agents", "skills", slug, "SKILL.md");

  await fs.mkdir(resolvePath("agents", "roles"), { recursive: true });
  await fs.mkdir(resolvePath(".claude", "roles"), { recursive: true });
  await fs.mkdir(resolvePath(".agents", "skills", slug), { recursive: true });

  await fs.writeFile(sharedPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  await fs.writeFile(claudePath, `${header}${data.rulesMarkdown}\n\nSkills: ${(data.skillRefs as string[]).join(", ")}\n`, "utf-8");
  await fs.writeFile(codexPath, `---\nname: ${slug}\ndescription: ${data.description}\n---\n\n${header}${data.rulesMarkdown}\n`, "utf-8");
}
