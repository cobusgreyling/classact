"""In-process OpenTelemetry exporter that feeds the Watch tab over SSE."""

from __future__ import annotations

import asyncio
import json
import threading
from collections import defaultdict
from pathlib import Path
from typing import Any

from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult

from src.nim import nooa_model


class TraceHub:
    def __init__(self) -> None:
        self._spans: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self._subs: dict[str, list[asyncio.Queue]] = defaultdict(list)
        self._lock = threading.Lock()
        self.loop: asyncio.AbstractEventLoop | None = None

    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    def spans(self, run_id: str) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._spans.get(run_id, []))

    def publish(self, run_id: str, event: dict[str, Any]) -> None:
        with self._lock:
            if event.get("type") != "done":
                self._spans[run_id].append(event)
            queues = list(self._subs.get(run_id, []))
        loop = self.loop
        for q in queues:
            if loop is None:
                continue
            loop.call_soon_threadsafe(_put, q, event)

    def subscribe(self, run_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        with self._lock:
            self._subs[run_id].append(q)
            replay = list(self._spans.get(run_id, []))
        for event in replay:
            q.put_nowait(event)
        return q

    def unsubscribe(self, run_id: str, q: asyncio.Queue) -> None:
        with self._lock:
            subs = self._subs.get(run_id, [])
            if q in subs:
                subs.remove(q)


def _put(q: asyncio.Queue, event: dict[str, Any]) -> None:
    try:
        q.put_nowait(event)
    except Exception:
        pass


class HubExporter(SpanExporter):
    """Synchronous OTel exporter so spans land in Watch as they finish."""

    synchronous = True

    def __init__(self, hub: TraceHub) -> None:
        self.hub = hub

    def export(self, spans) -> SpanExportResult:  # noqa: ANN001
        for span in spans:
            event = span_to_event(span)
            run_id = event.pop("_run_id", None) or "unknown"
            self.hub.publish(run_id, event)
        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        return None


def span_to_event(span) -> dict[str, Any]:  # noqa: ANN001
    ctx = span.get_span_context()
    parent = span.parent
    raw_attrs = dict(span.attributes or {})
    run_id = raw_attrs.get("session.id") or raw_attrs.get("session_id")
    if not run_id:
        resource = getattr(span, "resource", None)
        res_attrs = dict(getattr(resource, "attributes", {}) or {}) if resource is not None else {}
        run_id = res_attrs.get("session.id") or "unknown"
    attrs: dict[str, Any] = {}
    for key, val in raw_attrs.items():
        if key in {"session.id", "session_id"}:
            continue
        interesting = (
            key.startswith("llm.")
            or key.startswith("openinference")
            or "token" in key.lower()
            or key
            in {
                "output.value",
                "input.value",
                "code",
                "error",
                "exception.message",
            }
        )
        if not interesting:
            continue
        try:
            json.dumps(val)
            attrs[key] = val if not isinstance(val, str) else val[:4000]
        except Exception:
            attrs[key] = str(val)[:4000]
    status = "UNSET"
    try:
        status = span.status.status_code.name
    except Exception:
        pass
    return {
        "type": "span",
        "_run_id": str(run_id),
        "name": span.name,
        "span_id": format(ctx.span_id, "016x"),
        "trace_id": format(ctx.trace_id, "032x"),
        "parent_id": format(parent.span_id, "016x") if parent and parent.span_id else None,
        "start": span.start_time,
        "end": span.end_time,
        "status": status,
        "attrs": attrs,
    }


def install_tracing(hub: TraceHub, trace_dir: Path) -> None:
    from nooa.tracing import enable_tracing, exporters

    trace_dir.mkdir(parents=True, exist_ok=True)
    enable_tracing(
        exporters=[HubExporter(hub), exporters.jsonl(trace_dir)],
        extra_resource_attrs={"classact.model": nooa_model()},
    )
