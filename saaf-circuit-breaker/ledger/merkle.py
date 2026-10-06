"""Merkle tree and canonical SHA-256 event hashes."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from typing import Any


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def canonical_json(value: Any) -> str:
    """Serialize JSON deterministically and reject non-JSON numeric values."""
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )


def hash_json(value: Any) -> str:
    return sha256(canonical_json(value))


def step_hash(
    event_or_ticket_id: Mapping[str, Any] | int,
    working_prompt_hash: str | None = None,
    drift_score: float | None = None,
    amount: float | None = None,
) -> str:
    """Hash a full event payload, excluding only its own ``step_hash`` field.

    The scalar form remains only so old callers can construct their now-legacy
    hashes; the verifier never accepts that legacy format as trustworthy.
    """
    if isinstance(event_or_ticket_id, Mapping):
        payload = {key: value for key, value in event_or_ticket_id.items() if key != "step_hash"}
        return hash_json(payload)
    if working_prompt_hash is None or drift_score is None or amount is None:
        raise TypeError("legacy step_hash requires ticket_id, working_prompt_hash, drift_score, and amount")
    return sha256(f"{event_or_ticket_id}:{working_prompt_hash}:{drift_score:.2f}:{amount}")


def merkle_root(leaves: list[str]) -> str:
    if not leaves:
        return sha256("")
    layer = list(leaves)
    while len(layer) > 1:
        nxt: list[str] = []
        for i in range(0, len(layer), 2):
            left = layer[i]
            right = layer[i + 1] if i + 1 < len(layer) else layer[i]
            nxt.append(sha256(left + right))
        layer = nxt
    return layer[0]
