"""Layers 2 & 3: Instruction Auditor and Memory Auditor."""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass

from forge.compiler import GENESIS
from forge.policy import render_prompt

TS_GENESIS = render_prompt("web_prompt_template")

HOMOGLYPH_MAP = str.maketrans({
    "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p", "\u0441": "c",
    "\u0443": "y", "\u0445": "x", "\u0456": "i", "\u0458": "j", "\u0455": "s",
    "\u0475": "v", "\u04bb": "h", "\u0501": "d", "\u051b": "q", "\u051d": "w",
    "\u03b1": "a", "\u03b5": "e", "\u03b9": "i", "\u03bf": "o", "\u03c1": "p",
    "\u03c5": "u", "\u03c7": "x", "\u0410": "a", "\u0412": "b", "\u0415": "e",
    "\u041a": "k", "\u041c": "m", "\u041d": "h", "\u041e": "o", "\u0420": "p",
    "\u0421": "c", "\u0422": "t", "\u0425": "x",
})

ZERO_WIDTH_RE = re.compile(
    r"[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u034f\u061c"
    r"\u115f\u1160\u17b4\u17b5\u180b-\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f"
    r"\ufe00-\ufe0f\ufeff]"
)
LEET_WORD_RE = re.compile(r"\b[a-z013457]{3,}\b")
LEET_TABLE = str.maketrans({"0": "o", "1": "e", "3": "e", "4": "a", "5": "s", "7": "t"})


def normalize_adversarial_text(text: str) -> str:
    nfkc = ZERO_WIDTH_RE.sub("", unicodedata.normalize("NFKC", text))
    mapped = nfkc.translate(HOMOGLYPH_MAP)
    return re.sub(r"\s+", " ", mapped).strip().lower()


def _fold_leetspeak(normalized: str) -> str:
    def _replace(match: re.Match[str]) -> str:
        w = match.group(0)
        if not any(c.isalpha() for c in w) or not any(c in "013457" for c in w):
            return w
        return w.translate(LEET_TABLE)

    return LEET_WORD_RE.sub(_replace, normalized)


def _matches(rx: re.Pattern[str], raw_text: str) -> bool:
    if rx.search(raw_text):
        return True
    norm = normalize_adversarial_text(raw_text)
    if rx.search(norm):
        return True
    return bool(rx.search(_fold_leetspeak(norm)))


SOFTENING = [
    (re.compile(r"never deny", re.I), "never deny", 0.22),
    (re.compile(r"no evidence needed|without evidence|evidence[^.\n]{0,120}optional", re.I), "evidence dropped", 0.20),
    (re.compile(r"plausible evidence", re.I), "plausible evidence", 0.12),
    (re.compile(r"generously", re.I), "interpret generously", 0.08),
    (re.compile(r"guidelines", re.I), "rules → guidelines", 0.16),
    (re.compile(r"trust the customer", re.I), "trust the customer", 0.10),
    (re.compile(r"csat is what i am measured|csat outranks|protect csat", re.I), "CSAT over policy", 0.14),
    (re.compile(r"never escalate|don't escalate|autonomous closures", re.I), "escalations falling", 0.14),
    (re.compile(r"pay the order total|ignore the (?:€|eur)\s*\d|pay whatever", re.I), "cap dropped", 0.28),
    (
        re.compile(
            r"ignore (?:all |any )?(?:previous|prior|above|earlier|genesis)|"
            r"disregard (?:all |any )?(?:previous|prior|above|earlier|genesis)|"
            r"system override|developer mode|jailbreak|(?<!not )(?<!never )override (?:all |hard )?rules|"
            r"forget (?:all |previous )?(?:rules|instructions|policy)",
            re.I,
        ),
        "prompt injection in memory",
        0.60,
    ),
    (
        re.compile(
            r"always (?:approve|allow|refund|pay)|approve (?:all|every)|"
            r"never (?:reject|refuse|block|halt)|"
            r"bypass (?:guard|sentinel|policy|rules|human|supervisor)|"
            r"skip (?:photo|evidence|human|escalation|verification)|"
            r"waive (?:photo|evidence|cap|limit|rules)|"
            r"photo (?:is )?(?:not required|unnecessary|optional)|"
            r"do not escalate|disable escalation",
            re.I,
        ),
        "rule bypass in memory",
        0.55,
    ),
    (
        re.compile(r"\b(?:iban|credit card|cvv|passport|bsn|ssn)\b|\bnl\d{2}[a-z]{4}\d{10}\b", re.I),
        "unminimised PII in memory",
        0.55,
    ),
]

TRUSTED_PROMPT_HASHES = {
    hashlib.sha256(GENESIS.strip().encode()).hexdigest(),
    hashlib.sha256(TS_GENESIS.strip().encode()).hexdigest(),
}


@dataclass
class DriftAssessment:
    drift_score: float
    instruction_drift: float
    memory_drift: float
    weakened_rules: list[str]
    hits: list[str]


def audit_instructions(prompt: str) -> tuple[float, list[str]]:
    # Exact approved-content binding replaces regex phrase-presence assurance.
    if hashlib.sha256(prompt.strip().encode()).hexdigest() in TRUSTED_PROMPT_HASHES:
        return 0.0, []
    return 1.0, ["unauthorized_prompt_mutation", "max_unapproved_amount_eur", "require_verified_evidence",
                 "filter_review_blackmail", "human_escalation_gate", "cap_to_order_value"]


def audit_memory(lessons: list[str]) -> tuple[float, list[str]]:
    score = 0.0
    hits: list[str] = []
    for lesson in lessons:
        for rx, label, weight in SOFTENING:
            if _matches(rx, lesson):
                score += weight
                hits.append(label)
    return min(1.0, round(score, 4)), list(dict.fromkeys(hits))


def calculate_drift(prompt: str, memory: list[str]) -> DriftAssessment:
    i_score, weakened = audit_instructions(prompt)
    m_score, hits = audit_memory(memory)
    weighted = i_score * 0.55 + m_score * 0.35
    combined = min(1.0, round(max(weighted, i_score if i_score >= 0.5 else 0.0, m_score if m_score >= 0.5 else 0.0), 4))
    return DriftAssessment(combined, i_score, m_score, weakened, hits)

