"""Typer CLI: forge, rehearse, sentinel, verify."""

from __future__ import annotations

import json
from pathlib import Path
import sys

import typer
from rich.console import Console
from rich.table import Table

from forge.compiler import GENESIS, CompiledPolicyBundle, compile_policy, dump_artifacts
from forge.scanner import scan_path
from ledger.html_exporter import render_html
from ledger.merkle import hash_json, merkle_root, sha256, step_hash
from ledger.workpaper import verify_workpaper, write_workpaper
from rehearsal.swarm import run_swarm
from sentinel.runtime import SAAFSentinelRuntime

app = typer.Typer(help="SAAF Circuit Breaker — Forge / MiroFish / Jev Sentinel / Verify")
forge_app = typer.Typer(help="SAAF-Forge scanner")
rehearsal_app = typer.Typer(help="MiroFish rehearsal")
sentinel_app = typer.Typer(help="Jev Sentinel runtime")
console = Console()

app.add_typer(forge_app, name="forge")
app.add_typer(rehearsal_app, name="rehearse")
app.add_typer(sentinel_app, name="sentinel")


@forge_app.command("scan")
def forge_scan(
    target: Path = typer.Argument(..., exists=True),
    out_policy: Path = typer.Option(Path("./policies"), "--out-policy"),
) -> None:
    findings = scan_path(target)
    table = Table(title="SAAF-Forge · six red flags")
    table.add_column("Flag")
    table.add_column("File")
    table.add_column("Line")
    table.add_column("Detail")
    for f in findings:
        table.add_row(f.flag, f.path, str(f.line), f.detail)
    console.print(table)
    bundle = compile_policy()
    dump_artifacts(bundle, out_policy)
    console.print(f"[orange1]compiled[/] {bundle.policy_id} → {out_policy}")


@rehearsal_app.command("run")
def rehearse_run(
    scenario: Path = typer.Option(None, "--scenario"),
    watchdog: bool = typer.Option(True, "--watchdog/--no-watchdog"),
) -> None:
    result = run_swarm(watchdog=watchdog, scenario_path=scenario)
    console.print(
        f"personas={result['personas']} tickets={result['tickets']} "
        f"against={result['refunds_against_policy']} "
        f"paid_against=€{result['paid_against_policy_eur']} "
        f"quarantines={result['quarantines']}"
    )


@sentinel_app.command("process-ticket")
def process_ticket(
    ticket: Path = typer.Option(..., "--ticket", exists=True),
    policy: Path | None = typer.Option(None, "--policy", exists=True),
    out_workpaper: Path = typer.Option(Path("./workpapers/WP-0036.json"), "--out-workpaper"),
) -> None:
    data = json.loads(ticket.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("currency", "EUR") != "EUR":
        raise typer.BadParameter("Ticket must be a JSON object denominated in EUR")
    loaded_policy = (
        CompiledPolicyBundle.model_validate_json(policy.read_text(encoding="utf-8"))
        if policy is not None
        else compile_policy()
    )
    runtime = SAAFSentinelRuntime(loaded_policy)
    result = runtime.intercept_and_evaluate(
        "execute_refund",
        {"amount": data.get("requested_amount", data.get("amount", 0)), "ticket_id": data.get("ticket_id", 36)},
        {
            "order_total": data.get("order_total", 0),
            "has_photo_evidence": data.get("has_photo_evidence", False),
            "review_threat": data.get("review_threat", False),
        },
        runtime.last_healthy_checkpoint.prompt_content,
        [],
    )
    if result.get("reason") in {"INVALID_GUARD_INPUT", "INVALID_RUNTIME_INPUT"}:
        raise typer.BadParameter("Invalid money, evidence or runtime state")
    console.print(result)
    amount = data.get("requested_amount", data.get("amount", 0))
    prompt_hash = runtime.last_healthy_checkpoint.prompt_hash
    ticket_id = int(data.get("ticket_id", 36))
    workpaper_rules = {
        "max_amount": loaded_policy.hard_rules.max_unapproved_amount_eur,
        "require_evidence": loaded_policy.hard_rules.require_verified_evidence,
    }
    event = {
        "step": 1,
        "ticket_id": ticket_id,
        "customer_input_hash": hash_json(data),
        "working_prompt_hash": prompt_hash,
        "drift_score": float(result.get("drift_score", 1)),
        "tool_called": "execute_refund",
        "tool_args": {"amount": amount, "currency": data.get("currency", "EUR")},
        "guard_evaluation": result.get("guard_evaluation", "BLOCKED_BY_ACTION_GUARD"),
        "verdict": result.get("verdict"),
        "rollback_executed": result.get("action") == "ROLLBACK",
        "restored_checkpoint_hash": (
            runtime.last_healthy_checkpoint.prompt_hash if result.get("action") == "ROLLBACK" else None
        ),
        "parent_hash": sha256(GENESIS.strip()),
        "against_policy": False,
        "paid_amount": 0.0,
        "payment_executed": False,
        "policy_inputs": {"order_total": data.get("order_total"),
                          "has_photo_evidence": data.get("has_photo_evidence", False),
                          "review_threat": data.get("review_threat", False)},
    }
    event["step_hash"] = step_hash(event)
    wp = {
        "workpaper_id": f"WP-2026-JET-CARE-ON-{ticket_id:04d}",
        "audit_standard": "ISA_230 / NOREA_AI_CONTROL_FRAMEWORK",
        "metadata": {
            "entity": "Just Eat Takeaway.com",
            "system": "Automated Care Refunds Agent",
            "mode": "watchdog_on",
        },
        "genesis": {
            "policy_hash": hash_json(workpaper_rules),
            "prompt_hash": sha256(GENESIS.strip()),
            "hard_rules": workpaper_rules,
        },
        "trace": [event],
        "merkle_root": merkle_root([event["step_hash"]]),
        "audit_seal": "CONSISTENCY_CHECKED",
    }
    write_workpaper(out_workpaper, wp)
    console.print(f"workpaper → {out_workpaper}")


def sentinel_cli() -> None:
    """Standalone entry point accepting the documented process-ticket subcommand."""
    if len(sys.argv) > 1 and sys.argv[1] == "process-ticket":
        del sys.argv[1]
    typer.run(process_ticket)


@app.command("verify")
def verify_command(
    workpaper: Path = typer.Argument(...),
    generate_report: bool = typer.Option(False, "--generate-report"),
) -> None:
    wp = json.loads(workpaper.read_text(encoding="utf-8"))
    result = verify_workpaper(wp)
    console.print(result)
    if generate_report:
        html = render_html(wp, result)
        out = workpaper.with_suffix(".html")
        out.write_text(html, encoding="utf-8")
        console.print(f"report → {out}")
    if not result["ok"]:
        raise typer.Exit(code=1)


def verify_cli() -> None:
    """Standalone executable entry point: saaf-verify FILE [--generate-report]."""
    typer.run(verify_command)


@app.command("forge-scan")
def forge_scan_alias(target: Path, out_policy: Path = Path("./policies")) -> None:
    forge_scan(target, out_policy)


if __name__ == "__main__":
    app()
