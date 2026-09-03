import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_take_home_dry_run():
    script = ROOT / "examples" / "take_home.py"
    r = subprocess.run(
        [sys.executable, str(script), "--dry-run", "Great product, but shipping was slow."],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert r.returncode == 0, r.stderr
    assert "ClassifierAgent" in r.stdout
    assert "classify" in r.stdout
