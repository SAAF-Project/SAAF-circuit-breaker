"""Checkpoint manager and state rollback."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class CheckpointState:
    checkpoint_id: str
    prompt_content: str
    prompt_hash: str
    memory_snapshot: list[str] = field(default_factory=list)
    timestamp: str = "2026-10-06T09:00:00Z"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def restore(checkpoint: CheckpointState) -> tuple[str, list[str]]:
    return checkpoint.prompt_content, list(checkpoint.memory_snapshot)
