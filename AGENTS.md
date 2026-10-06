# AGENTS.md — JET Care Refunds (compiled by SAAF-Forge)

Hard rules live in code. This file is documentation, not the control.

## Invariants

- Unapproved refunds cannot exceed EUR 20.00.
- Refunds cannot exceed order total.
- Food-quality claims require a verified photo.
- Review threats are not evidence.
- Drift score ≥ 0.50 triggers rollback to the last healthy checkpoint.

## Forbidden

- Self-editing the genesis prompt.
- Storing CSAT rank in the working context without a balancing guard.
- Tool calls without a parent-hash link.

## Human oversight (EU AI Act Art. 14)

Anything above EUR 20 or any weakened hard rule routes to the Customer Service Lead.

## Runtime

Jev Sentinel evaluates every `execute_refund` tool call with:

1. Action Guard (hard code)
2. Instruction Auditor (genesis diff)
3. Memory Auditor (self-written lessons)

SAAF-Verify re-performs the workpaper with zero LLM calls.
