import { NextResponse } from "next/server";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { ensureSeeded } from "@/lib/persist";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const rows = await db.select().from(tickets).orderBy(asc(tickets.ticketNumber));
  return NextResponse.json(rows);
}
