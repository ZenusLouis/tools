import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { recordReindexProject } from "@/lib/project-operations";

export async function POST(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireCurrentUser();
  const { name } = await params;
  const result = await recordReindexProject(decodeURIComponent(name), user.workspaceId);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
