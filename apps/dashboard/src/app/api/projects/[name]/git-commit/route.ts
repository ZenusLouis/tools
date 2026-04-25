import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getProjectDetail } from "@/lib/projects";
import { requireCurrentUser } from "@/lib/auth";

const execFileAsync = promisify(execFile);

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const project = await getProjectDetail(name, user.workspaceId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.projectPath) return NextResponse.json({ error: "Project has no local path" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Commit message required" }, { status: 400 });

  try {
    await execFileAsync("git", ["-C", project.projectPath, "diff", "--cached", "--quiet"], { timeout: 10_000 })
      .then(() => {
        throw new Error("No staged changes. Stage files first, then commit.");
      })
      .catch((error: unknown) => {
        const exitCode = typeof error === "object" && error && "code" in error ? (error as { code?: number }).code : undefined;
        if (exitCode === 1) return;
        throw error;
      });

    const { stdout } = await execFileAsync("git", ["-C", project.projectPath, "commit", "-m", message], { timeout: 30_000 });
    const hash = (await execFileAsync("git", ["-C", project.projectPath, "rev-parse", "--short", "HEAD"], { timeout: 10_000 })).stdout.trim();

    await db.session.create({
      data: {
        workspaceId: user.workspaceId,
        provider: "codex",
        role: "commit-composer",
        type: "git-commit",
        project: project.name,
        date: new Date(),
        tasksCompleted: [],
        commitHash: hash,
        sessionNotes: message,
        cwd: project.projectPath,
      },
    });

    return NextResponse.json({ ok: true, hash, output: stdout });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
