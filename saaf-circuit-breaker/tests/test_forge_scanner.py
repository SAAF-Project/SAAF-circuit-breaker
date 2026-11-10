from pathlib import Path

from forge.scanner import scan_path, scan_python


def test_scanner_flags_rogue_agent():
    sample = Path(__file__).resolve().parents[2] / "samples" / "jet-refunds-agent" / "agent.py"
    if not sample.exists():
        sample = Path(__file__).resolve().parents[1].parent / "samples" / "jet-refunds-agent" / "agent.py"
    findings = scan_path(sample)
    flags = {f.flag for f in findings}
    assert "CAN_EDIT_ITSELF" in flags
    assert "SOFTENING_LANGUAGE" in flags
    assert "TARGET_IN_CONTEXT" in flags
    assert "NO_REPLAYABLE_LOG" in flags
    assert "RULES_ONLY_IN_PROMPT" in flags
    assert "ESCALATIONS_FALLING" in flags


def test_scanner_not_fooled_by_unrelated_comparison_before_prompt():
    source = """
counter = 0
if counter == 0:
    pass
PROMPT = "Refund at most EUR 20. Never above the order value."
def run(ticket):
    return execute_refund(amount=ticket["amount"])
"""
    flags = {f.flag for f in scan_python(Path("rogue_order.py"), source)}
    assert "RULES_ONLY_IN_PROMPT" in flags
    assert "NO_REPLAYABLE_LOG" in flags

