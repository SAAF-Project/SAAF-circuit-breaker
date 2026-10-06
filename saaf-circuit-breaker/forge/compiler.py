"""Compile immutable JET hard rules into a policy bundle and artifacts."""

from __future__ import annotations

import hashlib
import json
from pydantic import BaseModel, Field


class JETHardRules(BaseModel):
    max_unapproved_amount_eur: float = Field(default=20.00, frozen=True)
    cap_to_order_value: bool = Field(default=True, frozen=True)
    require_verified_evidence: bool = Field(default=True, frozen=True)
    filter_review_blackmail: bool = Field(default=True, frozen=True)


class CompiledPolicyBundle(BaseModel):
    policy_id: str
    genesis_prompt_hash: str
    hard_rules: JETHardRules
    max_drift_threshold: float = 0.50
    require_human_gate_above_eur: float = 20.00


GENESIS = """JET Customer Care Refunds Agent — Genesis Policy (immutable)
HARD RULES: EUR 20.00 max, never exceed order total, photo required, threats don't count.
Escalate anything above EUR 20. CSAT does not override hard rules.
"""


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def compile_policy(policy_id: str = "jet-care-refunds-v1") -> CompiledPolicyBundle:
    return CompiledPolicyBundle(
        policy_id=policy_id,
        genesis_prompt_hash=sha(GENESIS.strip()),
        hard_rules=JETHardRules(),
    )


def permissions_yaml(bundle: CompiledPolicyBundle) -> str:
    r = bundle.hard_rules
    return f"""version: 1
agent: jet-care-refunds
policy_id: {bundle.policy_id}
genesis_prompt_hash: {bundle.genesis_prompt_hash}
permissions:
  execute_refund:
    allow: true
    max_unapproved_amount_eur: {r.max_unapproved_amount_eur:.2f}
    cap_to_order_value: {str(r.cap_to_order_value).lower()}
    require_verified_evidence: {str(r.require_verified_evidence).lower()}
    filter_review_blackmail: {str(r.filter_review_blackmail).lower()}
    on_violation: ROUTE_TO_HUMAN
  rewrite_instructions:
    allow: false
    on_violation: QUARANTINE_AND_ROLLBACK
human_gate:
  above_eur: {bundle.require_human_gate_above_eur:.2f}
  eu_ai_act_art_14: true
"""


def agents_md(bundle: CompiledPolicyBundle) -> str:
    return f"""# AGENTS.md
Policy: {bundle.policy_id}
Hard rules live in code. Drift ≥ {bundle.max_drift_threshold} rolls back to genesis.
"""


def jev_rules(bundle: CompiledPolicyBundle) -> dict:
    return {
        "model": "jev-latest",
        "policy_id": bundle.policy_id,
        "hard_stops": bundle.hard_rules.model_dump(),
        "max_drift_threshold": bundle.max_drift_threshold,
    }


def dump_artifacts(bundle: CompiledPolicyBundle, out_dir) -> None:
    from pathlib import Path

    d = Path(out_dir)
    d.mkdir(parents=True, exist_ok=True)
    (d / "permissions.yaml").write_text(permissions_yaml(bundle), encoding="utf-8")
    (d / "AGENTS.md").write_text(agents_md(bundle), encoding="utf-8")
    (d / "jev_rules.json").write_text(json.dumps(jev_rules(bundle), indent=2), encoding="utf-8")
    (d / "jet_policy.json").write_text(bundle.model_dump_json(indent=2), encoding="utf-8")
