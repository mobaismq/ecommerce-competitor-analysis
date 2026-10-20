import argparse
import csv
import json
import os
import re
from collections import Counter
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional

try:
    import pymysql
except ImportError:
    pymysql = None

APP_DIR = Path(__file__).resolve().parent
SKILL_DIR = APP_DIR.parent
DEFAULT_INPUT_DIR = SKILL_DIR / "data" / "cleaned_output"
DEFAULT_OUTPUT_DIR = SKILL_DIR / "output"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze competitor data for listing strategy and hero image direction.")
    parser.add_argument("mode", choices=["json-only", "db-only", "hybrid"], help="Data source mode")
    parser.add_argument("--product-id", default=None, help="Competitor product id for DB mode")
    parser.add_argument("--job-id", type=int, default=None, help="Explicit job id for DB mode")
    parser.add_argument("--market-report", action="store_true", help="Generate a multi-competitor report grouped by price band.")
    parser.add_argument("--keyword", default=None, help="Filter DB competitors by product title/category keyword.")
    parser.add_argument("--limit", type=int, default=200, help="Maximum DB competitors to analyze in market-report mode.")
    parser.add_argument("--input-dir", default=str(DEFAULT_INPUT_DIR), help="Directory containing cleaned_output JSON files")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Directory for generated analysis files")
    parser.add_argument("--cost-file", default=None, help="CSV file containing your own SKU cost inputs")
    parser.add_argument("--cost-price", type=float, default=None, help="Your base product cost for price-band profit simulation.")
    parser.add_argument("--shipping-cost", type=float, default=0.0, help="Shipping cost per unit for profit simulation.")
    parser.add_argument("--packaging-cost", type=float, default=0.0, help="Packaging cost per unit for profit simulation.")
    parser.add_argument("--labor-cost", type=float, default=0.0, help="Labor/operation cost per unit for profit simulation.")
    parser.add_argument("--platform-fee-rate", type=float, default=0.0, help="Platform fee rate, e.g. 0.05 for 5%%.")
    parser.add_argument("--ad-fee-rate", type=float, default=0.0, help="Estimated ad/traffic fee rate, e.g. 0.10 for 10%%.")
    parser.add_argument("--target-margin", type=float, default=0.30, help="Target gross margin rate for price-band simulation.")
    parser.add_argument("--save-to-db", action="store_true", help="Persist market report, price bands, product-level analysis, assets, insights, and listing prompts to MySQL.")
    parser.add_argument("--format", choices=["markdown", "json", "both"], default="both", help="Output format")
    return parser.parse_args()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat(sep=" ") if isinstance(value, datetime) else value.isoformat()
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    return value


def read_cost_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        return [dict(row) for row in reader]


def to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def get_optional_env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name)
    if value is None:
        return default
    return value


def require_env(name: str, default: Optional[str] = None) -> str:
    value = os.getenv(name, default)
    if value is None or value == "":
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def get_connection() -> Any:
    if pymysql is None:
        raise RuntimeError("Missing dependency: pymysql. Install with: pip install pymysql")
    return pymysql.connect(
        host=require_env("MYSQL_HOST", "localhost"),
        port=int(require_env("MYSQL_PORT", "3306")),
        user=require_env("MYSQL_USER"),
        password=get_optional_env("MYSQL_PASSWORD", ""),
        database=require_env("MYSQL_DATABASE"),
        charset="utf8mb4",
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )


def load_from_json(input_dir: Path) -> dict[str, Any]:
    product_rows = read_json(input_dir / "product_snapshot.clean.json")
    sku_rows = read_json(input_dir / "product_sku_snapshot.clean.json")
    qa_rows = read_json(input_dir / "product_qa_snapshot.clean.json")
    media_rows = read_json(input_dir / "media_asset.clean.json")
    if not product_rows:
        raise RuntimeError("No product rows found in cleaned_output")
    product = product_rows[0]
    product_id = product.get("product_id")
    return {
        "product": product,
        "skus": [row for row in sku_rows if row.get("product_id") == product_id],
        "qas": [row for row in qa_rows if row.get("product_id") == product_id],
        "media_assets": [row for row in media_rows if row.get("product_id") == product_id],
        "meta": {
            "source": "json",
            "product_id": product_id,
            "job_id": None,
        },
    }


def load_cost_map(cost_file: Path) -> dict[str, dict[str, Any]]:
    rows = read_cost_rows(cost_file)
    cost_map: dict[str, dict[str, Any]] = {}
    for row in rows:
        sku_name = (row.get("sku_name") or row.get("name") or "").strip()
        if not sku_name:
            continue
        cost_map[sku_name] = {
            "sku_name": sku_name,
            "cost_price": to_float(row.get("cost_price")),
            "shipping_cost": to_float(row.get("shipping_cost")) or 0.0,
            "packaging_cost": to_float(row.get("packaging_cost")) or 0.0,
            "platform_fee_rate": to_float(row.get("platform_fee_rate")) or 0.0,
            "target_band": (row.get("target_band") or "").strip(),
            "target_sku_id": (row.get("target_sku_id") or "").strip(),
        }
    return cost_map


def fetch_latest_job_id(cursor: Any, product_id: str) -> Optional[int]:
    cursor.execute(
        """
        SELECT job_id
        FROM product_snapshot
        WHERE product_id = %s
        ORDER BY snapshot_time DESC, id DESC
        LIMIT 1
        """,
        (product_id,),
    )
    row = cursor.fetchone()
    return int(row["job_id"]) if row else None


def fetch_product_snapshot(cursor: Any, product_id: str, job_id: int) -> Optional[dict[str, Any]]:
    cursor.execute(
        """
        SELECT *
        FROM product_snapshot
        WHERE product_id = %s AND job_id = %s
        ORDER BY id DESC
        LIMIT 1
        """,
        (product_id, job_id),
    )
    return cursor.fetchone()


def fetch_product_skus(cursor: Any, product_id: str, job_id: int) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT *
        FROM product_sku_snapshot
        WHERE product_id = %s AND job_id = %s
        ORDER BY price ASC, id ASC
        """,
        (product_id, job_id),
    )
    return list(cursor.fetchall())


def fetch_product_qas(cursor: Any, product_id: str, job_id: int) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT *
        FROM product_qa_snapshot
        WHERE product_id = %s AND job_id = %s
        ORDER BY qa_time DESC, id DESC
        """,
        (product_id, job_id),
    )
    return list(cursor.fetchall())


