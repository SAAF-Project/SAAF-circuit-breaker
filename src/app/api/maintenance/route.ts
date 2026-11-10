import { db } from "@/db";
import { maintainStorage } from "@/lib/storage-limits";
/** Covered by the same operator-only proxy as all other pages and APIs. */
export async function POST() {
  try {
    await db.transaction(async (tx) => { await maintainStorage(tx); });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Maintenance unavailable" }, { status: 503 }); }
}
