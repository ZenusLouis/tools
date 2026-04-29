import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const STALE_ANALYSIS_MS = Math.max(5, Number(process.env.GCS_ANALYSIS_STALE_MINUTES ?? "30") || 30) * 60 * 1000;
const ACTIVE_STATUSES = new Set(["pending", "claimed", "running"]);

type AnalysisAction = {
  id: string;
  result: Prisma.JsonValue | null;
  status: string;
  error: string | null;
  updatedAt: Date;
};

function resultWithLog(previous: unknown, line: string) {
  const base =
    previous && typeof previous === "object" && !Array.isArray(previous)
      ? previous as Record<string, unknown>
      : {};
  const currentLog = Array.isArray(base.log) ? base.log.filter((item): item is string => typeof item === "string") : [];
  return {
    ...base,
    log: currentLog.includes(line) ? currentLog : [...currentLog, line],
  };
}

async function expireStaleAction(action: AnalysisAction | null) {
  if (!action || !ACTIVE_STATUSES.has(action.status)) return action;
  if (Date.now() - action.updatedAt.getTime() < STALE_ANALYSIS_MS) return action;

  const line = `Cancelled stale analysis after ${Math.round(STALE_ANALYSIS_MS / 60000)} minutes without progress.`;
  const updated = await db.bridgeFileAction.update({
    where: { id: action.id },
    data: {
      status: "cancelled",
      error: "Analysis cancelled because it became stale. Start a new analysis when the local bridge is ready.",
      completedAt: new Date(),
      result: resultWithLog(action.result, line),
    },
    select: { id: true, result: true, status: true, error: true, updatedAt: true },
  });
  return updated;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const projectName = decodeURIComponent(name);
  const actionId = req.nextUrl.searchParams.get("actionId");

  const count = await db.task.count({
    where: { feature: { module: { projectName } }, workspaceId: user.workspaceId },
  });

  let log: string[] = [];
  let failed = false;
  let errorMsg = "";
  let status: string | null = null;
  let updatedAt: string | null = null;
  let summary: unknown = null;
  if (actionId) {
    let action = await db.bridgeFileAction.findFirst({
      where: { id: actionId, workspaceId: user.workspaceId },
      select: { id: true, result: true, status: true, error: true, updatedAt: true },
    });
    action = await expireStaleAction(action);
    status = action?.status ?? null;
    updatedAt = action?.updatedAt?.toISOString() ?? null;
    const result = action?.result as { log?: string[]; summary?: unknown; analysisTranscript?: unknown } | null;
    log = result?.log ?? [];
    summary = result?.summary ?? null;
    if ((action?.status === "running" || action?.status === "claimed") && log.length === 0) {
      log = ["Local bridge picked up the analysis action.", "Claude is generating modules and tasks..."];
    }
    if (action?.status === "failed" || action?.status === "cancelled") {
      failed = true;
      errorMsg = action.error ?? (action.status === "cancelled" ? "Cancelled by user" : "Bridge action failed");
    }
    return NextResponse.json({ actionId: action?.id ?? actionId, ready: count > 0, created: count, log, failed, error: errorMsg, status, updatedAt, summary, analysisTranscript: result?.analysisTranscript ?? null });
  } else {
    let action = await db.bridgeFileAction.findFirst({
      where: {
        workspaceId: user.workspaceId,
        type: "run_analysis",
        payload: { path: ["projectName"], equals: projectName },
      },
      select: { id: true, result: true, status: true, error: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    action = await expireStaleAction(action);
    status = action?.status ?? null;
    updatedAt = action?.updatedAt?.toISOString() ?? null;
    const result = action?.result as { log?: string[]; summary?: unknown; runnerLabel?: string; analysisTranscript?: unknown } | null;
    log = result?.log ?? [];
    summary = result?.summary ?? null;
    if ((action?.status === "running" || action?.status === "claimed" || action?.status === "pending") && log.length === 0) {
      log = ["Queued - waiting for local Claude...", "Local bridge will continue even if you leave this page."];
    }
    if (action?.status === "failed" || action?.status === "cancelled") {
      failed = true;
      errorMsg = action.error ?? (action.status === "cancelled" ? "Cancelled by user" : "Bridge action failed");
    }
    return NextResponse.json({ actionId: action?.id ?? null, ready: count > 0, created: count, log, failed, error: errorMsg, status, updatedAt, summary, runnerLabel: result?.runnerLabel ?? "Claude", analysisTranscript: result?.analysisTranscript ?? null });
  }
}
