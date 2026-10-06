import { NextResponse } from "next/server";
import { db } from "@/db";
import { personas } from "@/db/schema";
import { ensureSeeded } from "@/lib/persist";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const rows = await db.select().from(personas);
  return NextResponse.json(rows);
}
