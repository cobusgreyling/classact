from pathlib import Path

from src.catalog import Catalog
from src.inspect_agent import inspect_record

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
