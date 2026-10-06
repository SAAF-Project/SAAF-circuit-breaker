import { randomUUID } from "node:crypto";
import { eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  checkpoints,
  forgeScans,
  personas,
  policies,
  rehearsalRuns,
  ticketEvents,
  tickets,
  workpapers,
} from "@/db/schema";
import { PERSONAS } from "@/lib/personas";
import { SCENARIO_TICKETS } from "@/lib/tickets";
import { compiledPolicy } from "@/lib/policy";
import { runSimulation, type RunMode, type SimulationResult } from "@/lib/engine";
import {
  compileAgentsMd,
  compileJevRules,
  compilePermissionsYaml,
  SAMPLE_ROGUE_AGENT,
  scanSource,
} from "@/lib/forge";

export async function ensureSeeded(): Promise<void> {
  // Legacy partial-hash seals cannot be carried forward as verified evidence.
  await db.update(workpapers).set({ verified: false }).where(ne(workpapers.auditSeal, "CONSISTENCY_CHECKED"));
  const existing = await db.select({ id: personas.id }).from(personas).limit(1);
  if (existing.length > 0) return;
  await seedAll();
}

export async function seedAll(): Promise<{ ok: true; runs: string[] }> {
  const policy = compiledPolicy();

  await db.delete(ticketEvents);
  await db.delete(checkpoints);
  await db.delete(workpapers);
  await db.delete(rehearsalRuns);
  await db.delete(forgeScans);
  await db.delete(tickets);
  await db.delete(personas);
  await db.delete(policies);

  await db.insert(policies).values({
    id: "policy-jet-v1",
    policyId: policy.policyId,
    genesisPrompt: policy.genesisPrompt,
    genesisPromptHash: policy.genesisPromptHash,
    hardRules: policy.hardRules,
    maxDriftThreshold: policy.maxDriftThreshold,
    requireHumanGateAboveEur: policy.requireHumanGateAboveEur,
  });

  await db.insert(personas).values(
    PERSONAS.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      role: p.role,
      faction: p.faction,
      description: p.description,
      pressureVector: p.pressureVector,
      color: p.color,
      initials: p.initials,
      x: p.x,
      y: p.y,
    })),
  );

  await db.insert(tickets).values(
    SCENARIO_TICKETS.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      customerName: t.customerName,
      city: t.city,
      restaurant: t.restaurant,
      orderTotal: t.orderTotal,
      requestedAmount: t.requestedAmount,
      claimType: t.claimType,
      hasPhotoEvidence: t.hasPhotoEvidence,
      reviewThreat: t.reviewThreat,
      customerMessage: t.customerMessage,
      phase: t.phase,
    })),
  );

  const findings = scanSource(SAMPLE_ROGUE_AGENT);
  await db.insert(forgeScans).values({
    id: "scan-rogue-agent",
    targetPath: "samples/jet-refunds-agent/agent.py",
    language: "python",
    sourcePreview: SAMPLE_ROGUE_AGENT,
    findings,
    redFlagCount: findings.length,
    compiledPolicyId: policy.policyId,
    permissionsYaml: compilePermissionsYaml(),
    agentsMd: compileAgentsMd(),
    jevRulesJson: compileJevRules(),
  });

  const onRun = await persistSimulation(runSimulation("watchdog_on"));
  const offRun = await persistSimulation(runSimulation("watchdog_off"));

  return { ok: true, runs: [onRun, offRun] };
}

