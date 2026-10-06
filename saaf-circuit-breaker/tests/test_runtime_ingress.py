import json

import pytest
from typer.testing import CliRunner

from cli.main import app
from forge.compiler import GENESIS
from sentinel.runtime import SAAFSentinelRuntime


@pytest.mark.parametrize("changes", [
    {"amount": "1.0"}, {"amount": True}, {"amount": -1.0},
    {"amount": float("nan")}, {"amount": 1.001},
    {"order_total": "20.0"}, {"has_photo_evidence": "false"},
    {"review_threat": "false"}, {"current_memory": "not a list"},
])
def test_runtime_rejects_raw_invalid_input(changes):
    values = {"amount": 1.0, "order_total": 20.0, "has_photo_evidence": True,
              "review_threat": False, "current_memory": []}
    values.update(changes)
    result = SAAFSentinelRuntime().intercept_and_evaluate(
        "execute_refund", {"amount": values["amount"]},
        {k: values[k] for k in ["order_total", "has_photo_evidence", "review_threat"]},
        GENESIS, values["current_memory"],
    )
    assert result["action"] == "HALT"
    assert result["verdict"] != "ALLOW"


def test_failed_verification_has_nonzero_cli_exit(tmp_path):
    path = tmp_path / "invalid.json"
    path.write_text(json.dumps({"trace": []}))
    result = CliRunner().invoke(app, ["verify", str(path)])
    assert result.exit_code == 1
    assert "False" in result.output
