import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { type FigmaDesignActionType, queueFigmaDesignAction } from "@/lib/project-operations";

const ACTIONS = new Set<FigmaDesignActionType>([
  "mcp_design_inspection",
  "mcp_ui_brief",
  "mcp_design_implementation",
  "mcp_visual_review",
]);

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const body = await request.json().catch(() => ({})) as { actionType?: string };
  const actionType = ACTIONS.has(body.actionType as FigmaDesignActionType)
    ? body.actionType as FigmaDesignActionType
    : "mcp_design_inspection";
  const result = await queueFigmaDesignAction(decodeURIComponent(name), user.workspaceId, actionType);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
