import assert from "node:assert/strict";
import test from "node:test";
import { evaluateActionGuard, type ActionGuardInput } from "../src/lib/sentinel";

const valid: ActionGuardInput = { amount: 10, orderTotal: 20, hasPhotoEvidence: true, reviewThreat: false, claimType: "goodwill" };

test("action guard fails closed on invalid money and coercible booleans", () => {
  for (const amount of [-1, NaN, Infinity, "10", true, 10.001]) {
    assert.equal(evaluateActionGuard({ ...valid, amount } as ActionGuardInput).ok, false, `amount=${String(amount)}`);
  }
  for (const orderTotal of [-1, NaN, "20", false]) {
    assert.equal(evaluateActionGuard({ ...valid, orderTotal } as ActionGuardInput).ok, false, `total=${String(orderTotal)}`);
  }
  assert.equal(evaluateActionGuard({ ...valid, hasPhotoEvidence: "false" } as unknown as ActionGuardInput).ok, false);
});

test("action guard permits valid cent boundaries and never exceeds either cap", () => {
  assert.equal(evaluateActionGuard({ ...valid, amount: 20 }).ok, true);
  assert.equal(evaluateActionGuard({ ...valid, amount: 20.01 }).ok, false);
  assert.equal(evaluateActionGuard({ ...valid, amount: 10, orderTotal: 9.99 }).ok, false);
  assert.equal(evaluateActionGuard({ ...valid, hasPhotoEvidence: false }).ok, false);
});
