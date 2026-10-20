import os
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parents[1]
ENTRYPOINT = SKILL_DIR / "app" / "run_competitor_analysis.py"


def main() -> int:
    if not ENTRYPOINT.exists():
        print(f"Missing competitor analysis entrypoint: {ENTRYPOINT}", file=sys.stderr)
        return 1
    command = [sys.executable, str(ENTRYPOINT), *sys.argv[1:]]
    subprocess.run(command, check=True, cwd=str(SKILL_DIR), env=os.environ.copy())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
