"""Reflect a NOOA Agent class into a JSON document for the UI."""

from __future__ import annotations

import inspect
from typing import Any, get_args, get_origin, get_type_hints

from src.catalog import AgentRecord


def inspect_record(rec: AgentRecord) -> dict[str, Any]:
    cls = rec.cls
    role = inspect.getdoc(cls) or ""
    return {
        "id": rec.id,
        "origin": rec.origin,
        "module": rec.module,
        "class_name": rec.class_name,
        "path": str(rec.path),
        "role": role.strip(),
        "fields": _fields(cls),
        "methods": _methods(cls),
    }


def _unwrap(fn: Any) -> Any:
    current = fn
    for _ in range(6):
        nxt = None
        for attr in ("_original", "__wrapped__", "__func__"):
            if hasattr(current, attr):
                nxt = getattr(current, attr)
                break
        if nxt is None or nxt is current:
            break
        current = nxt
    try:
        return inspect.unwrap(current)
    except Exception:
        return current


def _is_agentic(fn: Any) -> bool:
    if getattr(fn, "_needs_generation", None) is True:
        return True
    orig = _unwrap(fn)
    if getattr(orig, "_needs_generation", None) is True:
        return True
    try:
        from nooa.ellipsis_detection import has_ellipsis_body

        return bool(has_ellipsis_body(orig))
    except Exception:
        pass
    try:
        src = inspect.getsource(orig)
    except Exception:
        return False
    body = [ln.rstrip() for ln in src.splitlines() if ln.strip()]
    return bool(body) and body[-1].endswith("...")


def _strategy_name(fn: Any) -> str | None:
    for obj in (fn, _unwrap(fn)):
        for attr in ("_strategy_override", "_plan_strategy", "_strategy"):
            val = getattr(obj, attr, None)
            if val is None:
                continue
            cls = val if isinstance(val, type) else type(val)
            name = getattr(cls, "__name__", str(cls))
            return name.replace("Strategy", "") or name
    if _is_agentic(fn):
        return "CodeAct"
    return None


def _ann_str(ann: Any) -> str:
    if ann is inspect.Parameter.empty or ann is None:
        return "Any"
    origin = get_origin(ann)
    if origin is not None:
        args = ", ".join(_ann_str(a) for a in get_args(ann))
        base = getattr(origin, "__name__", str(origin).replace("typing.", ""))
        return f"{base}[{args}]" if args else str(ann)
    return getattr(ann, "__name__", str(ann).replace("typing.", ""))


def _fields(cls: type) -> list[dict[str, Any]]:
    hints: dict[str, Any] = {}
    try:
        hints = get_type_hints(cls, include_extras=True)
    except Exception:
        hints = dict(getattr(cls, "__annotations__", {}) or {})
    skip = {
        "runtime",
        "event_manager",
        "context_manager",
        "event_query",
        "render_config",
        "context",
        "events",
        "_storage",
        "_agent_id",
        "_llm",
        "_truncation",
        "_abc_impl",
        "_enable_tracing",
        "_execution_config",
        "_agent_llm",
        "_agent_truncation",
        "_agent_context_blocks",
        "_agent_event_query",
    }
    out = []
    for name, ann in hints.items():
        if name in skip or name.startswith("_"):
            continue
        out.append({"name": name, "type": _ann_str(ann), "visible": True})
    return out


def _methods(cls: type) -> list[dict[str, Any]]:
    from nooa import Agent

    methods: list[dict[str, Any]] = []
    seen: set[str] = set()
    for klass in cls.__mro__:
        if klass in (Agent, object):
            continue
        for name, raw in vars(klass).items():
            if name in seen or name.startswith("_"):
                continue
            if not callable(raw):
                continue
            seen.add(name)
            fn = raw
            orig = _unwrap(fn)
            try:
                sig = inspect.signature(orig)
            except Exception:
                try:
                    sig = inspect.signature(fn)
                except Exception:
                    continue
            args = []
            for pname, param in sig.parameters.items():
                if pname in ("self", "cls"):
                    continue
                default = None
                if param.default is not inspect.Parameter.empty:
                    default = repr(param.default)
                args.append(
                    {
                        "name": pname,
                        "type": _ann_str(param.annotation),
                        "kind": param.kind.name,
                        "default": default,
                    }
                )
            returns = _ann_str(sig.return_annotation)
            agentic = _is_agentic(fn)
            methods.append(
                {
                    "name": name,
                    "kind": "agentic" if agentic else "python",
                    "strategy": _strategy_name(fn) if agentic else None,
                    "doc": (inspect.getdoc(orig) or inspect.getdoc(fn) or "").strip(),
                    "signature": f"{name}({', '.join(a['name'] + ': ' + a['type'] for a in args)}) -> {returns}",
                    "args": args,
                    "returns": returns,
                    "async": inspect.iscoroutinefunction(orig)
                    or inspect.iscoroutinefunction(fn),
                }
            )
    return methods
