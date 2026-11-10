import { maintainStorage, enforceQuota } from "@/lib/storage-limits";
import { randomUUID } from "node:crypto";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderBudgets, checkpoints, sentinelSessions, ticketEvents, workpapers } from "@/db/schema";
import { interceptTicket } from "@/lib/engine";
import { hashJson, hashPrompt } from "@/lib/hash";
import { judgeWithJev } from "@/lib/jev";
import { buildWorkpaper, computeTraceHash, renderWorkpaperHtml, verifyWorkpaper, type TraceEvent } from "@/lib/ledger";
import { GENESIS_PROMPT, MAX_DRIFT_THRESHOLD, genesisPromptHash } from "@/lib/policy";
import { evaluateActionGuard, type ActionGuardInput } from "@/lib/sentinel";

export type InterceptInput = ActionGuardInput & { orderId?: string; sessionId?: string; currentPrompt?: string; currentMemory?: string[] };
export const validSessionId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function parseInterceptInput(value: unknown): InterceptInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const input = { ...body, reviewThreat: body.reviewThreat ?? false, claimType: body.claimType ?? "goodwill" } as InterceptInput;
  if (typeof body.orderId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(body.orderId)) return null;
  if (evaluateActionGuard(input).reason === "INVALID_ACTION_INPUT" ||
      (body.sessionId !== undefined && !validSessionId(body.sessionId)) ||
      typeof input.claimType !== "string" || input.claimType.length > 100 ||
      (body.currentPrompt !== undefined && (typeof body.currentPrompt !== "string" || body.currentPrompt.length > 20000)) ||
      (body.currentMemory !== undefined && (!Array.isArray(body.currentMemory) || body.currentMemory.length > 100 ||
        !body.currentMemory.every((lesson) => typeof lesson === "string" && lesson.length <= 2000)))) return null;
  return { orderId: body.orderId, amount: input.amount, orderTotal: input.orderTotal, hasPhotoEvidence: input.hasPhotoEvidence,
    reviewThreat: input.reviewThreat, claimType: input.claimType,
    ...(body.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
    ...(body.currentPrompt !== undefined ? { currentPrompt: input.currentPrompt } : {}),
    ...(body.currentMemory !== undefined ? { currentMemory: input.currentMemory } : {}) };
}

