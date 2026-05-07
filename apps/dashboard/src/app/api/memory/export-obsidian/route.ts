import { execSync } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildObsidianFiles } from "@/lib/obsidian-export";

export async function POST() {
  const user = await requireCurrentUser();
  const { files, nodeCount, edgeCount } = await buildObsidianFiles(user.workspaceId);

  const tmpDir = path.join(os.tmpdir(), `obsidian-${Date.now()}`);
  const zipPath = `${tmpDir}.zip`;
  try {
    await fs.mkdir(tmpDir, { recursive: true });
    for (const [name, content] of files) {
      await fs.writeFile(path.join(tmpDir, name), content, "utf-8");
    }
    execSync(`cd "${tmpDir}" && zip -r "${zipPath}" .`, { timeout: 30_000 });
    const zipContent = await fs.readFile(zipPath);

    await db.auditLog.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        actorType: "user",
        event: "obsidian_vault_exported",
        targetType: "Workspace",
        targetId: user.workspaceId,
        metadata: { files: files.size, nodes: nodeCount, edges: edgeCount },
      },
    }).catch(() => null);

    return new Response(zipContent, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="obsidian-vault-${new Date().toISOString().slice(0, 10)}.zip"`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
    await fs.unlink(zipPath).catch(() => null);
  }
}
