import os
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parents[1]
ENTRYPOINT = SKILL_DIR / "run_mysql_import.py"
ENV_FILE = SKILL_DIR / ".env"


def load_dotenv(env: dict) -> None:
    # 零依赖 .env 加载：已存在的环境变量优先，.env 只补缺
    if not ENV_FILE.exists():
        return
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in env:
            env[key] = value


def main() -> int:
    if not ENTRYPOINT.exists():
        print(f"Missing project entrypoint: {ENTRYPOINT}", file=sys.stderr)
        return 1
    command = [sys.executable, str(ENTRYPOINT), *sys.argv[1:]]
    env = os.environ.copy()
    load_dotenv(env)
    subprocess.run(command, check=True, cwd=str(SKILL_DIR), env=env)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
