# UI simplification acceptance

- Preserve the original source and production build on port 3189 unchanged.
- Preserve remote original branch `ui-original-before-simplify` at fb25c81b655b4c5fa36bce45d186cd4bc17abee5.
- All seven native pages remain reachable; mobile navigation must not disappear.
- Keep the current dark palette and typography, but shorten intros and reduce heading dominance.
- One obvious task per page; technical material remains accessible through native disclosures.
- No changes to runtime, policy, database schema, provider adapter, verifier, or API contracts.
- Real live Jev status, local restoration, and evidence links must remain visible after an intercept.
- Production build, TypeScript, existing tests, route checks, actual browser interactions, and mobile overflow checks must pass.
- Start the candidate separately on port 3191; the original app remains available on 3189.
- Change the public Pages origin only after acceptance, and retain a clear original-version fallback.
- If the deadline is exceeded or any material gate fails, leave the current public version in place and report the candidate as unfinished.
