import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sentinelSessions } from "@/db/schema";
import { parseInterceptInput, processIntercept, validSessionId } from "@/lib/live-sentinel";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 }); }
  const input = parseInterceptInput(body);
  if (!input) return NextResponse.json({ error: "Invalid safety inputs: finite non-negative EUR cents, real booleans, valid prompt/memory and session ID required." }, { status: 422 });
  try {
    return NextResponse.json(await processIntercept(input));
  } catch {
    return NextResponse.json({ error: "State transition unavailable; no action authorized.", action: "HALT", persisted: false, paymentExecuted: false }, { status: 503 });
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("sessionId");
  if (!validSessionId(id)) return NextResponse.json({ error: "Valid sessionId required" }, { status: 422 });
  const [session] = await db.select().from(sentinelSessions).where(eq(sentinelSessions.id, id));
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}
