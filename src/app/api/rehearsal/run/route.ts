import { NextResponse } from "next/server";
import { persistSimulation } from "@/lib/persist";
import { runSimulation, type RunMode } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let rawBody: unknown = {};
  try {
    const text = await request.text();
    if (text.trim() !== "") rawBody = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
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
  const runId = await persistSimulation(result);
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
