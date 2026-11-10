import { StorageLimitError } from "@/lib/storage-limits";
import { readJsonBody, bodyError } from "@/lib/http-safety";
import { NextResponse } from "next/server";
import { persistSimulation } from "@/lib/persist";
import { runSimulation, type RunMode } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let rawBody: unknown = {};
  try {
    rawBody = await readJsonBody(request, 4096, true);
  } catch (error) {
    return bodyError(error);
  }
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return NextResponse.json({ error: "JSON body must be an object" }, { status: 400 });
  }
  const body = rawBody as { mode?: unknown };
  if (body.mode !== undefined && body.mode !== "watchdog_on" && body.mode !== "watchdog_off") {
    return NextResponse.json({ error: "Invalid mode; must be watchdog_on or watchdog_off" }, { status: 422 });
  }
  const mode: RunMode = body.mode === "watchdog_off" ? "watchdog_off" : "watchdog_on";
  const result = runSimulation(mode);
  let runId: string;
  try { runId = await persistSimulation(result); }
  catch (error) { return NextResponse.json({ error: "Rehearsal storage unavailable or quota reached" }, { status: error instanceof StorageLimitError ? 429 : 503 }); }
  return NextResponse.json({
    runId,
    mode: result.mode,
    stats: result.stats,
    plays: result.plays,
    workpaper: result.workpaper,
    verification: result.verification,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode: RunMode = searchParams.get("mode") === "watchdog_off" ? "watchdog_off" : "watchdog_on";
  const result = runSimulation(mode);
  return NextResponse.json({
    mode: result.mode,
    stats: result.stats,
    plays: result.plays,
    workpaper: result.workpaper,
    verification: result.verification,
  });
}
