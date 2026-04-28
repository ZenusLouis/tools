import "server-only";
import { db } from "@/lib/db";

export type LocalProjectPath = {
  deviceId: string;
  deviceName: string;
  deviceKey: string;
  path: string;
  lastSyncedAt: string | null;
  online: boolean;
};

export type ProjectContext = {
  name: string;
  path: string | null;
  localPaths: LocalProjectPath[];
  frameworks: string[];
  mcpProfile: string | null;
  docs: Record<string, string>;
  tools: Record<string, string>;
  env: {
    required: string[];
    envFile: string;
  };
  lastIndexed: string | null;
  activeTask: string | null;
};

export type ContextJSON = {
  name: string;
  path?: string;
  framework?: string[];
  mcpProfile?: string;
  docs?: Record<string, string>;
  tools?: Record<string, string>;
  env?: {
    required?: string[];
    envFile?: string;
  };
  lastIndexed?: string;
  activeTask?: string | null;
};

export async function getProjectContext(projectName: string): Promise<ProjectContext | null> {
  const p = await db.project.findUnique({
    where: { name: projectName },
    include: {
      bridgePaths: {
        include: { device: true },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!p) return null;
  const localPaths = p.bridgePaths.map((item) => ({
    deviceId: item.deviceId,
    deviceName: item.device.name,
    deviceKey: item.device.deviceKey,
    path: item.path,
    lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
    online: item.device.lastSeenAt ? Date.now() - item.device.lastSeenAt.getTime() < 90_000 : false,
  }));
  return {
    name: p.name,
    path: localPaths[0]?.path ?? p.path,
    localPaths,
    frameworks: p.frameworks,
    mcpProfile: p.mcpProfile,
    docs: (p.docs as Record<string, string>) ?? {},
    tools: (p.links as Record<string, string>) ?? {},
    env: { required: [], envFile: "" },
    lastIndexed: p.lastIndexed?.toISOString() ?? null,
    activeTask: p.activeTask,
  };
}

export async function getMcpProfiles(): Promise<string[]> {
  const rows = await db.mcpProfile.findMany({ select: { profile: true }, orderBy: { profile: "asc" } });
  return rows.map((r) => r.profile);
}
