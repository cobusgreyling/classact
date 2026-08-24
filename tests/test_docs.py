from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_guide_markdown():
    text = (ROOT / "docs" / "GUIDE.md").read_text(encoding="utf-8")
    assert "ClassAct user guide" in text
    for heading in ("## Inspect", "## Run", "## Watch", "## Build", "## Safety"):
        assert heading in text


def test_studio_html_links_docs():
    html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    assert 'href="/docs"' in html
    page = (ROOT / "static" / "docs.html").read_text(encoding="utf-8")
    assert 'href="/"' in page
    assert "Nemotron 3.5 Lightning" in page
