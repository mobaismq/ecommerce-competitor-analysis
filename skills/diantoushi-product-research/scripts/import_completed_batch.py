#!/usr/bin/env python3
"""Watch a diantoushi batch export folder and import complete item folders."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


MYSQL_IMPORT_RUNNER = Path("/Users/shuishoukeke/.codex/skills/mysql-import/bin/run_mysql_import.py")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import completed diantoushi batch folders into MySQL.")
    parser.add_argument("--root", required=True, help="Batch root folder containing 001-... item folders.")
    parser.add_argument("--rpa-pid", type=int, help="Optional RPA PID. Stop after it exits and no new folders appear.")
    parser.add_argument("--skip-prefix", action="append", default=[], help="Three-digit folder prefix to skip, e.g. 001.")
    parser.add_argument("--poll-seconds", type=int, default=45)
    parser.add_argument("--summary-file", help="Summary JSON path. Defaults to <root>/mysql_import_watcher_summary.json.")
    parser.add_argument("--once", action="store_true", help="Scan once and exit.")
    return parser.parse_args()


def log(message: str) -> None:
    print(time.strftime("%Y-%m-%d %H:%M:%S"), message, flush=True)


def first_file(folder: Path, pattern: str) -> Path | None:
    matches = sorted(folder.glob(pattern))
    return matches[0] if matches else None


def complete_dirs(root: Path) -> list[tuple[Path, Path, Path, Path]]:
    rows: list[tuple[Path, Path, Path, Path]] = []
    for folder in sorted(p for p in root.iterdir() if p.is_dir()):
        product = first_file(folder, "商品数据ID_*.xlsx")
        sku = first_file(folder, "店透-SKU预览-表格-*.xlsx")
        qa = first_file(folder, "店透视-问大家分析-*.xlsx")
        if product and sku and qa:
            rows.append((folder, product, sku, qa))
    return rows


def pid_alive(pid: int | None) -> bool:
    if pid is None:
        return False
    return subprocess.run(["ps", "-p", str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def extract_json_objects(text: str) -> list[Any]:
    objects: list[Any] = []
    decoder = json.JSONDecoder()
    index = 0
    while index < len(text):
        start = text.find("{", index)
        if start < 0:
            break
        try:
            obj, end = decoder.raw_decode(text[start:])
        except json.JSONDecodeError:
            index = start + 1
            continue
        objects.append(obj)
        index = start + end
    return objects


def mysql_env() -> dict[str, str]:
    env = os.environ.copy()
    env.setdefault("MYSQL_HOST", "127.0.0.1")
    env.setdefault("MYSQL_PORT", "3306")
    env.setdefault("MYSQL_USER", "root")
    env.setdefault("MYSQL_PASSWORD", "")
    env.setdefault("MYSQL_DATABASE", "sys")
    return env


def import_one(folder: Path, product: Path, sku: Path, qa: Path, env: dict[str, str]) -> dict[str, Any]:
    output_dir = folder / "cleaned_output"
    command = [
        sys.executable,
        str(MYSQL_IMPORT_RUNNER),
        "clean-and-load",
        "--product-file",
        str(product),
        "--sku-file",
        str(sku),
        "--qa-file",
        str(qa),
        "--output-dir",
        str(output_dir),
    ]

    log(f"DRY_RUN {folder.name}")
    dry_run = subprocess.run(command + ["--dry-run"], env=env, text=True, capture_output=True)
    if dry_run.returncode != 0:
        return {
            "dir": folder.name,
            "status": "dry_run_failed",
            "returncode": dry_run.returncode,
            "stdout_tail": dry_run.stdout[-2000:],
            "stderr_tail": dry_run.stderr[-2000:],
        }

    dry_objects = extract_json_objects(dry_run.stdout)
    dry_counts = dry_objects[0].get("counts", {}) if dry_objects and isinstance(dry_objects[0], dict) else {}
    log(f"IMPORT {folder.name} counts={dry_counts}")
    real = subprocess.run(command, env=env, text=True, capture_output=True)
    if real.returncode != 0:
        return {
            "dir": folder.name,
            "status": "import_failed",
            "returncode": real.returncode,
            "dry_counts": dry_counts,
            "stdout_tail": real.stdout[-2000:],
            "stderr_tail": real.stderr[-2000:],
        }

    real_objects = extract_json_objects(real.stdout)
    job = next((obj for obj in real_objects if isinstance(obj, dict) and "job_id" in obj), {})
    return {
        "dir": folder.name,
        "status": "imported",
        "dry_counts": dry_counts,
        "job_id": job.get("job_id"),
        "job_no": job.get("job_no"),
        "inserted": job.get("inserted"),
        "verified": job.get("verified"),
    }


def write_summary(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    args = parse_args()
    root = Path(args.root).expanduser()
    summary_file = Path(args.summary_file).expanduser() if args.summary_file else root / "mysql_import_watcher_summary.json"
    imported_prefixes = set(args.skip_prefix)
    results: list[dict[str, Any]] = []
    env = mysql_env()

    log("WATCHER_START skip_prefixes=" + ",".join(sorted(imported_prefixes)))
    idle_after_rpa = 0
    while True:
        did_work = False
        for folder, product, sku, qa in complete_dirs(root):
            prefix = folder.name[:3]
            if prefix in imported_prefixes:
                continue
            result = import_one(folder, product, sku, qa, env)
            results.append(result)
            imported_prefixes.add(prefix)
            if result["status"] == "imported":
                log(f"IMPORTED {folder.name} job_id={result.get('job_id')}")
            else:
                log(f"FAILED {folder.name} status={result['status']}")
            did_work = True
            write_summary(
                summary_file,
                {
                    "root": str(root),
                    "rpa_pid": args.rpa_pid,
                    "imported_prefixes": sorted(imported_prefixes),
                    "results": results,
                },
            )

        if args.once:
            break

        if args.rpa_pid and not pid_alive(args.rpa_pid):
            if did_work:
                idle_after_rpa = 0
            else:
                idle_after_rpa += 1
            if idle_after_rpa >= 2:
                break

        time.sleep(args.poll_seconds)

    write_summary(
        summary_file,
        {
            "root": str(root),
            "rpa_pid": args.rpa_pid,
            "imported_prefixes": sorted(imported_prefixes),
            "results": results,
            "finished_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        },
    )
    log(
        "WATCHER_DONE imported_new="
        + str(sum(1 for r in results if r.get("status") == "imported"))
        + " failed="
        + str(sum(1 for r in results if r.get("status") != "imported"))
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
