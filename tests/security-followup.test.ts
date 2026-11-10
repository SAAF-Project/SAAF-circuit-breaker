import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import { authorizeRequest } from "../src/lib/access";
import { readJsonBody, BodyError } from "../src/lib/http-safety";
import { validJevDecision } from "../src/lib/jev-schema";
import { scanSource, SAMPLE_ROGUE_AGENT } from "../src/lib/forge";
import { pool, db } from "../src/db";
import { sentinelSessions, workpapers } from "../src/db/schema";
import { maintainStorage, enforceQuota, StorageLimitError } from "../src/lib/storage-limits";
import { verifyStoredWorkpaper } from "../src/lib/stored-workpaper";
import { processIntercept } from "../src/lib/live-sentinel";
import { GENESIS_PROMPT } from "../src/lib/genesis";
import { eq, inArray } from "drizzle-orm";
import { POST as intercept } from "../src/app/api/sentinel/intercept/route";
import { GET as listWorkpapers } from "../src/app/api/workpapers/route";
import { seedAll } from "../src/lib/persist";
after(async () => { await pool.end(); });

test("production access fails closed and blocks wrong credentials / cross-site mutations", () => {
  const env = { NODE_ENV: "production", SAAF_OPERATOR_USER: "operator", SAAF_OPERATOR_PASSWORD: "fixture-only-password-at-least-24-characters" };
  const req = (headers = {}, method = "GET") => new Request("https://demo.example/api/workpapers", { method, headers });
  assert.equal(authorizeRequest(req(), { NODE_ENV: "production" })?.status, 503);
  assert.equal(authorizeRequest(req(), env)?.status, 401);
  const headers = { authorization: `Basic ${Buffer.from(`operator:${env.SAAF_OPERATOR_PASSWORD}`).toString("base64")}` };
  assert.equal(authorizeRequest(req(headers), env), null);
  assert.equal(authorizeRequest(req({ ...headers, origin: "https://evil.example" }, "POST"), env)?.status, 403);
  assert.equal(authorizeRequest(req({ ...headers, origin: "https://demo.example" }, "POST"), env), null);
});

test("stream reader bounds actual bytes with no content-length and cancels before parsing", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(32)); }, cancel() { cancelled = true; } });
  const request = new Request("https://demo.example", { method: "POST", body, duplex: "half" } as RequestInit);
  await assert.rejects(readJsonBody(request, 64), (e) => e instanceof BodyError && e.status === 413);
  assert.equal(cancelled, true);
  await assert.rejects(readJsonBody(new Request("https://demo.example", { method: "POST", headers: { "content-length": "9999999" }, body: "{}" }), 64), (e) => e instanceof BodyError && e.status === 413);
});

test("scanner never treats comment/string/dead-code guard/hash names as proof", () => {
  for (const extra of ['# ActionGuard parent_hash', 'marker = "ActionGuard parent_hash"', 'if False:\n    ActionGuard()\n    parent_hash = "dummy"', '// ActionGuard parent_hash', '/* ActionGuard parent_hash */']) {
    const flags = scanSource(SAMPLE_ROGUE_AGENT + "\n" + extra).map((f) => f.flag);
    assert.ok(flags.includes("RULES_ONLY_IN_PROMPT"));
    assert.ok(flags.includes("NO_REPLAYABLE_LOG"));
  }
});

test("Jev schema rejects invalid ranges, missing choices, invalid sum and numeric types", () => {
  const baseline = { status: "succeeded", choice: "allow", confidence: 0.95, probabilities: { allow: 0.95, human: 0.05, quarantine: 0 } };
  assert.equal(validJevDecision(baseline), true);
  for (const mutate of [
    { confidence: 2 }, { confidence: NaN }, { confidence: true }, { choice: "unknown" },
    { probabilities: { allow: 1.1, human: -0.1, quarantine: 0 } },
    { probabilities: { allow: 0.95 } }, { probabilities: { allow: 0.9, human: 0.9, quarantine: 0.9 } },
  ]) assert.equal(validJevDecision({ ...baseline, ...mutate }), false);
});

const input = { amount: 10, orderTotal: 20, hasPhotoEvidence: true, reviewThreat: false, claimType: "goodwill", currentPrompt: GENESIS_PROMPT, currentMemory: [] };
const answer = () => new Response(JSON.stringify({ model: "fixture", answers: { containment: { type: "choice", choice: "allow", confidence: 0.99, probabilities: { allow: 1, human: 0, quarantine: 0 } } } }));

test("slow provider does not hold DB lock; unrelated session completes while first judgment waits", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.JEV_API_KEY;
  process.env.JEV_API_KEY = "fixture-only";
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  globalThis.fetch = async () => { if (++calls === 1) { started(); await gate; } return answer(); };
  try {
    const first = processIntercept({ ...input, orderId: randomUUID(), sessionId: randomUUID() });
    await waiting;
    const second = await Promise.race([
      processIntercept({ ...input, orderId: randomUUID(), sessionId: randomUUID() }),
      new Promise<never>((_, reject) => { const t = setTimeout(() => reject(new Error("unrelated DB work blocked")), 3000); t.unref(); }),
    ]);
    assert.equal(second.persisted, true);
    release();
    assert.equal((await first).persisted, true);
  } finally { release(); globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.JEV_API_KEY; else process.env.JEV_API_KEY = oldKey; }
});

test("tampered DB row cannot inherit cached verified=true; lists paginate", async () => {
  await seedAll();
  const [row] = await db.select().from(workpapers).limit(1);
  assert.equal(verifyStoredWorkpaper(row).ok, true);
  await db.update(workpapers).set({ trace: [], verified: true }).where(eq(workpapers.id, row.id));
  const response = await listWorkpapers(new Request("https://demo.example/api/workpapers?limit=50"));
  const rows = await response.json();
  assert.equal(rows.find((r: { id: string }) => r.id === row.id).verified, false);
  assert.equal((await (await listWorkpapers(new Request("https://demo.example/api/workpapers?limit=1"))).json()).length, 1);
});

test("database quotas reject creation at capacity and retention removes expired sessions", async () => {
  const ids = Array.from({ length: 100 }, () => randomUUID());
  const values = ids.map((id) => ({ id, activePrompt: GENESIS_PROMPT, activeMemory: [], checkpointPrompt: GENESIS_PROMPT, checkpointMemory: [], trace: [], updatedAt: new Date() }));
  await db.insert(sentinelSessions).values(values);
  try {
    await assert.rejects(db.transaction(async (tx) => { await maintainStorage(tx); await enforceQuota(tx, "sessions", randomUUID()); }), StorageLimitError);
    await db.update(sentinelSessions).set({ updatedAt: new Date(0) }).where(eq(sentinelSessions.id, ids[0]));
    await db.transaction(async (tx) => { await maintainStorage(tx); });
    assert.equal((await db.select().from(sentinelSessions).where(eq(sentinelSessions.id, ids[0]))).length, 0);
  } finally { await db.delete(sentinelSessions).where(inArray(sentinelSessions.id, ids)); }
});

test("oversize API request yields 413 before work or persistence", async () => {
  const response = await intercept(new Request("https://demo.example/api/sentinel/intercept", { method: "POST", body: "x".repeat(1_048_577) }));
  assert.equal(response.status, 413);
});
