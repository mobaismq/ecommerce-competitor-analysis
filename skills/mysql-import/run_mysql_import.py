import argparse
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_PRODUCT_FILE = BASE_DIR / "商品数据ID_808636994094_2026-07-01 (1).xlsx"
DEFAULT_SKU_FILE = BASE_DIR / "店透-SKU预览-表格-808636994094-2026-07-01 (4).xlsx"
DEFAULT_QA_FILE = BASE_DIR / "店透视-问大家分析-808636994094-2026-07-01 (1).xlsx"
DEFAULT_OUTPUT_DIR = BASE_DIR / "cleaned_output"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Excel clean + MySQL load pipeline.")
    parser.add_argument("mode", choices=["clean-and-load", "load-only", "init-schema"], help="Pipeline mode")
    parser.add_argument("--product-file", default=str(DEFAULT_PRODUCT_FILE), help="Product Excel file path")
    parser.add_argument("--sku-file", default=str(DEFAULT_SKU_FILE), help="SKU Excel file path")
    parser.add_argument("--qa-file", default=str(DEFAULT_QA_FILE), help="QA Excel file path")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Directory for cleaned JSON and media")
    parser.add_argument("--allow-missing-qa", action="store_true", help="Allow missing QA export and import product/SKU with zero QA rows.")
    parser.add_argument("--skip-dry-run", action="store_true", help="Skip the loader dry-run before the real import")
    parser.add_argument("--dry-run", action="store_true", help="Run only validations and do not import to MySQL")
    return parser.parse_args()


def run_step(command: list[str]) -> None:
    print("RUN:", " ".join(command))
    subprocess.run(command, check=True)


def main() -> int:
    args = parse_args()
    output_dir = str(Path(args.output_dir).resolve())

    if args.mode == "init-schema":
        run_step(
            [
                sys.executable,
                str(BASE_DIR / "load_to_mysql.py"),
                "--input-dir",
                output_dir,
                "--init-schema",
            ]
        )
        return 0

    if args.mode == "clean-and-load":
        clean_cmd = [
            sys.executable,
            str(BASE_DIR / "clean_data.py"),
            "--product-file",
            str(Path(args.product_file).resolve()),
            "--sku-file",
            str(Path(args.sku_file).resolve()),
            "--output-dir",
            output_dir,
        ]
        qa_file_supplied = "--qa-file" in sys.argv
        qa_path = Path(args.qa_file).resolve() if args.qa_file and (qa_file_supplied or not args.allow_missing_qa) else None
        if qa_path and qa_path.exists():
            clean_cmd += ["--qa-file", str(qa_path)]
        elif args.allow_missing_qa:
            clean_cmd.append("--allow-missing-qa")
        else:
            clean_cmd += ["--qa-file", str(qa_path)]
        run_step(clean_cmd)

    dry_run_cmd = [
        sys.executable,
        str(BASE_DIR / "load_to_mysql.py"),
        "--input-dir",
        output_dir,
        "--dry-run",
    ]

    if args.dry_run:
        run_step(dry_run_cmd)
        return 0

    if not args.skip_dry_run:
        run_step(dry_run_cmd)

    run_step(
        [
            sys.executable,
            str(BASE_DIR / "load_to_mysql.py"),
            "--input-dir",
            output_dir,
        ]
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
