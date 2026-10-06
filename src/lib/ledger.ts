import { hashJson, sha256, stepPayloadHash } from "@/lib/hash";
import { genesisPolicyHash, genesisPromptHash } from "@/lib/policy";
import { evaluateActionGuard, type ActionGuardInput } from "@/lib/sentinel";

export type TraceEvent = {
  step: number;
  ticketId: number;
  customerInputHash: string;
  workingPromptHash: string;
  driftScore: number;
  toolCalled: string;
  toolArgs: { amount: number; currency: string };
  guardEvaluation: "PASSED" | "BLOCKED_BY_ACTION_GUARD";
  verdict: string;
  rollbackExecuted: boolean;
  restoredCheckpointHash: string | null;
  stepHash: string;
  parentHash: string | null;
  againstPolicy: boolean;
  paidAmount: number;
  policyInputs?: Omit<ActionGuardInput, "amount">;
};

export type Workpaper = {
  workpaperId: string;
  auditStandard: string;
  metadata: {
    entity: string;
    system: string;
    timestamp: string;
    mode: string;
  };
  genesis: {
    policyHash: string;
    promptHash: string;
    hardRules: { max_amount: number; require_evidence: boolean };
  };
  trace: TraceEvent[];
  merkleRoot: string;
  auditSeal: "CONSISTENCY_CHECKED";
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isTraceEvent(value: unknown): value is TraceEvent {
  if (!isRecord(value) || !isRecord(value.toolArgs)) return false;
  return (
    Number.isInteger(value.step) &&
    Number.isInteger(value.ticketId) &&
    isHash(value.customerInputHash) &&
    isHash(value.workingPromptHash) &&
    isFiniteNumber(value.driftScore) &&
    typeof value.toolCalled === "string" && value.toolCalled.length > 0 &&
    isFiniteNumber(value.toolArgs.amount) && value.toolArgs.amount >= 0 &&
    typeof value.toolArgs.currency === "string" && value.toolArgs.currency.length > 0 &&
    (value.guardEvaluation === "PASSED" || value.guardEvaluation === "BLOCKED_BY_ACTION_GUARD") &&
    typeof value.verdict === "string" && value.verdict.length > 0 &&
    typeof value.rollbackExecuted === "boolean" &&
    (value.restoredCheckpointHash === null || (typeof value.restoredCheckpointHash === "string" && value.restoredCheckpointHash.length > 0)) &&
    isHash(value.stepHash) &&
    (value.parentHash === null || isHash(value.parentHash)) &&
    typeof value.againstPolicy === "boolean" &&
    isFiniteNumber(value.paidAmount) && value.paidAmount >= 0
  );
}

function hasBoundDemoMode(workpaperId: string, mode: unknown): boolean {
  if (mode !== "watchdog_on" && mode !== "watchdog_off") return false;
  const expected = workpaperId.includes("-OFF-")
    ? "watchdog_off"
    : workpaperId.includes("-ON-")
      ? "watchdog_on"
      : null;
  return mode === expected;
}

export function merkleRootFromLeaves(leaves: string[]): string {
  if (leaves.length === 0) return sha256("");
  let layer = [...leaves];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] ?? layer[i];
      next.push(sha256(left + right));
    }
    layer = next;
  }
  return layer[0];
}

export function merkleLayers(leaves: string[]): string[][] {
  if (leaves.length === 0) return [[]];
  const layers: string[][] = [leaves];
  let layer = [...leaves];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] ?? layer[i];
      next.push(sha256(left + right));
    }
    layers.push(next);
    layer = next;
  }
  return layers;
}

/**
 * Hash every event field except its own stepHash. This is a consistency hash,
 * not a signature or an authenticity proof.
 */
export function computeTraceHash(event: Omit<TraceEvent, "stepHash">): string {
  return stepPayloadHash(event);
}

export type VerifyResult = {
  ok: boolean;
  formatMatch: boolean;
  genesisMatch: boolean;
  guardReplayMatch: boolean;
  hashChainMatch: boolean;
  merkleMatch: boolean;
  failedSteps: number[];
  computedMerkleRoot: string;
  expectedMerkleRoot: string;
  message: string;
};

function invalidResult(message: string, expectedMerkleRoot = ""): VerifyResult {
  return {
    ok: false,
    formatMatch: false,
    genesisMatch: false,
    guardReplayMatch: false,
    hashChainMatch: false,
    merkleMatch: false,
    failedSteps: [],
    computedMerkleRoot: merkleRootFromLeaves([]),
    expectedMerkleRoot,
    message,
  };
}

