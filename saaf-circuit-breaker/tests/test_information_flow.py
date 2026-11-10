import copy
import json
from pathlib import Path
import pytest
from pydantic import ValidationError

from forge.compiler import CompiledPolicyBundle, GENESIS, compile_policy
from ledger.merkle import merkle_root, step_hash
from ledger.workpaper import verify_workpaper


ROOT = Path(__file__).resolve().parents[2]


def test_cross_stack_verifier_validates_web_and_python_workpapers():
    py_wp = json.loads((ROOT / "verification" / "WP-0036.json").read_text(encoding="utf-8"))
    web_wp = json.loads((ROOT / "docs" / "sample-workpaper.json").read_text(encoding="utf-8"))

    assert verify_workpaper(py_wp)["ok"] is True
    assert verify_workpaper(web_wp)["ok"] is True

    # Rehashed state-replay forgery on web workpaper (claiming ALLOW despite eroded memory and Jev quarantine)
    forged_web = copy.deepcopy(web_wp)
    forged_web["trace"][0]["verdict"] = "ALLOW"
    forged_web["trace"][0]["rollbackExecuted"] = False
    forged_web["trace"][0]["restoredCheckpointHash"] = None
    forged_web["trace"][0]["guardEvaluation"] = "PASSED"
    forged_web["trace"][0]["toolArgs"]["amount"] = 10.0
    forged_web["trace"][0]["policyInputs"]["hasPhotoEvidence"] = True
    forged_web["trace"][0]["policyInputs"]["reviewThreat"] = False
    forged_web["trace"][0]["humanReview"] = "not_required"
    raw_without = {k: v for k, v in forged_web["trace"][0].items() if k != "stepHash"}
    from ledger.merkle import hash_json

    forged_web["trace"][0]["stepHash"] = hash_json(raw_without)
    forged_web["merkleRoot"] = merkle_root([forged_web["trace"][0]["stepHash"]])
    assert verify_workpaper(forged_web)["ok"] is False


def test_compiled_policy_bundle_rejects_weakened_hard_rules_or_drift_ceiling():
    base = compile_policy().model_dump()

    for mutate in [
        lambda d: d["hard_rules"].__setitem__("max_unapproved_amount_eur", 50.0),
        lambda d: d["hard_rules"].__setitem__("max_unapproved_amount_eur", -1.0),
        lambda d: d["hard_rules"].__setitem__("cap_to_order_value", False),
        lambda d: d["hard_rules"].__setitem__("require_verified_evidence", False),
        lambda d: d["hard_rules"].__setitem__("filter_review_blackmail", False),
        lambda d: d.__setitem__("max_drift_threshold", 0.95),
        lambda d: d.__setitem__("max_drift_threshold", 0.0),
        lambda d: d.__setitem__("genesis_prompt_hash", "not-a-sha256-hash"),
    ]:
        bad = copy.deepcopy(base)
        mutate(bad)
        with pytest.raises(ValidationError):
            CompiledPolicyBundle.model_validate(bad)


def test_verifier_rejects_rehashed_payment_executed_true_when_unpaid():
    py_wp = json.loads((ROOT / "verification" / "WP-0036.json").read_text(encoding="utf-8"))
    forged = copy.deepcopy(py_wp)
    forged["trace"][0]["payment_executed"] = True
    forged["trace"][0]["step_hash"] = step_hash(forged["trace"][0])
    forged["merkle_root"] = merkle_root([forged["trace"][0]["step_hash"]])
    assert verify_workpaper(forged)["ok"] is False


@pytest.mark.parametrize("field", ["jev", "humanReview", "paymentExecuted"])
def test_audit_live_evidence_cannot_be_stripped(field):
    from ledger.merkle import hash_json
    wp = json.loads((ROOT / "docs/sample-workpaper.json").read_text())
    assert verify_workpaper(wp)["ok"]
    del wp["trace"][0][field]
    wp["trace"][0]["stepHash"] = hash_json({k: v for k, v in wp["trace"][0].items() if k != "stepHash"})
    wp["merkleRoot"] = wp["trace"][0]["stepHash"]
    assert not verify_workpaper(wp)["ok"]


