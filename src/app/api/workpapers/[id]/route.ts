import { NextResponse } from "next/server";
import { getWorkpaperByKey } from "@/lib/persist";
import { verifyWorkpaper, type Workpaper } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let decodedId: string;
  try {
    decodedId = decodeURIComponent(id);
  } catch {
    return NextResponse.json({ error: "Invalid workpaper identifier" }, { status: 400 });
  }
  const row = await getWorkpaperByKey(decodedId);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const wp: Workpaper = {
    workpaperId: row.workpaperId,
    auditStandard: row.auditStandard,
    metadata: {
      entity: row.entity,
      system: row.systemName,
      timestamp: row.createdAt.toISOString(),
      mode: row.workpaperId.includes("OFF") ? "watchdog_off" : "watchdog_on",
    },
    genesis: row.genesis as Workpaper["genesis"],
    trace: row.trace as Workpaper["trace"],
    merkleRoot: row.merkleRoot,
    auditSeal: row.auditSeal as Workpaper["auditSeal"],
  };
  return NextResponse.json({
    ...row,
    liveVerification: verifyWorkpaper(wp),
  });
}
