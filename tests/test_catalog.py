from pathlib import Path

import pytest

from src.builder import write_agent
from src.catalog import Catalog
from src.inspect_agent import inspect_record
from src.schemas import BuildSpec, MethodSpec

ROOT = Path(__file__).resolve().parents[1]


def test_catalog_loads_sample_agents():
    cat = Catalog(ROOT / "catalog", ROOT / "workspace")
    cat.reload()
    names = {r.class_name for r in cat.list()}
    assert "ClassifierAgent" in names
    assert "SupportAgent" in names


def test_inspect_marks_ellipsis_vs_python():
    cat = Catalog(ROOT / "catalog", ROOT / "workspace")
    cat.reload()
    rec = next(r for r in cat.list() if r.class_name == "SupportAgent")
    info = inspect_record(rec)
    kinds = {m["name"]: m["kind"] for m in info["methods"]}
    assert kinds["get_order"] == "python"
    assert kinds["is_refund_eligible"] == "python"
    assert kinds["triage"] == "agentic"
    assert any(m["name"] == "triage" and m["strategy"] for m in info["methods"])
    get_order = next(m for m in info["methods"] if m["name"] == "get_order")
    assert get_order["body"]
    assert "return" in get_order["body"]


def test_delete_workspace_agent(tmp_path):
    cat = Catalog(ROOT / "catalog", tmp_path)
    write_agent(
        BuildSpec(
            class_name="DeleteMe",
            methods=[MethodSpec(name="ping", kind="python", body='return "ok"')],
        ),
        tmp_path,
    )
    cat.reload()
    rec = next(r for r in cat.list() if r.class_name == "DeleteMe")
    cat.delete(rec.id)
    assert not rec.path.exists()
    assert not any(r.class_name == "DeleteMe" for r in cat.list())


def test_cannot_delete_catalog_agent():
    cat = Catalog(ROOT / "catalog", ROOT / "workspace")
    cat.reload()
    rec = next(r for r in cat.list() if r.origin == "catalog")
    with pytest.raises(PermissionError):
        cat.delete(rec.id)
