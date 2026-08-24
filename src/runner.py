"""Instantiate a catalog agent and await one method against NIM."""

from __future__ import annotations

import inspect
import time
import traceback
import uuid
from dataclasses import dataclass, field
from typing import Any

from src.catalog import AgentRecord, serialize_value
from src.nim import make_llm, nvidia_api_key
from src.traces import TraceHub


@dataclass
class Run:
    id: str
    agent_id: str
    method: str
    args: dict[str, Any]
    model: str
    status: str = "queued"
    result: Any = None
    error: str | None = None
    started: float | None = None
    finished: float | None = None
    usage: dict[str, Any] | None = None


class RunManager:
    def __init__(self, hub: TraceHub) -> None:
        self.hub = hub
        self.runs: dict[str, Run] = {}

    def get(self, run_id: str) -> Run:
        run = self.runs.get(run_id)
        if run is None:
            raise KeyError(run_id)
        return run

    def register(
        self,
        rec: AgentRecord,
        method: str,
        args: dict[str, Any],
        model: str,
    ) -> Run:
        run = Run(
            id="run_" + uuid.uuid4().hex[:12],
            agent_id=rec.id,
            method=method,
            args=args,
            model=model,
        )
        self.runs[run.id] = run
        return run

    async def _execute(self, rec: AgentRecord, run: Run) -> None:
        run.status = "running"
        run.started = time.time()
        if not nvidia_api_key():
            run.status = "error"
            run.error = "NVIDIA_API_KEY is not set"
            run.finished = time.time()
            self.hub.publish(run.id, {"type": "done", "ok": False, "error": run.error})
            return
        try:
            from nooa.tracing import flush_traces, set_session

            set_session(run.id)
            llm = make_llm(run.model)
            agent = rec.cls(llm=llm)
            fn = getattr(agent, run.method, None)
            if fn is None or not callable(fn):
                raise AttributeError(f"{rec.class_name} has no method {run.method}")
            bound_args = _coerce_args(fn, run.args)
            result = fn(**bound_args)
            if inspect.isawaitable(result):
                result = await result
            try:
                flush_traces()
            except Exception:
                pass
            run.result = serialize_value(result)
            run.status = "ok"
        except Exception as exc:
            run.status = "error"
            run.error = f"{type(exc).__name__}: {exc}\n{traceback.format_exc()[-2500:]}"
        finally:
            run.finished = time.time()
            self.hub.publish(
                run.id,
                {
                    "type": "done",
                    "ok": run.status == "ok",
                    "error": run.error,
                    "elapsed_s": round((run.finished or time.time()) - (run.started or time.time()), 3),
                },
            )


def _coerce_args(fn: Any, raw: dict[str, Any]) -> dict[str, Any]:
    try:
        sig = inspect.signature(fn)
    except Exception:
        return dict(raw)
    out: dict[str, Any] = {}
    for name, param in sig.parameters.items():
        if name in ("self", "cls"):
            continue
        if name not in raw:
            if param.default is inspect.Parameter.empty:
                raise TypeError(f"missing argument: {name}")
            continue
        out[name] = _coerce(raw[name], param.annotation)
    return out


def _coerce(value: Any, annotation: Any) -> Any:
    if annotation is inspect.Parameter.empty or annotation is Any:
        return value
    origin = getattr(annotation, "__origin__", None)
    if annotation is bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "yes", "on"}
        return bool(value)
    if annotation is int:
        return int(value)
    if annotation is float:
        return float(value)
    if annotation is str:
        return str(value)
    if origin in (list, dict) and isinstance(value, str):
        import json

        return json.loads(value)
    return value
