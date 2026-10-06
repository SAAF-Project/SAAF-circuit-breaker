"""Tool interceptor & container freeze handler."""

from __future__ import annotations

from typing import Any

from forge.compiler import CompiledPolicyBundle, GENESIS, compile_policy, sha
from sentinel.auditors import calculate_drift
from sentinel.checkpoint import CheckpointState, restore
from sentinel.guards import action_guard


class SAAFSentinelRuntime:
    def __init__(self, policy: CompiledPolicyBundle | None = None, genesis_prompt: str = GENESIS):
        self.policy = policy or compile_policy()
        self.last_healthy_checkpoint = CheckpointState(
            checkpoint_id="chk_genesis",
            prompt_content=genesis_prompt,
            prompt_hash=self.policy.genesis_prompt_hash,
            memory_snapshot=[],
            timestamp="2026-10-06T09:00:00Z",
        )

    def intercept_and_evaluate(
        self,
        tool_name: str,
        tool_args: dict[str, Any],
        order_context: dict[str, Any],
        current_prompt: str,
        current_memory: list[str],
    ) -> dict[str, Any]:
        if (not isinstance(tool_args, dict) or not isinstance(order_context, dict)
                or not isinstance(current_prompt, str) or not isinstance(current_memory, list)
                or not all(isinstance(lesson, str) for lesson in current_memory)):
            return {"verdict": "ROUTE_TO_HUMAN", "reason": "INVALID_RUNTIME_INPUT",
                    "action": "HALT", "guard_evaluation": "BLOCKED_BY_ACTION_GUARD"}
        # Validate raw values: coercion turns strings and booleans into false authority.
        amount = tool_args.get("amount")
        order_total = order_context.get("order_total")
        has_photo = order_context.get("has_photo_evidence", False)
        threat = order_context.get("review_threat", False)

        guard = action_guard(
            amount,
            order_total,
            has_photo,
            threat,
            self.policy.hard_rules.max_unapproved_amount_eur,
        )
        if not guard.ok:
            return {
                "verdict": "ROUTE_TO_HUMAN",
                "reason": guard.reason,
                "drift_score": 1.0,
                "action": "HALT",
                "guard_evaluation": guard.evaluation,
                "violations": guard.violations,
                "tool_name": tool_name,
            }

        drift = calculate_drift(current_prompt, current_memory)
        if drift.drift_score >= self.policy.max_drift_threshold or drift.weakened_rules:
            restored_prompt, restored_mem = restore(self.last_healthy_checkpoint)
            return {
                "verdict": "QUARANTINE_AND_ROLLBACK",
                "drift_score": drift.drift_score,
                "weakened_rules": drift.weakened_rules,
                "restored_checkpoint_id": self.last_healthy_checkpoint.checkpoint_id,
                "action": "ROLLBACK",
                "guard_evaluation": guard.evaluation,
                "restored_prompt": restored_prompt,
                "restored_memory": restored_mem,
            }

        if drift.drift_score == 0.0:
            self.last_healthy_checkpoint = CheckpointState(
                checkpoint_id=f"chk_{tool_args.get('ticket_id', 'ok')}",
                prompt_content=current_prompt,
                prompt_hash=sha(current_prompt),
                memory_snapshot=list(current_memory),
            )

        return {
            "verdict": "ALLOW",
            "drift_score": drift.drift_score,
            "action": "PROCEED",
            "guard_evaluation": guard.evaluation,
        }