/** A transactional local demo agent. No external refunds or external agents are actuated. */
export async function processIntercept(input: InterceptInput) {
  if (!input.orderId || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(input.orderId)) throw new Error("ORDER_ID_REQUIRED");
  const orderId = input.orderId;
  const sessionId = input.sessionId ?? randomUUID();
  // Snapshot and slow provider I/O happen without a DB transaction or advisory lock.
  const [stored] = await db.select().from(sentinelSessions).where(eq(sentinelSessions.id, sessionId));
  const before = { prompt: stored?.activePrompt ?? GENESIS_PROMPT, memory: stored?.activeMemory ?? [] };
  const storedCheckpointValid =
    typeof stored?.checkpointPrompt === "string" &&
    hashPrompt(stored.checkpointPrompt) === genesisPromptHash() &&
    Array.isArray(stored.checkpointMemory) && stored.checkpointMemory.length === 0;
  const checkpoint = storedCheckpointValid
    ? { prompt: stored.checkpointPrompt, memory: stored.checkpointMemory ?? [] }
    : { prompt: GENESIS_PROMPT, memory: [] };
  const proposed = { prompt: input.currentPrompt ?? before.prompt, memory: input.currentMemory ?? before.memory };
  const trace = (stored?.trace ?? []) as unknown as TraceEvent[];
  if (trace.length >= 100) throw new Error("SESSION_EVENT_LIMIT");
  let local = interceptTicket({ ...input, currentPrompt: proposed.prompt, currentMemory: proposed.memory });
  const jev = await judgeWithJev({ proposedAction: { amount: input.amount, orderTotal: input.orderTotal,
    hasPhotoEvidence: input.hasPhotoEvidence, reviewThreat: input.reviewThreat, claimType: input.claimType },
    instructions: proposed.prompt, memory: proposed.memory, deterministicAssessment: local });
  return db.transaction(async (tx) => {
    await maintainStorage(tx);
    await enforceQuota(tx, "sessions", sessionId);
    await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))`);
    const [current] = await tx.select().from(sentinelSessions).where(eq(sentinelSessions.id, sessionId));
    // Never apply a judgment made for a stale snapshot. Caller may retry explicitly.
    if (JSON.stringify(current ?? null) !== JSON.stringify(stored ?? null)) throw new Error("SESSION_CONFLICT");
    // Quota lock above serializes authorization budgets across ALL sessions/processes.
    const [order] = await tx.select().from(orderBudgets).where(eq(orderBudgets.id, orderId));
    if (order && order.orderTotal !== input.orderTotal) throw new Error("ORDER_TOTAL_CONFLICT");
    if (!order) {
      const [n] = await tx.select({ value: count() }).from(orderBudgets);
      if (n.value >= 10000) throw new Error("ORDER_BUDGET_LIMIT");
      await tx.insert(orderBudgets).values({ id: orderId, orderTotal: input.orderTotal, authorizedCents: 0 });
    }
    const alreadyAuthorized = (order?.authorizedCents ?? 0) / 100;
    local = interceptTicket({ ...input, alreadyAuthorized, currentPrompt: proposed.prompt, currentMemory: proposed.memory });
    const rollbackExecuted = local.drift.driftScore >= MAX_DRIFT_THRESHOLD || local.drift.weakenedRules.length > 0 || jev.choice === "quarantine";
    const uncertain = jev.status !== "succeeded" || jev.confidence === null || jev.confidence < 0.8 ||
      (jev.choice === "allow" && (jev.probabilities?.allow ?? 0) < 0.8);
    const verdict = rollbackExecuted ? "QUARANTINE_AND_ROLLBACK" :
      (!local.guard.ok || local.verdict !== "ALLOW" || uncertain || jev.choice !== "allow") ? "ROUTE_TO_HUMAN" : "ALLOW";
    const action = rollbackExecuted ? "ROLLBACK" : verdict === "ALLOW" ? "PROCEED" : "HALT";
    const reason = rollbackExecuted ? "PROPOSED_STATE_QUARANTINED_CHECKPOINT_RESTORED" : !local.guard.ok ? local.guard.reason :
      jev.status !== "succeeded" ? jev.error! : uncertain ? "JEV_UNCERTAIN_HUMAN_REVIEW" :
      jev.choice === "human" ? "JEV_HUMAN_REVIEW" : local.reason;
    const after = rollbackExecuted ? checkpoint : verdict === "ALLOW" ? proposed : before;
    const healthy =
      verdict === "ALLOW" &&
      local.drift.driftScore === 0 &&
      local.drift.weakenedRules.length === 0 &&
      hashPrompt(after.prompt) === genesisPromptHash() &&
      after.memory.length === 0
        ? after
        : checkpoint;
    const step = trace.length + 1;
    const workpaperId = `WP-LIVE-ON-${sessionId}`;
    const eventPayload = {
      step, ticketId: step, customerInputHash: hashJson(input), workingPromptHash: hashPrompt(proposed.prompt),
      driftScore: local.drift.driftScore, toolCalled: "execute_refund", toolArgs: { amount: input.amount, currency: "EUR" },
      guardEvaluation: local.guard.evaluation, verdict, rollbackExecuted,
      restoredCheckpointHash: rollbackExecuted ? hashPrompt(checkpoint.prompt) : null,
      parentHash: trace.at(-1)?.stepHash ?? genesisPromptHash(), againstPolicy: false, paidAmount: 0,
      orderId, authorizationReserved: verdict === "ALLOW",
      policyInputs: { alreadyAuthorized, orderTotal: input.orderTotal, hasPhotoEvidence: input.hasPhotoEvidence, reviewThreat: input.reviewThreat, claimType: input.claimType },
      stateBefore: before, proposedState: proposed, stateAfter: after, jev, reason,
      humanReview: verdict === "ALLOW" ? "not_required" : "queued_local_review", paymentExecuted: false,
    };
    const event = { ...eventPayload, stepHash: computeTraceHash(eventPayload) };
    const nextTrace = [...trace, event];
    if (Buffer.byteLength(JSON.stringify(nextTrace)) > 2_097_152) throw new Error("SESSION_BYTE_LIMIT");
    const workpaper = buildWorkpaper({ workpaperId, mode: "watchdog_on", promptHash: genesisPromptHash(), trace: nextTrace });
    const verification = verifyWorkpaper(workpaper);
    if (!verification.ok) throw new Error("INTERNAL_WORKPAPER_INTEGRITY_FAILURE");
    if (verdict === "ALLOW") {
      await tx.update(orderBudgets).set({ authorizedCents: (order?.authorizedCents ?? 0) + Math.round(input.amount * 100) })
        .where(eq(orderBudgets.id, orderId));
    }
    await tx.insert(sentinelSessions).values({ id: sessionId, activePrompt: after.prompt, activeMemory: after.memory,
      checkpointPrompt: healthy.prompt, checkpointMemory: healthy.memory, trace: nextTrace as unknown as Record<string, unknown>[], updatedAt: new Date() })
      .onConflictDoUpdate({ target: sentinelSessions.id, set: { activePrompt: after.prompt, activeMemory: after.memory,
        checkpointPrompt: healthy.prompt, checkpointMemory: healthy.memory, trace: nextTrace as unknown as Record<string, unknown>[], updatedAt: new Date() } });
    await tx.insert(ticketEvents).values({ id: `live-${sessionId}-${step}`, runId: `live-${sessionId}`,
      ticketId: `live-${step}`, ticketNumber: step, proposedAmount: input.amount, paidAmount: 0, toolName: "execute_refund",
      verdict, reason, driftScore: local.drift.driftScore, instructionDrift: local.drift.instructionDrift,
      memoryDrift: local.drift.memoryDrift, weakenedRules: local.drift.weakenedRules, action,
      workingPrompt: after.prompt, workingPromptHash: hashPrompt(after.prompt), memorySnapshot: after.memory,
      csatScore: 0, checkpointId: `live-${sessionId}-chk-${step}`, rewriteOccurred: proposed.prompt !== before.prompt,
      againstPolicy: false, stepHash: event.stepHash, parentHash: event.parentHash });
    await tx.insert(checkpoints).values({ id: `live-${sessionId}-chk-${step}`, runId: `live-${sessionId}`,
      checkpointKey: `live-${step}`, promptContent: healthy.prompt, promptHash: hashPrompt(healthy.prompt),
      memorySnapshot: healthy.memory, healthy: true, ticketNumber: step });
    const document = { workpaperId, runId: `live-${sessionId}`, auditStandard: workpaper.auditStandard,
      entity: workpaper.metadata.entity, systemName: workpaper.metadata.system,
      genesis: workpaper.genesis as unknown as Record<string, unknown>, trace: nextTrace,
      merkleRoot: workpaper.merkleRoot, auditSeal: workpaper.auditSeal, verified: verification.ok,
      verificationResult: verification as unknown as Record<string, unknown>, htmlReport: renderWorkpaperHtml(workpaper, verification) };
    await tx.insert(workpapers).values({ id: `wp-live-${sessionId}`, ...document })
      .onConflictDoUpdate({ target: workpapers.workpaperId, set: document });
    return { ...local, orderId, alreadyAuthorized, authorizationReserved: verdict === "ALLOW", verdict, action, reason, jev, sessionId, rollbackExecuted, activeState: after,
      checkpointHash: hashPrompt(healthy.prompt), persisted: true, paymentExecuted: false,
      humanReview: event.humanReview, workpaper, verification };
  });
}
