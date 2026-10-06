# Verified hackathon build

## Running demo

Production web server: http://127.0.0.1:3189/ (local-only).
Original project repaired in place: `/Users/brightech/Downloads/saaf-circuit-breaker-prototype`.
Python executables are installed in `saaf-circuit-breaker/.venv/bin/`.

## Executed acceptance checks

- Fresh Python 3.11 editable installation succeeded.
- **34 Python tests passed**, including raw runtime input rejection, event mutations, malformed verifier fields, order-total replay, and nonzero verification-failure exit.
- **13 TypeScript tests passed**, including HTTP validation, provider-error/invalid-choice fail-closed behavior, deterministic veto of a model allow, persisted rollback and concurrent session serialization.
- Typecheck passed. ESLint passed with **11 existing image-optimization warnings**, zero errors. Production Next.js build passed.
- `scripts/verify-live.mjs` passed **26 checks** against the production server: routes, seven SVG assets, invalid inputs, malformed JSON, repeatable persisted rehearsals, real Jev judgment, exact rollback/workpaper readback, and a forged verdict rejected by verification.
- Real upstream responses identified **jev-1.13.0**. The production UI displayed the real result, restored the editor prompt/memory, and linked the committed workpaper; no captured runtime errors.
- Sentinel mobile layout measured **390px viewport / 390px content** after fixing intrinsic text/grid overflow.
- The exact installed Sentinel and Verify commands processed ticket #36 with a generated policy and emitted a verified JSON workpaper plus HTML report.
- The canonical Python scanner now detects all six categories, including the previously missed tool-registry subscript call.

Machine-readable live evidence: `live-check-778ce7c8-8c54-43ff-9019-249f04e61121.json`.
Offline CLI evidence: `WP-0036.json`, `WP-0036.html`, and `policy/`.
Repeat the side-effecting local web gate with `node scripts/verify-live.mjs http://127.0.0.1:3189`.

## Fixed defects and boundaries

Full-event canonical hashes cover decision/rollback/payment/context fields, enforce trusted genesis and parent linkage, and replay available policy inputs. Empty/malformed traces fail. Legacy partial-hash seals are not accepted or silently migrated to trust.
The live endpoint now performs a real transactional **local** state transition: server-owned healthy checkpoint, restored active prompt and memory, event/checkpoint records and workpaper. A response label alone is not used as rollback evidence.
Both HTTP and Python runtime paths validate raw values without string/boolean coercion; money is bounded, finite, nonnegative and compared in cents.
Jev is a server-only typed judgment adapter with a bounded timeout. Its allow cannot override deterministic guards. Invalid, unavailable or uncertain judgment halts for local human review. The real benign-action probe returned a low-confidence allow and was conservatively routed to review; no claim is made that model confidence is calibrated.
Repeated rehearsal writes no longer fail on the stable workpaper key. Run IDs are collision-resistant and persistence is transactional.
The obsolete credential-bearing Drizzle JSON configuration was removed in favor of an environment-based TypeScript configuration. Jev credentials were not copied into application source or client bundles.

This is a **local hackathon prototype**, not a certified production financial system: no external refunds or external agent state are actuated, review evidence is a local queue rather than a delivered reviewer notification, and the UI lacks production authentication.
Rehearsal is a deterministic MiroFish-inspired scenario, not upstream MiroFish execution. Python CLI is the offline companion; real Jev calls are in the web Sentinel.
Hashes demonstrate consistency/re-performance, not signatures or producer authenticity. Regulatory frameworks remain alignment targets, not compliance certification. Custom Python policies alter runtime enforcement but require an explicitly approved trust-binding extension to verify against a non-default genesis.

## Startup requirements

The running server has server-only credentials loaded from the existing Hermes configuration and uses the isolated local audit PostgreSQL instance at port 55439. The cached local launch helper is `/Users/brightech/.hermes/cache/scratch/saaf-local-run.mjs`; it is not portable infrastructure and scratch files can expire.
For a portable restart, configure your own `DATABASE_URL` and `TYPESAFE_API_KEY` or `JEV_API_KEY` in the process environment, provision schema with the documented scripts, and use `npm start -- --hostname 127.0.0.1 --port 3189`. The application source, dependency lockfile, tests, migration, artifacts and setup documentation are in the original project directory.
