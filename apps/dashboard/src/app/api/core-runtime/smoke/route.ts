import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { runCoreApiLifecycleSmoke } from "@/lib/core-api";

export async function POST() {
  await requireCurrentUser();
  const result = await runCoreApiLifecycleSmoke();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
