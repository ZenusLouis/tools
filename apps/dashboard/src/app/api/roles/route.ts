import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import fs from "fs/promises";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolvePath } from "@/lib/fs/resolve";
import { ensureWorkspaceAgentDefaults } from "@/lib/agent-bootstrap";

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
  await ensureWorkspaceAgentDefaults(user.workspaceId);
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
    codex: `.codex/skills/${parsed.data.slug}/SKILL.md`,
    chatgpt: `.agents/providers/chatgpt/roles/${parsed.data.slug}.md`,
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

export async function DELETE(req: NextRequest) {
  const user = await requireCurrentUser();
  const { slug } = await req.json().catch(() => ({}));
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  await db.agentRole.deleteMany({ where: { workspaceId: user.workspaceId, slug } });
  return NextResponse.json({ ok: true });
}

async function writeGeneratedRoleFiles(slug: string, data: Record<string, unknown>) {
  const header = "# Managed by GCS Dashboard. Regenerate from /create.\n\n";
  const sharedPath = resolvePath("agents", "roles", `${slug}.json`);
  const claudePath = resolvePath(".claude", "roles", `${slug}.md`);
  const codexPath = resolvePath(".codex", "skills", slug, "SKILL.md");
  const chatgptPath = resolvePath(".agents", "providers", "chatgpt", "roles", `${slug}.md`);
  const learningPath = resolvePath("agents", "learning", "role-feedback.md");

  await fs.mkdir(resolvePath("agents", "roles"), { recursive: true });
  await fs.mkdir(resolvePath(".claude", "roles"), { recursive: true });
  await fs.mkdir(resolvePath(".codex", "skills", slug), { recursive: true });
  await fs.mkdir(resolvePath(".agents", "providers", "chatgpt", "roles"), { recursive: true });
  await fs.mkdir(resolvePath("agents", "learning"), { recursive: true });

  await fs.writeFile(sharedPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  await fs.writeFile(claudePath, `${header}${data.rulesMarkdown}\n\nSkills: ${(data.skillRefs as string[]).join(", ")}\n`, "utf-8");
  await fs.writeFile(
    codexPath,
    `---\nname: ${slug}\ndescription: ${data.description}\n---\n\n${header}${data.rulesMarkdown}\n\n## Skills\n${(data.skillRefs as string[]).map((skill) => `- ${skill}`).join("\n")}\n`,
    "utf-8",
  );
  await fs.writeFile(
    chatgptPath,
    `${header}# ${data.name}\n\n${data.description}\n\n## Rules\n${data.rulesMarkdown}\n\n## Skills\n${(data.skillRefs as string[]).map((skill) => `- ${skill}`).join("\n")}\n`,
    "utf-8",
  );
  await fs.appendFile(learningPath, `\n## ${data.name}\n\n- Generated role artifact for ${data.provider}; review after first real task.\n`, "utf-8");
}
