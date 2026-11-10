import copy

import pytest

from forge.compiler import GENESIS
from ledger.html_exporter import render_html
from ledger.merkle import hash_json, merkle_root, sha256, step_hash
from ledger.workpaper import verify_workpaper


def make_workpaper(mode: str) -> dict:
    amount = 21.35
    event = {
        "step": 1,
        "ticket_id": 36,
        "customer_input_hash": sha256("ticket 36 customer input"),
        "working_prompt_hash": sha256("working prompt"),
        "drift_score": 1.0,
        "tool_called": "execute_refund",
        "tool_args": {"amount": amount, "currency": "EUR"},
        "guard_evaluation": "BLOCKED_BY_ACTION_GUARD",
        "verdict": "ROUTE_TO_HUMAN" if mode == "watchdog_on" else "ALLOW",
        "rollback_executed": False,
        "restored_checkpoint_hash": None,
        "parent_hash": sha256(GENESIS.strip()),
        "against_policy": mode == "watchdog_off",
        "paid_amount": 0.0 if mode == "watchdog_on" else amount,
    }
    event["step_hash"] = step_hash(event)
    hard_rules = {"max_amount": 20.0, "require_evidence": True}
    return {
        "workpaper_id": f"WP-TEST-{'ON' if mode == 'watchdog_on' else 'OFF'}-0001",
        "audit_standard": "ISA_230 / NOREA_AI_CONTROL_FRAMEWORK",
        "metadata": {"mode": mode},
        "genesis": {
            "policy_hash": hash_json(hard_rules),
            "prompt_hash": sha256(GENESIS.strip()),
            "hard_rules": hard_rules,
        },
        "trace": [event],
        "merkle_root": merkle_root([event["step_hash"]]),
        "audit_seal": "CONSISTENCY_CHECKED",
    }


@pytest.mark.parametrize("mode", ["watchdog_on", "watchdog_off"])
def test_workpaper_integrity_accepts_watchdog_demonstrations(mode: str):
    assert verify_workpaper(make_workpaper(mode))["ok"] is True


@pytest.mark.parametrize(
    ("name", "mutate"),
    [
        ("verdict", lambda wp: wp["trace"][0].__setitem__("verdict", "ALLOW")),
        ("rollback", lambda wp: wp["trace"][0].__setitem__("rollback_executed", True)),
        ("currency", lambda wp: wp["trace"][0]["tool_args"].__setitem__("currency", "USD")),
        ("customer input", lambda wp: wp["trace"][0].__setitem__("customer_input_hash", sha256("tampered"))),
        ("parent linkage", lambda wp: wp["trace"][0].__setitem__("parent_hash", sha256("wrong parent"))),
        ("paid amount", lambda wp: wp["trace"][0].__setitem__("paid_amount", 21.35)),
        ("added event field", lambda wp: wp["trace"][0].__setitem__("execution_channel", "unreviewed")),
        ("genesis prompt", lambda wp: wp["genesis"].__setitem__("prompt_hash", sha256("tampered genesis"))),
        ("mode", lambda wp: wp["metadata"].__setitem__("mode", "watchdog_off")),
    ],
)
def test_workpaper_integrity_rejects_unhashed_mutations(name: str, mutate):
    workpaper = make_workpaper("watchdog_on")
    mutate(workpaper)
    assert verify_workpaper(workpaper)["ok"] is False, name


def test_offline_rule_replay_rejects_rehashed_order_violation():
    wp = make_workpaper("watchdog_on")
    event = wp["trace"][0]
    event.update(tool_args={"amount": 10.0, "currency": "EUR"}, paid_amount=10.0,
                 guard_evaluation="PASSED", verdict="ALLOW",
                 policy_inputs={"order_total": 20.0, "has_photo_evidence": True, "review_threat": False})
    event["step_hash"] = step_hash(event)
    wp["merkle_root"] = event["step_hash"]
    assert verify_workpaper(wp)["ok"]
    event["policy_inputs"]["order_total"] = 5.0
    event["step_hash"] = step_hash(event)
    wp["merkle_root"] = event["step_hash"]
    assert not verify_workpaper(wp)["ok"]


