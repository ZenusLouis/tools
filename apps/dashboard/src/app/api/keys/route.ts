import { NextRequest, NextResponse } from "next/server";
import { listApiKeys, createApiKey, deleteApiKey } from "@/lib/api-keys";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  service: z.string().min(1).max(50),
  value: z.string().min(1),
});

export async function GET() {
  try {
    const keys = await listApiKeys();
    return NextResponse.json(keys);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, service, value } = CreateSchema.parse(body);
    const key = await createApiKey(name, service, value);
    return NextResponse.json(key, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteApiKey(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
