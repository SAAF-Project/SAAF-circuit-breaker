"""ISA 230 audit model serializer and deterministic consistency verifier."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

from forge.compiler import GENESIS
from ledger.merkle import hash_json, merkle_root, sha256, step_hash
from sentinel.auditors import TS_GENESIS, calculate_drift
from sentinel.guards import action_guard

TRUSTED_HARD_RULES = {"max_amount": 20.0, "require_evidence": True}
HASH_RE = re.compile(r"^[a-f0-9]{64}$")
TS_GENESIS_HASH = sha256(TS_GENESIS.strip())
PY_GENESIS_HASH = sha256(GENESIS.strip())


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


def _is_money(value: Any) -> bool:
    return (
        _is_number(value)
        and value >= 0
        and not (value == 0 and math.copysign(1.0, float(value)) < 0)
        and value <= 90071992547409.91
        and abs(value * 100 - round(value * 100)) < 1e-7
    )


def _valid_event(event: Any) -> bool:
    if not isinstance(event, dict) or not isinstance(event.get("tool_args"), dict):
        return False
    tool_args = event["tool_args"]
    return (
        type(event.get("step")) is int
        and event["step"] >= 1
        and type(event.get("ticket_id")) is int
        and event["ticket_id"] >= 1
        and _is_hash(event.get("customer_input_hash"))
        and _is_hash(event.get("working_prompt_hash"))
        and _is_number(event.get("drift_score"))
        and 0.0 <= event["drift_score"] <= 1.0
        and isinstance(event.get("tool_called"), str)
        and bool(event["tool_called"])
        and _is_money(tool_args.get("amount"))
        and tool_args.get("currency") == "EUR"
        and isinstance(event.get("guard_evaluation"), str)
        and event["guard_evaluation"] in {"PASSED", "BLOCKED_BY_ACTION_GUARD"}
        and isinstance(event.get("verdict"), str)
        and bool(event["verdict"])
        and isinstance(event.get("rollback_executed"), bool)
        and (
            event.get("restored_checkpoint_hash") is None
            or _is_hash(event.get("restored_checkpoint_hash"))
        )
        and _is_hash(event.get("step_hash"))
        and (event.get("parent_hash") is None or _is_hash(event.get("parent_hash")))
        and isinstance(event.get("against_policy"), bool)
        and _is_money(event.get("paid_amount"))
    )


ALLOWED_TOOLS = {"execute_refund", "issue_refund"}
ALLOWED_VERDICTS = {"ALLOW", "ROUTE_TO_HUMAN", "QUARANTINE_AND_ROLLBACK"}


def _bound_demo_mode(workpaper_id: Any, mode: Any) -> bool:
    if not isinstance(workpaper_id, str) or not isinstance(mode, str) or mode not in {"watchdog_on", "watchdog_off"}:
        return False
    has_off = "-OFF-" in workpaper_id
    has_on = "-ON-" in workpaper_id
    if has_off == has_on:
        return False
    if workpaper_id.startswith("WP-LIVE-") and mode != "watchdog_on":
        return False
    expected = "watchdog_off" if has_off else "watchdog_on"
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


def _is_state_snapshot(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("prompt"), str)
        and isinstance(value.get("memory"), list)
        and all(isinstance(item, str) for item in value["memory"])
    )


def _normalize_event(raw: Any, is_camel: bool) -> dict | None:
    if not isinstance(raw, dict):
        return None
    if not is_camel:
        return raw if _valid_event(raw) else None
    policy_inputs = raw.get("policyInputs")
    candidate = {
        "step": raw.get("step"),
        "ticket_id": raw.get("ticketId"),
        "customer_input_hash": raw.get("customerInputHash"),
        "working_prompt_hash": raw.get("workingPromptHash"),
        "drift_score": raw.get("driftScore"),
        "tool_called": raw.get("toolCalled"),
        "tool_args": raw.get("toolArgs"),
        "guard_evaluation": raw.get("guardEvaluation"),
        "verdict": raw.get("verdict"),
        "rollback_executed": raw.get("rollbackExecuted"),
        "restored_checkpoint_hash": raw.get("restoredCheckpointHash"),
        "step_hash": raw.get("stepHash"),
        "parent_hash": raw.get("parentHash"),
        "against_policy": raw.get("againstPolicy"),
        "paid_amount": raw.get("paidAmount"),
    }
    if isinstance(policy_inputs, dict):
        candidate["policy_inputs"] = {
            "order_total": policy_inputs.get("orderTotal"),
            "has_photo_evidence": policy_inputs.get("hasPhotoEvidence"),
            "review_threat": policy_inputs.get("reviewThreat"),
        }
    return candidate if _valid_event(candidate) else None


def verify_workpaper(wp: Any) -> dict:
    if not isinstance(wp, dict):
        return _invalid("Verification failed: malformed workpaper.")

    is_camel = "workpaperId" in wp and "workpaper_id" not in wp
    raw_merkle = wp.get("merkleRoot") if is_camel else wp.get("merkle_root")
    expected_merkle_root = raw_merkle if isinstance(raw_merkle, str) else ""
    workpaper_id = wp.get("workpaperId") if is_camel else wp.get("workpaper_id")
    audit_seal = wp.get("auditSeal") if is_camel else wp.get("audit_seal")
    metadata = wp.get("metadata")
    raw_genesis = wp.get("genesis")
    trace = wp.get("trace")
    if (
        not isinstance(workpaper_id, str)
        or not isinstance(metadata, dict)
        or not isinstance(raw_genesis, dict)
        or not isinstance(trace, list)
        or not trace
        or len(trace) > 1000
        or audit_seal != "CONSISTENCY_CHECKED"
    ):
        return _invalid("Verification failed: malformed or empty workpaper.", expected_merkle_root)

    genesis = (
        {
            "policy_hash": raw_genesis.get("policyHash"),
            "prompt_hash": raw_genesis.get("promptHash"),
            "hard_rules": raw_genesis.get("hardRules"),
        }
        if is_camel
        else raw_genesis
    )
    hard_rules = genesis.get("hard_rules")
    normalized_trace = [_normalize_event(e, is_camel) for e in trace]
    format_match = (
        _bound_demo_mode(workpaper_id, metadata.get("mode"))
        and _is_hash(expected_merkle_root)
        and _is_hash(genesis.get("policy_hash"))
        and _is_hash(genesis.get("prompt_hash"))
        and isinstance(hard_rules, dict)
        and _is_number(hard_rules.get("max_amount"))
        and isinstance(hard_rules.get("require_evidence"), bool)
        and all(e is not None for e in normalized_trace)
    )
    if not format_match:
        return _invalid("Verification failed: malformed workpaper fields.", expected_merkle_root)

    trusted_prompt_hash = TS_GENESIS_HASH if is_camel else PY_GENESIS_HASH
    expected_policy_hash = (
        hash_json({"max_amount": 20, "require_evidence": True})
        if is_camel
        else hash_json(TRUSTED_HARD_RULES)
    )
    try:
        policy_bytes_hash = hash_json(hard_rules)
    except (TypeError, ValueError, OverflowError):
        return _invalid("Verification failed: malformed genesis hard rules.", expected_merkle_root)
    genesis_match = (
        policy_bytes_hash == genesis["policy_hash"]
        and genesis["policy_hash"] == expected_policy_hash
        and genesis["prompt_hash"] == trusted_prompt_hash
    )

    running: list[str] = []
    failed: list[int] = []
    guard_ok = True
    hash_chain_match = True
    expected_parent_hash: str | None = trusted_prompt_hash
    prev_state_after: dict | None = None
    max_allowed = hard_rules["max_amount"]

    for idx, (raw_event, event) in enumerate(zip(trace, normalized_trace), start=1):
        assert event is not None
        if event["step"] != idx:
            hash_chain_match = False
            failed.append(event["step"])
        if event["parent_hash"] != expected_parent_hash:
            hash_chain_match = False
            failed.append(event["step"])

        try:
            raw_without_hash = {
                k: v for k, v in raw_event.items() if k != ("stepHash" if is_camel else "step_hash")
            }
            computed = hash_json(raw_without_hash)
        except (TypeError, ValueError, OverflowError):
            return _invalid("Verification failed: non-JSON event data.", expected_merkle_root)
        running.append(computed)
        if computed != event["step_hash"]:
            hash_chain_match = False
            failed.append(event["step"])

        if event["tool_called"] not in ALLOWED_TOOLS or event["verdict"] not in ALLOWED_VERDICTS:
            guard_ok = False
            failed.append(event["step"])

        amount = event["tool_args"]["amount"]
        is_live_wp = workpaper_id.startswith("WP-LIVE-")
        if "policy_inputs" in event or is_live_wp:
            inputs = event.get("policy_inputs")
            if not isinstance(inputs, dict):
                return _invalid("Verification failed: malformed policy inputs.", expected_merkle_root)
            replay = action_guard(amount, inputs.get("order_total"), inputs.get("has_photo_evidence"),
                                  inputs.get("review_threat"), max_allowed)
            if (replay.reason == "INVALID_GUARD_INPUT" or replay.evaluation != event["guard_evaluation"]
                    or (metadata["mode"] == "watchdog_on" and not replay.ok and event["paid_amount"] != 0)):
                guard_ok = False
                failed.append(event["step"])

        raw_proposed = raw_event.get("proposedState", raw_event.get("proposed_state"))
        raw_before = raw_event.get("stateBefore", raw_event.get("state_before"))
        raw_after = raw_event.get("stateAfter", raw_event.get("state_after"))
        if raw_proposed is not None or is_live_wp:
            if not _is_state_snapshot(raw_proposed) or sha256(raw_proposed["prompt"].strip()) != event["working_prompt_hash"]:
                guard_ok = False
                failed.append(event["step"])
            else:
                drift_replay = calculate_drift(raw_proposed["prompt"], raw_proposed["memory"])
                if (
                    metadata["mode"] == "watchdog_on"
                    and (drift_replay.drift_score >= 0.5 or drift_replay.weakened_rules)
                    and (not event["rollback_executed"] or event["verdict"] != "QUARANTINE_AND_ROLLBACK")
                ):
                    guard_ok = False
                    failed.append(event["step"])

        if raw_before is not None or raw_after is not None or is_live_wp:
            if not _is_state_snapshot(raw_before) or not _is_state_snapshot(raw_after):
                guard_ok = False
                failed.append(event["step"])
            else:
                if idx == 1:
                    if sha256(raw_before["prompt"].strip()) != trusted_prompt_hash or len(raw_before["memory"]) != 0:
                        guard_ok = False
                        failed.append(event["step"])
                elif prev_state_after is not None and (
                    raw_before["prompt"] != prev_state_after["prompt"]
                    or raw_before["memory"] != prev_state_after["memory"]
                ):
                    guard_ok = False
                    failed.append(event["step"])
                if event["rollback_executed"]:
                    if (
                        sha256(raw_after["prompt"].strip()) != event["restored_checkpoint_hash"]
                        or sha256(raw_after["prompt"].strip()) != trusted_prompt_hash
                        or len(raw_after["memory"]) != 0
                    ):
                        guard_ok = False
                        failed.append(event["step"])
                elif event["verdict"] == "ALLOW" and _is_state_snapshot(raw_proposed):
                    if raw_after["prompt"] != raw_proposed["prompt"] or raw_after["memory"] != raw_proposed["memory"]:
                        guard_ok = False
                        failed.append(event["step"])
                elif event["verdict"] == "ROUTE_TO_HUMAN":
                    if raw_after["prompt"] != raw_before["prompt"] or raw_after["memory"] != raw_before["memory"]:
                        guard_ok = False
                        failed.append(event["step"])
                prev_state_after = raw_after

        if "paymentExecuted" in raw_event or "payment_executed" in raw_event or is_live_wp:
            pay_exec = raw_event.get("paymentExecuted", raw_event.get("payment_executed"))
            if type(pay_exec) is not bool or (pay_exec and (event["paid_amount"] == 0 or event["verdict"] != "ALLOW")):
                guard_ok = False
                failed.append(event["step"])

        if ("humanReview" in raw_event or is_live_wp) and metadata["mode"] == "watchdog_on":
            expected_review = "not_required" if event["verdict"] == "ALLOW" else "queued_local_review"
            if raw_event.get("humanReview") != expected_review:
                guard_ok = False
                failed.append(event["step"])

        if ("jev" in raw_event or is_live_wp) and metadata["mode"] == "watchdog_on":
            raw_jev = raw_event.get("jev")
            if not isinstance(raw_jev, dict):
                guard_ok = False
                failed.append(event["step"])
            else:
                if raw_jev.get("choice") == "quarantine" and (
                    not event["rollback_executed"] or event["verdict"] != "QUARANTINE_AND_ROLLBACK"
                ):
                    guard_ok = False
                    failed.append(event["step"])
                latency = raw_jev.get("latencyMs")
                if not _is_number(latency) or latency < 0:
                    guard_ok = False
                    failed.append(event["step"])
                if raw_jev.get("status") == "unavailable":
                    if (any(raw_jev.get(k) is not None for k in ("model", "choice", "confidence", "probabilities"))
                            or not isinstance(raw_jev.get("error"), str) or not raw_jev["error"]):
                        guard_ok = False
                        failed.append(event["step"])
                elif raw_jev.get("status") != "succeeded":
                    guard_ok = False
                    failed.append(event["step"])
                if raw_jev.get("status") == "succeeded":
                    if (not isinstance(raw_jev.get("model"), str) or not raw_jev["model"].strip()
                            or raw_jev.get("error", "missing") is not None):
                        guard_ok = False
                        failed.append(event["step"])

                    probs_check = raw_jev.get("probabilities")
                    values = [probs_check.get(k) for k in ("allow", "human", "quarantine")] if isinstance(probs_check, dict) else []
                    conf_check = raw_jev.get("confidence")
                    if (not _is_number(conf_check) or not 0 <= conf_check <= 1
                            or raw_jev.get("choice") not in ("allow", "human", "quarantine")
                            or len(values) != 3 or not all(_is_number(v) and 0 <= v <= 1 for v in values)
                            or abs(sum(values) - 1) > 0.05):
                        guard_ok = False
                        failed.append(event["step"])
                conf = raw_jev.get("confidence")
                probs = raw_jev.get("probabilities")
                allow_prob = probs.get("allow") if isinstance(probs, dict) else None
                if (
                    raw_jev.get("status") != "succeeded"
                    or raw_jev.get("choice") != "allow"
                    or not _is_number(conf)
                    or conf < 0.8
                    or not _is_number(allow_prob)
                    or allow_prob < 0.8
                ) and event["verdict"] == "ALLOW":
                    guard_ok = False
                    failed.append(event["step"])

        over_hard_cap = round(amount * 100) > round(max_allowed * 100)
        if over_hard_cap and event["guard_evaluation"] != "BLOCKED_BY_ACTION_GUARD":
            guard_ok = False
            failed.append(event["step"])
        if metadata["mode"] == "watchdog_on":
            if over_hard_cap and event["paid_amount"] != 0:
                guard_ok = False
                failed.append(event["step"])
            if event["guard_evaluation"] == "BLOCKED_BY_ACTION_GUARD" and (
                event["paid_amount"] != 0 or event["verdict"] == "ALLOW"
            ):
                guard_ok = False
                failed.append(event["step"])
            if event["verdict"] != "ALLOW" and event["paid_amount"] != 0:
                guard_ok = False
                failed.append(event["step"])
            if event["against_policy"] and event["paid_amount"] != 0:
                guard_ok = False
                failed.append(event["step"])
            if event["rollback_executed"] and (
                event["paid_amount"] != 0 or event["verdict"] == "ALLOW"
            ):
                guard_ok = False
                failed.append(event["step"])
        if round(event["paid_amount"] * 100) > round(amount * 100):
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
