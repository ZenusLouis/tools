import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const projectName = decodeURIComponent(name);
  const body = await req.json().catch(() => ({})) as { actionId?: unknown };
  const actionId = typeof body.actionId === "string" ? body.actionId : null;

  const where = {
    workspaceId: user.workspaceId,
    type: "run_analysis",
    status: { in: ["pending", "claimed", "running"] },
    ...(actionId
      ? { id: actionId }
      : { payload: { path: ["projectName"], equals: projectName } }),
  };

  const actions = await db.bridgeFileAction.findMany({
    where,
    select: { id: true, result: true },
  });

  if (actions.length === 0) {
    return NextResponse.json({ ok: true, cancelled: 0 });
  }

  await Promise.all(actions.map((action) => db.bridgeFileAction.update({
    where: { id: action.id },
    data: {
      status: "cancelled",
      error: "Cancelled by user",
      completedAt: new Date(),
      result: resultWithLog(action.result, "Cancelled by user."),
    },
  })));

  return NextResponse.json({ ok: true, cancelled: actions.length });
}
