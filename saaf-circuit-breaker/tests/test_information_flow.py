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
