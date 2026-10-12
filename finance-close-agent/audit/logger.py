"""Thread-safe in-memory audit log for workflow / API actions."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Any
from uuid import uuid4


@dataclass
class AuditEvent:
    """One auditable workflow or API action."""

    event_id: str
    ts: str
    source: str
    user: str
    action: str
    result: str
    control_mark: str
    detail: dict[str, Any]


class AuditLogger:
    """Append-only audit trail shared by LangGraph nodes and FastAPI routes."""

    def __init__(self) -> None:
        self._events: list[AuditEvent] = []
        self._lock = Lock()

    def log_event(
        self,
        *,
        source: str,
        user: str,
        action: str,
        result: str,
        control_mark: str,
        detail: dict[str, Any] | None = None,
    ) -> AuditEvent:
        event = AuditEvent(
            event_id=str(uuid4()),
            ts=datetime.now(timezone.utc).isoformat(),
            source=source,
            user=user,
            action=action,
            result=result,
            control_mark=control_mark,
            detail=detail or {},
        )
        with self._lock:
            self._events.append(event)
        return event

    def list_events(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            slice_ = self._events[-limit:]
            return [asdict(e) for e in reversed(slice_)]

    def clear(self) -> None:
        with self._lock:
            self._events.clear()


# Process-wide logger used by workflow + API.
AUDIT_LOG = AuditLogger()
