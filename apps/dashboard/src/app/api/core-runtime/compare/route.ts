import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { compareCoreApiContract } from "@/lib/core-api";

export async function GET() {
  await requireCurrentUser();
  const result = await compareCoreApiContract();
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
