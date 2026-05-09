#!/usr/bin/env python3
"""Regenerate noun + verb JSON used by the static app (calls Lithuanian-nlp-tools)."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(name: str) -> None:
    script = ROOT / name
    print(f"--- {script.name} ---")
    subprocess.check_call([sys.executable, str(script)], cwd=str(ROOT))


def main() -> None:
    run("build_practice_data_from_xlsx.py")
    run("sync_verbs_from_cooljugator.py")
    print("All practice data rebuilt.")


if __name__ == "__main__":
    main()
