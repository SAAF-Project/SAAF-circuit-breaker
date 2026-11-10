import { NextResponse } from "next/server";
import { ensureSeeded } from "@/lib/persist";

export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.SAAF_ENABLE_SEED !== "true") return NextResponse.json({ error: "Explicit seeding is disabled" }, { status: 403 });
  await ensureSeeded();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ error: "Use POST to seed" }, { status: 405, headers: { Allow: "POST" } });
}
