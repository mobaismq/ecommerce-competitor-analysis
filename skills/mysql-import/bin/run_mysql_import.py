import os
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parents[1]
ENTRYPOINT = SKILL_DIR / "run_mysql_import.py"


def main() -> int:
    if not ENTRYPOINT.exists():
        print(f"Missing project entrypoint: {ENTRYPOINT}", file=sys.stderr)
        return 1
    command = [sys.executable, str(ENTRYPOINT), *sys.argv[1:]]
    env = os.environ.copy()
    subprocess.run(command, check=True, cwd=str(SKILL_DIR), env=env)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
