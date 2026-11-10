import { workpapers } from "@/db/schema";
import { verifyWorkpaper } from "@/lib/ledger";
export function storedWorkpaper(row: typeof workpapers.$inferSelect) {
  return {
    workpaperId: row.workpaperId, auditStandard: row.auditStandard,
    metadata: { entity: row.entity, system: row.systemName, timestamp: row.createdAt.toISOString(),
      mode: row.workpaperId.includes("-OFF-") ? "watchdog_off" : "watchdog_on" },
    genesis: row.genesis, trace: row.trace, merkleRoot: row.merkleRoot, auditSeal: row.auditSeal,
  };
}
export function verifyStoredWorkpaper(row: typeof workpapers.$inferSelect) { return verifyWorkpaper(storedWorkpaper(row)); }
