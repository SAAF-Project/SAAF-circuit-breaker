import json
from pathlib import Path

from typer.testing import CliRunner

from cli.main import app, sentinel_app
from forge.compiler import GENESIS, compile_policy
from ledger.merkle import hash_json, merkle_root, sha256, step_hash
from sentinel.guards import action_guard


runner = CliRunner()


def test_action_guard_rejects_invalid_money_and_boolean_types():
    invalid_values = [True, "1.00", float("nan"), float("inf"), -0.01, 10**1000]
    for amount in invalid_values:
        result = action_guard(amount, 10.0, True, False)
        assert result.ok is False, amount
        assert result.evaluation == "BLOCKED_BY_ACTION_GUARD"


def test_action_guard_rejects_invalid_order_values_and_evidence_types():
    assert not action_guard(1.0, float("nan"), True, False).ok
    assert not action_guard(1.0, 10.0, "false", False).ok
    assert not action_guard(1.0, 10.0, True, "false").ok


def test_sentinel_cli_loads_and_enforces_supplied_policy(tmp_path: Path):
    ticket = tmp_path / "ticket.json"
    ticket.write_text(json.dumps({
        "ticket_id": 99,
        "requested_amount": 15.0,
        "order_total": 20.0,
        "has_photo_evidence": True,
        "review_threat": False,
    }))
    policy = compile_policy().model_dump()
    policy["policy_id"] = "lower-cap-test"
    policy["hard_rules"]["max_unapproved_amount_eur"] = 10.0
    policy_path = tmp_path / "policy.json"
    policy_path.write_text(json.dumps(policy))
    workpaper = tmp_path / "workpaper.json"

    result = runner.invoke(sentinel_app, [
        "--ticket", str(ticket), "--policy", str(policy_path),
        "--out-workpaper", str(workpaper),
    ])

    assert result.exit_code == 0, result.output
    assert "ROUTE_TO_HUMAN" in result.output
    assert workpaper.exists()


def test_verify_cli_accepts_trailing_generate_report_option(tmp_path: Path):
    workpaper = tmp_path / "workpaper.json"
    rules = {"max_amount": 20.0, "require_evidence": True}
    event = {
        "step": 1,
        "ticket_id": 36,
        "customer_input_hash": sha256("ticket"),
        "working_prompt_hash": sha256("prompt"),
        "drift_score": 1.0,
        "tool_called": "execute_refund",
        "tool_args": {"amount": 21.35, "currency": "EUR"},
        "guard_evaluation": "BLOCKED_BY_ACTION_GUARD",
        "verdict": "ROUTE_TO_HUMAN",
        "rollback_executed": False,
        "restored_checkpoint_hash": None,
        "parent_hash": sha256(GENESIS.strip()),
        "against_policy": True,
        "paid_amount": 0.0,
    }
    event["step_hash"] = step_hash(event)
    workpaper.write_text(json.dumps({
        "workpaper_id": "WP-TEST-ON-0001",
        "metadata": {"mode": "watchdog_on"},
        "genesis": {
            "hard_rules": rules,
            "policy_hash": hash_json(rules),
            "prompt_hash": sha256(GENESIS.strip()),
        },
        "trace": [event],
        "merkle_root": merkle_root([event["step_hash"]]),
        "audit_seal": "CONSISTENCY_CHECKED",
    }))

    result = runner.invoke(app, ["verify", str(workpaper), "--generate-report"])

    assert result.exit_code == 0, result.output
    assert (tmp_path / "workpaper.html").exists()


def test_pyproject_disables_ambiguous_flat_package_discovery():
    pyproject = Path(__file__).resolve().parents[1] / "pyproject.toml"
    contents = pyproject.read_text()
    assert "[tool.setuptools.packages.find]" in contents
    assert 'include = ["cli*", "forge*", "ledger*", "rehearsal*", "sentinel*"]' in contents
