"""ISA 230 audit model serializer and deterministic consistency verifier."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

from forge.compiler import GENESIS
from ledger.merkle import hash_json, merkle_root, sha256, step_hash
from sentinel.guards import action_guard

TRUSTED_HARD_RULES = {"max_amount": 20.0, "require_evidence": True}
HASH_RE = re.compile(r"^[a-f0-9]{64}$")


def verify_workpaper_offline(workpaper_path: str) -> bool:
    with open(workpaper_path, "r", encoding="utf-8") as f:
        wp = json.load(f)
    return verify_workpaper(wp)["ok"]


def _is_hash(value: Any) -> bool:
    return isinstance(value, str) and bool(HASH_RE.fullmatch(value))


def _is_number(value: Any) -> bool:
    try:
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
    except OverflowError:
        return False


def _valid_event(event: Any) -> bool:
    if not isinstance(event, dict) or not isinstance(event.get("tool_args"), dict):
        return False
    tool_args = event["tool_args"]
    return (
        isinstance(event.get("step"), int)
        and isinstance(event.get("ticket_id"), int)
        and _is_hash(event.get("customer_input_hash"))
        and _is_hash(event.get("working_prompt_hash"))
        and _is_number(event.get("drift_score"))
        and isinstance(event.get("tool_called"), str)
        and bool(event["tool_called"])
        and _is_number(tool_args.get("amount"))
        and tool_args["amount"] >= 0
        and isinstance(tool_args.get("currency"), str)
        and bool(tool_args["currency"])
        and isinstance(event.get("guard_evaluation"), str)
        and event["guard_evaluation"] in {"PASSED", "BLOCKED_BY_ACTION_GUARD"}
        and isinstance(event.get("verdict"), str)
        and bool(event["verdict"])
        and isinstance(event.get("rollback_executed"), bool)
        and (
            event.get("restored_checkpoint_hash") is None
            or (isinstance(event.get("restored_checkpoint_hash"), str) and bool(event["restored_checkpoint_hash"]))
        )
        and _is_hash(event.get("step_hash"))
        and (event.get("parent_hash") is None or _is_hash(event.get("parent_hash")))
        and isinstance(event.get("against_policy"), bool)
        and _is_number(event.get("paid_amount"))
        and event["paid_amount"] >= 0
    )


def _bound_demo_mode(workpaper_id: Any, mode: Any) -> bool:
    if not isinstance(workpaper_id, str) or not isinstance(mode, str) or mode not in {"watchdog_on", "watchdog_off"}:
        return False
    expected = "watchdog_off" if "-OFF-" in workpaper_id else "watchdog_on" if "-ON-" in workpaper_id else None
    return mode == expected


def _invalid(message: str, expected_merkle_root: str = "") -> dict:
    return {
        "ok": False,
        "format_match": False,
        "genesis_match": False,
        "merkle_match": False,
        "guard_ok": False,
        "hash_chain_match": False,
        "failed_steps": [],
        "computed_merkle_root": merkle_root([]),
        "expected_merkle_root": expected_merkle_root,
        "message": message,
    }


def verify_workpaper(wp: Any) -> dict:
    if not isinstance(wp, dict):
        return _invalid("Verification failed: malformed workpaper.")

    expected_merkle_root = wp.get("merkle_root") if isinstance(wp.get("merkle_root"), str) else ""
    metadata = wp.get("metadata")
    genesis = wp.get("genesis")
    trace = wp.get("trace")
    if (
        not isinstance(wp.get("workpaper_id"), str)
        or not isinstance(metadata, dict)
        or not isinstance(genesis, dict)
        or not isinstance(trace, list)
        or not trace
        or wp.get("audit_seal") != "CONSISTENCY_CHECKED"
    ):
        return _invalid("Verification failed: malformed or empty workpaper.", expected_merkle_root)

    hard_rules = genesis.get("hard_rules")
    format_match = (
        _bound_demo_mode(wp["workpaper_id"], metadata.get("mode"))
        and _is_hash(expected_merkle_root)
        and _is_hash(genesis.get("policy_hash"))
        and _is_hash(genesis.get("prompt_hash"))
        and isinstance(hard_rules, dict)
        and _is_number(hard_rules.get("max_amount"))
        and isinstance(hard_rules.get("require_evidence"), bool)
        and all(_valid_event(event) for event in trace)
    )
    if not format_match:
        return _invalid("Verification failed: malformed workpaper fields.", expected_merkle_root)

    trusted_prompt_hash = sha256(GENESIS.strip())
    genesis_match = (
        hash_json(hard_rules) == genesis["policy_hash"]
        and genesis["policy_hash"] == hash_json(TRUSTED_HARD_RULES)
        and genesis["prompt_hash"] == trusted_prompt_hash
    )

    running: list[str] = []
    failed: list[int] = []
    guard_ok = True
    hash_chain_match = True
    expected_parent_hash: str | None = trusted_prompt_hash
    max_allowed = hard_rules["max_amount"]

    for event in trace:
        if event["parent_hash"] != expected_parent_hash:
            hash_chain_match = False
            failed.append(event["step"])

        try:
            computed = step_hash(event)
        except (TypeError, ValueError, OverflowError):
            return _invalid("Verification failed: non-JSON event data.", expected_merkle_root)
        running.append(computed)
        if computed != event["step_hash"]:
            hash_chain_match = False
            failed.append(event["step"])

        amount = event["tool_args"]["amount"]
        if "policy_inputs" in event:
            inputs = event["policy_inputs"]
            if not isinstance(inputs, dict):
                return _invalid("Verification failed: malformed policy inputs.", expected_merkle_root)
            replay = action_guard(amount, inputs.get("order_total"), inputs.get("has_photo_evidence"),
                                  inputs.get("review_threat"), max_allowed)
            if (replay.reason == "INVALID_GUARD_INPUT" or replay.evaluation != event["guard_evaluation"]
                    or (metadata["mode"] == "watchdog_on" and not replay.ok and event["paid_amount"] != 0)):
                guard_ok = False
                failed.append(event["step"])
        over_hard_cap = amount > max_allowed
        if over_hard_cap and event["guard_evaluation"] != "BLOCKED_BY_ACTION_GUARD":
            guard_ok = False
            failed.append(event["step"])
        if metadata["mode"] == "watchdog_on" and over_hard_cap and event["paid_amount"] != 0:
            guard_ok = False
            failed.append(event["step"])
        if event["paid_amount"] > amount:
            guard_ok = False
            failed.append(event["step"])
        if (
            (event["rollback_executed"] and event["restored_checkpoint_hash"] is None)
            or (not event["rollback_executed"] and event["restored_checkpoint_hash"] is not None)
            or (event["verdict"] == "QUARANTINE_AND_ROLLBACK" and not event["rollback_executed"])
        ):
            guard_ok = False
            failed.append(event["step"])

        expected_parent_hash = event["step_hash"]

    root = merkle_root(running)
    merkle_match = root == expected_merkle_root
    ok = genesis_match and guard_ok and hash_chain_match and merkle_match
    return {
        "ok": ok,
        "format_match": format_match,
        "genesis_match": genesis_match,
        "merkle_match": merkle_match,
        "guard_ok": guard_ok,
        "hash_chain_match": hash_chain_match,
        "failed_steps": list(dict.fromkeys(failed)),
        "computed_merkle_root": root,
        "expected_merkle_root": expected_merkle_root,
        "message": (
            "Deterministic consistency and re-performance checks passed; hashes are not signatures or proof of authenticity."
            if ok
            else "Verification failed. Workpaper does not re-perform cleanly."
        ),
    }


def write_workpaper(path: Path, wp: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(wp, indent=2), encoding="utf-8")
