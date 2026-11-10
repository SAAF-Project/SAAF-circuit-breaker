import { count, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { checkpoints, forgeScans, rehearsalRuns, sentinelSessions, ticketEvents, workpapers } from "@/db/schema";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class StorageLimitError extends Error {}
export const STORAGE_LIMITS = { sessions: 100, scans: 200, runs: 100, retentionDays: 30 } as const;
/** Shared DB lock makes quota checks atomic across processes, not just one Node worker. */
export async function maintainStorage(tx: Tx) {
  await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('saaf-storage-budget'))`);
  const cutoff = new Date(Date.now() - STORAGE_LIMITS.retentionDays * 86400000);
  const expiredSessions = await tx.select({ id: sentinelSessions.id }).from(sentinelSessions).where(lt(sentinelSessions.updatedAt, cutoff));
  const expiredRuns = await tx.select({ id: rehearsalRuns.id }).from(rehearsalRuns).where(lt(rehearsalRuns.startedAt, cutoff));
  const runIds = [...expiredSessions.map((s) => `live-${s.id}`), ...expiredRuns.map((s) => s.id)];
  if (runIds.length) {
    await tx.delete(ticketEvents).where(inArray(ticketEvents.runId, runIds));
    await tx.delete(checkpoints).where(inArray(checkpoints.runId, runIds));
    await tx.delete(workpapers).where(inArray(workpapers.runId, runIds));
  }
  if (expiredSessions.length) await tx.delete(sentinelSessions).where(inArray(sentinelSessions.id, expiredSessions.map((s) => s.id)));
  if (expiredRuns.length) await tx.delete(rehearsalRuns).where(inArray(rehearsalRuns.id, expiredRuns.map((s) => s.id)));
  await tx.delete(forgeScans).where(sql`${forgeScans.createdAt} < ${cutoff} AND ${forgeScans.id} <> 'scan-rogue-agent'`);
}
export async function enforceQuota(tx: Tx, kind: "sessions" | "scans" | "runs", id?: string) {
  const table = kind === "sessions" ? sentinelSessions : kind === "scans" ? forgeScans : rehearsalRuns;
  // Updating an existing session consumes no new slot.
  if (kind === "sessions" && id && (await tx.select({ id: sentinelSessions.id }).from(sentinelSessions).where(eq(sentinelSessions.id, id))).length) return;
  const [row] = await tx.select({ value: count() }).from(table);
  if (row.value >= STORAGE_LIMITS[kind]) throw new StorageLimitError(`STORAGE_${kind.toUpperCase()}_LIMIT`);
}
