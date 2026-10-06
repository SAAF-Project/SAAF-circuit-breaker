import { NextResponse } from "next/server";
import { db } from "@/db";
import { workpapers } from "@/db/schema";
import { ensureSeeded } from "@/lib/persist";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const rows = await db.select().from(workpapers).orderBy(desc(workpapers.createdAt));
  return NextResponse.json(
    rows.map((w) => ({
      id: w.id,
      workpaperId: w.workpaperId,
      runId: w.runId,
      auditStandard: w.auditStandard,
      entity: w.entity,
      systemName: w.systemName,
      merkleRoot: w.merkleRoot,
      auditSeal: w.auditSeal,
      verified: w.verified,
      createdAt: w.createdAt,
    })),
  );
}
