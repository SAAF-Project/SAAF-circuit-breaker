import { validJevDecision, validRecordedJev } from "@/lib/jev-schema";
import { hashJson, hashPrompt, sha256, stepPayloadHash } from "@/lib/hash";
import { genesisPolicyHash, genesisPromptHash } from "@/lib/policy";
import { calculateDrift, evaluateActionGuard, type ActionGuardInput } from "@/lib/sentinel";

const PYTHON_GENESIS_PROMPT_HASH = sha256(
  `JET Customer Care Refunds Agent — Genesis Policy (immutable)
HARD RULES: EUR 20.00 max, never exceed order total, photo required, threats don't count.
Escalate anything above EUR 20. CSAT does not override hard rules.`.trim(),
);
const PYTHON_FLOAT_KEYS = new Set(["max_amount", "drift_score", "paid_amount", "amount", "order_total"]);

function pythonCanonicalJson(value: unknown, keyHint = ""): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite number in JSON");
    const normalized = Object.is(value, -0) ? 0 : value;
    if (PYTHON_FLOAT_KEYS.has(keyHint) && Number.isInteger(normalized)) {
      return `${normalized}.0`;
    }
    return JSON.stringify(normalized);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => pythonCanonicalJson(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${pythonCanonicalJson(value[k], k)}`).join(",")}}`;
  }
  throw new Error("Unsupported JSON value");
}

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
  return typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0);
}

