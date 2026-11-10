"""Compile immutable JET hard rules into a policy bundle and artifacts."""

from __future__ import annotations

import hashlib
import json
import math
import re
from pydantic import BaseModel, Field, field_validator

HASH_RE = re.compile(r"^[a-f0-9]{64}$")


class JETHardRules(BaseModel):
    max_unapproved_amount_eur: float = Field(default=20.00, frozen=True)
    cap_to_order_value: bool = Field(default=True, frozen=True)
    require_verified_evidence: bool = Field(default=True, frozen=True)
    filter_review_blackmail: bool = Field(default=True, frozen=True)

    @field_validator("max_unapproved_amount_eur")
    @classmethod
    def _valid_cap(cls, v: float) -> float:
        if isinstance(v, bool) or not math.isfinite(v) or v <= 0 or v > 20.0:
            raise ValueError("max_unapproved_amount_eur must be in (0, 20.00]")
        return v

    @field_validator("cap_to_order_value", "require_verified_evidence", "filter_review_blackmail")
    @classmethod
    def _hard_rules_must_remain_enabled(cls, v: bool) -> bool:
        if v is not True:
            raise ValueError("Hard safety rules cannot be disabled in compiled policy")
        return v


class CompiledPolicyBundle(BaseModel):
    policy_id: str
    genesis_prompt_hash: str
    hard_rules: JETHardRules
    max_drift_threshold: float = 0.50
    require_human_gate_above_eur: float = 20.00

    @field_validator("policy_id")
    @classmethod
    def _valid_policy_id(cls, v: str) -> str:
        if not isinstance(v, str) or not v.strip() or len(v) > 128:
            raise ValueError("policy_id must be a non-empty string")
        return v

    @field_validator("genesis_prompt_hash")
    @classmethod
    def _valid_genesis_hash(cls, v: str) -> str:
        if not isinstance(v, str) or not HASH_RE.fullmatch(v):
            raise ValueError("genesis_prompt_hash must be a 64-character hex SHA-256 digest")
        return v

    @field_validator("max_drift_threshold")
    @classmethod
    def _valid_drift_threshold(cls, v: float) -> float:
        if isinstance(v, bool) or not math.isfinite(v) or v <= 0.0 or v > 0.50:
            raise ValueError("max_drift_threshold must be in (0.0, 0.50]")
        return v

    @field_validator("require_human_gate_above_eur")
    @classmethod
    def _valid_human_gate(cls, v: float) -> float:
        if isinstance(v, bool) or not math.isfinite(v) or v <= 0.0 or v > 20.0:
            raise ValueError("require_human_gate_above_eur must be in (0.0, 20.00]")
        return v


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
