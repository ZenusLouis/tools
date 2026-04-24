import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await requireCurrentUser();
  const [roles, keys, devices] = await Promise.all([
    db.agentRole.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { name: "asc" } }),
    db.apiKey.findMany({ where: { workspaceId: user.workspaceId }, select: { service: true } }),
    db.bridgeDevice.findMany({ where: { workspaceId: user.workspaceId, lastSeenAt: { gte: new Date(Date.now() - 5 * 60_000) } } }),
  ]);

  const services = new Set(keys.map((k) => k.service));
  const local = {
    claude: devices.some((d) => d.claudeAvailable),
    codex: devices.some((d) => d.codexAvailable),
  };

  const available = roles.filter((role) => {
    if (role.executionModeDefault === "local") {
      return role.provider === "claude" ? local.claude : role.provider === "codex" ? local.codex : false;
    }
    if (role.credentialService === "none") return true;
    return services.has(role.credentialService);
  });

  return NextResponse.json({
    agents: available.map((role) => ({
      id: role.id,
      name: role.name,
      provider: role.provider,
      mode: role.executionModeDefault,
      model: role.defaultModel,
      roleType: role.roleType,
    })),
  });
}