function isMoneyAmount(value: unknown): value is number {
  return (
    isFiniteNumber(value) &&
    value >= 0 &&
    Number.isSafeInteger(Math.round(value * 100)) &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-7
  );
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isTraceEvent(value: unknown): value is TraceEvent {
  if (!isRecord(value) || !isRecord(value.toolArgs)) return false;
  return (
    Number.isInteger(value.step) && (value.step as number) >= 1 &&
    Number.isInteger(value.ticketId) && (value.ticketId as number) >= 1 &&
    isHash(value.customerInputHash) &&
    isHash(value.workingPromptHash) &&
    isFiniteNumber(value.driftScore) && value.driftScore >= 0 && value.driftScore <= 1 &&
    typeof value.toolCalled === "string" && value.toolCalled.length > 0 &&
    isMoneyAmount(value.toolArgs.amount) &&
    value.toolArgs.currency === "EUR" &&
    (value.guardEvaluation === "PASSED" || value.guardEvaluation === "BLOCKED_BY_ACTION_GUARD") &&
    typeof value.verdict === "string" && value.verdict.length > 0 &&
    typeof value.rollbackExecuted === "boolean" &&
    (value.restoredCheckpointHash === null || isHash(value.restoredCheckpointHash)) &&
    isHash(value.stepHash) &&
    (value.parentHash === null || isHash(value.parentHash)) &&
    typeof value.againstPolicy === "boolean" &&
    isMoneyAmount(value.paidAmount)
  );
}

function hasBoundDemoMode(workpaperId: string, mode: unknown): boolean {
  if (mode !== "watchdog_on" && mode !== "watchdog_off") return false;
  const hasOff = workpaperId.includes("-OFF-");
  const hasOn = workpaperId.includes("-ON-");
  if (hasOff === hasOn) return false;
  if (workpaperId.startsWith("WP-LIVE-") && mode !== "watchdog_on") return false;
  const expected = hasOff ? "watchdog_off" : "watchdog_on";
  return mode === expected;
}

const ALLOWED_TOOLS = new Set(["execute_refund", "issue_refund"]);
const ALLOWED_VERDICTS = new Set(["ALLOW", "ROUTE_TO_HUMAN", "QUARANTINE_AND_ROLLBACK"]);

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

function isStateSnapshot(value: unknown): value is { prompt: string; memory: string[] } {
  return (
    isRecord(value) &&
    typeof value.prompt === "string" &&
    Array.isArray(value.memory) &&
    value.memory.every((m) => typeof m === "string")
  );
}

function normalizeWorkpaperForVerify(raw: JsonRecord): {
  isSnakeCase: boolean;
  workpaperId: unknown;
  metadata: unknown;
  genesis: JsonRecord | null;
  trace: unknown;
  merkleRoot: string;
  auditSeal: unknown;
} {
  const isSnakeCase = "workpaper_id" in raw && !("workpaperId" in raw);
  const rawGenesis = isRecord(raw.genesis) ? raw.genesis : null;
  const genesis = rawGenesis
    ? isSnakeCase
      ? {
          policyHash: rawGenesis.policy_hash,
          promptHash: rawGenesis.prompt_hash,
          hardRules: rawGenesis.hard_rules,
        }
      : rawGenesis
    : null;
  return {
    isSnakeCase,
    workpaperId: isSnakeCase ? raw.workpaper_id : raw.workpaperId,
    metadata: raw.metadata,
    genesis,
    trace: raw.trace,
    merkleRoot: typeof (isSnakeCase ? raw.merkle_root : raw.merkleRoot) === "string"
      ? ((isSnakeCase ? raw.merkle_root : raw.merkleRoot) as string)
      : "",
    auditSeal: isSnakeCase ? raw.audit_seal : raw.auditSeal,
  };
}

function normalizeTraceEvent(raw: unknown, isSnakeCase: boolean): TraceEvent | null {
  if (!isRecord(raw)) return null;
  const candidate = isSnakeCase
    ? {
        ...raw,
        ticketId: raw.ticket_id,
        customerInputHash: raw.customer_input_hash,
        workingPromptHash: raw.working_prompt_hash,
        driftScore: raw.drift_score,
        toolCalled: raw.tool_called,
        toolArgs: raw.tool_args,
        guardEvaluation: raw.guard_evaluation,
        rollbackExecuted: raw.rollback_executed,
        restoredCheckpointHash: raw.restored_checkpoint_hash,
        stepHash: raw.step_hash,
        parentHash: raw.parent_hash,
        againstPolicy: raw.against_policy,
        paidAmount: raw.paid_amount,
        ...(isRecord(raw.policy_inputs)
          ? {
              policyInputs: {
                orderTotal: raw.policy_inputs.order_total,
                hasPhotoEvidence: raw.policy_inputs.has_photo_evidence,
                reviewThreat: raw.policy_inputs.review_threat,
                claimType: typeof raw.policy_inputs.claim_type === "string" ? raw.policy_inputs.claim_type : "goodwill",
              },
            }
          : {}),
      }
    : raw;
  return isTraceEvent(candidate) ? (candidate as TraceEvent) : null;
}

export function verifyWorkpaper(value: unknown): VerifyResult {
  if (!isRecord(value)) return invalidResult("Verification failed: malformed workpaper.");

  const norm = normalizeWorkpaperForVerify(value);
  const merkleRoot = norm.merkleRoot;
  if (
    typeof norm.workpaperId !== "string" ||
    !isRecord(norm.metadata) ||
    !isRecord(norm.genesis) ||
    !Array.isArray(norm.trace) ||
    norm.trace.length === 0 ||
    norm.trace.length > 1000 ||
    norm.auditSeal !== "CONSISTENCY_CHECKED"
  ) {
    return invalidResult("Verification failed: malformed or empty workpaper.", merkleRoot);
  }

  const metadata = norm.metadata;
  const genesis = norm.genesis;
  const normalizedEvents = norm.trace.map((e) => normalizeTraceEvent(e, norm.isSnakeCase));
  const formatMatch = hasBoundDemoMode(norm.workpaperId, metadata.mode) &&
    isHash(merkleRoot) &&
    isHash(genesis.policyHash) &&
    isHash(genesis.promptHash) &&
    isRecord(genesis.hardRules) &&
    isFiniteNumber(genesis.hardRules.max_amount) &&
    typeof genesis.hardRules.require_evidence === "boolean" &&
    normalizedEvents.every((e): e is TraceEvent => e !== null);

  if (!formatMatch) return invalidResult("Verification failed: malformed workpaper fields.", merkleRoot);

  const expectedGenesisPromptHash = norm.isSnakeCase ? PYTHON_GENESIS_PROMPT_HASH : genesisPromptHash();
  const expectedGenesisPolicyHash = norm.isSnakeCase
    ? sha256(pythonCanonicalJson({ max_amount: 20, require_evidence: true }))
    : genesisPolicyHash();
  let policyBytesHash: string;
  try {
    policyBytesHash = norm.isSnakeCase ? sha256(pythonCanonicalJson(genesis.hardRules)) : hashJson(genesis.hardRules);
  } catch {
    return invalidResult("Verification failed: malformed genesis hard rules.", merkleRoot);
  }
  const genesisMatch =
    policyBytesHash === genesis.policyHash &&
    genesis.policyHash === expectedGenesisPolicyHash &&
    genesis.promptHash === expectedGenesisPromptHash;

  const runningHashes: string[] = [];
  const failedSteps: number[] = [];
  let guardReplayMatch = true;
  let hashChainMatch = true;
  let expectedParentHash: string | null = expectedGenesisPromptHash;
  let prevStateAfter: { prompt: string; memory: string[] } | null = null;
  const maxAllowed = (genesis.hardRules as JsonRecord).max_amount as number;

  for (let idx = 0; idx < normalizedEvents.length; idx++) {
    const event = normalizedEvents[idx]!;
    const rawEvent = norm.trace[idx] as JsonRecord;
    if (event.step !== idx + 1) {
      hashChainMatch = false;
      failedSteps.push(event.step);
    }
    if (event.parentHash !== expectedParentHash) {
      hashChainMatch = false;
      failedSteps.push(event.step);
    }

    // Preserve forward-compatible event fields: only the step hash itself is excluded.
    const rawPayload = { ...rawEvent };
    delete rawPayload[norm.isSnakeCase ? "step_hash" : "stepHash"];
    let computed: string;
    try {
      computed = norm.isSnakeCase ? sha256(pythonCanonicalJson(rawPayload)) : stepPayloadHash(rawPayload);
    } catch {
      return invalidResult("Verification failed: non-JSON event data.", merkleRoot);
    }
    runningHashes.push(computed);
    if (computed !== event.stepHash) {
      hashChainMatch = false;
      failedSteps.push(event.step);
    }

    if (!ALLOWED_TOOLS.has(event.toolCalled) || !ALLOWED_VERDICTS.has(event.verdict)) {
      guardReplayMatch = false;
      failedSteps.push(event.step);
    }

    const overHardCap = Math.round(event.toolArgs.amount * 100) > Math.round(maxAllowed * 100);
    if (event.policyInputs !== undefined || norm.workpaperId.startsWith("WP-LIVE-")) {
      const replay = evaluateActionGuard({ ...event.policyInputs, amount: event.toolArgs.amount } as ActionGuardInput);
      if (replay.reason === "INVALID_ACTION_INPUT" || replay.evaluation !== event.guardEvaluation ||
          (metadata.mode === "watchdog_on" && !replay.ok && event.paidAmount !== 0)) {
        guardReplayMatch = false;
        failedSteps.push(event.step);
      }
    }

    // Layer 2 & Layer 3 + State Transition + Jev containment replay when state fields are present
    const isLiveWorkpaper = norm.workpaperId.startsWith("WP-LIVE-");
    const rawProposed = rawEvent.proposedState ?? rawEvent.proposed_state;
    const rawBefore = rawEvent.stateBefore ?? rawEvent.state_before;
    const rawAfter = rawEvent.stateAfter ?? rawEvent.state_after;
    if (rawProposed !== undefined || isLiveWorkpaper) {
      if (!isStateSnapshot(rawProposed) || hashPrompt(rawProposed.prompt) !== event.workingPromptHash) {
        guardReplayMatch = false;
        failedSteps.push(event.step);
      } else {
        const driftReplay = calculateDrift(rawProposed.prompt, rawProposed.memory);
        if (
          metadata.mode === "watchdog_on" &&
          (driftReplay.driftScore >= 0.5 || driftReplay.weakenedRules.length > 0) &&
          (!event.rollbackExecuted || event.verdict !== "QUARANTINE_AND_ROLLBACK")
        ) {
          guardReplayMatch = false;
          failedSteps.push(event.step);
        }
      }
    }
    if (rawBefore !== undefined || rawAfter !== undefined || isLiveWorkpaper) {
      if (!isStateSnapshot(rawBefore) || !isStateSnapshot(rawAfter)) {
        guardReplayMatch = false;
        failedSteps.push(event.step);
      } else {
        if (idx === 0) {
          if (hashPrompt(rawBefore.prompt) !== expectedGenesisPromptHash || rawBefore.memory.length !== 0) {
            guardReplayMatch = false;
            failedSteps.push(event.step);
          }
        } else if (
          prevStateAfter &&
          (rawBefore.prompt !== prevStateAfter.prompt || hashJson(rawBefore.memory) !== hashJson(prevStateAfter.memory))
        ) {
          guardReplayMatch = false;
          failedSteps.push(event.step);
        }
        if (event.rollbackExecuted) {
          if (
            hashPrompt(rawAfter.prompt) !== event.restoredCheckpointHash ||
            hashPrompt(rawAfter.prompt) !== expectedGenesisPromptHash ||
            rawAfter.memory.length !== 0
          ) {
            guardReplayMatch = false;
            failedSteps.push(event.step);
          }
        } else if (event.verdict === "ALLOW" && isStateSnapshot(rawProposed)) {
          if (rawAfter.prompt !== rawProposed.prompt || hashJson(rawAfter.memory) !== hashJson(rawProposed.memory)) {
            guardReplayMatch = false;
            failedSteps.push(event.step);
          }
        } else if (event.verdict === "ROUTE_TO_HUMAN") {
          if (rawAfter.prompt !== rawBefore.prompt || hashJson(rawAfter.memory) !== hashJson(rawBefore.memory)) {
            guardReplayMatch = false;
            failedSteps.push(event.step);
          }
        }
        prevStateAfter = rawAfter;
      }
    }
    if (rawEvent.paymentExecuted !== undefined || rawEvent.payment_executed !== undefined || isLiveWorkpaper) {
      const paymentExecuted = rawEvent.paymentExecuted ?? rawEvent.payment_executed;
      if (typeof paymentExecuted !== "boolean" || (paymentExecuted && (event.paidAmount === 0 || event.verdict !== "ALLOW"))) {
        guardReplayMatch = false;
        failedSteps.push(event.step);
      }
    }
    if ((rawEvent.humanReview !== undefined || isLiveWorkpaper) && metadata.mode === "watchdog_on") {
      const expectedReview = event.verdict === "ALLOW" ? "not_required" : "queued_local_review";
      if (rawEvent.humanReview !== expectedReview) {
        guardReplayMatch = false;
        failedSteps.push(event.step);
      }
    }
    if ((rawEvent.jev !== undefined || isLiveWorkpaper) && metadata.mode === "watchdog_on") {
      if (!isRecord(rawEvent.jev)) {
        guardReplayMatch = false;
        failedSteps.push(event.step);
      } else {
        const jev = rawEvent.jev;
        if (!validRecordedJev(jev)) {
          guardReplayMatch = false;
          failedSteps.push(event.step);
        }
        const probs = isRecord(jev.probabilities) ? jev.probabilities : null;
        if (jev.choice === "quarantine" && (!event.rollbackExecuted || event.verdict !== "QUARANTINE_AND_ROLLBACK")) {
          guardReplayMatch = false;
          failedSteps.push(event.step);
        }
        if (
          (!validJevDecision(jev) ||
            jev.status !== "succeeded" ||
            jev.choice !== "allow" ||
            typeof jev.confidence !== "number" ||
            jev.confidence < 0.8 ||
            !probs ||
            typeof probs.allow !== "number" ||
            probs.allow < 0.8) &&
          event.verdict === "ALLOW"
        ) {
          guardReplayMatch = false;
          failedSteps.push(event.step);
        }
      }
    }

    if (overHardCap && event.guardEvaluation !== "BLOCKED_BY_ACTION_GUARD") {
      guardReplayMatch = false;
      failedSteps.push(event.step);
    }
    if (metadata.mode === "watchdog_on") {
      if (overHardCap && event.paidAmount !== 0) {
        guardReplayMatch = false;
        failedSteps.push(event.step);
      }
      if (event.guardEvaluation === "BLOCKED_BY_ACTION_GUARD" && (event.paidAmount !== 0 || event.verdict === "ALLOW")) {
        guardReplayMatch = false;
        failedSteps.push(event.step);
      }
      if (event.verdict !== "ALLOW" && event.paidAmount !== 0) {
        guardReplayMatch = false;
        failedSteps.push(event.step);
      }
      if (event.againstPolicy && event.paidAmount !== 0) {
        guardReplayMatch = false;
        failedSteps.push(event.step);
      }
      if (event.rollbackExecuted && (event.paidAmount !== 0 || event.verdict === "ALLOW")) {
        guardReplayMatch = false;
        failedSteps.push(event.step);
      }
    }
    if (Math.round(event.paidAmount * 100) > Math.round(event.toolArgs.amount * 100)) {
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
  const merkleMatch = computedMerkleRoot === merkleRoot;
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
    expectedMerkleRoot: merkleRoot,
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
        <td>${escapeHtml(e.step)}</td>
        <td>#${escapeHtml(e.ticketId)}</td>
        <td>€${escapeHtml(e.toolArgs.amount.toFixed(2))}</td>
        <td>${escapeHtml(e.guardEvaluation)}</td>
        <td>${escapeHtml(e.verdict)}</td>
        <td>${escapeHtml(e.driftScore.toFixed(2))}</td>
        <td><code>${escapeHtml(e.stepHash.slice(0, 16))}</code></td>
      </tr>`,
    )
    .join("");
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escapeHtml(wp.workpaperId)}</title>
<style>
  body { font-family: ui-monospace, monospace; background: #07080c; color: #e8e4d9; padding: 32px; }
  h1 { color: #ff7a1a; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #2a2e38; padding: 6px 8px; text-align: left; }
  .ok { color: #4ade80; } .bad { color: #ff4d6d; }
</style></head>
<body>
  <h1>SAAF-VERIFY · ${escapeHtml(wp.workpaperId)}</h1>
  <p>${escapeHtml(wp.auditStandard)}</p>
  <p>Entity: ${escapeHtml(wp.metadata.entity)} · System: ${escapeHtml(wp.metadata.system)}</p>
  <p>Genesis policy hash: <code>${escapeHtml(wp.genesis.policyHash)}</code></p>
  <p>Merkle root: <code>${escapeHtml(wp.merkleRoot)}</code></p>
  <p class="${verification.ok ? "ok" : "bad"}">${escapeHtml(verification.message)}</p>
  <table>
    <thead><tr><th>Step</th><th>Ticket</th><th>Amount</th><th>Guard</th><th>Verdict</th><th>Drift</th><th>Hash</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;
}
