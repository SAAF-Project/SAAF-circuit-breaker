import { verifyStoredWorkpaper } from "@/lib/stored-workpaper";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workpapers } from "@/db/schema";
import { ensureSeeded } from "@/lib/persist";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request?: Request) {
  const params = request ? new URL(request.url).searchParams : new URLSearchParams();
  const limit = Math.min(50, Math.max(1, Number(params.get("limit")) || 25));
  const offset = Math.min(10000, Math.max(0, Number(params.get("offset")) || 0));
  await ensureSeeded();
  const rows = await db.select().from(workpapers).orderBy(desc(workpapers.createdAt), desc(workpapers.id)).limit(Math.floor(limit)).offset(Math.floor(offset));
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
      verified: verifyStoredWorkpaper(w).ok,
      createdAt: w.createdAt,
    })),
  );
}
