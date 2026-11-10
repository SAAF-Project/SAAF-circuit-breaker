import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { computeTraceHash, verifyWorkpaper, type Workpaper } from "../src/lib/ledger";
import { GENESIS_PROMPT } from "../src/lib/genesis";

function liveFixture(): Workpaper {
  const wp = JSON.parse(readFileSync("docs/sample-workpaper.json", "utf8")) as Workpaper;
  const state = { prompt: GENESIS_PROMPT, memory: [] };
  Object.assign(wp.trace[0], {
    toolArgs: { amount: 10, currency: "EUR" }, paidAmount: 0,
    guardEvaluation: "PASSED", verdict: "ALLOW", rollbackExecuted: false,
    restoredCheckpointHash: null, driftScore: 0.04, humanReview: "not_required",
    policyInputs: { orderTotal: 20, hasPhotoEvidence: true, reviewThreat: false, claimType: "goodwill" },
    stateBefore: state, proposedState: state, stateAfter: state,
    jev: { model: "fixture", error: null, latencyMs: 0, status: "succeeded", choice: "allow", confidence: 0.95, probabilities: { allow: 0.95, human: 0.05, quarantine: 0 } },
  });
  return rehash(wp);
}
function rehash(wp: Workpaper): Workpaper {
  const { stepHash: _old, ...payload } = wp.trace[0];
  wp.trace[0].stepHash = computeTraceHash(payload);
  wp.merkleRoot = wp.trace[0].stepHash;
  return wp;
}

test("audit: live ALLOW replay uses allow probability, not confidence alone", () => {
  const wp = liveFixture();
  assert.equal(verifyWorkpaper(wp).ok, true, JSON.stringify(verifyWorkpaper(wp)));
  Object.assign(wp.trace[0], { jev: { model: "fixture", error: null, latencyMs: 0, status: "succeeded", choice: "allow", confidence: 0.95, probabilities: { allow: 0.1, human: 0.9, quarantine: 0 } } });
  assert.equal(verifyWorkpaper(rehash(wp)).ok, false);
});

test("audit: live mode cannot be downgraded to bypass a blocked payout", () => {
  const wp = liveFixture();
  wp.workpaperId = "WP-LIVE-ON-OFF-0001";
  wp.metadata.mode = "watchdog_off";
  Object.assign(wp.trace[0], { toolArgs: { amount: 21.35, currency: "EUR" }, paidAmount: 21.35,
    againstPolicy: true, guardEvaluation: "BLOCKED_BY_ACTION_GUARD" });
  assert.equal(verifyWorkpaper(rehash(wp)).ok, false);
});
