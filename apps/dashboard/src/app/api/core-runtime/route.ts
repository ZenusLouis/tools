import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { getCoreApiRuntimeStatus } from "@/lib/core-api";

export async function GET() {
  await requireCurrentUser();
  const status = await getCoreApiRuntimeStatus();
  return NextResponse.json({ ok: true, status });
}
