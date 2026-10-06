import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/verify/route";
import {
  buildWorkpaper,
  computeTraceHash,
  type TraceEvent,
  type Workpaper,
  verifyWorkpaper,
} from "../src/lib/ledger";
import { genesisPromptHash } from "../src/lib/policy";
import { sha256 } from "../src/lib/hash";

function makeWorkpaper(mode: "watchdog_on" | "watchdog_off"): Workpaper {
  const amount = 21.35;
  const eventBase: Omit<TraceEvent, "stepHash"> = {
    step: 1,
    ticketId: 36,
    customerInputHash: sha256("ticket 36 customer input"),
    workingPromptHash: sha256("working prompt"),
    driftScore: 1,
    toolCalled: "execute_refund",
    toolArgs: { amount, currency: "EUR" },
    guardEvaluation: "BLOCKED_BY_ACTION_GUARD",
    verdict: mode === "watchdog_on" ? "ROUTE_TO_HUMAN" : "ALLOW",
    rollbackExecuted: false,
    restoredCheckpointHash: null,
    parentHash: genesisPromptHash(),
    againstPolicy: mode === "watchdog_off",
    paidAmount: mode === "watchdog_on" ? 0 : amount,
  };
  const event = { ...eventBase, stepHash: computeTraceHash(eventBase) };
  return buildWorkpaper({
    workpaperId: mode === "watchdog_on" ? "WP-TEST-ON-0001" : "WP-TEST-OFF-0001",
    mode,
    promptHash: genesisPromptHash(),
    trace: [event],
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

test("integrity v2 accepts the watchdog-on and intentional watchdog-off demonstrations", () => {
  assert.equal(verifyWorkpaper(makeWorkpaper("watchdog_on")).ok, true);
  assert.equal(verifyWorkpaper(makeWorkpaper("watchdog_off")).ok, true);
});

test("integrity v2 rejects every covered event and context mutation without rehashing", () => {
  const baseline = makeWorkpaper("watchdog_on");
  const mutations: Array<[string, (wp: Workpaper) => void]> = [
    ["verdict", (wp) => { wp.trace[0].verdict = "ALLOW"; }],
    ["rollback", (wp) => { wp.trace[0].rollbackExecuted = true; }],
    ["currency", (wp) => { wp.trace[0].toolArgs.currency = "USD"; }],
    ["customer input", (wp) => { wp.trace[0].customerInputHash = sha256("tampered customer input"); }],
    ["parent linkage", (wp) => { wp.trace[0].parentHash = sha256("wrong parent"); }],
    ["paid amount", (wp) => { wp.trace[0].paidAmount = 21.35; }],
    ["added event field", (wp) => { (wp.trace[0] as TraceEvent & Record<string, unknown>).executionChannel = "unreviewed"; }],
    ["genesis prompt", (wp) => { wp.genesis.promptHash = sha256("tampered genesis"); }],
    ["mode", (wp) => { wp.metadata.mode = "watchdog_off"; }],
  ];

  for (const [name, mutate] of mutations) {
    const tampered = clone(baseline);
    mutate(tampered);
    assert.equal(verifyWorkpaper(tampered).ok, false, name);
  }
});

test("integrity v2 rejects empty, malformed, and discontinuous traces", () => {
  const empty = makeWorkpaper("watchdog_on");
  empty.trace = [];
  assert.equal(verifyWorkpaper(empty).ok, false);

  const malformed = makeWorkpaper("watchdog_on") as unknown as { trace: unknown };
  malformed.trace = [{ step: 1 }];
  assert.equal(verifyWorkpaper(malformed).ok, false);

  const discontinuous = makeWorkpaper("watchdog_on");
  discontinuous.trace[0].parentHash = sha256("not the trusted genesis hash");
  assert.equal(verifyWorkpaper(discontinuous).ok, false);
});

test("offline replay rejects a rehashed order-total violation", () => {
  const wp = makeWorkpaper("watchdog_on");
  const event = wp.trace[0] as TraceEvent & { policyInputs: { orderTotal: number; hasPhotoEvidence: boolean; reviewThreat: boolean; claimType: string } };
  event.toolArgs.amount = 10;
  event.paidAmount = 10;
  event.guardEvaluation = "PASSED";
  event.verdict = "ALLOW";
  event.policyInputs = { orderTotal: 20, hasPhotoEvidence: true, reviewThreat: false, claimType: "goodwill" };
  const { stepHash: _old, ...payload } = event;
  event.stepHash = computeTraceHash(payload);
  wp.merkleRoot = event.stepHash;
  assert.equal(verifyWorkpaper(wp).ok, true);
  event.policyInputs.orderTotal = 5;
  const { stepHash: _prior, ...forged } = event;
  event.stepHash = computeTraceHash(forged);
  wp.merkleRoot = event.stepHash;
  assert.equal(verifyWorkpaper(wp).ok, false);
});

test("verify API returns a controlled 400 for malformed JSON", async () => {
  const response = await POST(new Request("http://localhost/api/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not valid json",
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Malformed JSON body" });
});
