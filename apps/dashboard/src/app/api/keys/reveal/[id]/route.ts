import { NextRequest, NextResponse } from "next/server";
import { revealApiKey } from "@/lib/api-keys";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const value = await revealApiKey(id);
    return NextResponse.json({ value });
  } catch (e) {
    const msg = String(e);
    const status = msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
