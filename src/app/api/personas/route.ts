import { NextResponse } from "next/server";
import { db } from "@/db";
import { personas } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(personas);
  return NextResponse.json(rows);
}
