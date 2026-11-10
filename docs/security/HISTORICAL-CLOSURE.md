# Historical findings — remediation and remaining blockers

Date: 2026-11-10. Branch: `arena/823d707d-saaf-circuit-breaker`, based on `375420097f51fc88a8caa28223b977e74e917f65`.

**This is not a claim that every cross-repository historical finding is closed.** The repository-local changes below have deterministic regression evidence. External infrastructure, legal decisions, other repositories and independently executed CI/deployment checks remain explicitly open. No production configuration was changed, no signing/private credentials were requested, no Git history was rewritten, and no media or software release was published.

## Closure matrix

| Historical finding | Current disposition | Evidence / outstanding requirement |
|---|---|---|
| Phrase-preserving instruction waiver | Fixed by fail-closed approved-content binding | TypeScript/Python reject every unapproved prompt hash, even benign paraphrases. Exact waiver and paraphrase fixtures score >=0.5 and roll back. This is deliberately NOT a claim of semantic entailment; a model judge is never the sole authority. |
| Unsigned/self-asserted trust anchors | Partial; infrastructure and other repositories OPEN | Ed25519 verification binds the complete document digest, reviewer identity, commit SHA and bounded expiry to an independently administered public key. API can require attestations. CI rejects reviewed/Tested claims with absent/malformed/untrusted evidence. KMS signing and nightly WORM anchoring are NOT provisioned. Portal/living-map badge sources were not modified or verified. |
| Split-refund aggregate cap | Fixed for the demo's stable order-reference boundary | Shared PostgreSQL authorization budget is checked/incremented in the commit transaction across sessions/workers. Three concurrent EUR19.99 calls on one EUR100 order yield one ALLOW and two human routes. Python has atomic SQLite reservations; CLI uses a persistent ledger across invocations. Authenticated order lookup and real payment reconciliation remain integration requirements. |
| Blackmail with photo | Fixed | Both guards route review threats regardless of evidence. Unit/runtime tests cover both photo cases. |
| Broken tests / no CI | Implemented and locally validated; GitHub execution pending | Tests pass without DATABASE_URL and on real disposable PostgreSQL. Each external-DB test file gets a new database, never resets the caller's DB. Workflow adds PostgreSQL service, JS/Python tests, lint/typecheck/build, audit and assurance gate. CI cannot be described as green on main until this branch is merged and that workflow actually succeeds. |
| Critical/high dependencies | Fixed in THIS checkout; other apps OPEN | Next and eslint-config-next upgraded to 16.4.6, PostCSS upgraded and lockfile refreshed. Fresh npm audit: zero high/critical; moderate transitive toolchain findings remain. Dependabot added. saaf-portal's Next/Auth/Vitest dependencies were not audited or modified. No deployed route reachability was probed. |
| Root permissions.yaml not consumed | Fixed | Root file removed. `forge/policy.json` is the shared TypeScript/Python runtime authority; generated YAML is an export artifact only. Python package data includes the policy JSON. |
| Unauthenticated / GET seed writes | Fixed in code | GET seed is 405; explicit POST requires SAAF_ENABLE_SEED=true and is idempotent under an advisory lock. Production proxy requires operator authentication. Read pages/list APIs no longer implicitly seed/reset business fixtures. Development mode is not a public deployment mode. |
| Committed media / history size | OPEN | Existing ~35.7MB tracked videos are unchanged. Moving to release assets or LFS requires a destination/quota decision and updating public-site references. GitHub Pages does not transparently serve LFS pointers as video. A normal migration will not remove old blobs from Git history; history rewriting requires separate explicit coordination. |
| Duplicated authoritative cap | Fixed for runtime authority | TS genesis, guard/replay/build and Python compiler/guard/replay import one packaged policy manifest. Human-gate cap derives from it. Approved templates interpolate it. Remaining literal amounts in historical workpapers, recorded media, sample attacks and example scenarios are evidence/examples, NOT alternative governing inputs. |
| Missing licence | OPEN — owner decision | No reuse licence has been invented on the copyright holder's behalf. Owner must select terms (e.g. MIT or Apache-2.0) and confirm authority to license code and separately supplied media. Other listed repositories require separate review. |
| Portal prohibitive licence | OPEN — outside checkout | Portal licence was neither read nor changed here. Requires owner-approved terms and work in that repository. |
| Public claim / limitations mismatch | Fixed in checked-in README and demo sources | README stale no-auth claim removed; visible limitation paragraphs added to Next page and both public redirect pages. Automatic redirects removed so disclosure can be read. Discloses exact-hash control, heuristic scanning, no external payments, unsigned consistency, deployment revision uncertainty. EU AI Act compliance is not certified by this change. |

