import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureWorkspaceAgentDefaults } from "@/lib/agent-bootstrap";

export async function GET() {
  const user = await requireCurrentUser();
  await ensureWorkspaceAgentDefaults(user.workspaceId);
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
    diagnostics: {
      roles: roles.length,
      apiKeys: Array.from(services),
      local,
      onlineDevices: devices.map((device) => ({
        name: device.name,
        deviceKey: device.deviceKey,
        claudeAvailable: device.claudeAvailable,
        codexAvailable: device.codexAvailable,
        lastSeenAt: device.lastSeenAt,
      })),
    },
    agents: available.map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      provider: role.provider,
      mode: role.executionModeDefault,
      model: role.defaultModel,
      roleType: role.roleType,
    })),
  });
}
