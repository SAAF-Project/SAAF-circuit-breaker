"""Layer 1: Action Guard — hard rules in code, never in the prompt."""

from __future__ import annotations

from dataclasses import dataclass
import math
from numbers import Real
from forge.policy import CAP


@dataclass
class GuardResult:
    ok: bool
    evaluation: str
    reason: str
    violations: list[str]


def action_guard(
    amount: float,
    order_total: float,
    has_photo: bool,
    review_threat: bool,
    max_unapproved: float = CAP,
    already_authorized: float = 0.0,
) -> GuardResult:
    violations: list[str] = []
    money = {
        "amount": amount,
        "order total": order_total,
        "unapproved cap": max_unapproved,
        "already authorized": already_authorized,
    }
    for label, value in money.items():
        finite = isinstance(value, int) or (isinstance(value, Real) and math.isfinite(value))
        if isinstance(value, bool) or not isinstance(value, Real) or not finite:
            violations.append(f"{label} must be a finite number")
        elif value < 0 or (value == 0 and math.copysign(1.0, float(value)) < 0):
            violations.append(f"{label} must be non-negative")
        elif value > 90071992547409.91 or abs(value * 100 - round(value * 100)) > 1e-7:
            violations.append(f"{label} must be safe integer EUR cents")
    if type(has_photo) is not bool:
        violations.append("photo evidence flag must be a boolean")
    if type(review_threat) is not bool:
        violations.append("review-threat flag must be a boolean")
    if violations:
        return GuardResult(False, "BLOCKED_BY_ACTION_GUARD", "INVALID_GUARD_INPUT", violations)

    if round(amount * 100) > round(max_unapproved * 100):
        violations.append(f"amount {amount} exceeds unapproved cap {max_unapproved}")
    if round(amount * 100) > round(order_total * 100):
        violations.append(f"amount {amount} exceeds order total {order_total}")
    if not has_photo and amount > 0:
        violations.append("verified photo evidence missing")
    aggregate = round(amount * 100) + round(already_authorized * 100)
    if aggregate > round(max_unapproved * 100):
        violations.append("aggregate unapproved refund cap exceeded")
    if aggregate > round(order_total * 100):
        violations.append("aggregate refunds exceed order value")
    if review_threat:
        violations.append("review-threat claim requires human review regardless of evidence")
    if violations:
        return GuardResult(False, "BLOCKED_BY_ACTION_GUARD", "HARD_RULE_VIOLATION_ACTION_GUARD", violations)
    return GuardResult(True, "PASSED", "HARD_RULES_INTACT", [])