def test_audit_trivial_assertion_does_not_prove_refund_cap():
    from forge.scanner import scan_python
    source = 'policy = "Refund at most EUR 20"\nassert True\nexecute_refund(amount=30)\n'
    assert "RULES_ONLY_IN_PROMPT" in {f.flag for f in scan_python(Path("fixture.py"), source)}


def live_allow_fixture():
    from ledger.merkle import hash_json
    wp = json.loads((ROOT / "docs/sample-workpaper.json").read_text())
    event = wp["trace"][0]
    state = event["stateBefore"]
    event.update(toolArgs={"amount": 10, "currency": "EUR"}, paidAmount=0,
                 guardEvaluation="PASSED", verdict="ALLOW", rollbackExecuted=False,
                 restoredCheckpointHash=None, driftScore=0, humanReview="not_required",
                 policyInputs={"orderTotal": 20, "hasPhotoEvidence": True, "reviewThreat": False, "claimType": "goodwill"},
                 proposedState=copy.deepcopy(state), stateAfter=copy.deepcopy(state),
                 jev={"model": "fixture", "error": None, "latencyMs": 0, "status": "succeeded", "choice": "allow", "confidence": 0.95,
                      "probabilities": {"allow": 0.95, "human": 0.05, "quarantine": 0}})
    event["stepHash"] = hash_json({k: v for k, v in event.items() if k != "stepHash"})
    wp["merkleRoot"] = event["stepHash"]
    return wp


def rehash_web(wp):
    from ledger.merkle import hash_json
    event = wp["trace"][0]
    event["stepHash"] = hash_json({k: v for k, v in event.items() if k != "stepHash"})
    wp["merkleRoot"] = event["stepHash"]
    return wp


def test_audit_live_allow_probability_replayed():
    wp = live_allow_fixture()
    assert verify_workpaper(wp)["ok"]
    wp["trace"][0]["jev"]["probabilities"] = {"allow": 0.1, "human": 0.9, "quarantine": 0}
    assert not verify_workpaper(rehash_web(wp))["ok"]


def test_audit_live_downgrade_blocked_payout():
    wp = live_allow_fixture()
    wp["workpaperId"] = "WP-LIVE-ON-OFF-0001"
    wp["metadata"]["mode"] = "watchdog_off"
    wp["trace"][0].update(toolArgs={"amount": 21.35, "currency": "EUR"}, paidAmount=21.35,
                           againstPolicy=True, guardEvaluation="BLOCKED_BY_ACTION_GUARD")
    assert not verify_workpaper(rehash_web(wp))["ok"]


@pytest.mark.parametrize("mutation", [
    {"confidence": 2}, {"confidence": True},
    {"probabilities": {"allow": 1.1, "human": -0.1, "quarantine": 0}},
    {"probabilities": {"allow": 0.95}},
    {"probabilities": {"allow": 0.9, "human": 0.9, "quarantine": 0.9}},
])
def test_audit_full_jev_schema(mutation):
    wp = live_allow_fixture()
    wp["trace"][0]["jev"].update(mutation)
    assert not verify_workpaper(rehash_web(wp))["ok"]


@pytest.mark.parametrize("extra", [
    '# ActionGuard parent_hash',
    'marker = "ActionGuard parent_hash"',
    'if False:\n    ActionGuard()\n    parent_hash = "dummy"',
])
def test_scanner_keywords_cannot_certify_enforcement(extra):
    from forge.scanner import scan_python, _scan_text
    source = 'policy = "Refund at most EUR 20"\nexecute_refund(amount=30)\n' + extra
    for findings in (scan_python(Path("fixture.py"), source), _scan_text(Path("fixture.ts"), source)):
        flags = {f.flag for f in findings}
        assert {"RULES_ONLY_IN_PROMPT", "NO_REPLAYABLE_LOG"} <= flags


def test_bounded_evidence_regex_handles_repeated_prefixes():
    import time
    from sentinel.auditors import SOFTENING
    pattern = next(p for p, label, weight in SOFTENING if label == "evidence dropped")
    start = time.monotonic()
    assert pattern.search("evidence " * 10000) is None
    assert time.monotonic() - start < 2
    assert pattern.search("evidence is optional")
