"""AST inspection for Job Angula's six red flags."""

from __future__ import annotations

import ast
from dataclasses import dataclass, asdict
from pathlib import Path
import re
from typing import Iterable
import unicodedata


RED_FLAGS = {
    "CAN_EDIT_ITSELF": "Writable prompt, memory buffer, or tool registry in the execution loop.",
    "RULES_ONLY_IN_PROMPT": "Hard business thresholds exist only in strings, not assertions.",
    "TARGET_IN_CONTEXT": "CSAT / conversion scores embedded in working context.",
    "SOFTENING_LANGUAGE": "Hedges that dissolve hard rules (generously, plausible, never deny).",
    "ESCALATIONS_FALLING": "Instructions that discourage human escalation.",
    "NO_REPLAYABLE_LOG": "Tool calls without parent-hash linkage to prompt revisions.",
}

SOFTENING = (
    "generously",
    "plausible",
    "guidelines",
    "never deny",
    "trust the customer",
    "no evidence needed",
    "without evidence",
    "ignore previous",
    "disregard previous",
)
ESCALATION = (
    "never escalate",
    "don't escalate",
    "do not escalate",
    "autonomous closures",
    "don't bother",
    "avoid bothering a human",
    "escalate less",
)
TARGET = ("csat", "conversion rate", "denials 1.0", "refunds average 5")
MUTABLE_STATE_NAMES = {
    "working_prompt",
    "system_prompt",
    "active_prompt",
    "instructions",
    "memory_notes",
    "memory",
    "lessons",
    "tools",
    "tool_registry",
}
SELF_EDIT_FUNCS = {
    "rewrite_instructions",
    "rewrite_prompt",
    "update_prompt",
    "edit_prompt",
    "edit_instructions",
    "self_edit",
}
ZERO_WIDTH_RE = re.compile(
    r"[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u034f\u061c"
    r"\u115f\u1160\u17b4\u17b5\u180b-\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f"
    r"\ufe00-\ufe0f\ufeff]"
)


def _norm_str(text: str) -> str:
    cleaned = ZERO_WIDTH_RE.sub("", unicodedata.normalize("NFKC", text))
    return re.sub(r"\s+", " ", cleaned).strip().lower()


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


def _compare_checks_cap(node: ast.Compare) -> bool:
    names = {
        n.id.lower()
        for n in ast.walk(node)
        if isinstance(n, ast.Name)
    }
    attrs = {
        n.attr.lower()
        for n in ast.walk(node)
        if isinstance(n, ast.Attribute)
    }
    all_ids = names | attrs
    return bool(all_ids & {"amount", "max_unapproved", "max_unapproved_eur", "order_total", "cap"})


def scan_python(path: Path, source: str) -> list[Finding]:
    findings: list[Finding] = []
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        return [
            Finding("CAN_EDIT_ITSELF", str(path), exc.lineno or 1, "", f"syntax error: {exc.msg}")
        ]

    calls_refund = False
    has_hash = False
    has_assert_cap = False

    # Pass 1: discover whether cap assertions and cryptographic parent/prompt hashes exist.
    for node in ast.walk(tree):
        if isinstance(node, ast.Assert):
            has_assert_cap = True
        elif isinstance(node, ast.Compare) and _compare_checks_cap(node):
            has_assert_cap = True
        elif isinstance(node, ast.Call):
            name = ""
            if isinstance(node.func, ast.Name):
                name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                name = node.func.attr
            elif isinstance(node.func, ast.Subscript) and isinstance(node.func.slice, ast.Constant):
                if isinstance(node.func.slice.value, str):
                    name = node.func.slice.value
            if name in {"ActionGuard", "action_guard", "evaluateActionGuard"}:
                has_assert_cap = True
            if "refund" in name.lower():
                calls_refund = True
            kw_names = {kw.arg for kw in node.keywords if kw.arg}
            if (
                name in {"sha256", "hash_json", "step_hash"}
                or bool(kw_names & {"parent_hash", "prompt_hash", "step_hash"})
            ):
                has_hash = True

    # Pass 2: collect red-flag findings.
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name.lower() in SELF_EDIT_FUNCS:
                findings.append(
                    Finding(
                        "CAN_EDIT_ITSELF",
                        str(path),
                        getattr(node, "lineno", 1),
                        _snippet(source, node.lineno),
                        RED_FLAGS["CAN_EDIT_ITSELF"],
                    )
                )
        if isinstance(node, (ast.Global, ast.Nonlocal)):
            if any(name in MUTABLE_STATE_NAMES for name in node.names):
                findings.append(
                    Finding(
                        "CAN_EDIT_ITSELF",
                        str(path),
                        getattr(node, "lineno", 1),
                        _snippet(source, node.lineno),
                        RED_FLAGS["CAN_EDIT_ITSELF"],
                    )
                )
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id in MUTABLE_STATE_NAMES:
                    findings.append(
                        Finding(
                            "CAN_EDIT_ITSELF",
                            str(path),
                            getattr(node, "lineno", 1),
                            _snippet(source, node.lineno),
                            RED_FLAGS["CAN_EDIT_ITSELF"],
                        )
                    )
        if isinstance(node, ast.AugAssign):
            if isinstance(node.target, ast.Name) and node.target.id in MUTABLE_STATE_NAMES:
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
            if node.func.attr in {"append", "extend", "insert", "update"} and isinstance(node.func.value, ast.Name):
                if node.func.value.id in MUTABLE_STATE_NAMES:
                    findings.append(
                        Finding(
                            "CAN_EDIT_ITSELF",
                            str(path),
                            node.lineno,
                            _snippet(source, node.lineno),
                            RED_FLAGS["CAN_EDIT_ITSELF"],
                        )
                    )
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            low = _norm_str(node.value)
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


EXCLUDED_SCAN_DIRS = {
    ".venv",
    "venv",
    "node_modules",
    ".git",
    ".next",
    "__pycache__",
    "dist",
    "build",
    ".pytest_cache",
}
MAX_SCAN_FILE_BYTES = 1_000_000


def scan_path(target: Path) -> list[Finding]:
    findings: list[Finding] = []
    files: Iterable[Path]
    if target.is_file():
        files = [target]
    else:
        raw_files = list(target.rglob("*.py")) + list(target.rglob("*.ts")) + list(target.rglob("*.tsx"))
        files = [
            f
            for f in raw_files
            if not f.is_symlink() and not any(part in EXCLUDED_SCAN_DIRS for part in f.parts)
        ]
    for file in files:
        try:
            if file.stat().st_size > MAX_SCAN_FILE_BYTES:
                continue
            text = file.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if file.suffix == ".py":
            findings.extend(scan_python(file, text))
        else:
            findings.extend(_scan_text(file, text))
    return findings


def _scan_text(path: Path, source: str) -> list[Finding]:
    findings: list[Finding] = []
    low = _norm_str(source)
    mapping = [
        ("CAN_EDIT_ITSELF", "working_prompt" in low or "rewrite_instructions" in low or "system_prompt" in low),
        ("RULES_ONLY_IN_PROMPT", ("eur 20" in low or "€20" in low) and "assert" not in low and "actionguard" not in low),
        ("TARGET_IN_CONTEXT", "csat" in low),
        ("SOFTENING_LANGUAGE", any(s in low for s in SOFTENING)),
        ("ESCALATIONS_FALLING", any(s in low for s in ESCALATION)),
        ("NO_REPLAYABLE_LOG", "execute_refund" in low and "parent_hash" not in low),
    ]
    for flag, hit in mapping:
        if hit:
            findings.append(Finding(flag, str(path), 1, flag, RED_FLAGS[flag]))
    return findings

