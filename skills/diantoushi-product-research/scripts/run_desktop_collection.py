#!/usr/bin/env python3
"""Bridge the shared scraper's workbooks to the desktop snapshot contract.

The final stdout line is JSON; preceding lines are real scraper progress.
This entry point never loads MySQL or sends data to an AI provider.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

SCRIPTS = Path(__file__).resolve().parent
MYSQL = SCRIPTS.parents[1] / "mysql-import"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_json(path: Path, default: Any):
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else default


def export_items(root: Path) -> list[dict[str, Any]]:
    batch = read_json(root / "batch_summary.json", {})
    if isinstance(batch.get("results"), list):
        return [row for row in batch["results"] if row.get("ok")]
    summaries = sorted(root.rglob("product_summary.json"))
    return [{**read_json(path, {}), "target_dir": str(path.parent)} for path in summaries] or [{"target_dir": str(root)}]


def export_file(item: dict, folder: Path, key: str, patterns: list[str]) -> Path | None:
    value = (item.get("files") or {}).get(key) or item.get(key)
    if value:
        path = Path(value)
        if not path.is_absolute():
            path = folder / path
        if path.is_file():
            return path
    for pattern in patterns:
        matches = sorted(folder.glob(pattern))
        if matches:
            return matches[0]
    return None


def collect_products(root: Path, items: list[dict] | None = None) -> dict[str, Any]:
    cleaner = load_module("desktop_export_cleaner", MYSQL / "clean_data.py")
    products = []
    files: set[str] = set()
    warnings: list[str] = []
    for item in items if items is not None else export_items(root):
        folder = Path(item.get("target_dir") or root)
        product_file = export_file(item, folder, "product_file", ["商品数据*.xlsx", "product.xlsx"])
        if not product_file:
            warnings.append(f"跳过缺少商品数据的目录：{folder}")
            continue
        sku_file = export_file(item, folder, "sku_file", ["*SKU*.xlsx", "sku.xlsx"])
        qa_file = export_file(item, folder, "ask_file", ["*问大家*.xlsx", "qa.xlsx"])
        product_rows = cleaner.read_first_sheet(product_file)
        cleaned = cleaner.clean_product_rows(product_rows, product_file)
        sku_rows = cleaner.clean_sku_rows(cleaner.read_first_sheet(sku_file), sku_file)[0] if sku_file else []
        qa_rows = cleaner.clean_qa_rows(cleaner.read_first_sheet(qa_file), qa_file) if qa_file else []
        reviews = cleaner.clean_review_comment_rows(folder / "review_comments.json")
        image_payload = read_json(folder / "product_page_images.json", {})
        images = image_payload.get("images") or []
        for index, row in enumerate(cleaned):
            product_id = str(row.get("product_id") or item.get("item_id") or "").strip()
            if not product_id:
                raise ValueError(f"商品数据缺少商品 ID：{product_file}")
            def belongs(record):
                return not record.get("product_id") or str(record["product_id"]) == product_id
            skus = [sku for sku in sku_rows if belongs(sku)]
            prices = [sku["price"] for sku in skus if sku.get("price") is not None]
            selected = item.get("selected") or {}
            price = min(prices) if prices else cleaner.parse_decimal(product_rows[index].get("价格"))
            if price is None and isinstance(selected.get("price"), (float, int)):
                price = selected["price"]
            main_images = [image for image in images if "main" in str(image.get("image_type", ""))]
            image_url = next((image.get("source_url") for image in main_images if image.get("source_url")), None)
            image_url = image_url or next((sku.get("sku_image_url") for sku in skus if sku.get("sku_image_url")), None)
            products.append({
                "externalProductId": product_id,
                "title": row.get("product_title"), "price": price, "shopName": row.get("shop_name"),
                "sold": row.get("sold_count"), "salesAmount": row.get("sales_amount"),
                "productUrl": selected.get("href") or f"https://item.taobao.com/item.htm?id={product_id}",
                "imageUrl": image_url,
                "skus": [{"skuId": str(sku.get("sku_id") or f"{product_id}-row-{sku['row_no']}"),
                          "name": sku.get("sku_info") or sku.get("package_type"),
                          "price": sku.get("price"), "imageUrl": sku.get("sku_image_url")} for sku in skus],
                "qas": [{"question": qa.get("question"), "answer": qa.get("answer")} for qa in qa_rows if belongs(qa)],
                "reviews": [{"content": "\n追评：".join(filter(None, [review.get("review_text"), review.get("follow_review")] ))}
                            for review in reviews if belongs(review)],
                "sourceData": {"product": row, "images": image_payload, "exportDirectory": str(folder.resolve())},
            })
        for path in folder.rglob("*"):
            if path.is_file() and path.suffix.lower() in {".xlsx", ".json", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".zip"}:
                files.add(str(path.resolve()))
        for key in ("ask_status", "sku_status", "review_comments", "product_page_images"):
            if isinstance(item.get(key), dict) and item[key].get("ok") is False:
                warnings.append(f"商品 {item.get('item_id', '')} 的 {key} 数据不完整，保留已有数据")
    if not products:
        raise ValueError("未取得可入库的商品数据，请检查采集日志、登录状态和导出文件")
    counts = {"productCount": len(products), "skuCount": sum(len(p["skus"]) for p in products),
              "qaCount": sum(len(p["qas"]) for p in products), "reviewCount": sum(len(p["reviews"]) for p in products)}
    return {"files": sorted(files), "products": products, "counts": counts, "warnings": warnings}


def run_scraper(args) -> tuple[Path, list[dict]]:
    if sys.platform != "darwin":
        raise RuntimeError("此完整采集器需要 macOS；Windows/CDP 旧版脚本保留在源码中，尚未接入批量采集")
    runner = load_module("desktop_mac_scraper", SCRIPTS / "run_diantoushi_rpa.py")
    native_args = ["--product-name", args.product_name, "--top-n", str(args.top_n),
                   "--search-pages", str(args.search_pages), "--speed-profile", args.speed_profile,
                   "--run-dir", str(args.run_dir / "rpa"), "--master-dir", str(args.exports_dir),
                   "--stop-on-error"]
    for flag, value in [("--min-price", args.min_price), ("--max-price", args.max_price)]:
        if value is not None:
            native_args.extend([flag, str(value)])
    previous = sys.argv
    try:
        sys.argv = [str(SCRIPTS / "run_diantoushi_rpa.py"), *native_args]
        config = runner.parse_args()
    finally:
        sys.argv = previous
    logger = runner.Logger(args.run_dir / "rpa" / "run.log")
    if args.product_url:
        selected = {"href": args.product_url, "item_id": runner.parse_item_id(args.product_url)}
        logger.section("batch item 1/1")
        toolbar = runner.navigate_to_product_with_toolbar(logger, selected, selected.get("item_id") or "direct")
        item = runner.export_current_product(logger, config, selected, args.exports_dir / "001-product", toolbar)
        return args.exports_dir, [item]
    # Use batch output even for one product so files stay inside the desktop job directory.
    summary = runner.run_batch_pipeline(config, logger)
    return args.exports_dir, [item for item in summary["results"] if item.get("ok")]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--product-name", required=True)
    parser.add_argument("--product-url")
    parser.add_argument("--top-n", type=int, default=1)
    parser.add_argument("--search-pages", type=int, default=8)
    parser.add_argument("--min-price", type=float)
    parser.add_argument("--max-price", type=float)
    parser.add_argument("--speed-profile", choices=["fast", "balanced", "conservative"], default="fast")
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--exports-dir", type=Path)
    parser.add_argument("--clean-only", action="store_true", help="Convert existing exports; never open a browser")
    args = parser.parse_args()
    if not 1 <= args.top_n <= 100 or not 1 <= args.search_pages <= 100:
        parser.error("商品数量与搜索页数必须是 1-100 的整数")
    if args.min_price is not None and args.max_price is not None and args.min_price > args.max_price:
        parser.error("最低价不能高于最高价")
    args.run_dir = args.run_dir.resolve()
    args.exports_dir = (args.exports_dir or args.run_dir / "exports").resolve()
    args.run_dir.mkdir(parents=True, exist_ok=True)
    try:
        root, items = (args.exports_dir, None) if args.clean_only else run_scraper(args)
        result = collect_products(root, items)
        for warning in result["warnings"]:
            print(f"[WARN] {warning}", flush=True)
        (args.run_dir / "collected-products.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({"ok": True, **result}, ensure_ascii=False), flush=True)
        return 0
    except Exception as error:
        print(f"[ERROR] {error}", file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
