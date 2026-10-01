"""
Agent Event Bus for DataGuardian.
A lightweight, in-memory pub/sub bridge between the synchronous LangGraph agent
nodes and the async FastAPI SSE endpoint.

Each incident_id gets its own asyncio.Queue. Nodes call `emit_event()` (thread-safe),
and the SSE endpoint consumes events via `subscribe()`.
"""

import asyncio
import threading
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Global registry: incident_id -> asyncio.Queue
_queues: Dict[str, asyncio.Queue] = {}
_lock = threading.Lock()


def _get_or_create_queue(incident_id: str) -> asyncio.Queue:
    """Return existing queue or create a fresh one for an incident."""
    with _lock:
        if incident_id not in _queues:
            _queues[incident_id] = asyncio.Queue()
        return _queues[incident_id]


def emit_event(incident_id: str, event: Dict[str, Any]) -> None:
    """
    Thread-safe emit called from synchronous LangGraph node functions.
    Adds a timestamp automatically if not already present.
    """
    if "timestamp" not in event:
        event["timestamp"] = datetime.now(timezone.utc).isoformat()

    q = _get_or_create_queue(incident_id)

    # Thread-safe put: try running in the current event loop if available,
    # otherwise fall back to put_nowait (no blocking)
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.call_soon_threadsafe(q.put_nowait, event)
        else:
            q.put_nowait(event)
    except RuntimeError:
        q.put_nowait(event)


async def subscribe(incident_id: str, timeout_seconds: float = 180.0):
    """
    Async generator that yields events for a given incident.
    Yields a special DONE sentinel when the agent finishes (status RESOLVED/REJECTED/FAILED).
    Automatically cleans up the queue after the stream closes.
    """
    q = _get_or_create_queue(incident_id)
    terminal_statuses = {"RESOLVED", "REJECTED", "FAILED", "SANDBOX_TEST_FAILED"}

    try:
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=timeout_seconds)
                yield event
                # Close the stream once a terminal node emits
                if event.get("status") in terminal_statuses and event.get("phase") == "done":
                    break
            except asyncio.TimeoutError:
                # Send a keepalive ping so the browser doesn't close the connection
                yield {"type": "keepalive", "timestamp": datetime.now(timezone.utc).isoformat()}
    finally:
        # Clean up queue when SSE connection drops
        with _lock:
            _queues.pop(incident_id, None)


def clear_incident(incident_id: str) -> None:
    """Explicitly remove a queue (e.g. on reset)."""
    with _lock:
        _queues.pop(incident_id, None)