## Runtime and deployment instructions

1. Install the updated lockfile with `npm ci`. Apply `npm run db:migrate` on an existing PostgreSQL deployment (adds order_budgets without deleting records); fresh schema provisioning still requires the repository's database setup procedure.
2. Live intercept requests now require `orderId` matching `[A-Za-z0-9][A-Za-z0-9_-]{0,127}`. Reuse the SAME stable order reference across all refund attempts. A changed order total for an existing reference is rejected. Caller-supplied prior authorized amounts are ignored; DB state governs.
3. ALLOW reserves cents even though this demo makes no payments. Budgets survive session expiry, reseeding and evidence retention. They are not automatically released/evicted; the 10,000-order limit fails closed. Real integration must resolve identity/total from authenticated order records, atomically reconcile payment results, and account for every refund path. Inventing a new ID per attempt is not order ownership.
4. Python CLI uses `SAAF_BUDGET_DB` or `.saaf/order-budgets.sqlite`. Keep the ledger stable/private across invocations. A default in-memory runtime is only for one-process simulation; inject a shared persistent ledger for service use. Do not delete/reinitialize ledger files to bypass caps.
5. Explicit fixture initialization: authenticated POST `/api/seed` with `SAAF_ENABLE_SEED=true`; repeated calls do not reset state. Disable the flag afterward. GET pages no longer seed automatically, so an uninitialized list can legitimately be empty.
6. Workpaper authenticity is separate from consistency. POST `/api/verify` accepts `{workpaper, attestation}`. Set `SAAF_REQUIRE_ATTESTATION=true` to reject unsigned/untrusted documents; configure `SAAF_REVIEW_PUBLIC_KEYS_JSON` with public keys and reviewer identities outside PR-controlled content. The app contains NO private signer or KMS credentials. Default unsigned demonstrations remain explicitly unauthenticated.
7. Attestation signed message is the UTF-8 JSON array `["saaf-attestation-v1", keyId, reviewer, commitSha, issuedAt, expiresAt, digest]`; digest is SHA-256 over the full workpaper's recursively key-sorted canonical JSON. Keys must be Ed25519; expiry must be after issue, in the future and no more than 90 days later. Expected source commit and signing policy must be checked by the independent signer. This verifies attribution, not the truth of every recorded event.
8. `assurance-claims.json` intentionally starts EMPTY: no reviewed/Tested claim is implied. CI's `scripts/check-assurance-claims.mjs` requires reviewer, commit SHA, artifact path/digest, key ID, issue/expiry and signature from the external trusted-key registry. The claim signature covers the sorted claim payload excluding signature. A trusted reviewer/registry and branch-protection governance must exist independently; repo owners can otherwise change their own checks. Do not pretend this script retroactively fixes external portal/map feeds.
9. Provision and test the actual external signer/KMS and immutable object store, access separation, expiry/key revocation, failed-anchor alerts and recovery before closing the cryptographic infrastructure finding. No external services were assumed or created.

## Validation

See `historical-validation.json` for final counts/results. Commands:

```sh
scripts/security-sandbox.sh   # offline Linux source/toolchain isolation, PGlite + Python + build
DATABASE_URL=postgresql://... npm test  # requires a disposable test server and CREATEDB role
npm audit --audit-level=high
node scripts/check-assurance-claims.mjs
```

The external-DB runner creates and drops ONLY randomized `saaf_test_*` databases, bootstraps the static schema there, and closes connections. Use an ephemeral server, not a production administrator account. Local PostgreSQL validation used an npm-distributed PostgreSQL binary on loopback with dummy fixtures; CI uses PostgreSQL 17. Forward migrations were executed twice on a disposable database to check idempotence. A newly generated Python CLI cumulative-budget workpaper was also verified in TypeScript.

New regressions: `tests/historical-findings.test.ts` and `saaf-circuit-breaker/tests/test_historical_findings.py`. They cover waiver/paraphrase mutation, blackmail with photo, split amounts, concurrent/session-independent reservations, CLI persistence, opt-in/idempotent seed/read-only lists, reviewer signatures, unsigned authenticity rejection, and failing/passing CI assurance records. Existing cross-stack recorded fixtures remain accepted.

## Decisions/access still required to close the WHOLE list

- Owner selects the code licence and media terms; separate portal/multi-repository changes need their own authorization and reviews.
- Owner chooses LFS vs release/object-storage hosting, quota and old-history migration policy. Existing published video links must stay functional during migration.
- Operator provisions independent signing/KMS/WORM infrastructure and trust governance, then supplies non-secret configuration/test evidence.
- CI must actually run on the PR/main revision; deployment revision and real access controls must be separately verified. Independent review is still not available in this session.
