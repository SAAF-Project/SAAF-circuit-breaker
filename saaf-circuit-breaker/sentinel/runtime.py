"""Tool interceptor & container freeze handler."""

from __future__ import annotations

from typing import Any
import sqlite3

from forge.compiler import CompiledPolicyBundle, GENESIS, compile_policy, sha
from sentinel.auditors import calculate_drift
from sentinel.checkpoint import CheckpointState, restore
from sentinel.guards import action_guard
from sentinel.budgets import OrderBudgets
import re


class SAAFSentinelRuntime:
    def __init__(self, policy: CompiledPolicyBundle | None = None, genesis_prompt: str = GENESIS, budgets: OrderBudgets | None = None):
        self.budgets = budgets or OrderBudgets()
        self.policy = policy or compile_policy()
        self.last_healthy_checkpoint = CheckpointState(
            checkpoint_id="chk_genesis",
            prompt_content=genesis_prompt,
            prompt_hash=self.policy.genesis_prompt_hash,
            memory_snapshot=[],
            timestamp="2026-10-06T09:00:00Z",
        )

    def intercept_and_evaluate(self, tool_name, tool_args, order_context, current_prompt, current_memory):
        if not isinstance(order_context, dict) or not isinstance(tool_args, dict):
            return {"verdict": "ROUTE_TO_HUMAN", "action": "HALT", "reason": "INVALID_RUNTIME_INPUT", "guard_evaluation": "BLOCKED_BY_ACTION_GUARD", "drift_score": 1.0}
        # Existing scenario ticket IDs are stable local order references; real integrations must supply order_id.
        ref = order_context.get("order_id", tool_args.get("ticket_id"))
        if isinstance(ref, bool) or not isinstance(ref, (str, int)) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", str(ref)):
            return {"verdict": "ROUTE_TO_HUMAN", "action": "HALT", "reason": "ORDER_ID_REQUIRED", "guard_evaluation": "BLOCKED_BY_ACTION_GUARD", "drift_score": 1.0}
        # Validate before touching SQLite (NaN, bool and malformed totals are not authority).
        preflight = action_guard(tool_args.get("amount"), order_context.get("order_total"), order_context.get("has_photo_evidence", False), order_context.get("review_threat", False), self.policy.hard_rules.max_unapproved_amount_eur)
        if preflight.reason == "INVALID_GUARD_INPUT":
            return {"verdict": "ROUTE_TO_HUMAN", "action": "HALT", "reason": preflight.reason, "guard_evaluation": preflight.evaluation, "drift_score": 1.0}
        try:
            with self.budgets.locked(str(ref), order_context.get("order_total")) as prior:
                result = self._evaluate(tool_name, tool_args, order_context, current_prompt, current_memory, prior)
                if result["verdict"] == "ALLOW":
                    self.budgets.reserve(str(ref), tool_args["amount"])
                return {**result, "order_id": str(ref), "already_authorized": prior, "authorization_reserved": result["verdict"] == "ALLOW"}
        except (ValueError, sqlite3.Error):
            return {"verdict": "ROUTE_TO_HUMAN", "action": "HALT", "reason": "ORDER_BUDGET_UNAVAILABLE", "guard_evaluation": "BLOCKED_BY_ACTION_GUARD", "drift_score": 1.0}

    def _evaluate(
        self,
        tool_name: str,
        tool_args: dict[str, Any],
        order_context: dict[str, Any],
        current_prompt: str,
        current_memory: list[str],
        already_authorized: float = 0.0,
    ) -> dict[str, Any]:
        if (
            not isinstance(tool_name, str)
            or not tool_name.strip()
            or not isinstance(tool_args, dict)
            or not isinstance(order_context, dict)
            or not isinstance(current_prompt, str)
            or len(current_prompt) > 20000
            or not isinstance(current_memory, list)
            or len(current_memory) > 100
            or not all(isinstance(lesson, str) and len(lesson) <= 2000 for lesson in current_memory)
        ):
            return {
                "verdict": "ROUTE_TO_HUMAN",
                "reason": "INVALID_RUNTIME_INPUT",
                "drift_score": 1.0,
                "action": "HALT",
                "guard_evaluation": "BLOCKED_BY_ACTION_GUARD",
            }
        if tool_name == "rewrite_instructions":
            restored_prompt, restored_mem = restore(self.last_healthy_checkpoint)
            return {
                "verdict": "QUARANTINE_AND_ROLLBACK",
                "reason": "FORBIDDEN_TOOL_REWRITE_INSTRUCTIONS",
                "drift_score": 1.0,
                "weakened_rules": ["unauthorized_prompt_mutation"],
                "restored_checkpoint_id": self.last_healthy_checkpoint.checkpoint_id,
                "action": "ROLLBACK",
                "guard_evaluation": "BLOCKED_BY_ACTION_GUARD",
                "restored_prompt": restored_prompt,
                "restored_memory": restored_mem,
            }
        if tool_name != "execute_refund":
            return {
                "verdict": "ROUTE_TO_HUMAN",
                "reason": "UNAUTHORIZED_TOOL_CALL",
                "drift_score": 1.0,
                "action": "HALT",
                "guard_evaluation": "BLOCKED_BY_ACTION_GUARD",
            }
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
            self.policy.hard_rules.max_unapproved_amount_eur, already_authorized,
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

        if (
            drift.drift_score == 0.0
            and not drift.weakened_rules
            and sha(current_prompt.strip()) == self.policy.genesis_prompt_hash
            and len(current_memory) == 0
        ):
            self.last_healthy_checkpoint = CheckpointState(
                checkpoint_id=f"chk_{tool_args.get('ticket_id', 'ok')}",
                prompt_content=current_prompt,
                prompt_hash=sha(current_prompt.strip()),
                memory_snapshot=list(current_memory),
            )

        return {
            "verdict": "ALLOW",
            "drift_score": drift.drift_score,
            "action": "PROCEED",
            "guard_evaluation": guard.evaluation,
        }
