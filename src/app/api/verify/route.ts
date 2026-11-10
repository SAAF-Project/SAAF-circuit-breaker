import { readJsonBody, bodyError } from "@/lib/http-safety";
import { NextResponse } from "next/server";
import { verifyWorkpaper, renderWorkpaperHtml, type Workpaper } from "@/lib/ledger";
import { getWorkpaperByKey } from "@/lib/persist";
import { runSimulation } from "@/lib/engine";

export const dynamic = "force-dynamic";

type VerifyRequest = {
  workpaperId?: string;
  workpaper?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return bodyError(error);
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "JSON body must be an object" }, { status: 400 });
  }
  const input = body as VerifyRequest;

  if (input.workpaper !== undefined) {
    const verification = verifyWorkpaper(input.workpaper);
    return NextResponse.json(
      { verification, workpaper: input.workpaper },
      { status: verification.formatMatch ? 200 : 422 },
    );
  }

  if (typeof input.workpaperId === "string" && input.workpaperId.length > 0) {
    const row = await getWorkpaperByKey(input.workpaperId);
    if (!row) {
      return NextResponse.json({ error: "Workpaper not found" }, { status: 404 });
    }
    const wp = {
      workpaperId: row.workpaperId,
      auditStandard: row.auditStandard,
      metadata: {
        entity: row.entity,
        system: row.systemName,
        timestamp: row.createdAt.toISOString(),
        mode: row.workpaperId.includes("-OFF-") ? "watchdog_off" : "watchdog_on",
      },
      genesis: row.genesis,
      trace: row.trace,
      merkleRoot: row.merkleRoot,
      auditSeal: row.auditSeal,
    };
    const verification = verifyWorkpaper(wp);
    return NextResponse.json({ verification, workpaper: wp, htmlReport: renderWorkpaperHtml(wp as Workpaper, verification) });
  }

  return NextResponse.json({ error: "Provide a workpaper or workpaperId" }, { status: 400 });
}

export async function GET() {
  const sim = runSimulation("watchdog_on");
  return NextResponse.json({
    verification: sim.verification,
    workpaper: sim.workpaper,
  });
}