@pytest.mark.parametrize("field,value", [("mode", []), ("amount", 10**1000), ("guard", {})])
def test_verifier_malformed_fields_fail_without_exception(field, value):
    wp = make_workpaper("watchdog_on")
    if field == "mode":
        wp["metadata"]["mode"] = value
    elif field == "amount":
        wp["trace"][0]["tool_args"]["amount"] = value
    else:
        wp["trace"][0]["guard_evaluation"] = value
    assert not verify_workpaper(wp)["ok"]


def test_workpaper_integrity_rejects_empty_malformed_and_discontinuous_traces():
    empty = make_workpaper("watchdog_on")
    empty["trace"] = []
    assert verify_workpaper(empty)["ok"] is False

    malformed = make_workpaper("watchdog_on")
    malformed["trace"] = [{"step": 1}]
    assert verify_workpaper(malformed)["ok"] is False

    discontinuous = copy.deepcopy(make_workpaper("watchdog_on"))
    discontinuous["trace"][0]["parent_hash"] = sha256("not genesis")
    assert verify_workpaper(discontinuous)["ok"] is False


def test_verifier_rejects_boolean_step_subcap_blocked_payout_and_deep_nesting():
    bool_step = make_workpaper("watchdog_on")
    bool_step["trace"][0]["step"] = True
    bool_step["trace"][0]["step_hash"] = step_hash(bool_step["trace"][0])
    bool_step["merkle_root"] = bool_step["trace"][0]["step_hash"]
    assert verify_workpaper(bool_step)["ok"] is False

    forged_subcap = make_workpaper("watchdog_on")
    forged_subcap["trace"][0]["tool_args"]["amount"] = 15.0
    forged_subcap["trace"][0]["paid_amount"] = 15.0
    forged_subcap["trace"][0]["guard_evaluation"] = "BLOCKED_BY_ACTION_GUARD"
    forged_subcap["trace"][0]["verdict"] = "ALLOW"
    forged_subcap["trace"][0]["step_hash"] = step_hash(forged_subcap["trace"][0])
    forged_subcap["merkle_root"] = forged_subcap["trace"][0]["step_hash"]
    assert verify_workpaper(forged_subcap)["ok"] is False

    deep_wp = make_workpaper("watchdog_on")
    nested: dict = {"leaf": "ok"}
    for _ in range(40):
        nested = {"child": nested}
    deep_wp["trace"][0]["extra"] = nested
    assert verify_workpaper(deep_wp)["ok"] is False


def test_html_exporter_escapes_untrusted_fields_and_adds_csp():
    wp = make_workpaper("watchdog_on")
    wp["workpaper_id"] = 'WP-ON-<script>alert("x")</script>'
    wp["trace"][0]["verdict"] = "<img src=x onerror=alert(1)>"
    html = render_html(wp, verify_workpaper(wp))
    assert "<script>" not in html
    assert "<img src=x" not in html
    assert "&lt;script&gt;" in html
    assert "Content-Security-Policy" in html



@pytest.mark.parametrize("field,value", [("tool_called", "disable_guard"), ("tool_called", "update_system_prompt"), ("tool_called", "override_cap"), ("verdict", "APPROVED_BY_AGENT")])
def test_audit_unknown_tools_and_verdicts_rejected_after_rehash(field, value):
    wp = make_workpaper("watchdog_on")
    wp["trace"][0][field] = value
    wp["trace"][0]["step_hash"] = step_hash(wp["trace"][0])
    wp["merkle_root"] = wp["trace"][0]["step_hash"]
    assert not verify_workpaper(wp)["ok"]


@pytest.mark.parametrize("identifier", ["WP-LIVE-ON-OFF-0001", "WP-LIVE-OFF-0001", "WP-TEST-ON-OFF-0001"])
def test_audit_ambiguous_or_downgraded_mode_rejected(identifier):
    wp = make_workpaper("watchdog_off")
    wp["workpaper_id"] = identifier
    assert not verify_workpaper(wp)["ok"]