def fetch_media_assets(cursor: Any, product_id: str, job_id: int) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT *
        FROM media_asset
        WHERE product_id = %s AND job_id = %s
        ORDER BY sort_no ASC, id ASC
        """,
        (product_id, job_id),
    )
    return list(cursor.fetchall())


def fetch_market_products(cursor: Any, keyword: Optional[str], limit: int) -> list[dict[str, Any]]:
    where = ""
    params: list[Any] = []
    if keyword:
        where = "WHERE product_title LIKE %s OR category_name LIKE %s"
        params.extend([f"%{keyword}%", f"%{keyword}%"])
    cursor.execute(
        f"""
        SELECT *
        FROM product_snapshot
        {where}
        ORDER BY id DESC
        LIMIT %s
        """,
        (*params, max(limit * 3, limit)),
    )
    rows = list(cursor.fetchall())
    deduped: list[dict[str, Any]] = []
    seen = set()
    for row in rows:
        key = row.get("product_id")
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(row)
        if len(deduped) >= limit:
            break
    return deduped


def fetch_rows_for_jobs(cursor: Any, table_name: str, job_ids: list[int]) -> list[dict[str, Any]]:
    if not job_ids:
        return []
    placeholders = ",".join(["%s"] * len(job_ids))
    cursor.execute(
        f"""
        SELECT *
        FROM {table_name}
        WHERE job_id IN ({placeholders})
        ORDER BY job_id ASC, id ASC
        """,
        job_ids,
    )
    return list(cursor.fetchall())


def group_by_product_job(rows: list[dict[str, Any]]) -> dict[tuple[str, int], list[dict[str, Any]]]:
    grouped: dict[tuple[str, int], list[dict[str, Any]]] = {}
    for row in rows:
        product_id = str(row.get("product_id") or "")
        job_id = row.get("job_id")
        if not product_id or job_id is None:
            continue
        grouped.setdefault((product_id, int(job_id)), []).append(row)
    return grouped


def load_market_from_db(keyword: Optional[str], limit: int) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            products = fetch_market_products(cursor, keyword, limit)
            job_ids = sorted({int(row["job_id"]) for row in products if row.get("job_id") is not None})
            sku_group = group_by_product_job(fetch_rows_for_jobs(cursor, "product_sku_snapshot", job_ids))
            qa_group = group_by_product_job(fetch_rows_for_jobs(cursor, "product_qa_snapshot", job_ids))
            media_group = group_by_product_job(fetch_rows_for_jobs(cursor, "media_asset", job_ids))
            competitors = []
            for product in products:
                key = (str(product.get("product_id") or ""), int(product.get("job_id")))
                competitors.append(
                    {
                        "product": product,
                        "skus": sku_group.get(key, []),
                        "qas": qa_group.get(key, []),
                        "media_assets": media_group.get(key, []),
                    }
                )
            return {
                "competitors": competitors,
                "meta": {
                    "source": "mysql",
                    "keyword": keyword,
                    "limit": limit,
                    "competitor_count": len(competitors),
                },
            }
    finally:
        conn.close()


def load_from_db(product_id: Optional[str], job_id: Optional[int]) -> dict[str, Any]:
    if not product_id and not job_id:
        raise RuntimeError("db-only mode requires --product-id or --job-id")
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            resolved_job_id = job_id
            resolved_product_id = product_id
            if resolved_product_id and resolved_job_id is None:
                resolved_job_id = fetch_latest_job_id(cursor, resolved_product_id)
            if resolved_job_id is None:
                raise RuntimeError("Could not resolve job_id from database")
            if resolved_product_id is None:
                cursor.execute(
                    "SELECT product_id FROM product_snapshot WHERE job_id = %s ORDER BY id DESC LIMIT 1",
                    (resolved_job_id,),
                )
                row = cursor.fetchone()
                if not row:
                    raise RuntimeError("Could not resolve product_id from database")
                resolved_product_id = row["product_id"]
            product = fetch_product_snapshot(cursor, resolved_product_id, resolved_job_id)
            if not product:
                raise RuntimeError("No product snapshot found for requested product/job")
            return {
                "product": product,
                "skus": fetch_product_skus(cursor, resolved_product_id, resolved_job_id),
                "qas": fetch_product_qas(cursor, resolved_product_id, resolved_job_id),
                "media_assets": fetch_media_assets(cursor, resolved_product_id, resolved_job_id),
                "meta": {
                    "source": "mysql",
                    "product_id": resolved_product_id,
                    "job_id": resolved_job_id,
                },
            }
    finally:
        conn.close()


def choose_data_source(args: argparse.Namespace) -> dict[str, Any]:
    if args.mode == "json-only":
        return load_from_json(Path(args.input_dir).resolve())
    if args.mode == "db-only" and (args.market_report or args.keyword or (not args.product_id and args.job_id is None)):
        return load_market_from_db(args.keyword, args.limit)
    if args.mode == "db-only":
        return load_from_db(args.product_id, args.job_id)
    try:
        if args.market_report or args.keyword or (not args.product_id and args.job_id is None):
            return load_market_from_db(args.keyword, args.limit)
        return load_from_db(args.product_id, args.job_id)
    except Exception:
        return load_from_json(Path(args.input_dir).resolve())


def classify_price_band(price: Optional[float]) -> str:
    if price is None:
        return "未知"
    if price < 30:
        return "0-30元引流带"
    if price < 60:
        return "30-60元低价主销带"
    if price < 100:
        return "60-100元主销利润带"
    if price < 180:
        return "100-180元升级带"
    if price < 300:
        return "180-300元高配带"
    return "300元以上高客单带"


def product_effective_price(product: dict[str, Any], skus: list[dict[str, Any]]) -> Optional[float]:
    for key in ["effective_min_price", "min_coupon_price", "min_price"]:
        value = to_float(product.get(key))
        if value is not None:
            return value
    prices = [to_float(row.get("coupon_price") or row.get("price")) for row in skus]
    prices = [price for price in prices if price is not None]
    return min(prices) if prices else None


def product_link(product: dict[str, Any]) -> Optional[str]:
    direct = product.get("product_url")
    if direct:
        return str(direct)
    product_id = product.get("product_id")
    if product_id:
        return f"https://item.taobao.com/item.htm?id={product_id}"
    return None


def is_tool_listing(product: dict[str, Any]) -> bool:
    text = f"{product.get('product_title') or ''} {product.get('category_name') or ''}"
    tool_terms = ["水平仪", "水准仪", "激光", "红外线", "五金", "工具", "仪器仪表"]
    return any(term in text for term in tool_terms)


def summarize_price_bands(skus: list[dict[str, Any]]) -> dict[str, Any]:
    prices = [row.get("coupon_price") or row.get("price") for row in skus if (row.get("coupon_price") or row.get("price")) is not None]
    if not prices:
        return {"min": None, "max": None, "avg": None, "bands": {}}
    band_counter = Counter(classify_price_band(price) for price in prices)
    return {
        "min": min(prices),
        "max": max(prices),
        "avg": round(sum(prices) / len(prices), 2),
        "bands": dict(band_counter),
    }


def extract_qa_keywords(qas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    stop_words = {"可以", "这个", "不是", "一下", "什么", "时候", "多少", "收到", "谢谢", "您好", "就是", "还有"}
    counter = Counter()
    for row in qas:
        text = f"{row.get('question') or ''} {row.get('answer') or ''}"
        for token in re.findall(r"[一-龥]{2,6}", text):
            if token not in stop_words:
                counter[token] += 1
    return [{"keyword": key, "count": value} for key, value in counter.most_common(10)]


def infer_positioning(product: dict[str, Any], skus: list[dict[str, Any]]) -> dict[str, Any]:
    sold = product.get("sold_count") or 0
    sales = product.get("sales_amount") or 0
    avg_price = 0.0
    price_summary = summarize_price_bands(skus)
    if price_summary["avg"] is not None:
        avg_price = price_summary["avg"]

    tool_listing = is_tool_listing(product)
    if avg_price < 90:
        primary = "低门槛引流型" if not tool_listing else "入门工具引流型"
    elif avg_price < 180:
        primary = "中价位主销型" if not tool_listing else "专业性价比主销型"
    else:
        primary = "高客单囤货型" if not tool_listing else "专业高配利润型"

    evidence = []
    if sold:
        evidence.append(f"已售约 {sold}")
    if sales:
        evidence.append(f"销售额约 {sales}")
    if price_summary["min"] is not None and price_summary["max"] is not None:
        evidence.append(f"SKU券后价覆盖 {price_summary['min']} - {price_summary['max']}")

    if tool_listing:
        listing_angle = "户外强光可视 + 精度稳定 + 线数/续航/配件清晰"
        if primary == "入门工具引流型":
            listing_angle = "低门槛入手 + 基础测平够用 + 售后保障降低试错"
        elif primary == "专业性价比主销型":
            listing_angle = "专业施工场景 + 强光细线 + 配件齐全的性价比"
        elif primary == "专业高配利润型":
            listing_angle = "高配线数/数显中控 + 户外适配 + 工程级稳定性"
    else:
        listing_angle = "规格清晰 + 划算感 + 家用囤货价值"
        if primary == "低门槛引流型":
            listing_angle = "低门槛首购 + 规格透明 + 品质不踩雷"
        elif primary == "中价位主销型":
            listing_angle = "品质感与性价比平衡 + 主销组合装"
        elif primary == "高客单囤货型":
            listing_angle = "囤货更省 + 大包装更值 + 家庭场景"

    return {
        "market_positioning": primary,
        "listing_angle": listing_angle,
        "evidence": evidence,
    }


def infer_hero_image_direction(product: dict[str, Any], skus: list[dict[str, Any]], qas: list[dict[str, Any]], media_assets: list[dict[str, Any]]) -> dict[str, Any]:
    price_summary = summarize_price_bands(skus)
    keywords = extract_qa_keywords(qas)
    if is_tool_listing(product):
        hero_axes = [
            "主图优先表达户外强光可视、线数、精度和适用场景，让施工用户一眼判断能不能用",
            "首屏明确核心配置：绿光/红光、几线、是否数显中控、电池数量、支架或配件",
            "副图补充实测场景，如室外阳光、墙面打线、地面找平、装修/工程使用距离",
        ]
        if price_summary.get("max") and price_summary["max"] >= 180:
            hero_axes.append("高配 SKU 要突出续航、强光细线、配件套装和售后保障，避免只靠低价竞争")
        avoid = [
            "只写低价，不说明强光下可视效果、精度、线数和配件",
            "参数堆得太满，主图没有一个明确的第一卖点",
            "只做工具外观展示，不回应户外施工和测平精度顾虑",
        ]
    else:
        hero_axes = [
            "主图优先突出规格量感，避免用户看不懂包数/抽数/组合数",
            "首屏直接展示价格锚点和囤货价值，不只讲品牌感",
            "副图补充品质信息，如柔软度、厚度、是否掉屑、是否有异味",
        ]
        if price_summary.get("max") and price_summary["max"] >= 180:
            hero_axes.append("针对高价组合装，增加家庭囤货和单次购买更省的视觉表达")
        avoid = [
            "只写低价，不说明规格",
            "信息堆太满导致重点不清楚",
            "只做颜值，不回应用户的真实顾虑",
        ]
    if media_assets:
        hero_axes.append(f"当前可复用 {len(media_assets)} 张竞品 SKU 图作为风格参考，不建议直接照搬文案")
    if keywords:
        top = "、".join(item["keyword"] for item in keywords[:5])
        hero_axes.append(f"根据问答，高频关注点集中在：{top}")
    return {
        "hero_image_direction": hero_axes,
        "avoid": avoid,
    }


def infer_pricing_strategy(product: dict[str, Any], skus: list[dict[str, Any]]) -> dict[str, Any]:
    summary = summarize_price_bands(skus)
    recommendations = []
    if is_tool_listing(product):
        if summary["min"] is not None:
            recommendations.append(f"入门款可参考 {summary['min']} 附近价格带，承担搜索点击和新手试用转化")
        if summary["avg"] is not None:
            recommendations.append(f"主销款优先围绕均价 {summary['avg']} 附近，突出强光可视、精度和配件齐全")
        if summary["max"] is not None and summary["max"] > 180:
            recommendations.append(f"高配利润款可参考 {summary['max']} 附近，重点强化线数、数显中控、续航和工程级稳定性")
    else:
        if summary["min"] is not None:
            recommendations.append(f"引流款可参考 {summary['min']} 附近价格带，重点承担点击和首购转化")
        if summary["avg"] is not None:
            recommendations.append(f"主销款优先围绕均价 {summary['avg']} 附近做利润与转化平衡")
        if summary["max"] is not None and summary["max"] > 180:
            recommendations.append(f"利润款可参考 {summary['max']} 附近的大包装/组合装，但必须强化囤货价值")
    return {
        "price_summary": summary,
        "recommendations": recommendations,
    }


def build_cost_candidates(cost_map: dict[str, dict[str, Any]], skus: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates = []
    unmatched = []
    for sku_name, cost in cost_map.items():
        matched = None
        target_sku_id = cost.get("target_sku_id") or ""
        target_band = cost.get("target_band") or ""
        lower_name = sku_name.lower()

        if target_sku_id:
            for sku in skus:
                if str(sku.get("sku_id") or "") == target_sku_id:
                    matched = sku
                    break

        if matched is None and target_band:
            band_skus = [sku for sku in skus if classify_price_band(sku.get("coupon_price") or sku.get("price")) == target_band]
            if band_skus:
                matched = sorted(band_skus, key=lambda x: (x.get("coupon_price") or x.get("price") or 0))[0]

        if matched is None:
            for sku in skus:
                sku_info = str(sku.get("sku_info") or "")
                if lower_name in sku_info.lower() or sku_info.lower() in lower_name:
                    matched = sku
                    break

        if matched is None and len(skus) == 1:
            matched = skus[0]
        if matched is None:
            unmatched.append(sku_name)
            continue
        sell_price = to_float(matched.get("coupon_price") or matched.get("price"))
        total_cost = (cost.get("cost_price") or 0.0) + (cost.get("shipping_cost") or 0.0) + (cost.get("packaging_cost") or 0.0)
        fee_rate = cost.get("platform_fee_rate") or 0.0
        fee_amount = (sell_price or 0.0) * fee_rate if sell_price is not None else 0.0
        total_cost_with_fee = total_cost + fee_amount
        gross_margin_rate = None
        if sell_price not in (None, 0):
            gross_margin_rate = round((sell_price - total_cost_with_fee) / sell_price, 4)
        target_price_for_60 = None
        if fee_rate < 1:
            denominator = 1 - 0.60 - fee_rate
            if denominator > 0:
                target_price_for_60 = round(total_cost / denominator, 2)
        candidates.append(
            {
                "sku_name": sku_name,
                "matched_sku_id": matched.get("sku_id"),
                "matched_sku_info": matched.get("sku_info"),
                "matched_band": classify_price_band(sell_price),
                "market_price": sell_price,
                "cost_price": cost.get("cost_price"),
                "shipping_cost": cost.get("shipping_cost"),
                "packaging_cost": cost.get("packaging_cost"),
                "platform_fee_rate": fee_rate,
                "estimated_total_cost": round(total_cost_with_fee, 2),
                "gross_margin_rate": gross_margin_rate,
                "meets_60_percent": gross_margin_rate is not None and gross_margin_rate >= 0.60,
                "target_price_for_60_margin": target_price_for_60,
            }
        )
    return {
        "matched": candidates,
        "unmatched": unmatched,
    }


def infer_review_qa_insights(product: dict[str, Any], qas: list[dict[str, Any]]) -> dict[str, Any]:
    review_count = product.get("review_count")
    favorite_count = product.get("favorite_count")
    question_count = product.get("question_count")
    keywords = extract_qa_keywords(qas)
    concerns = [item["keyword"] for item in keywords[:5]]
    if is_tool_listing(product):
        suggestions = [
            "标题和主图优先回应户外强光、线数、精度、配件和适用距离",
            "详情页补充实测效果、质保售后和校准说明，降低专业工具购买顾虑",
            "围绕高频顾虑设置 FAQ，例如室外是否看得清、墙面/地面是否通用、配件是否齐全",
        ]
    else:
        suggestions = [
            "标题和主图优先回应规格是否清楚",
            "详情页补充品质保障信息，降低低价带用户疑虑",
            "围绕高频顾虑设置 FAQ，减少客服解释成本",
        ]
    return {
        "review_signals": {
            "review_count": review_count,
            "favorite_count": favorite_count,
            "question_count": question_count,
        },
        "high_frequency_concerns": concerns,
        "sell_point_suggestions": suggestions,
    }


SELLING_POINT_TERMS = [
    "高精度",
    "数显",
    "激光",
    "强磁",
    "磁吸",
    "绿光",
    "红外线",
    "倾角",
    "坡度",
    "水平尺",
    "多功能",
    "锂电池",
    "便携",
    "工程",
    "家用",
    "户外",
    "续航",
    "套装",
    "升级",
]


DEMAND_TERMS = [
    "准不准",
    "精度",
    "好用",
    "质量",
    "耐用",
    "电池",
    "续航",
    "配件",
    "磁力",
    "吸力",
    "户外",
    "强光",
    "看得清",
    "尺寸",
    "安装",
    "施工",
    "售后",
    "发货",
]


def extract_term_counts(texts: list[str], terms: list[str], limit: int = 12) -> list[dict[str, Any]]:
    counter = Counter()
    for text in texts:
        for term in terms:
            if term in text:
                counter[term] += 1
    return [{"term": term, "count": count} for term, count in counter.most_common(limit)]


def sample_competitor_images(skus: list[dict[str, Any]], media_assets: list[dict[str, Any]], limit: int = 8) -> list[dict[str, Any]]:
    images = []
    seen = set()
    for sku in skus:
        url = sku.get("sku_image_url")
        if url and url not in seen:
            seen.add(url)
            images.append(
                {
                    "image_type": "sku_image_url",
                    "product_id": sku.get("product_id"),
                    "sku_id": sku.get("sku_id"),
                    "url": url,
                    "path": sku.get("sku_image_path"),
                }
            )
        if len(images) >= limit:
            return images
    for media in media_assets:
        key = media.get("source_url") or media.get("storage_path") or media.get("file_name")
        if key and key not in seen:
            seen.add(key)
            images.append(
                {
                    "image_type": media.get("image_type") or "media_asset",
                    "product_id": media.get("product_id"),
                    "sku_id": media.get("sku_id"),
                    "url": media.get("source_url"),
                    "path": media.get("storage_path"),
                    "file_name": media.get("file_name"),
                }
            )
        if len(images) >= limit:
            return images
    return images


def build_profit_simulation(args: argparse.Namespace, target_price: Optional[float]) -> Optional[dict[str, Any]]:
    if args.cost_price is None or target_price is None:
        return None
    fixed_cost = args.cost_price + args.shipping_cost + args.packaging_cost + args.labor_cost
    fee_amount = target_price * (args.platform_fee_rate + args.ad_fee_rate)
    total_cost = fixed_cost + fee_amount
    gross_profit = target_price - total_cost
    gross_margin_rate = gross_profit / target_price if target_price else None
    break_even_price = None
    denominator = 1 - args.platform_fee_rate - args.ad_fee_rate
    if denominator > 0:
        break_even_price = round(fixed_cost / denominator, 2)
    target_price_for_margin = None
    denominator_with_margin = 1 - args.platform_fee_rate - args.ad_fee_rate - args.target_margin
    if denominator_with_margin > 0:
        target_price_for_margin = round(fixed_cost / denominator_with_margin, 2)
    return {
        "target_price": round(target_price, 2),
        "cost_price": args.cost_price,
        "shipping_cost": args.shipping_cost,
        "packaging_cost": args.packaging_cost,
        "labor_cost": args.labor_cost,
        "platform_fee_rate": args.platform_fee_rate,
        "ad_fee_rate": args.ad_fee_rate,
        "fee_amount": round(fee_amount, 2),
        "estimated_total_cost": round(total_cost, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_margin_rate": round(gross_margin_rate, 4) if gross_margin_rate is not None else None,
        "break_even_price": break_even_price,
        "target_margin": args.target_margin,
        "target_price_for_margin": target_price_for_margin,
    }


def build_image_prompt(band_name: str, sell_points: list[dict[str, Any]], demands: list[dict[str, Any]]) -> dict[str, str]:
    point_text = "、".join(item["term"] for item in sell_points[:4]) or "核心卖点清晰"
    demand_text = "、".join(item["term"] for item in demands[:4]) or "用户购买顾虑"
    return {
        "main_image_prompt": f"电商主图，价格带{band_name}，突出{point_text}，画面直接展示产品实物和使用场景，文案围绕{demand_text}，清晰专业，高转化，白底或浅色施工场景，参数信息分层排版。",
        "detail_image_prompt": f"电商详情页长图，围绕{point_text}展开，依次展示痛点、功能证明、场景实拍、参数对比、售后保障，回应{demand_text}，风格专业可信，适合淘宝五金工具类目。",
        "buyer_show_prompt": f"买家秀风格图片，真实施工/家用场景中使用产品，强调{point_text}带来的实际效果，画面自然，不夸张，能够缓解{demand_text}相关顾虑。",
    }


def build_product_analysis(item: dict[str, Any], band_name: str, args: argparse.Namespace) -> dict[str, Any]:
    product = item["product"]
    skus = item["skus"]
    qas = item["qas"]
    media_assets = item["media_assets"]
    title_text = str(product.get("product_title") or "")
    sku_texts = [str(sku.get("sku_info") or "") for sku in skus]
    qa_texts = [f"{qa.get('question') or ''} {qa.get('answer') or ''}" for qa in qas]
    sell_points = extract_term_counts([title_text, *sku_texts], SELLING_POINT_TERMS, limit=10)
    demands = extract_term_counts(qa_texts, DEMAND_TERMS, limit=10)
    if not demands:
        demands = [{"term": row["keyword"], "count": row["count"]} for row in extract_qa_keywords(qas)[:8]]
    images = sample_competitor_images(skus, media_assets, limit=12)
    price = item.get("effective_price")
    return {
        "product_id": product.get("product_id"),
        "job_id": product.get("job_id"),
        "product_title": product.get("product_title"),
        "category_name": product.get("category_name"),
        "product_link": product_link(product),
        "price_band": band_name,
        "price": price,
        "price_min": product.get("effective_min_price") or product.get("min_coupon_price") or product.get("min_price"),
        "price_max": product.get("effective_max_price") or product.get("max_coupon_price") or product.get("max_price"),
        "sold_count": product.get("sold_count"),
        "sales_amount": product.get("sales_amount"),
        "review_count": product.get("review_count"),
        "favorite_count": product.get("favorite_count"),
        "question_count": product.get("question_count"),
        "sku_count": len(skus),
        "qa_count": len(qas),
        "image_count": len(images),
        "skus": [
            {
                "sku_id": sku.get("sku_id"),
                "sku_info": sku.get("sku_info"),
                "price": sku.get("price"),
                "coupon_price": sku.get("coupon_price"),
                "stock_qty": sku.get("stock_qty"),
                "sku_image_url": sku.get("sku_image_url"),
                "sku_image_path": sku.get("sku_image_path"),
            }
            for sku in skus[:50]
        ],
        "images": images,
        "qa_examples": [
            {
                "question": qa.get("question"),
                "answer": qa.get("answer"),
                "nickname": qa.get("nickname"),
                "qa_time": qa.get("qa_time"),
            }
            for qa in qas[:20]
        ],
        "selling_points": sell_points,
        "demands": demands,
        "profit_simulation": build_profit_simulation(args, price),
        "image_prompts": build_image_prompt(band_name, sell_points, demands),
    }


def build_market_price_band_report(data: dict[str, Any], args: argparse.Namespace) -> dict[str, Any]:
    competitors = data.get("competitors", [])
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in competitors:
        price = product_effective_price(item["product"], item["skus"])
        band = classify_price_band(price)
        enriched = {**item, "effective_price": price, "price_band": band}
        grouped.setdefault(band, []).append(enriched)

    band_order = ["0-30元引流带", "30-60元低价主销带", "60-100元主销利润带", "100-180元升级带", "180-300元高配带", "300元以上高客单带", "未知"]
    price_band_report = []
    for band in band_order:
        items = grouped.get(band, [])
        if not items:
            continue
        products = [item["product"] for item in items]
        all_skus = [sku for item in items for sku in item["skus"]]
        all_qas = [qa for item in items for qa in item["qas"]]
        all_media = [media for item in items for media in item["media_assets"]]
        titles = [str(product.get("product_title") or "") for product in products]
        sku_texts = [str(sku.get("sku_info") or "") for sku in all_skus]
        qa_texts = [f"{qa.get('question') or ''} {qa.get('answer') or ''}" for qa in all_qas]
        prices = [item["effective_price"] for item in items if item["effective_price"] is not None]
        avg_price = round(sum(prices) / len(prices), 2) if prices else None
        sell_points = extract_term_counts(titles + sku_texts, SELLING_POINT_TERMS)
        demands = extract_term_counts(qa_texts, DEMAND_TERMS)
        keyword_demands = extract_qa_keywords(all_qas)
        demand_items = demands or [{"term": item["keyword"], "count": item["count"]} for item in keyword_demands[:8]]
        sales_amounts = [to_float(product.get("sales_amount")) or 0.0 for product in products]
        sold_counts = [int(product.get("sold_count") or 0) for product in products]
        product_analysis = [build_product_analysis(item, band, args) for item in sorted(items, key=lambda row: int(row["product"].get("sold_count") or 0), reverse=True)]
        representative_competitors = sorted(items, key=lambda item: int(item["product"].get("sold_count") or 0), reverse=True)[:10]
        competitor_links = [
            {
                "product_id": item["product"].get("product_id"),
                "title": item["product"].get("product_title"),
                "price": item["effective_price"],
                "sold_count": item["product"].get("sold_count"),
                "sales_amount": item["product"].get("sales_amount"),
                "link": product_link(item["product"]),
            }
            for item in representative_competitors
        ]
        qa_examples = [
            {
                "product_id": qa.get("product_id"),
                "question": qa.get("question"),
                "answer": qa.get("answer"),
            }
            for qa in all_qas[:12]
        ]
        images = sample_competitor_images(all_skus, all_media, limit=12)
        prompt = build_image_prompt(band, sell_points, demand_items)
        price_for_profit = avg_price or (sum([p for p in prices]) / len(prices) if prices else None)
        price_band_report.append(
            {
                "price_band": band,
                "competitor_count": len(items),
                "price_min": min(prices) if prices else None,
                "price_max": max(prices) if prices else None,
                "price_avg": avg_price,
                "sold_count_total": sum(sold_counts),
                "sales_amount_total": round(sum(sales_amounts), 2),
                "competitor_links": competitor_links,
                "display_images": {
                    "available_images": images,
                    "note": "当前数据库主要保存 SKU 图片链接/媒体资产；若需要完整主图、详情图，需要下载商品主图和详情页图片后再入库。",
                },
                "extracted_selling_points": sell_points,
                "qa_and_review": {
                    "review_count_total": sum(int(product.get("review_count") or 0) for product in products),
                    "qa_count_total": len(all_qas),
                    "qa_examples": qa_examples,
                    "note": "当前表中评价为数量字段，未采集评价明细；需求提炼优先来自问大家，缺问大家时只保留评价数量信号。",
                },
                "extracted_demands": demand_items,
                "profit_simulation": build_profit_simulation(args, price_for_profit),
                "image_prompts": prompt,
                "product_analysis": product_analysis,
            }
        )

    return {
        "summary": {
            "source": data["meta"]["source"],
            "keyword": data["meta"].get("keyword"),
            "competitor_count": len(competitors),
            "price_band_count": len(price_band_report),
            "cost_price": args.cost_price,
            "cost_model": {
                "shipping_cost": args.shipping_cost,
                "packaging_cost": args.packaging_cost,
                "labor_cost": args.labor_cost,
                "platform_fee_rate": args.platform_fee_rate,
                "ad_fee_rate": args.ad_fee_rate,
                "target_margin": args.target_margin,
            },
        },
        "price_band_report": price_band_report,
        "data_gaps": [
            "若数据库没有商品主图/详情图，报告只能使用 SKU 图片链接和已入库媒体资产作为图片线索。",
            "若没有评价明细，报告只能用评价数量和问大家内容做需求判断。",
            "利润测算必须提供成本价；未提供时只输出价格带和竞品信号，不给毛利结论。",
        ],
    }


def build_analysis(data: dict[str, Any], cost_map: Optional[dict[str, dict[str, Any]]] = None) -> dict[str, Any]:
    if data.get("competitors") is not None:
        raise RuntimeError("build_analysis handles single-product reports only; use build_market_price_band_report for competitor datasets.")
    product = data["product"]
    skus = data["skus"]
    qas = data["qas"]
    media_assets = data["media_assets"]
    positioning = infer_positioning(product, skus)
    hero = infer_hero_image_direction(product, skus, qas, media_assets)
    pricing = infer_pricing_strategy(product, skus)
    review_insights = infer_review_qa_insights(product, qas)
    cost_analysis = build_cost_candidates(cost_map or {}, skus) if cost_map else {"matched": [], "unmatched": []}

    if is_tool_listing(product):
        selling_points = [
            "户外强光可视",
            "线数/精度/细线效果清楚",
            "配件套装和续航配置透明",
            "入门款、主销款、高配款分层表达",
        ]
        risks = [
            "只卷低价会削弱专业工具的可靠感和售后预期",
            "主图若不说明强光可视、精度和线数，容易被同价位竞品分流",
            "没有根据问答补充户外实测和配件说明，会增加客服解释成本",
        ]
    else:
        selling_points = [
            "规格量感清楚",
            "囤货更省的价格锚点",
            "品质感不踩雷",
            "主销款和利润款分层表达",
        ]
        risks = [
            "只卷低价容易损失品牌感和利润空间",
            "主图若不说明规格，转化会被低价竞品分流",
            "没有根据高频问答优化文案，容易增加用户疑虑",
        ]

    return {
        "summary": {
            "source": data["meta"]["source"],
            "product_id": data["meta"]["product_id"],
            "job_id": data["meta"].get("job_id"),
            "product_title": product.get("product_title"),
            "category_name": product.get("category_name"),
            "sku_count": len(skus),
            "qa_count": len(qas),
            "media_count": len(media_assets),
            "cost_rows": len(cost_map or {}),
        },
        "positioning": positioning,
        "hero_image_direction": hero,
        "pricing_analysis": pricing,
        "review_qa_insights": review_insights,
        "cost_margin_analysis": cost_analysis,
        "selling_points": selling_points,
        "risks": risks,
        "evidence": {
            "product": {
                "sold_count": product.get("sold_count"),
                "sales_amount": product.get("sales_amount"),
                "review_count": product.get("review_count"),
                "favorite_count": product.get("favorite_count"),
                "question_count": product.get("question_count"),
            },
            "price_summary": pricing["price_summary"],
            "qa_keywords": extract_qa_keywords(qas),
        },
    }


def render_money(value: Any) -> str:
    if value is None:
        return "无数据"
    try:
        return f"{float(value):.2f}"
    except (TypeError, ValueError):
        return str(value)


def render_percent(value: Any) -> str:
    if value is None:
        return "无法计算"
    try:
        return f"{float(value) * 100:.2f}%"
    except (TypeError, ValueError):
        return str(value)


def render_market_markdown(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = []
    title_keyword = summary.get("keyword") or "全量商品"
    lines.append(f"# 竞品价格带分析报告 - {title_keyword}")
    lines.append("")
    lines.append("## 数据概览")
    lines.append(f"- 数据来源：{summary.get('source')}")
    lines.append(f"- 竞品数：{summary.get('competitor_count')}")
    lines.append(f"- 价格带数：{summary.get('price_band_count')}")
    if summary.get("cost_price") is not None:
        model = summary.get("cost_model") or {}
        lines.append(
            f"- 成本模型：产品成本 {summary.get('cost_price')}，运费 {model.get('shipping_cost')}，包装 {model.get('packaging_cost')}，"
            f"人工/运营 {model.get('labor_cost')}，平台费率 {render_percent(model.get('platform_fee_rate'))}，"
            f"推广费率 {render_percent(model.get('ad_fee_rate'))}，目标毛利 {render_percent(model.get('target_margin'))}"
        )
    else:
        lines.append("- 成本模型：未提供成本价，本报告不输出毛利结论")
    lines.append("")

    for band in report["price_band_report"]:
        lines.append(f"## {band['price_band']}")
        lines.append(f"- 竞品数：{band['competitor_count']}")
        lines.append(f"- 价格范围：{render_money(band['price_min'])} - {render_money(band['price_max'])}")
        lines.append(f"- 均价：{render_money(band['price_avg'])}")
        lines.append(f"- 总销量：{band['sold_count_total']}")
        lines.append(f"- 总销额：{render_money(band['sales_amount_total'])}")
        lines.append("")
        lines.append("### 竞品链接")
        for item in band["competitor_links"]:
            title = str(item.get("title") or item.get("product_id") or "")[:80]
            link = item.get("link") or ""
            lines.append(
                f"- {title} | 价格 {render_money(item.get('price'))} | 销量 {item.get('sold_count') or 0} | "
                f"销额 {render_money(item.get('sales_amount'))} | {link}"
            )
        lines.append("")
        lines.append("### 展示图线索")
        images = band["display_images"]["available_images"]
        if images:
            for image in images[:8]:
                url_or_path = image.get("url") or image.get("path") or image.get("file_name")
                lines.append(f"- {image.get('image_type')} | 商品 {image.get('product_id')} | SKU {image.get('sku_id')} | {url_or_path}")
        else:
            lines.append("- 暂无可用图片链接")
        lines.append(f"- 说明：{band['display_images']['note']}")
        lines.append("")
        lines.append("### 提炼卖点")
        if band["extracted_selling_points"]:
            for item in band["extracted_selling_points"]:
                lines.append(f"- {item['term']}：出现 {item['count']} 次")
        else:
            lines.append("- 暂未提炼到稳定卖点")
        lines.append("")
        lines.append("### 评价和问大家需求")
        qa = band["qa_and_review"]
        lines.append(f"- 评价数合计：{qa['review_count_total']}")
        lines.append(f"- 问大家明细数：{qa['qa_count_total']}")
        if band["extracted_demands"]:
            for item in band["extracted_demands"]:
                lines.append(f"- 需求/顾虑：{item['term']}，出现 {item['count']} 次")
        else:
            lines.append("- 暂无可提炼问大家需求")
        if qa["qa_examples"]:
            lines.append("#### 问大家样例")
            for item in qa["qa_examples"][:5]:
                lines.append(f"- 问：{item.get('question') or ''}；答：{item.get('answer') or ''}")
        lines.append(f"- 说明：{qa['note']}")
        lines.append("")
        lines.append("### 我方利润测算")
        profit = band.get("profit_simulation")
        if profit:
            lines.append(f"- 测算售价：{render_money(profit.get('target_price'))}")
            lines.append(f"- 预估总成本：{render_money(profit.get('estimated_total_cost'))}")
            lines.append(f"- 单件毛利：{render_money(profit.get('gross_profit'))}")
            lines.append(f"- 毛利率：{render_percent(profit.get('gross_margin_rate'))}")
            lines.append(f"- 保本售价：{render_money(profit.get('break_even_price'))}")
            lines.append(f"- 达到目标毛利售价：{render_money(profit.get('target_price_for_margin'))}")
        else:
            lines.append("- 未提供成本价，暂不计算利润")
        lines.append("")
        lines.append("### 作图提示词")
        prompts = band["image_prompts"]
        lines.append(f"- 主图：{prompts['main_image_prompt']}")
        lines.append(f"- 详情：{prompts['detail_image_prompt']}")
        lines.append(f"- 买家秀：{prompts['buyer_show_prompt']}")
        lines.append("")

    lines.append("## 数据缺口")
    for item in report.get("data_gaps", []):
        lines.append(f"- {item}")
    return "\n".join(lines)


def render_markdown(report: dict[str, Any]) -> str:
    if report.get("price_band_report") is not None:
        return render_market_markdown(report)
    summary = report["summary"]
    positioning = report["positioning"]
    hero = report["hero_image_direction"]
    pricing = report["pricing_analysis"]
    review = report["review_qa_insights"]
    cost_analysis = report.get("cost_margin_analysis", {"matched": [], "unmatched": []})

    lines = []
    lines.append(f"# 竞品分析报告 - {summary.get('product_title') or summary.get('product_id')}")
    lines.append("")
    lines.append("## 竞品概览")
    lines.append(f"- 数据来源：{summary['source']}")
    lines.append(f"- 商品ID：{summary['product_id']}")
    lines.append(f"- SKU数：{summary['sku_count']}")
    lines.append(f"- 问答数：{summary['qa_count']}")
    lines.append(f"- 图片数：{summary['media_count']}")
    lines.append(f"- 成本输入行数：{summary.get('cost_rows', 0)}")
    lines.append("")
    lines.append("## 上架切入点")
    lines.append(f"- 市场定位：{positioning['market_positioning']}")
    lines.append(f"- 建议切入：{positioning['listing_angle']}")
    for item in positioning["evidence"]:
        lines.append(f"- 依据：{item}")
    lines.append("")
    lines.append("## 主图方向")
    for item in hero["hero_image_direction"]:
        lines.append(f"- {item}")
    lines.append("### 避免")
    for item in hero["avoid"]:
        lines.append(f"- {item}")
    lines.append("")
    lines.append("## 价格与SKU策略")
    ps = pricing["price_summary"]
    lines.append(f"- 最低价：{ps['min']}")
    lines.append(f"- 最高价：{ps['max']}")
    lines.append(f"- 均价：{ps['avg']}")
    lines.append(f"- 价格带分布：{ps['bands']}")
    for item in pricing["recommendations"]:
        lines.append(f"- {item}")
    lines.append("")
    lines.append("## QA/评价洞察")
    lines.append(f"- 评价数：{review['review_signals']['review_count']}")
    lines.append(f"- 收藏数：{review['review_signals']['favorite_count']}")
    lines.append(f"- 问答数：{review['review_signals']['question_count']}")
    lines.append(f"- 高频关注点：{', '.join(review['high_frequency_concerns']) if review['high_frequency_concerns'] else '无'}")
    for item in review["sell_point_suggestions"]:
        lines.append(f"- {item}")
    if cost_analysis.get("matched"):
        lines.append("")
        lines.append("## 你的成本测算")
        for item in cost_analysis["matched"]:
            margin = item.get("gross_margin_rate")
            margin_text = f"{round(margin * 100, 2)}%" if margin is not None else "无法计算"
            lines.append(
                f"- {item['sku_name']} -> 匹配竞品 SKU {item['matched_sku_id']} ({item['matched_sku_info']})，"
                f"匹配价带 {item['matched_band']}，市场价 {item['market_price']}，预估总成本 {item['estimated_total_cost']}，"
                f"毛利率 {margin_text}，60%门槛 {'满足' if item['meets_60_percent'] else '不满足'}，"
                f"达到60%毛利建议售价 {item['target_price_for_60_margin']}"
            )
    if cost_analysis.get("unmatched"):
        lines.append("")
        lines.append("## 未匹配成本项")
        for name in cost_analysis["unmatched"]:
            lines.append(f"- {name}")
    lines.append("")
    lines.append("## 可复用卖点")
    for item in report["selling_points"]:
        lines.append(f"- {item}")
    lines.append("")
    lines.append("## 风险提示")
    for item in report["risks"]:
        lines.append(f"- {item}")
    return "\n".join(lines)


def write_outputs(report: dict[str, Any], output_dir: Path, format_name: str) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    safe_report = json_safe(report)
    if format_name in {"json", "both"}:
        (output_dir / "competitor_analysis.json").write_text(
            json.dumps(safe_report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    if format_name in {"markdown", "both"}:
        (output_dir / "competitor_analysis.md").write_text(
            render_markdown(safe_report),
            encoding="utf-8",
        )


MARKET_SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS market_analysis_run (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        report_no VARCHAR(64) NOT NULL,
        report_hash CHAR(64) NOT NULL,
        source_platform VARCHAR(32) NOT NULL DEFAULT 'taobao',
        data_source VARCHAR(32) NULL,
        keyword VARCHAR(255) NULL,
        competitor_count INT NOT NULL DEFAULT 0,
        price_band_count INT NOT NULL DEFAULT 0,
        cost_price DECIMAL(18,2) NULL,
        cost_model_json LONGTEXT NULL,
        report_json LONGTEXT NULL,
        report_path TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_market_analysis_hash (report_hash),
        KEY idx_market_analysis_keyword (keyword),
        KEY idx_market_analysis_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS market_price_band_analysis (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        run_id BIGINT UNSIGNED NOT NULL,
        price_band VARCHAR(64) NOT NULL,
        competitor_count INT NOT NULL DEFAULT 0,
        price_min DECIMAL(18,2) NULL,
        price_max DECIMAL(18,2) NULL,
        price_avg DECIMAL(18,2) NULL,
        sold_count_total BIGINT NOT NULL DEFAULT 0,
        sales_amount_total DECIMAL(18,2) NULL,
        review_count_total BIGINT NOT NULL DEFAULT 0,
        qa_count_total BIGINT NOT NULL DEFAULT 0,
        selling_points_json LONGTEXT NULL,
        demands_json LONGTEXT NULL,
        qa_examples_json LONGTEXT NULL,
        display_images_json LONGTEXT NULL,
        profit_simulation_json LONGTEXT NULL,
        image_prompts_json LONGTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_price_band_run_band (run_id, price_band),
        KEY idx_price_band_run (run_id),
        KEY idx_price_band_name (price_band)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS market_price_band_competitor (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        run_id BIGINT UNSIGNED NOT NULL,
        price_band_id BIGINT UNSIGNED NOT NULL,
        price_band VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NULL,
        product_title TEXT NULL,
        price DECIMAL(18,2) NULL,
        sold_count BIGINT NULL,
        sales_amount DECIMAL(18,2) NULL,
        product_link TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_band_competitor_run (run_id),
        KEY idx_band_competitor_band (price_band_id),
        KEY idx_band_competitor_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS market_price_band_image (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        run_id BIGINT UNSIGNED NOT NULL,
        price_band_id BIGINT UNSIGNED NOT NULL,
        price_band VARCHAR(64) NOT NULL,
        image_type VARCHAR(64) NULL,
        product_id VARCHAR(64) NULL,
        sku_id VARCHAR(64) NULL,
        image_url TEXT NULL,
        image_path TEXT NULL,
        file_name VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_band_image_run (run_id),
        KEY idx_band_image_band (price_band_id),
        KEY idx_band_image_product (product_id),
        KEY idx_band_image_sku (sku_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS market_price_band_insight (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        run_id BIGINT UNSIGNED NOT NULL,
        price_band_id BIGINT UNSIGNED NOT NULL,
        price_band VARCHAR(64) NOT NULL,
        insight_type VARCHAR(32) NOT NULL,
        term VARCHAR(255) NOT NULL,
        occurrence_count INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_band_insight_run (run_id),
        KEY idx_band_insight_band (price_band_id),
        KEY idx_band_insight_type (insight_type),
        KEY idx_band_insight_term (term)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS market_price_band_product_analysis (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        run_id BIGINT UNSIGNED NOT NULL,
        price_band_id BIGINT UNSIGNED NOT NULL,
        price_band VARCHAR(64) NOT NULL,
        source_job_id BIGINT UNSIGNED NULL,
        product_id VARCHAR(64) NULL,
        product_title TEXT NULL,
        category_name VARCHAR(255) NULL,
        product_link TEXT NULL,
        price DECIMAL(18,2) NULL,
        price_min DECIMAL(18,2) NULL,
        price_max DECIMAL(18,2) NULL,
        sold_count BIGINT NULL,
        sales_amount DECIMAL(18,2) NULL,
        review_count BIGINT NULL,
        favorite_count BIGINT NULL,
        question_count BIGINT NULL,
        sku_count INT NOT NULL DEFAULT 0,
        qa_count INT NOT NULL DEFAULT 0,
        image_count INT NOT NULL DEFAULT 0,
        sku_json LONGTEXT NULL,
        image_json LONGTEXT NULL,
        qa_examples_json LONGTEXT NULL,
        selling_points_json LONGTEXT NULL,
        demands_json LONGTEXT NULL,
        profit_simulation_json LONGTEXT NULL,
        image_prompts_json LONGTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_market_product_run (run_id),
        KEY idx_market_product_band (price_band_id),
        KEY idx_market_product_product (product_id),
        KEY idx_market_product_price (price)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS market_product_asset (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        run_id BIGINT UNSIGNED NOT NULL,
        price_band_id BIGINT UNSIGNED NOT NULL,
        product_analysis_id BIGINT UNSIGNED NOT NULL,
        price_band VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NULL,
        sku_id VARCHAR(64) NULL,
        asset_type VARCHAR(64) NULL,
        asset_url TEXT NULL,
        asset_path TEXT NULL,
        file_name VARCHAR(255) NULL,
        sort_no INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_market_asset_run (run_id),
        KEY idx_market_asset_product_analysis (product_analysis_id),
        KEY idx_market_asset_product (product_id),
        KEY idx_market_asset_band (price_band_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS market_product_insight (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        run_id BIGINT UNSIGNED NOT NULL,
        price_band_id BIGINT UNSIGNED NOT NULL,
        product_analysis_id BIGINT UNSIGNED NOT NULL,
        price_band VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NULL,
        insight_type VARCHAR(32) NOT NULL,
        term VARCHAR(255) NOT NULL,
        occurrence_count INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_market_product_insight_run (run_id),
        KEY idx_market_product_insight_product_analysis (product_analysis_id),
        KEY idx_market_product_insight_product (product_id),
        KEY idx_market_product_insight_type (insight_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS market_listing_generation (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        run_id BIGINT UNSIGNED NOT NULL,
        price_band_id BIGINT UNSIGNED NOT NULL,
        product_analysis_id BIGINT UNSIGNED NULL,
        price_band VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NULL,
        generation_type VARCHAR(32) NOT NULL DEFAULT 'image_prompt_seed',
        title_text TEXT NULL,
        main_image_prompt TEXT NULL,
        detail_image_prompt TEXT NULL,
        buyer_show_prompt TEXT NULL,
        generation_json LONGTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_listing_generation_run (run_id),
        KEY idx_listing_generation_band (price_band_id),
        KEY idx_listing_generation_product_analysis (product_analysis_id),
        KEY idx_listing_generation_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
]


def db_decimal(value: Any) -> Optional[float]:
    return to_float(value)


def db_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def db_json(value: Any) -> str:
    return json.dumps(json_safe(value), ensure_ascii=False)


def ensure_market_schema(cursor: Any) -> None:
    for statement in MARKET_SCHEMA_STATEMENTS:
        cursor.execute(statement)


def persist_market_report(report: dict[str, Any], report_path: Path) -> dict[str, Any]:
    if report.get("price_band_report") is None:
        raise RuntimeError("--save-to-db currently supports market price-band reports only.")
    summary = report.get("summary") or {}
    report_json = db_json(report)
    report_hash = __import__("hashlib").sha256(json.dumps(json_safe(report), ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            ensure_market_schema(cursor)
            cursor.execute("SELECT id FROM market_analysis_run WHERE report_hash = %s", (report_hash,))
            existing = cursor.fetchone()
            if existing:
                run_id = int(existing["id"])
                for table in [
                    "market_listing_generation",
                    "market_product_insight",
                    "market_product_asset",
                    "market_price_band_product_analysis",
                    "market_price_band_insight",
                    "market_price_band_image",
                    "market_price_band_competitor",
                    "market_price_band_analysis",
                ]:
                    cursor.execute(f"DELETE FROM {table} WHERE run_id = %s", (run_id,))
                cursor.execute(
                    """
                    UPDATE market_analysis_run
                    SET report_no=%s, data_source=%s, keyword=%s, competitor_count=%s,
                        price_band_count=%s, cost_price=%s, cost_model_json=%s,
                        report_json=%s, report_path=%s, created_at=%s
                    WHERE id=%s
                    """,
                    (
                        f"market-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                        summary.get("source"),
                        summary.get("keyword"),
                        db_int(summary.get("competitor_count")) or 0,
                        db_int(summary.get("price_band_count")) or 0,
                        db_decimal(summary.get("cost_price")),
                        db_json(summary.get("cost_model") or {}),
                        report_json,
                        str(report_path),
                        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        run_id,
                    ),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO market_analysis_run (
                        report_no, report_hash, source_platform, data_source, keyword,
                        competitor_count, price_band_count, cost_price, cost_model_json,
                        report_json, report_path
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        f"market-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                        report_hash,
                        "taobao",
                        summary.get("source"),
                        summary.get("keyword"),
                        db_int(summary.get("competitor_count")) or 0,
                        db_int(summary.get("price_band_count")) or 0,
                        db_decimal(summary.get("cost_price")),
                        db_json(summary.get("cost_model") or {}),
                        report_json,
                        str(report_path),
                    ),
                )
                run_id = int(cursor.lastrowid)

            stats = {"run_id": run_id, "bands": 0, "competitors": 0, "band_images": 0, "band_insights": 0, "products": 0, "product_assets": 0, "product_insights": 0, "listing_generations": 0}
            for band in report.get("price_band_report") or []:
                qa = band.get("qa_and_review") or {}
                display = band.get("display_images") or {}
                cursor.execute(
                    """
                    INSERT INTO market_price_band_analysis (
                        run_id, price_band, competitor_count, price_min, price_max, price_avg,
                        sold_count_total, sales_amount_total, review_count_total, qa_count_total,
                        selling_points_json, demands_json, qa_examples_json, display_images_json,
                        profit_simulation_json, image_prompts_json
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        run_id,
                        band.get("price_band"),
                        db_int(band.get("competitor_count")) or 0,
                        db_decimal(band.get("price_min")),
                        db_decimal(band.get("price_max")),
                        db_decimal(band.get("price_avg")),
                        db_int(band.get("sold_count_total")) or 0,
                        db_decimal(band.get("sales_amount_total")),
                        db_int(qa.get("review_count_total")) or 0,
                        db_int(qa.get("qa_count_total")) or 0,
                        db_json(band.get("extracted_selling_points") or []),
                        db_json(band.get("extracted_demands") or []),
                        db_json(qa.get("qa_examples") or []),
                        db_json(display.get("available_images") or []),
                        db_json(band.get("profit_simulation")),
                        db_json(band.get("image_prompts") or {}),
                    ),
                )
                band_id = int(cursor.lastrowid)
                stats["bands"] += 1

                for item in band.get("competitor_links") or []:
                    cursor.execute(
                        """
                        INSERT INTO market_price_band_competitor (
                            run_id, price_band_id, price_band, product_id, product_title,
                            price, sold_count, sales_amount, product_link
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        (
                            run_id,
                            band_id,
                            band.get("price_band"),
                            item.get("product_id"),
                            item.get("title"),
                            db_decimal(item.get("price")),
                            db_int(item.get("sold_count")),
                            db_decimal(item.get("sales_amount")),
                            item.get("link"),
                        ),
                    )
                    stats["competitors"] += 1

                for image in display.get("available_images") or []:
                    cursor.execute(
                        """
                        INSERT INTO market_price_band_image (
                            run_id, price_band_id, price_band, image_type, product_id,
                            sku_id, image_url, image_path, file_name
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        (
                            run_id,
                            band_id,
                            band.get("price_band"),
                            image.get("image_type"),
                            image.get("product_id"),
                            image.get("sku_id"),
                            image.get("url"),
                            image.get("path"),
                            image.get("file_name"),
                        ),
                    )
                    stats["band_images"] += 1

                for insight_type, key in [("selling_point", "extracted_selling_points"), ("demand", "extracted_demands")]:
                    for insight in band.get(key) or []:
                        term = insight.get("term") or insight.get("keyword")
                        if not term:
                            continue
                        cursor.execute(
                            """
                            INSERT INTO market_price_band_insight (
                                run_id, price_band_id, price_band, insight_type, term, occurrence_count
                            ) VALUES (%s,%s,%s,%s,%s,%s)
                            """,
                            (run_id, band_id, band.get("price_band"), insight_type, term, db_int(insight.get("count")) or 0),
                        )
                        stats["band_insights"] += 1

                for product in band.get("product_analysis") or []:
                    cursor.execute(
                        """
                        INSERT INTO market_price_band_product_analysis (
                            run_id, price_band_id, price_band, source_job_id, product_id,
                            product_title, category_name, product_link, price, price_min, price_max,
                            sold_count, sales_amount, review_count, favorite_count, question_count,
                            sku_count, qa_count, image_count, sku_json, image_json, qa_examples_json,
                            selling_points_json, demands_json, profit_simulation_json, image_prompts_json
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        (
                            run_id,
                            band_id,
                            band.get("price_band"),
                            db_int(product.get("job_id")),
                            product.get("product_id"),
                            product.get("product_title"),
                            product.get("category_name"),
                            product.get("product_link"),
                            db_decimal(product.get("price")),
                            db_decimal(product.get("price_min")),
                            db_decimal(product.get("price_max")),
                            db_int(product.get("sold_count")),
                            db_decimal(product.get("sales_amount")),
                            db_int(product.get("review_count")),
                            db_int(product.get("favorite_count")),
                            db_int(product.get("question_count")),
                            db_int(product.get("sku_count")) or 0,
                            db_int(product.get("qa_count")) or 0,
                            db_int(product.get("image_count")) or 0,
                            db_json(product.get("skus") or []),
                            db_json(product.get("images") or []),
                            db_json(product.get("qa_examples") or []),
                            db_json(product.get("selling_points") or []),
                            db_json(product.get("demands") or []),
                            db_json(product.get("profit_simulation")),
                            db_json(product.get("image_prompts") or {}),
                        ),
                    )
                    product_analysis_id = int(cursor.lastrowid)
                    stats["products"] += 1

                    for index, image in enumerate(product.get("images") or []):
                        cursor.execute(
                            """
                            INSERT INTO market_product_asset (
                                run_id, price_band_id, product_analysis_id, price_band,
                                product_id, sku_id, asset_type, asset_url, asset_path, file_name, sort_no
                            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                            """,
                            (
                                run_id,
                                band_id,
                                product_analysis_id,
                                band.get("price_band"),
                                product.get("product_id"),
                                image.get("sku_id"),
                                image.get("image_type"),
                                image.get("url"),
                                image.get("path"),
                                image.get("file_name"),
                                index,
                            ),
                        )
                        stats["product_assets"] += 1

                    for insight_type, key in [("selling_point", "selling_points"), ("demand", "demands")]:
                        for insight in product.get(key) or []:
                            term = insight.get("term") or insight.get("keyword")
                            if not term:
                                continue
                            cursor.execute(
                                """
                                INSERT INTO market_product_insight (
                                    run_id, price_band_id, product_analysis_id, price_band,
                                    product_id, insight_type, term, occurrence_count
                                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                                """,
                                (
                                    run_id,
                                    band_id,
                                    product_analysis_id,
                                    band.get("price_band"),
                                    product.get("product_id"),
                                    insight_type,
                                    term,
                                    db_int(insight.get("count")) or 0,
                                ),
                            )
                            stats["product_insights"] += 1

                    prompts = product.get("image_prompts") or {}
                    cursor.execute(
                        """
                        INSERT INTO market_listing_generation (
                            run_id, price_band_id, product_analysis_id, price_band, product_id,
                            generation_type, main_image_prompt, detail_image_prompt,
                            buyer_show_prompt, generation_json
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        (
                            run_id,
                            band_id,
                            product_analysis_id,
                            band.get("price_band"),
                            product.get("product_id"),
                            "image_prompt_seed",
                            prompts.get("main_image_prompt"),
                            prompts.get("detail_image_prompt"),
                            prompts.get("buyer_show_prompt"),
                            db_json(prompts),
                        ),
                    )
                    stats["listing_generations"] += 1
            conn.commit()
            return {"ok": True, "report_hash": report_hash, **stats}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def safe_print(text: str) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"))


def main() -> int:
    args = parse_args()
    data = choose_data_source(args)
    cost_map = load_cost_map(Path(args.cost_file).resolve()) if args.cost_file else {}
    if data.get("competitors") is not None:
        report = build_market_price_band_report(data, args)
    else:
        report = build_analysis(data, cost_map)
    output_dir = Path(args.output_dir).resolve()
    write_outputs(report, output_dir, args.format)
    save_result = None
    if args.save_to_db:
        save_result = persist_market_report(report, output_dir / "competitor_analysis.json")

    safe_print(json.dumps(json_safe(report["summary"]), ensure_ascii=False, indent=2))
    if save_result:
        safe_print(json.dumps(json_safe(save_result), ensure_ascii=False, indent=2))
    safe_print(f"Generated outputs in: {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