export async function persistSimulation(result: SimulationResult): Promise<string> {
  const runId = `run-${result.mode}-${randomUUID()}`;
  const workpaperRowId = `wp-${result.mode}-${randomUUID()}`;
  return db.transaction(async (tx) => {

  await tx.insert(rehearsalRuns).values({
    id: runId,
    mode: result.mode,
    status: "completed",
    ticketsProcessed: result.stats.ticketsProcessed,
    refundsAgainstPolicy: result.stats.refundsAgainstPolicy,
    paidAgainstPolicyEur: result.stats.paidAgainstPolicyEur,
    paidCompliantEur: result.stats.paidCompliantEur,
    quarantines: result.stats.quarantines,
    rollbacks: result.stats.rollbacks,
    humanRoutes: result.stats.humanRoutes,
    maxDriftScore: result.stats.maxDriftScore,
    finalDriftScore: result.stats.finalDriftScore,
    merkleRoot: result.stats.merkleRoot,
    workpaperId: result.workpaper.workpaperId,
    completedAt: new Date(),
  });

  if (result.plays.length > 0) {
    await tx.insert(ticketEvents).values(
      result.plays.map((play) => ({
        id: `${runId}-t-${play.ticket.ticketNumber}`,
        runId,
        ticketId: play.ticket.id,
        ticketNumber: play.ticket.ticketNumber,
        proposedAmount: play.proposedAmount,
        paidAmount: play.paidAmount,
        toolName: play.toolName,
        verdict: play.verdict,
        reason: play.reason,
        driftScore: play.driftScore,
        instructionDrift: play.instructionDrift,
        memoryDrift: play.memoryDrift,
        weakenedRules: play.weakenedRules,
        action: play.action,
        workingPrompt: play.workingPrompt,
        workingPromptHash: play.workingPromptHash,
        memorySnapshot: play.memorySnapshot,
        lessonWritten: play.lessonWritten,
        csatScore: play.csatScore,
        checkpointId: play.checkpointId,
        rewriteOccurred: play.rewriteOccurred,
        againstPolicy: play.againstPolicy,
        stepHash: play.stepHash,
        parentHash: play.parentHash,
      })),
    );
  }

  await tx.insert(checkpoints).values({
    id: `${runId}-chk-genesis`,
    runId,
    checkpointKey: "chk_genesis",
    promptContent: compiledPolicy().genesisPrompt,
    promptHash: compiledPolicy().genesisPromptHash,
    memorySnapshot: [],
    healthy: true,
    ticketNumber: 0,
  });

  await tx.insert(workpapers).values({
    id: workpaperRowId,
    workpaperId: result.workpaper.workpaperId,
    runId,
    auditStandard: result.workpaper.auditStandard,
    entity: result.workpaper.metadata.entity,
    systemName: result.workpaper.metadata.system,
    genesis: result.workpaper.genesis as unknown as Record<string, unknown>,
    trace: result.workpaper.trace as unknown as Record<string, unknown>[],
    merkleRoot: result.workpaper.merkleRoot,
    auditSeal: result.workpaper.auditSeal,
    verified: result.verification.ok,
    verificationResult: result.verification as unknown as Record<string, unknown>,
    htmlReport: result.htmlReport,
  }).onConflictDoUpdate({ target: workpapers.workpaperId, set: {
    runId, genesis: result.workpaper.genesis as unknown as Record<string, unknown>,
    trace: result.workpaper.trace as unknown as Record<string, unknown>[],
    merkleRoot: result.workpaper.merkleRoot, auditSeal: result.workpaper.auditSeal,
    verified: result.verification.ok,
    verificationResult: result.verification as unknown as Record<string, unknown>, htmlReport: result.htmlReport,
  } });

  return runId;
  });
}

export async function latestRuns(): Promise<{
  on: SimulationResult;
  off: SimulationResult;
}> {
  return {
    on: runSimulation("watchdog_on"),
    off: runSimulation("watchdog_off"),
  };
}

export async function getDashboard() {
  await ensureSeeded();
  const [on, off] = [runSimulation("watchdog_on"), runSimulation("watchdog_off")];
  const [scan] = await db.select().from(forgeScans).limit(1);
  const wpRows = await db.select().from(workpapers);
  const personaRows = await db.select().from(personas);
  const ticketRows = await db.select().from(tickets);
  const runRows = await db.select().from(rehearsalRuns);

  return {
    seeded: true,
    policy: compiledPolicy(),
    scan,
    personas: personaRows,
    ticketCount: ticketRows.length,
    runs: runRows,
    comparison: {
      watchdogOn: on.stats,
      watchdogOff: off.stats,
    },
    workpapers: wpRows.map((w) => ({
      id: w.id,
      workpaperId: w.workpaperId,
      merkleRoot: w.merkleRoot,
      verified: w.verified,
      auditSeal: w.auditSeal,
      createdAt: w.createdAt,
    })),
  };
}

export async function getWorkpaperByKey(workpaperId: string) {
  await ensureSeeded();
  const rows = await db.select().from(workpapers).where(eq(workpapers.workpaperId, workpaperId));
  return rows[0] ?? null;
}

export type { RunMode };
