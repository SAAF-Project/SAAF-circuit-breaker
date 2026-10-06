import { NextResponse } from "next/server";
import { persistSimulation } from "@/lib/persist";
import { runSimulation, type RunMode } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { mode?: RunMode };
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
