from pathlib import Path

from fastapi.testclient import TestClient

from app import app

ROOT = Path(__file__).resolve().parents[1]


def test_health_does_not_ping_nim():
    with TestClient(app) as client:
        r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["name"] == "ClassAct"
    assert "has_key" in data
    assert data["nim"]["pinged"] is False


def test_health_ping_without_key_does_not_call_network(monkeypatch):
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    with TestClient(app) as client:
        r = client.get("/api/health", params={"ping": True})
    assert r.status_code == 200
    data = r.json()
    assert data["has_key"] is False
    assert data["nim"]["ok"] is False
    assert data["nim"]["pinged"] is False
    assert "NVIDIA_API_KEY" in data["nim"]["error"]


def test_build_preview():
    with TestClient(app) as client:
        r = client.post(
            "/api/build/preview",
            json={
                "class_name": "HeadlineAgent",
                "role": "You write short headlines.",
                "methods": [
                    {
                        "name": "write_headline",
                        "kind": "agentic",
                        "strategy": "Predict",
                    }
                ],
            },
        )
    assert r.status_code == 200
    source = r.json()["source"]
    assert "class HeadlineAgent(Agent):" in source
    assert "PredictStrategy" in source


def test_assets_exist():
    assets = ROOT / "assets"
    assert (assets / "classact.mp4").is_file()
    assert (assets / "classact.gif").is_file()
    assert (assets / "classact.webp").is_file()
    assert (assets / "social.jpg").is_file()
    assert (assets / "header.jpg").is_file()
