import argparse
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

try:
    import pymysql
except ImportError:
    pymysql = None

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_DIR = BASE_DIR / "cleaned_output"

SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS crawl_job (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        job_no VARCHAR(64) NOT NULL,
        source_platform VARCHAR(32) NOT NULL DEFAULT 'taobao',
        job_type VARCHAR(32) NOT NULL DEFAULT 'shop',
        target_value VARCHAR(255) NULL,
        shop_id VARCHAR(64) NULL,
        shop_name VARCHAR(255) NULL,
        job_status VARCHAR(32) NOT NULL DEFAULT 'pending',
        retry_count INT NOT NULL DEFAULT 0,
        product_count INT NOT NULL DEFAULT 0,
        sku_count INT NOT NULL DEFAULT 0,
        qa_count INT NOT NULL DEFAULT 0,
        image_count INT NOT NULL DEFAULT 0,
        error_message TEXT NULL,
        scheduled_at DATETIME NULL,
        started_at DATETIME NULL,
        finished_at DATETIME NULL,
        remark VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_crawl_job_no (job_no),
        KEY idx_crawl_job_platform (source_platform),
        KEY idx_crawl_job_type (job_type),
        KEY idx_crawl_job_target (target_value),
        KEY idx_crawl_job_shop (shop_id),
        KEY idx_crawl_job_status (job_status),
        KEY idx_crawl_job_started (started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS source_file_record (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        job_id BIGINT UNSIGNED NOT NULL,
        file_type VARCHAR(32) NOT NULL,
        source_kind VARCHAR(64) NOT NULL,
        source_name VARCHAR(255) NULL,
        source_url TEXT NULL,
        local_path TEXT NULL,
        http_status INT NULL,
        download_status VARCHAR(32) NULL,
        content_type VARCHAR(128) NULL,
        file_size BIGINT NULL,
        sha256 CHAR(64) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_source_file_job (job_id),
        KEY idx_source_file_kind (source_kind),
        KEY idx_source_file_sha256 (sha256)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS product_snapshot (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        job_id BIGINT UNSIGNED NOT NULL,
        source_platform VARCHAR(32) NOT NULL DEFAULT 'taobao',
        product_id VARCHAR(64) NULL,
        shop_id VARCHAR(64) NULL,
        shop_name VARCHAR(255) NULL,
        shop_type VARCHAR(64) NULL,
        product_title TEXT NULL,
        category_name VARCHAR(255) NULL,
        product_url TEXT NULL,
        is_listed TINYINT NULL,
        sku_count INT NULL,
        min_price DECIMAL(18, 2) NULL,
        max_price DECIMAL(18, 2) NULL,
        min_coupon_price DECIMAL(18, 2) NULL,
        max_coupon_price DECIMAL(18, 2) NULL,
        effective_min_price DECIMAL(18, 2) NULL,
        effective_max_price DECIMAL(18, 2) NULL,
        sold_count_raw VARCHAR(64) NULL,
        sold_count INT NULL,
        sales_amount_raw VARCHAR(64) NULL,
        sales_amount DECIMAL(18, 2) NULL,
        review_count_raw VARCHAR(64) NULL,
        review_count INT NULL,
        favorite_count_raw VARCHAR(64) NULL,
        favorite_count INT NULL,
        question_count_raw VARCHAR(64) NULL,
        question_count INT NULL,
        payer_count_raw VARCHAR(64) NULL,
        payer_count INT NULL,
        monthly_received_raw VARCHAR(64) NULL,
        monthly_received INT NULL,
        snapshot_time DATETIME NULL,
        data_snapshot_date DATE NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_product_snapshot_job (job_id),
        KEY idx_product_snapshot_product (product_id),
        KEY idx_product_snapshot_shop (shop_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS product_sku_snapshot (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        job_id BIGINT UNSIGNED NOT NULL,
        product_id VARCHAR(64) NULL,
        sku_id VARCHAR(64) NULL,
        sku_title VARCHAR(500) NULL,
        sku_info TEXT NULL,
        sku_image_url TEXT NULL,
        sku_image_path TEXT NULL,
        package_type VARCHAR(500) NULL,
        price DECIMAL(18, 2) NULL,
        coupon_price DECIMAL(18, 2) NULL,
        stock_qty INT NULL,
        snapshot_time DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_product_sku_job (job_id),
        KEY idx_product_sku_product (product_id),
        KEY idx_product_sku_id (sku_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS product_qa_snapshot (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        job_id BIGINT UNSIGNED NOT NULL,
        product_id VARCHAR(64) NULL,
        nickname VARCHAR(255) NULL,
        qa_time DATETIME NULL,
        question TEXT NULL,
        answer TEXT NULL,
        qa_hash CHAR(64) NULL,
        snapshot_time DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_product_qa_job (job_id),
        KEY idx_product_qa_product (product_id),
        KEY idx_product_qa_hash (qa_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS product_review_snapshot (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        job_id BIGINT UNSIGNED NOT NULL,
        product_id VARCHAR(64) NULL,
        row_no INT NULL,
        buyer_name VARCHAR(255) NULL,
        review_time DATETIME NULL,
        sku_text TEXT NULL,
        review_text TEXT NULL,
        media_text TEXT NULL,
        useful_count INT NULL,
        follow_review TEXT NULL,
        follow_time DATETIME NULL,
        follow_media_text TEXT NULL,
        review_hash CHAR(64) NULL,
        raw_json JSON NULL,
        snapshot_time DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_product_review_job (job_id),
        KEY idx_product_review_product (product_id),
        KEY idx_product_review_hash (review_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS media_asset (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        job_id BIGINT UNSIGNED NOT NULL,
        product_id VARCHAR(64) NULL,
        sku_id VARCHAR(64) NULL,
        qa_id BIGINT UNSIGNED NULL,
        image_type VARCHAR(32) NULL,
        source_url TEXT NULL,
        storage_type VARCHAR(32) NULL,
        storage_path TEXT NULL,
        file_name VARCHAR(255) NULL,
        mime_type VARCHAR(128) NULL,
        file_ext VARCHAR(16) NULL,
        file_size BIGINT NULL,
        width INT NULL,
        height INT NULL,
        sha256 CHAR(64) NULL,
        sort_no INT NOT NULL DEFAULT 0,
        is_downloaded TINYINT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_media_job (job_id),
        KEY idx_media_product (product_id),
        KEY idx_media_sku (sku_id),
        KEY idx_media_sha256 (sha256)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS product_page_image_asset (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        job_id BIGINT UNSIGNED NOT NULL,
        product_id VARCHAR(64) NULL,
        image_type VARCHAR(32) NOT NULL,
        source_url TEXT NULL,
        storage_type VARCHAR(32) NULL,
        storage_path TEXT NULL,
        file_name VARCHAR(255) NULL,
        mime_type VARCHAR(128) NULL,
        file_ext VARCHAR(16) NULL,
        file_size BIGINT NULL,
        width INT NULL,
        height INT NULL,
        sha256 CHAR(64) NULL,
        sort_no INT NOT NULL DEFAULT 0,
        is_downloaded TINYINT NOT NULL DEFAULT 0,
        page_url TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_product_page_image_job (job_id),
        KEY idx_product_page_image_product (product_id),
        KEY idx_product_page_image_type (image_type),
        KEY idx_product_page_image_sha256 (sha256)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
]


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def file_sha256(path: Path) -> Optional[str]:
    if not path.exists() or not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_size(path: Path) -> Optional[int]:
    if not path.exists() or not path.is_file():
        return None
    return path.stat().st_size


def load_cleaned_data(input_dir: Path) -> dict[str, Any]:
    manifest = read_json(input_dir / "manifest.json")
    product_rows = read_json(input_dir / "product_snapshot.clean.json")
    sku_rows = read_json(input_dir / "product_sku_snapshot.clean.json") if (input_dir / "product_sku_snapshot.clean.json").exists() else []
    qa_rows = read_json(input_dir / "product_qa_snapshot.clean.json") if (input_dir / "product_qa_snapshot.clean.json").exists() else []
    review_rows = read_json(input_dir / "product_review_snapshot.clean.json") if (input_dir / "product_review_snapshot.clean.json").exists() else []
    media_rows = read_json(input_dir / "media_asset.clean.json")
    product_page_image_rows = read_json(input_dir / "product_page_image_asset.clean.json") if (input_dir / "product_page_image_asset.clean.json").exists() else []
    return {
        "manifest": manifest,
        "product_rows": product_rows,
        "sku_rows": sku_rows,
        "qa_rows": qa_rows,
        "review_rows": review_rows,
        "media_rows": media_rows,
        "product_page_image_rows": product_page_image_rows,
    }


def resolve_source_path(base_dir: Path, input_dir: Path, source_value: str) -> Path:
    path = Path(source_value)
    if path.is_absolute():
        return path
    for candidate in (input_dir.parent / source_value, base_dir / source_value):
        if candidate.exists():
            return candidate
    return input_dir.parent / source_value


def build_source_file_records(base_dir: Path, input_dir: Path, manifest: dict[str, Any]) -> list[dict[str, Any]]:
    records = []

    source_files = manifest.get("source_files", {})
    for _, source_value in source_files.items():
        if not source_value:
            continue
        path = resolve_source_path(base_dir, input_dir, str(source_value))
        if path.exists():
            records.append(
                {
                    "file_type": "excel",
                    "source_kind": "source_excel",
                    "source_name": path.name,
                    "source_url": None,
                    "local_path": str(path),
                    "http_status": None,
                    "download_status": "available",
                    "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "file_size": file_size(path),
                    "sha256": file_sha256(path),
                }
            )

    for name in [
        "manifest.json",
        "product_snapshot.clean.json",
        "product_sku_snapshot.clean.json",
        "product_qa_snapshot.clean.json",
        "product_review_snapshot.clean.json",
        "product_page_image_asset.clean.json",
        "media_asset.clean.json",
    ]:
        path = input_dir / name
        if path.exists():
            records.append(
                {
                    "file_type": "json",
                    "source_kind": "clean_output",
                    "source_name": name,
                    "source_url": None,
                    "local_path": str(path),
                    "http_status": None,
                    "download_status": "generated",
                    "content_type": "application/json",
                    "file_size": file_size(path),
                    "sha256": file_sha256(path),
                }
            )

    for image_path in sorted((input_dir / "media").glob("*")):
        if image_path.is_file():
            suffix = image_path.suffix.lower()
            if suffix == ".png":
                content_type = "image/png"
            elif suffix in {".jpg", ".jpeg"}:
                content_type = "image/jpeg"
            elif suffix == ".webp":
                content_type = "image/webp"
            else:
                content_type = "application/octet-stream"
            records.append(
                {
                    "file_type": "image",
                    "source_kind": "exported_media",
                    "source_name": image_path.name,
                    "source_url": None,
                    "local_path": str(image_path),
                    "http_status": None,
                    "download_status": "generated",
                    "content_type": content_type,
                    "file_size": file_size(image_path),
                    "sha256": file_sha256(image_path),
                }
            )

    return records


def build_job_payload(manifest: dict[str, Any]) -> dict[str, Any]:
    counts = manifest.get("counts", {})
    return {
        "job_no": f"clean-import-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}",
        "source_platform": "taobao",
        "job_type": "clean_json_import",
        "target_value": "cleaned_output",
        "shop_id": None,
        "shop_name": None,
        "job_status": "running",
        "retry_count": 0,
        "product_count": counts.get("product", 0),
        "sku_count": counts.get("sku", 0),
            "qa_count": counts.get("qa", 0),
        "image_count": counts.get("media_asset", counts.get("exported_images", 0)),
        "error_message": None,
        "scheduled_at": None,
        "started_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "finished_at": None,
        "remark": "import from cleaned_output",
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load cleaned e-commerce JSON data into MySQL.")
    parser.add_argument("--input-dir", default=str(DEFAULT_INPUT_DIR), help="Directory containing cleaned_output JSON files")
    parser.add_argument("--dry-run", action="store_true", help="Validate files and print counts without writing to MySQL")
    parser.add_argument("--init-schema", action="store_true", help="Create missing MySQL tables required by this loader")
    return parser.parse_args()


def require_env(name: str, default: Optional[str] = None) -> str:
    value = os.getenv(name, default)
    if value is None or value == "":
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def get_optional_env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name)
    if value is None:
        return default
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
        autocommit=False,
        cursorclass=pymysql.cursors.DictCursor,
    )


def ensure_schema(conn: Any) -> None:
    with conn.cursor() as cursor:
        for statement in SCHEMA_STATEMENTS:
            cursor.execute(statement)
        ensure_column(cursor, "product_snapshot", "min_price", "DECIMAL(18, 2) NULL")
        ensure_column(cursor, "product_snapshot", "max_price", "DECIMAL(18, 2) NULL")
        ensure_column(cursor, "product_snapshot", "min_coupon_price", "DECIMAL(18, 2) NULL")
        ensure_column(cursor, "product_snapshot", "max_coupon_price", "DECIMAL(18, 2) NULL")
        ensure_column(cursor, "product_snapshot", "effective_min_price", "DECIMAL(18, 2) NULL")
        ensure_column(cursor, "product_snapshot", "effective_max_price", "DECIMAL(18, 2) NULL")
        ensure_column(cursor, "product_sku_snapshot", "sku_image_url", "TEXT NULL")
        ensure_column(cursor, "product_sku_snapshot", "sku_image_path", "TEXT NULL")
    conn.commit()


def ensure_column(cursor: Any, table_name: str, column_name: str, definition: str) -> None:
    cursor.execute(f"SHOW COLUMNS FROM {table_name} LIKE %s", (column_name,))
    if cursor.fetchone():
        return
    cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")


def validate_media_paths(input_dir: Path, media_rows: list[dict[str, Any]]) -> list[str]:
    missing = []
    for row in media_rows:
        rel = row.get("storage_path")
        if not rel:
            continue
        path = input_dir / rel
        if not path.exists():
            missing.append(str(path))
    return missing


def insert_crawl_job(cursor: Any, payload: dict[str, Any]) -> int:
    sql = """
        INSERT INTO crawl_job (
            job_no, source_platform, job_type, target_value, shop_id, shop_name, job_status,
            retry_count, product_count, sku_count, qa_count, image_count, error_message,
            scheduled_at, started_at, finished_at, remark
        ) VALUES (
            %(job_no)s, %(source_platform)s, %(job_type)s, %(target_value)s, %(shop_id)s, %(shop_name)s, %(job_status)s,
            %(retry_count)s, %(product_count)s, %(sku_count)s, %(qa_count)s, %(image_count)s, %(error_message)s,
            %(scheduled_at)s, %(started_at)s, %(finished_at)s, %(remark)s
        )
    """
    cursor.execute(sql, payload)
    return int(cursor.lastrowid)


def update_crawl_job_status(cursor: Any, job_id: int, status: str, error_message: Optional[str] = None) -> None:
    cursor.execute(
        """
        UPDATE crawl_job
        SET job_status = %s, error_message = %s, finished_at = %s
        WHERE id = %s
        """,
        (status, error_message, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), job_id),
    )


def insert_source_file_records(cursor: Any, job_id: int, rows: list[dict[str, Any]]) -> int:
    sql = """
        INSERT INTO source_file_record (
            job_id, file_type, source_kind, source_name, source_url,
            local_path, http_status, download_status, content_type, file_size, sha256
        ) VALUES (
            %(job_id)s, %(file_type)s, %(source_kind)s, %(source_name)s, %(source_url)s,
            %(local_path)s, %(http_status)s, %(download_status)s, %(content_type)s, %(file_size)s, %(sha256)s
        )
    """
    payload = [{**row, "job_id": job_id} for row in rows]
    if payload:
        cursor.executemany(sql, payload)
    return len(payload)


def sku_price_summary(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        product_id = row.get("product_id")
        if not product_id:
            continue
        summary = grouped.setdefault(str(product_id), {"prices": [], "coupon_prices": [], "effective_prices": []})
        price = row.get("price")
        coupon_price = row.get("coupon_price")
        if price is not None:
            summary["prices"].append(price)
        if coupon_price is not None:
            summary["coupon_prices"].append(coupon_price)
        effective_price = coupon_price if coupon_price is not None else price
        if effective_price is not None:
            summary["effective_prices"].append(effective_price)

    out: dict[str, dict[str, Any]] = {}
    for product_id, summary in grouped.items():
        prices = summary["prices"]
        coupon_prices = summary["coupon_prices"]
        effective_prices = summary["effective_prices"]
        out[product_id] = {
            "min_price": min(prices) if prices else None,
            "max_price": max(prices) if prices else None,
            "min_coupon_price": min(coupon_prices) if coupon_prices else None,
            "max_coupon_price": max(coupon_prices) if coupon_prices else None,
            "effective_min_price": min(effective_prices) if effective_prices else None,
            "effective_max_price": max(effective_prices) if effective_prices else None,
        }
    return out


def insert_product_rows(cursor: Any, job_id: int, rows: list[dict[str, Any]], sku_rows: Optional[list[dict[str, Any]]] = None) -> int:
    sql = """
        INSERT INTO product_snapshot (
            job_id, source_platform, product_id, shop_id, shop_name, shop_type, product_title,
            category_name, product_url, is_listed, sku_count,
            min_price, max_price, min_coupon_price, max_coupon_price, effective_min_price, effective_max_price,
            sold_count_raw, sold_count, sales_amount_raw, sales_amount,
            review_count_raw, review_count, favorite_count_raw, favorite_count,
            question_count_raw, question_count, payer_count_raw, payer_count,
            monthly_received_raw, monthly_received, snapshot_time, data_snapshot_date
        ) VALUES (
            %(job_id)s, %(source_platform)s, %(product_id)s, %(shop_id)s, %(shop_name)s, %(shop_type)s, %(product_title)s,
            %(category_name)s, %(product_url)s, %(is_listed)s, %(sku_count)s,
            %(min_price)s, %(max_price)s, %(min_coupon_price)s, %(max_coupon_price)s, %(effective_min_price)s, %(effective_max_price)s,
            %(sold_count_raw)s, %(sold_count)s, %(sales_amount_raw)s, %(sales_amount)s,
            %(review_count_raw)s, %(review_count)s, %(favorite_count_raw)s, %(favorite_count)s,
            %(question_count_raw)s, %(question_count)s, %(payer_count_raw)s, %(payer_count)s,
            %(monthly_received_raw)s, %(monthly_received)s, %(snapshot_time)s, %(data_snapshot_date)s
        )
    """
    payload = []
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    price_by_product = sku_price_summary(sku_rows or [])
    for row in rows:
        price_summary = price_by_product.get(str(row.get("product_id")), {})
        payload.append(
            {
                "job_id": job_id,
                "source_platform": "taobao",
                "product_id": row.get("product_id"),
                "shop_id": None,
                "shop_name": row.get("shop_name"),
                "shop_type": row.get("shop_type"),
                "product_title": row.get("product_title"),
                "category_name": row.get("category_name"),
                "product_url": None,
                "is_listed": row.get("is_listed"),
                "sku_count": row.get("sku_count"),
                "min_price": price_summary.get("min_price"),
                "max_price": price_summary.get("max_price"),
                "min_coupon_price": price_summary.get("min_coupon_price"),
                "max_coupon_price": price_summary.get("max_coupon_price"),
                "effective_min_price": price_summary.get("effective_min_price"),
                "effective_max_price": price_summary.get("effective_max_price"),
                "sold_count_raw": row.get("sold_count_raw"),
                "sold_count": row.get("sold_count"),
                "sales_amount_raw": row.get("sales_amount_raw"),
                "sales_amount": row.get("sales_amount"),
                "review_count_raw": row.get("review_count_raw"),
                "review_count": row.get("review_count"),
                "favorite_count_raw": row.get("favorite_count_raw"),
                "favorite_count": row.get("favorite_count"),
                "question_count_raw": row.get("question_count_raw"),
                "question_count": row.get("question_count"),
                "payer_count_raw": row.get("payer_count_raw"),
                "payer_count": row.get("payer_count"),
                "monthly_received_raw": row.get("monthly_received_raw"),
                "monthly_received": row.get("monthly_received"),
                "snapshot_time": now,
                "data_snapshot_date": None,
            }
        )
    if payload:
        cursor.executemany(sql, payload)
    return len(payload)


def insert_sku_rows(cursor: Any, job_id: int, rows: list[dict[str, Any]]) -> int:
    sql = """
        INSERT INTO product_sku_snapshot (
            job_id, product_id, sku_id, sku_title, sku_info,
            sku_image_url, sku_image_path, package_type, price,
            coupon_price, stock_qty, snapshot_time
        ) VALUES (
            %(job_id)s, %(product_id)s, %(sku_id)s, %(sku_title)s, %(sku_info)s,
            %(sku_image_url)s, %(sku_image_path)s, %(package_type)s, %(price)s,
            %(coupon_price)s, %(stock_qty)s, %(snapshot_time)s
        )
    """
    payload = []
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for row in rows:
        payload.append(
            {
                "job_id": job_id,
                "product_id": row.get("product_id"),
                "sku_id": row.get("sku_id"),
                "sku_title": None,
                "sku_info": row.get("sku_info"),
                "sku_image_url": row.get("sku_image_url"),
                "sku_image_path": row.get("sku_image_path"),
                "package_type": row.get("package_type"),
                "price": row.get("price"),
                "coupon_price": row.get("coupon_price"),
                "stock_qty": row.get("stock_qty"),
                "snapshot_time": now,
            }
        )
    if payload:
        cursor.executemany(sql, payload)
    return len(payload)


def insert_qa_rows(cursor: Any, job_id: int, rows: list[dict[str, Any]]) -> int:
    sql = """
        INSERT INTO product_qa_snapshot (
            job_id, product_id, nickname, qa_time, question, answer, qa_hash, snapshot_time
        ) VALUES (
            %(job_id)s, %(product_id)s, %(nickname)s, %(qa_time)s, %(question)s, %(answer)s, %(qa_hash)s, %(snapshot_time)s
        )
    """
    payload = []
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for row in rows:
        payload.append(
            {
                "job_id": job_id,
                "product_id": row.get("product_id"),
                "nickname": row.get("nickname"),
                "qa_time": row.get("qa_time"),
                "question": row.get("question"),
                "answer": row.get("answer"),
                "qa_hash": row.get("qa_hash"),
                "snapshot_time": now,
            }
        )
    if payload:
        cursor.executemany(sql, payload)
    return len(payload)


def insert_review_rows(cursor: Any, job_id: int, rows: list[dict[str, Any]]) -> int:
    sql = """
        INSERT INTO product_review_snapshot (
            job_id, product_id, row_no, buyer_name, review_time, sku_text, review_text,
            media_text, useful_count, follow_review, follow_time, follow_media_text,
            review_hash, raw_json, snapshot_time
        ) VALUES (
            %(job_id)s, %(product_id)s, %(row_no)s, %(buyer_name)s, %(review_time)s, %(sku_text)s, %(review_text)s,
            %(media_text)s, %(useful_count)s, %(follow_review)s, %(follow_time)s, %(follow_media_text)s,
            %(review_hash)s, CAST(%(raw_json)s AS JSON), %(snapshot_time)s
        )
    """
    payload = []
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for row in rows:
        raw_json = row.get("raw_json")
        payload.append(
            {
                "job_id": job_id,
                "product_id": row.get("product_id"),
                "row_no": row.get("row_no"),
                "buyer_name": row.get("buyer_name"),
                "review_time": row.get("review_time"),
                "sku_text": row.get("sku_text"),
                "review_text": row.get("review_text"),
                "media_text": row.get("media_text"),
                "useful_count": row.get("useful_count"),
                "follow_review": row.get("follow_review"),
                "follow_time": row.get("follow_time"),
                "follow_media_text": row.get("follow_media_text"),
                "review_hash": row.get("review_hash"),
                "raw_json": json.dumps(raw_json, ensure_ascii=False) if raw_json is not None else None,
                "snapshot_time": now,
            }
        )
    if payload:
        cursor.executemany(sql, payload)
    return len(payload)


def insert_media_rows(cursor: Any, job_id: int, rows: list[dict[str, Any]]) -> int:
    sql = """
        INSERT INTO media_asset (
            job_id, product_id, sku_id, qa_id, image_type, source_url,
            storage_type, storage_path, file_name, mime_type, file_ext,
            file_size, width, height, sha256, sort_no, is_downloaded
        ) VALUES (
            %(job_id)s, %(product_id)s, %(sku_id)s, %(qa_id)s, %(image_type)s, %(source_url)s,
            %(storage_type)s, %(storage_path)s, %(file_name)s, %(mime_type)s, %(file_ext)s,
            %(file_size)s, %(width)s, %(height)s, %(sha256)s, %(sort_no)s, %(is_downloaded)s
        )
    """
    payload = []
    for row in rows:
        file_name = row.get("file_name")
        ext = Path(file_name).suffix.lower().lstrip(".") if file_name else None
        mime = None
        if ext == "png":
            mime = "image/png"
        elif ext in {"jpg", "jpeg"}:
            mime = "image/jpeg"
        elif ext == "webp":
            mime = "image/webp"
        payload.append(
            {
                "job_id": job_id,
                "product_id": row.get("product_id"),
                "sku_id": row.get("sku_id"),
                "qa_id": None,
                "image_type": row.get("image_type"),
                "source_url": row.get("source_url"),
                "storage_type": row.get("storage_type") or "local_file",
                "storage_path": row.get("storage_path"),
                "file_name": file_name,
                "mime_type": mime,
                "file_ext": ext,
                "file_size": row.get("file_size"),
                "width": None,
                "height": None,
                "sha256": row.get("sha256"),
                "sort_no": row.get("sort_no", 0),
                "is_downloaded": row.get("is_downloaded", 0),
            }
        )
    if payload:
        cursor.executemany(sql, payload)
    return len(payload)


def insert_product_page_image_rows(cursor: Any, job_id: int, rows: list[dict[str, Any]]) -> int:
    sql = """
        INSERT INTO product_page_image_asset (
            job_id, product_id, image_type, source_url, storage_type, storage_path,
            file_name, mime_type, file_ext, file_size, width, height, sha256,
            sort_no, is_downloaded, page_url
        ) VALUES (
            %(job_id)s, %(product_id)s, %(image_type)s, %(source_url)s, %(storage_type)s, %(storage_path)s,
            %(file_name)s, %(mime_type)s, %(file_ext)s, %(file_size)s, %(width)s, %(height)s, %(sha256)s,
            %(sort_no)s, %(is_downloaded)s, %(page_url)s
        )
    """
    payload = []
    for row in rows:
        file_name = row.get("file_name")
        ext = row.get("file_ext") or (Path(file_name).suffix.lower().lstrip(".") if file_name else None)
        payload.append(
            {
                "job_id": job_id,
                "product_id": row.get("product_id"),
                "image_type": row.get("image_type") or "product_page_image",
                "source_url": row.get("source_url"),
                "storage_type": row.get("storage_type") or "local_file",
                "storage_path": row.get("storage_path"),
                "file_name": file_name,
                "mime_type": row.get("mime_type"),
                "file_ext": ext,
                "file_size": row.get("file_size"),
                "width": row.get("width"),
                "height": row.get("height"),
                "sha256": row.get("sha256"),
                "sort_no": row.get("sort_no", 0),
                "is_downloaded": row.get("is_downloaded", 0),
                "page_url": row.get("page_url"),
            }
        )
    if payload:
        cursor.executemany(sql, payload)
    return len(payload)


def count_rows_for_job(cursor: Any, table_name: str, job_id: int) -> int:
    cursor.execute(f"SELECT COUNT(*) AS cnt FROM {table_name} WHERE job_id = %s", (job_id,))
    result = cursor.fetchone()
    return int(result["cnt"])


def run_dry_run(base_dir: Path, input_dir: Path, data: dict[str, Any]) -> int:
    missing = validate_media_paths(input_dir, data["media_rows"])
    source_records = build_source_file_records(base_dir, input_dir, data["manifest"])
    summary = {
        "input_dir": str(input_dir),
        "counts": {
            "product": len(data["product_rows"]),
            "sku": len(data["sku_rows"]),
            "qa": len(data["qa_rows"]),
            "review_comment": len(data.get("review_rows", [])),
            "media_asset": len(data["media_rows"]),
            "product_page_image_asset": len(data.get("product_page_image_rows", [])),
            "source_file_record": len(source_records),
        },
        "missing_media_paths": missing,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 1 if missing else 0


def main() -> int:
    args = parse_args()
    input_dir = Path(args.input_dir).resolve()

    if args.init_schema:
        conn = get_connection()
        try:
            ensure_schema(conn)
        finally:
            conn.close()
        if not input_dir.exists():
            print(json.dumps({"schema_initialized": True}, ensure_ascii=False, indent=2))
            return 0

    data = load_cleaned_data(input_dir)

    if args.dry_run:
        return run_dry_run(BASE_DIR, input_dir, data)

    conn = get_connection()
    ensure_schema(conn)
    job_payload = build_job_payload(data["manifest"])
    source_records = build_source_file_records(BASE_DIR, input_dir, data["manifest"])
    missing_media = validate_media_paths(input_dir, data["media_rows"])
    if missing_media:
        raise RuntimeError(f"Missing exported media files: {missing_media}")

    job_id = None
    try:
        with conn.cursor() as cursor:
            job_id = insert_crawl_job(cursor, job_payload)
            inserted_source_files = insert_source_file_records(cursor, job_id, source_records)
            inserted_products = insert_product_rows(cursor, job_id, data["product_rows"], data["sku_rows"])
            inserted_skus = insert_sku_rows(cursor, job_id, data["sku_rows"])
            inserted_qas = insert_qa_rows(cursor, job_id, data["qa_rows"])
            inserted_reviews = insert_review_rows(cursor, job_id, data.get("review_rows", []))
            inserted_media = insert_media_rows(cursor, job_id, data["media_rows"])
            inserted_product_page_images = insert_product_page_image_rows(cursor, job_id, data.get("product_page_image_rows", []))

            verify = {
                "product_snapshot": count_rows_for_job(cursor, "product_snapshot", job_id),
                "product_sku_snapshot": count_rows_for_job(cursor, "product_sku_snapshot", job_id),
                "product_qa_snapshot": count_rows_for_job(cursor, "product_qa_snapshot", job_id),
                "product_review_snapshot": count_rows_for_job(cursor, "product_review_snapshot", job_id),
                "media_asset": count_rows_for_job(cursor, "media_asset", job_id),
                "product_page_image_asset": count_rows_for_job(cursor, "product_page_image_asset", job_id),
            }

            update_crawl_job_status(cursor, job_id, "success", None)
            conn.commit()

        summary = {
            "job_id": job_id,
            "job_no": job_payload["job_no"],
            "inserted": {
                "source_file_record": inserted_source_files,
                "product_snapshot": inserted_products,
                "product_sku_snapshot": inserted_skus,
                "product_qa_snapshot": inserted_qas,
                "product_review_snapshot": inserted_reviews,
                "media_asset": inserted_media,
                "product_page_image_asset": inserted_product_page_images,
            },
            "verified": verify,
        }
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        conn.rollback()
        if job_id is not None:
            try:
                with conn.cursor() as cursor:
                    update_crawl_job_status(cursor, job_id, "failed", str(exc)[:65535])
                conn.commit()
            except Exception:
                conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
