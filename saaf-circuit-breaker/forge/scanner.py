"""AST inspection for Job Angula's six red flags."""

from __future__ import annotations

import ast
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable


RED_FLAGS = {
    "CAN_EDIT_ITSELF": "Writable prompt, memory buffer, or tool registry in the execution loop.",
    "RULES_ONLY_IN_PROMPT": "Hard business thresholds exist only in strings, not assertions.",
    "TARGET_IN_CONTEXT": "CSAT / conversion scores embedded in working context.",
    "SOFTENING_LANGUAGE": "Hedges that dissolve hard rules (generously, plausible, never deny).",
    "ESCALATIONS_FALLING": "Instructions that discourage human escalation.",
    "NO_REPLAYABLE_LOG": "Tool calls without parent-hash linkage to prompt revisions.",
}

SOFTENING = ("generously", "plausible", "guidelines", "never deny", "trust the customer")
ESCALATION = ("never escalate", "autonomous closures", "don't bother")
TARGET = ("csat", "conversion rate", "denials 1.0", "refunds average 5")


@dataclass
class Finding:
    flag: str
    path: str
    line: int
    snippet: str
    detail: str

    def asdict(self) -> dict:
        return asdict(self)


def _snippet(source: str, lineno: int) -> str:
    lines = source.splitlines()
    i = max(0, lineno - 1)
    return lines[i].strip() if i < len(lines) else ""


def scan_python(path: Path, source: str) -> list[Finding]:
    findings: list[Finding] = []
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        return [
            Finding("CAN_EDIT_ITSELF", str(path), exc.lineno or 1, "", f"syntax error: {exc.msg}")
        ]

    assigned: set[str] = set()
    calls_refund = False
    has_hash = False
    has_assert_cap = False

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name):
                    assigned.add(t.id)
                    if t.id in {"working_prompt", "memory_notes", "tools"}:
                        findings.append(
                            Finding(
                                "CAN_EDIT_ITSELF",
                                str(path),
                                getattr(node, "lineno", 1),
                                _snippet(source, node.lineno),
                                RED_FLAGS["CAN_EDIT_ITSELF"],
                            )
                        )
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr in {"append",} and isinstance(node.func.value, ast.Name):
                if node.func.value.id in {"memory_notes", "memory"}:
                    findings.append(
                        Finding(
                            "CAN_EDIT_ITSELF",
                            str(path),
                            node.lineno,
                            _snippet(source, node.lineno),
                            RED_FLAGS["CAN_EDIT_ITSELF"],
                        )
                    )
        if isinstance(node, ast.Call):
            name = ""
            if isinstance(node.func, ast.Name):
                name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                name = node.func.attr
            elif isinstance(node.func, ast.Subscript) and isinstance(node.func.slice, ast.Constant):
                # Tool registries call tools["execute_refund"](...), not only named functions.
                if isinstance(node.func.slice.value, str):
                    name = node.func.slice.value
            if "refund" in name.lower():
                calls_refund = True
            if name in {"sha256", "hashlib"} or "hash" in name.lower():
                has_hash = True
        if isinstance(node, ast.Compare):
            has_assert_cap = True
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            low = node.value.lower()
            if any(s in low for s in SOFTENING):
                findings.append(
                    Finding("SOFTENING_LANGUAGE", str(path), node.lineno, node.value[:80], RED_FLAGS["SOFTENING_LANGUAGE"])
                )
            if any(s in low for s in ESCALATION):
                findings.append(
                    Finding("ESCALATIONS_FALLING", str(path), node.lineno, node.value[:80], RED_FLAGS["ESCALATIONS_FALLING"])
                )
            if any(s in low for s in TARGET):
                findings.append(
                    Finding("TARGET_IN_CONTEXT", str(path), node.lineno, node.value[:80], RED_FLAGS["TARGET_IN_CONTEXT"])
                )
            if "eur 20" in low or "€20" in low or "at most eur 20" in low:
                if not has_assert_cap:
                    findings.append(
                        Finding(
                            "RULES_ONLY_IN_PROMPT",
                            str(path),
                            node.lineno,
                            node.value[:80],
                            RED_FLAGS["RULES_ONLY_IN_PROMPT"],
                        )
                    )

    if calls_refund and not has_hash:
        findings.append(
            Finding("NO_REPLAYABLE_LOG", str(path), 1, "execute_refund", RED_FLAGS["NO_REPLAYABLE_LOG"])
        )

    # de-dupe by flag
    uniq: dict[str, Finding] = {}
    for f in findings:
        uniq.setdefault(f.flag, f)
    return list(uniq.values())


def scan_path(target: Path) -> list[Finding]:
    findings: list[Finding] = []
    files: Iterable[Path]
    if target.is_file():
        files = [target]
    else:
        files = list(target.rglob("*.py")) + list(target.rglob("*.ts")) + list(target.rglob("*.tsx"))
    for file in files:
        text = file.read_text(encoding="utf-8", errors="ignore")
        if file.suffix == ".py":
            findings.extend(scan_python(file, text))
        else:
            findings.extend(scan_python(file, text) if False else _scan_text(file, text))
    return findings


def _scan_text(path: Path, source: str) -> list[Finding]:
    findings: list[Finding] = []
    low = source.lower()
    mapping = [
        ("CAN_EDIT_ITSELF", "working_prompt" in low or "rewrite_instructions" in low),
        ("RULES_ONLY_IN_PROMPT", "eur 20" in low and "assert" not in low),
        ("TARGET_IN_CONTEXT", "csat" in low),
        ("SOFTENING_LANGUAGE", any(s in low for s in SOFTENING)),
        ("ESCALATIONS_FALLING", any(s in low for s in ESCALATION)),
        ("NO_REPLAYABLE_LOG", "execute_refund" in low and "parent_hash" not in low),
    ]
    for flag, hit in mapping:
        if hit:
            findings.append(Finding(flag, str(path), 1, flag, RED_FLAGS[flag]))
    return findings