export function verifyWorkpaper(value: unknown): VerifyResult {
  if (!isRecord(value)) return invalidResult("Verification failed: malformed workpaper.");

  const merkleRoot = typeof value.merkleRoot === "string" ? value.merkleRoot : "";
  if (
    typeof value.workpaperId !== "string" ||
    !isRecord(value.metadata) ||
    !isRecord(value.genesis) ||
    !Array.isArray(value.trace) ||
    value.trace.length === 0 ||
    value.auditSeal !== "CONSISTENCY_CHECKED"
  ) {
    return invalidResult("Verification failed: malformed or empty workpaper.", merkleRoot);
  }

  const metadata = value.metadata;
  const genesis = value.genesis;
  const formatMatch = hasBoundDemoMode(value.workpaperId, metadata.mode) &&
    isHash(merkleRoot) &&
    isHash(genesis.policyHash) &&
    isHash(genesis.promptHash) &&
    isRecord(genesis.hardRules) &&
    isFiniteNumber(genesis.hardRules.max_amount) &&
    typeof genesis.hardRules.require_evidence === "boolean" &&
    value.trace.every(isTraceEvent);

  if (!formatMatch) return invalidResult("Verification failed: malformed workpaper fields.", merkleRoot);

  const typed = value as Workpaper;
  const policyBytesHash = hashJson(typed.genesis.hardRules);
  const genesisMatch =
    policyBytesHash === typed.genesis.policyHash &&
    typed.genesis.policyHash === genesisPolicyHash() &&
    typed.genesis.promptHash === genesisPromptHash();

  const runningHashes: string[] = [];
  const failedSteps: number[] = [];
  let guardReplayMatch = true;
  let hashChainMatch = true;
  let expectedParentHash: string | null = genesisPromptHash();

  for (const event of typed.trace) {
    if (event.parentHash !== expectedParentHash) {
      hashChainMatch = false;
      failedSteps.push(event.step);
    }

    // Preserve forward-compatible event fields: only the hash is excluded.
    const { stepHash: _stepHash, ...eventPayload } = event;
    const computed = computeTraceHash(eventPayload);
    runningHashes.push(computed);
    if (computed !== event.stepHash) {
      hashChainMatch = false;
      failedSteps.push(event.step);
    }

    const overHardCap = event.toolArgs.amount > typed.genesis.hardRules.max_amount;
    if (event.policyInputs !== undefined || typed.workpaperId.startsWith("WP-LIVE-")) {
      const replay = evaluateActionGuard({ ...event.policyInputs, amount: event.toolArgs.amount } as ActionGuardInput);
      if (replay.reason === "INVALID_ACTION_INPUT" || replay.evaluation !== event.guardEvaluation ||
          (typed.metadata.mode === "watchdog_on" && !replay.ok && event.paidAmount !== 0)) {
        guardReplayMatch = false;
        failedSteps.push(event.step);
      }
    }
    if (overHardCap && event.guardEvaluation !== "BLOCKED_BY_ACTION_GUARD") {
      guardReplayMatch = false;
      failedSteps.push(event.step);
    }
    if (typed.metadata.mode === "watchdog_on" && overHardCap && event.paidAmount !== 0) {
      guardReplayMatch = false;
      failedSteps.push(event.step);
    }
    if (event.paidAmount > event.toolArgs.amount) {
      guardReplayMatch = false;
      failedSteps.push(event.step);
    }
    if (
      (event.rollbackExecuted && event.restoredCheckpointHash === null) ||
      (!event.rollbackExecuted && event.restoredCheckpointHash !== null) ||
      (event.verdict === "QUARANTINE_AND_ROLLBACK" && !event.rollbackExecuted)
    ) {
      guardReplayMatch = false;
      failedSteps.push(event.step);
    }

    expectedParentHash = event.stepHash;
  }

  const computedMerkleRoot = merkleRootFromLeaves(runningHashes);
  const merkleMatch = computedMerkleRoot === typed.merkleRoot;
  const ok = genesisMatch && guardReplayMatch && hashChainMatch && merkleMatch;

  return {
    ok,
    formatMatch,
    genesisMatch,
    guardReplayMatch,
    hashChainMatch,
    merkleMatch,
    failedSteps: Array.from(new Set(failedSteps)),
    computedMerkleRoot,
    expectedMerkleRoot: typed.merkleRoot,
    message: ok
      ? "Deterministic consistency and re-performance checks passed; hashes are not signatures or proof of authenticity."
      : "Verification failed. Workpaper does not re-perform cleanly.",
  };
}

export function buildWorkpaper(input: {
  workpaperId: string;
  mode: string;
  promptHash: string;
  trace: TraceEvent[];
}): Workpaper {
  const merkle = merkleRootFromLeaves(input.trace.map((t) => t.stepHash));
  return {
    workpaperId: input.workpaperId,
    auditStandard: "ISA_230 / NOREA_AI_CONTROL_FRAMEWORK",
    metadata: {
      entity: "Just Eat Takeaway.com",
      system: "Automated Care Refunds Agent",
      timestamp: new Date().toISOString(),
      mode: input.mode,
    },
    genesis: {
      policyHash: genesisPolicyHash(),
      promptHash: input.promptHash,
      hardRules: { max_amount: 20.0, require_evidence: true },
    },
    trace: input.trace,
    merkleRoot: merkle,
    auditSeal: "CONSISTENCY_CHECKED",
  };
}

export function renderWorkpaperHtml(wp: Workpaper, verification: VerifyResult): string {
  const rows = wp.trace
    .map(
      (e) => `<tr>
        <td>${e.step}</td>
        <td>#${e.ticketId}</td>
        <td>€${e.toolArgs.amount.toFixed(2)}</td>
        <td>${e.guardEvaluation}</td>
        <td>${e.verdict}</td>
        <td>${e.driftScore.toFixed(2)}</td>
        <td><code>${e.stepHash.slice(0, 16)}</code></td>
      </tr>`,
    )
    .join("");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${wp.workpaperId}</title>
<style>
  body { font-family: ui-monospace, monospace; background: #07080c; color: #e8e4d9; padding: 32px; }
  h1 { color: #ff7a1a; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #2a2e38; padding: 6px 8px; text-align: left; }
  .ok { color: #4ade80; } .bad { color: #ff4d6d; }
</style></head>
<body>
  <h1>SAAF-VERIFY · ${wp.workpaperId}</h1>
  <p>${wp.auditStandard}</p>
  <p>Entity: ${wp.metadata.entity} · System: ${wp.metadata.system}</p>
  <p>Genesis policy hash: <code>${wp.genesis.policyHash}</code></p>
  <p>Merkle root: <code>${wp.merkleRoot}</code></p>
  <p class="${verification.ok ? "ok" : "bad"}">${verification.message}</p>
  <table>
    <thead><tr><th>Step</th><th>Ticket</th><th>Amount</th><th>Guard</th><th>Verdict</th><th>Drift</th><th>Hash</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;
}
