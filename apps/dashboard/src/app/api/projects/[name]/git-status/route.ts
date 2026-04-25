import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getProjectDetail } from "@/lib/projects";
import { requireCurrentUser } from "@/lib/auth";

const execFileAsync = promisify(execFile);

type NumstatFile = { path: string; added: number; removed: number };

function parseNumstat(stdout: string): NumstatFile[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [addedRaw, removedRaw, ...pathParts] = line.split(/\s+/);
      return {
        path: pathParts.join(" "),
        added: Number.parseInt(addedRaw, 10) || 0,
        removed: Number.parseInt(removedRaw, 10) || 0,
      };
    });
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const project = await getProjectDetail(name, user.workspaceId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.projectPath) return NextResponse.json({ error: "Project has no local path" }, { status: 400 });

  try {
    const [{ stdout: staged }, { stdout: unstaged }] = await Promise.all([
      execFileAsync("git", ["-C", project.projectPath, "diff", "--cached", "--numstat"], { timeout: 10_000 }),
      execFileAsync("git", ["-C", project.projectPath, "diff", "--numstat"], { timeout: 10_000 }),
    ]);
    return NextResponse.json({
      project: project.name,
      path: project.projectPath,
      staged: parseNumstat(staged),
      unstaged: parseNumstat(unstaged),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
