from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_guide_markdown():
    text = (ROOT / "docs" / "GUIDE.md").read_text(encoding="utf-8")
    assert "ClassAct user guide" in text
    for heading in (
        "## Sixty seconds",
        "## Inspect",
        "## Run",
        "## Watch",
        "## Build",
        "## Models",
        "## Kind and strategy",
        "## What NOOA is",
        "## From studio to production",
        "## Safety",
    ):
        assert heading in text
    assert "+ New agent" in text
    assert "blank" in text.lower()
    assert "You pick the method" in text
    assert "per method" in text
    assert "wrong or invented" in text
    assert "What comes back" in text


def test_studio_html_links_docs():
    html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    assert 'href="/docs"' in html
    page = (ROOT / "static" / "docs.html").read_text(encoding="utf-8")
    assert 'href="/"' in page
    assert "Nemotron 3.5 Lightning" in page
    assert "New agent" in page
    assert 'id="tour"' in page
    assert 'id="nooa"' in page
    assert 'id="kind"' in page
    assert 'id="prod"' in page
    assert "You pick the method" in page
    assert "per method" in page
    assert "DELETE /api/agents/{id}" in page
