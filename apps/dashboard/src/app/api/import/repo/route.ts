import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncWorkspaceFromRepo } from "@/lib/repo-sync";

const REPO_ROOT = process.env.GCS_REPO_ROOT ?? process.env.CLAUDE_ROOT ?? "d:\\GlobalClaudeSkills";

export async function POST(req: Request) {
  const user = await requireCurrentUser();
  const body = await req.json().catch(() => ({})) as {
    includeLogs?: boolean;
    includeProjects?: boolean;
    includeLessons?: boolean;
    includeMcp?: boolean;
    includeSkillsAndRoles?: boolean;
  };

  const job = await db.importJob.create({
    data: {
      workspaceId: user.workspaceId,
      sourceType: "repo-json",
      sourcePath: REPO_ROOT,
      status: "running",
      summary: {
        includeLogs: body.includeLogs !== false,
        includeProjects: body.includeProjects !== false,
        includeLessons: body.includeLessons !== false,
        includeMcp: body.includeMcp !== false,
        includeSkillsAndRoles: body.includeSkillsAndRoles !== false,
      },
    },
  });

  try {
    const result = await syncWorkspaceFromRepo(db, user.workspaceId, REPO_ROOT, {
      includeLogs: body.includeLogs !== false,
      includeProjects: body.includeProjects !== false,
      includeLessons: body.includeLessons !== false,
      includeMcp: body.includeMcp !== false,
      includeSkillsAndRoles: body.includeSkillsAndRoles !== false,
      onlyIfEmpty: false,
    });

    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "succeeded",
        summary: result,
        error: null,
      },
    });

    await db.auditLog.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        actorType: "user",
        event: "repo_json_imported",
        targetType: "Workspace",
        targetId: user.workspaceId,
        metadata: { jobId: job.id, result },
      },
    }).catch(() => null);

    return NextResponse.json({ ok: true, jobId: job.id, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: message,
      },
    });

    await db.auditLog.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        actorType: "user",
        event: "repo_json_import_failed",
        targetType: "Workspace",
        targetId: user.workspaceId,
        metadata: { jobId: job.id, error: message },
      },
    }).catch(() => null);

    return NextResponse.json({ ok: false, jobId: job.id, error: message }, { status: 500 });
  }
}
