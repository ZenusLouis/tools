import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { analyzeProjectForWorkspace } from "@/lib/project-analysis";

export async function POST(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const projectName = decodeURIComponent(name);
  const result = await analyzeProjectForWorkspace(projectName, user.workspaceId);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
