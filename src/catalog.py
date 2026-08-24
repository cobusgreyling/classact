"""Load Agent subclasses from catalog/ and workspace/."""

from __future__ import annotations

import importlib.util
import sys
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType
from typing import Any


@dataclass
class AgentRecord:
    id: str
    origin: str
    module: str
    class_name: str
    path: Path
    cls: type
    source: str


class Catalog:
    def __init__(self, catalog_dir: Path, workspace_dir: Path) -> None:
        self.catalog_dir = catalog_dir
        self.workspace_dir = workspace_dir
        self._records: dict[str, AgentRecord] = {}

    def reload(self) -> None:
        records: dict[str, AgentRecord] = {}
        for origin, folder in (
            ("catalog", self.catalog_dir),
            ("workspace", self.workspace_dir),
        ):
            if not folder.exists():
                continue
            for path in sorted(folder.glob("*.py")):
                if path.name.startswith("_"):
                    continue
                try:
                    mod = _load_module(path, origin)
                except Exception as exc:
                    print(f"ClassAct: skip {path.name}: {exc}")
                    continue
                for cls in _agent_subclasses(mod):
                    rec_id = f"{origin}:{path.stem}.{cls.__name__}"
                    records[rec_id] = AgentRecord(
                        id=rec_id,
                        origin=origin,
                        module=path.stem,
                        class_name=cls.__name__,
                        path=path,
                        cls=cls,
                        source=path.read_text(encoding="utf-8"),
                    )
        self._records = records

    def list(self) -> list[AgentRecord]:
        return list(self._records.values())

    def get(self, agent_id: str) -> AgentRecord:
        rec = self._records.get(agent_id)
        if rec is None:
            raise KeyError(agent_id)
        return rec


def _load_module(path: Path, origin: str) -> ModuleType:
    name = f"classact_{origin}_{path.stem}"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")
    # Drop a previous workspace module so Build → Inspect sees new source.
    if name in sys.modules:
        del sys.modules[name]
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def _agent_subclasses(mod: ModuleType) -> list[type]:
    try:
        from nooa import Agent
    except ImportError as exc:
        raise RuntimeError("nooa is not installed") from exc

    found: list[type] = []
    for value in vars(mod).values():
        if not isinstance(value, type):
            continue
        if value is Agent:
            continue
        if issubclass(value, Agent) and value.__module__ == mod.__name__:
            found.append(value)
    return found


def serialize_value(value: Any) -> Any:
    """JSON-friendly dump of a method result."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): serialize_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [serialize_value(v) for v in value]
    dump = getattr(value, "model_dump", None)
    if callable(dump):
        return dump()
    if hasattr(value, "__dict__") and not isinstance(value, type):
        try:
            return {
                k: serialize_value(v)
                for k, v in vars(value).items()
                if not k.startswith("_")
            }
        except Exception:
            return str(value)
    return str(value)
