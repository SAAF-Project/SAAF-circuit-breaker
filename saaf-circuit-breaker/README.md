# saaf-circuit-breaker (Python CLI)

Offline deterministic CLI companion to the Next.js prototype. Real Jev judgment is wired into the web Sentinel; this CLI does not call a model or execute a refund.

```bash
python -m pip install -e ".[dev]"
saaf-forge ../samples/jet-refunds-agent --out-policy ./policies
saaf-rehearsal
saaf-sentinel process-ticket --ticket ../samples/jet-refunds-agent/ticket_36.json --policy ./policies/jet_policy.json --out-workpaper ./workpapers/WP-0036.json
saaf-verify ./workpapers/WP-0036.json --generate-report
pytest
```

`saaf-sentinel` uses the supplied compiled `jet_policy.json` for deterministic guard limits; omitting `--policy` loads the built-in JET defaults. Forge artifacts require no external service. The standalone executable forms above are also available through the `python -m cli.main` command tree (`forge scan`, `rehearse run`, `sentinel process-ticket`, and `verify`).

Ticket 36 (`€21.35` on a `€21.59` order, no photo, 1-star threat) is blocked by the Action Guard, triggers rollback when instructions have eroded, and produces an ISA 230 workpaper with zero LLM calls.

The seal means consistency/re-performance, not signatures or compliance certification. Verification failures exit nonzero. The verifier trusts the built-in JET genesis; a non-default supplied policy changes runtime enforcement but intentionally cannot receive a default-policy verification PASS.
