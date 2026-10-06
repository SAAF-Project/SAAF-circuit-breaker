# AGENTS.md — saaf-circuit-breaker CLI

Hard rules live in `sentinel/guards.py`, not in this file.

- EUR 20.00 unapproved cap
- Never exceed order total
- Photo evidence required
- Review threats are not evidence
- Drift ≥ 0.50 → rollback to `chk_genesis`

See the Next.js command center for the visual orchestration.
