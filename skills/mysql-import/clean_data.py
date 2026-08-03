import argparse
import hashlib
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "p": "http://schemas.openxmlformats.org/package/2006/relationships",
    "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
}

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_PRODUCT_FILE = BASE_DIR / "商品数据ID_808636994094_2026-07-01 (1).xlsx"
DEFAULT_SKU_FILE = BASE_DIR / "店透-SKU预览-表格-808636994094-2026-07-01 (4).xlsx"
DEFAULT_QA_FILE = BASE_DIR / "店透视-问大家分析-808636994094-2026-07-01 (1).xlsx"
DEFAULT_OUTPUT_DIR = BASE_DIR / "cleaned_output"

CANONICAL_HEADERS = {
    "店铺名称": ["店铺名称", "店铺名", "店名"],
    "店铺类型": ["店铺类型"],
    "商品标题": ["商品标题", "商品名称", "标题"],
    "商品ID": ["商品ID", "宝贝ID"],
    "类目": ["类目", "商品类目"],
    "上架": ["上架", "上架时间"],
    "SKU数": ["SKU数", "SKU数量"],
    "已售": ["已售", "销量"],
    "销售额约": ["销售额约", "销售额", "成交额"],
    "评价": ["评价", "评价数"],
    "收藏": ["收藏", "收藏数"],
    "问大家": ["问大家", "问答数"],
    "付款人数": ["付款人数"],
    "月收货": ["月收货"],
    "SKU信息": ["SKU信息", "规格信息"],
    "SKU图片": ["SKU图片", "图片", "图片链接", "SKU图片链接", "SKU图链接", "SKU图片URL", "图片URL"],
    "SKUID": ["SKUID", "SKU ID"],
    "价格": ["价格", "售价"],
    "券后价格": ["券后价格", "券后价"],
    "套餐类型": ["套餐类型", "套餐", "颜色分类"],
    "库存": ["库存", "库存数"],
    "昵称": ["昵称", "用户昵称"],
    "时间": ["时间", "提问时间"],
    "问题": ["问题"],
    "问答": ["问答", "回答"],
}


def normalize_header(text: Any) -> str:
    raw = str(text or "").strip().replace("\n", "")
    for canonical, candidates in CANONICAL_HEADERS.items():
        if raw in candidates:
            return canonical
    return raw


def normalize_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if text in {"", "-", "--", "暂无", "None", "nan"}:
        return None
    return text


def parse_datetime(value: Any) -> Optional[str]:
    text = normalize_text(value)
    if not text:
        return None
    text = text.replace("北京时间", "").strip()
    text = re.sub(r"\s+星期[一二三四五六日天]$", "", text)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
    return text


def parse_int_like(value: Any) -> Optional[int]:
    text = normalize_text(value)
    if not text:
        return None
    cleaned = text.replace(",", "").replace("+", "").replace("约", "")
    multiplier = 1
    if "万" in cleaned:
        multiplier = 10000
        cleaned = cleaned.replace("万", "")
    if "千" in cleaned:
        multiplier = 1000
        cleaned = cleaned.replace("千", "")
    cleaned = cleaned.replace("件", "").replace("人", "").replace("次", "")
    cleaned = re.sub(r"[^0-9.\-]", "", cleaned)
    if not cleaned:
        return None
    try:
        return int(float(cleaned) * multiplier)
    except ValueError:
        return None


def parse_decimal(value: Any) -> Optional[float]:
    text = normalize_text(value)
    if not text:
        return None
    cleaned = text.replace(",", "").replace("约", "")
    multiplier = 1
    if "万" in cleaned:
        multiplier = 10000
        cleaned = cleaned.replace("万", "")
    if "千" in cleaned:
        multiplier = 1000
        cleaned = cleaned.replace("千", "")
    cleaned = cleaned.replace("元", "")
    cleaned = re.sub(r"[^0-9.\-]", "", cleaned)
    if not cleaned:
        return None
    try:
        return round(float(cleaned) * multiplier, 2)
    except ValueError:
        return None


def parse_bool_listed(value: Any) -> Optional[int]:
    text = normalize_text(value)
    if not text:
        return None
    true_tokens = ["上架", "在售", "是"]
    false_tokens = ["下架", "停售", "否"]
    if any(token in text for token in true_tokens):
        return 1
    if any(token in text for token in false_tokens):
        return 0
    if parse_datetime(text):
        return 1
    return None


def extract_product_id_from_name(file_name: str) -> Optional[str]:
    match = re.search(r"(\d{8,})", file_name)
    return match.group(1) if match else None


def qa_hash(product_id: Optional[str], nickname: Any, qa_time: Any, question: Any, answer: Any) -> str:
    payload = "|".join(
        [
            product_id or "",
            normalize_text(nickname) or "",
            parse_datetime(qa_time) or "",
            normalize_text(question) or "",
            normalize_text(answer) or "",
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def review_hash(product_id: Optional[str], buyer_name: Any, review_time: Any, sku_text: Any, review_text: Any) -> str:
    payload = "|".join(
        [
            product_id or "",
            normalize_text(buyer_name) or "",
            parse_datetime(review_time) or "",
            normalize_text(sku_text) or "",
            normalize_text(review_text) or "",
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def col_to_index(col: str) -> int:
    total = 0
    for ch in col:
        if ch.isalpha():
            total = total * 26 + (ord(ch.upper()) - 64)
    return total - 1


def load_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    strings = []
    for si in root.findall("a:si", NS):
        parts = []
        for node in si.iterfind(".//a:t", NS):
            parts.append(node.text or "")
        strings.append("".join(parts))
    return strings


def workbook_sheet_targets(zf: zipfile.ZipFile) -> list[tuple[str, str]]:
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall("p:Relationship", NS)}
    sheets = []
    for sheet in wb.find("a:sheets", NS):
        rel_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        target = rel_map[rel_id]
        if not target.startswith("xl/"):
            target = "xl/" + target.lstrip("/")
        sheets.append((sheet.attrib["name"], target))
    return sheets


def cell_value(cell: ET.Element, shared: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        node = cell.find("a:is/a:t", NS)
        return node.text if node is not None else ""
    value_node = cell.find("a:v", NS)
    if value_node is None:
        return ""
    text = value_node.text or ""
    if cell_type == "s":
        idx = int(text)
        return shared[idx] if idx < len(shared) else text
    return text


def read_first_sheet(path: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(path) as zf:
        shared = load_shared_strings(zf)
        _, target = workbook_sheet_targets(zf)[0]
        root = ET.fromstring(zf.read(target))
        rows = []
        for row in root.findall(".//a:sheetData/a:row", NS):
            values: dict[int, str] = {}
            for cell in row.findall("a:c", NS):
                ref = cell.attrib.get("r", "")
                col = "".join(ch for ch in ref if ch.isalpha())
                values[col_to_index(col)] = cell_value(cell, shared)
            rows.append(values)
    if not rows:
        return []
    header_row = rows[0]
    max_index = max(header_row.keys()) if header_row else -1
    headers = [normalize_header(header_row.get(i, "")) for i in range(max_index + 1)]
    records = []
    for raw in rows[1:]:
        if not raw:
            continue
        record = {}
        limit = max(max_index, max(raw.keys()))
        for i in range(limit + 1):
            header = headers[i] if i < len(headers) else f"extra_{i}"
            record[header] = raw.get(i, "")
        if any(normalize_text(v) for v in record.values()):
            records.append(record)
    return records


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_embedded_images(xlsx_path: Path, export_dir: Path) -> list[dict[str, Any]]:
    export_dir.mkdir(parents=True, exist_ok=True)
    extracted = []
    with zipfile.ZipFile(xlsx_path) as zf:
        drawing_rels_path = "xl/drawings/_rels/drawing1.xml.rels"
        drawing_path = "xl/drawings/drawing1.xml"
        if drawing_path not in zf.namelist() or drawing_rels_path not in zf.namelist():
            return []

        rels_root = ET.fromstring(zf.read(drawing_rels_path))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels_root.findall("p:Relationship", NS)}
        drawing_root = ET.fromstring(zf.read(drawing_path))

        for anchor in drawing_root.findall("xdr:oneCellAnchor", NS):
            from_node = anchor.find("xdr:from", NS)
            pic = anchor.find("xdr:pic", NS)
            if from_node is None or pic is None:
                continue
            col = int(from_node.findtext("xdr:col", default="-1", namespaces=NS))
            row = int(from_node.findtext("xdr:row", default="-1", namespaces=NS))
            blip = pic.find(".//{http://schemas.openxmlformats.org/drawingml/2006/main}blip")
            if blip is None:
                continue
            rel_id = blip.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
            if not rel_id or rel_id not in rel_map:
                continue
            target = rel_map[rel_id]
            media_path = str((Path("xl/drawings") / target).resolve()).replace('\\', '/')
            if ":/" in media_path:
                media_path = media_path.split(":/", 1)[1]
            media_path = re.sub(r"^[A-Za-z]:", "", media_path)
            media_path = media_path.lstrip("/")
            if not media_path.startswith("xl/"):
                media_path = "xl/" + media_path.split("xl/", 1)[-1]
            if media_path not in zf.namelist():
                continue
            original_name = Path(media_path).name
            output_name = f"row_{row}_{original_name}"
            output_path = export_dir / output_name
            output_path.write_bytes(zf.read(media_path))
            extracted.append(
                {
                    "row_index": row,
                    "col_index": col,
                    "file_name": output_name,
                    "relative_path": f"media/{output_name}",
                    "absolute_path": str(output_path),
                    "file_size": output_path.stat().st_size,
                    "sha256": file_sha256(output_path),
                }
            )
    return extracted


def clean_product_rows(rows: list[dict[str, str]], source_file: Path) -> list[dict[str, Any]]:
    out = []
    fallback_product_id = extract_product_id_from_name(source_file.name)
    for row in rows:
        product_id = normalize_text(row.get("商品ID")) or fallback_product_id
        out.append(
            {
                "source_file": source_file.name,
                "product_id": product_id,
                "shop_name": normalize_text(row.get("店铺名称")),
                "shop_type": normalize_text(row.get("店铺类型")),
                "product_title": normalize_text(row.get("商品标题")),
                "category_name": normalize_text(row.get("类目")),
                "listed_at_raw": normalize_text(row.get("上架")),
                "listed_at": parse_datetime(row.get("上架")),
                "is_listed": parse_bool_listed(row.get("上架")),
                "sku_count": parse_int_like(row.get("SKU数")),
                "sold_count_raw": normalize_text(row.get("已售")),
                "sold_count": parse_int_like(row.get("已售")),
                "sales_amount_raw": normalize_text(row.get("销售额约")),
                "sales_amount": parse_decimal(row.get("销售额约")),
                "review_count_raw": normalize_text(row.get("评价")),
                "review_count": parse_int_like(row.get("评价")),
                "favorite_count_raw": normalize_text(row.get("收藏")),
                "favorite_count": parse_int_like(row.get("收藏")),
                "question_count_raw": normalize_text(row.get("问大家")),
                "question_count": parse_int_like(row.get("问大家")),
                "payer_count_raw": normalize_text(row.get("付款人数")),
                "payer_count": parse_int_like(row.get("付款人数")),
                "monthly_received_raw": normalize_text(row.get("月收货")),
                "monthly_received": parse_int_like(row.get("月收货")),
            }
        )
    return out


def clean_sku_rows(
    rows: list[dict[str, str]],
    source_file: Path,
    embedded_images: Optional[list[dict[str, Any]]] = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    out = []
    media_assets = []
    fallback_product_id = extract_product_id_from_name(source_file.name)
    image_by_sheet_row = {item["row_index"]: item for item in (embedded_images or [])}
    for idx, row in enumerate(rows, start=1):
        image = image_by_sheet_row.get(idx)
        product_id = normalize_text(row.get("商品ID")) or fallback_product_id
        sku_id = normalize_text(row.get("SKUID"))
        cleaned = {
            "source_file": source_file.name,
            "row_no": idx,
            "product_id": product_id,
            "sku_id": sku_id,
            "sku_info": normalize_text(row.get("SKU信息")),
            "sku_image_url": normalize_text(row.get("SKU图片")),
            "sku_image_path": image["relative_path"] if image else None,
            "price": parse_decimal(row.get("价格")),
            "coupon_price": parse_decimal(row.get("券后价格")),
            "package_type": normalize_text(row.get("套餐类型")),
            "stock_qty": parse_int_like(row.get("库存")),
        }
        out.append(cleaned)
        if image:
            media_assets.append(
                {
                    "source_file": source_file.name,
                    "row_no": idx,
                    "owner_type": "sku",
                    "product_id": product_id,
                    "sku_id": sku_id,
                    "image_type": "sku",
                    "source_url": normalize_text(row.get("SKU图片")),
                    "storage_type": "local_file",
                    "storage_path": image["relative_path"],
                    "file_name": image["file_name"],
                    "file_size": image["file_size"],
                    "sha256": image["sha256"],
                    "sort_no": 0,
                    "is_downloaded": 1,
                }
            )
    return out, media_assets


def clean_qa_rows(rows: list[dict[str, str]], source_file: Path) -> list[dict[str, Any]]:
    out = []
    fallback_product_id = extract_product_id_from_name(source_file.name)
    for idx, row in enumerate(rows, start=1):
        product_id = normalize_text(row.get("商品ID")) or fallback_product_id
        nickname = normalize_text(row.get("昵称"))
        qa_time = parse_datetime(row.get("时间"))
        question = normalize_text(row.get("问题"))
        answer = normalize_text(row.get("问答"))
        out.append(
            {
                "source_file": source_file.name,
                "row_no": idx,
                "product_id": product_id,
                "nickname": nickname,
                "qa_time": qa_time,
                "question": question,
                "answer": answer,
                "qa_hash": qa_hash(product_id, nickname, qa_time, question, answer),
            }
        )
    return out


def clean_product_page_image_assets(sidecar_file: Path) -> list[dict[str, Any]]:
    if not sidecar_file.exists():
        return []
    try:
        payload = json.loads(sidecar_file.read_text(encoding="utf-8"))
    except Exception:
        return []
    images = payload.get("images") if isinstance(payload, dict) else []
    if not isinstance(images, list):
        return []
    out = []
    for idx, row in enumerate(images, start=1):
        if not isinstance(row, dict):
            continue
        storage_path = normalize_text(row.get("storage_path"))
        clean_storage_path = None
        if storage_path:
            path = Path(storage_path)
            clean_storage_path = storage_path if path.is_absolute() else str(Path("..") / path)
        image_type = normalize_text(row.get("image_type")) or "product_page_image"
        out.append(
            {
                "source_file": sidecar_file.name,
                "row_no": idx,
                "owner_type": "product",
                "product_id": normalize_text(row.get("product_id")) or normalize_text(payload.get("product_id")),
                "sku_id": None,
                "image_type": image_type,
                "source_url": normalize_text(row.get("source_url")),
                "storage_type": normalize_text(row.get("storage_type")) or "local_file",
                "storage_path": clean_storage_path,
                "file_name": normalize_text(row.get("file_name")),
                "mime_type": normalize_text(row.get("mime_type")),
                "file_ext": normalize_text(row.get("file_ext")),
                "file_size": parse_int_like(row.get("file_size")),
                "width": parse_int_like(row.get("width")),
                "height": parse_int_like(row.get("height")),
                "sha256": normalize_text(row.get("sha256")),
                "sort_no": parse_int_like(row.get("sort_no")) or idx,
                "is_downloaded": 1 if row.get("is_downloaded", 1) else 0,
                "page_url": normalize_text(row.get("page_url")) or normalize_text(payload.get("page_url")),
            }
        )
    return out


def clean_review_comment_rows(sidecar_file: Path) -> list[dict[str, Any]]:
    if not sidecar_file.exists():
        return []
    try:
        payload = json.loads(sidecar_file.read_text(encoding="utf-8"))
    except Exception:
        return []

    # 新格式：review_comments.json 包含 workbook_files，需要从 xlsx 解析评论
    workbook_files = payload.get("workbook_files") if isinstance(payload, dict) else []
    if isinstance(workbook_files, list) and workbook_files:
        fallback_product_id = normalize_text(payload.get("product_id")) if isinstance(payload, dict) else None
        all_rows = []
        for wb_path_str in workbook_files:
            wb_path = Path(wb_path_str)
            if not wb_path.exists():
                continue
            try:
                xlsx_rows = read_first_sheet(wb_path)
                all_rows.extend(xlsx_rows)
            except Exception:
                continue
        if all_rows:
            return _build_review_rows_from_dicts(all_rows, fallback_product_id, str(sidecar_file))

    # 旧格式：review_comments.json 直接包含 rows 数组
    rows = payload.get("rows") if isinstance(payload, dict) else []
    if not isinstance(rows, list):
        return []
    fallback_product_id = normalize_text(payload.get("product_id")) if isinstance(payload, dict) else None
    return _build_review_rows_from_dicts(rows, fallback_product_id, str(sidecar_file))


def _build_review_rows_from_dicts(rows: list[dict], fallback_product_id: Optional[str], source_file: str) -> list[dict[str, Any]]:
    out = []
    for idx, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            continue
        product_id = normalize_text(row.get("商品ID")) or fallback_product_id
        buyer_name = normalize_text(row.get("旺旺号")) or normalize_text(row.get("昵称"))
        review_time = parse_datetime(row.get("初评时间")) or parse_datetime(row.get("评价时间"))
        sku_text = normalize_text(row.get("SKU"))
        review_text = normalize_text(row.get("初评")) or normalize_text(row.get("评论")) or normalize_text(row.get("初评内容"))
        follow_review = normalize_text(row.get("追评")) or normalize_text(row.get("追评内容"))
        follow_time = parse_datetime(row.get("追评时间"))
        if not review_text and not follow_review:
            continue  # 跳过没有评论内容的行
        out.append(
            {
                "source_file": source_file,
                "row_no": parse_int_like(row.get("序号")) or idx,
                "product_id": product_id,
                "buyer_name": buyer_name,
                "review_time": review_time,
                "sku_text": sku_text,
                "review_text": review_text,
                "media_text": normalize_text(row.get("晒图/视频")),
                "useful_count": parse_int_like(row.get("有用")),
                "follow_review": follow_review,
                "follow_time": follow_time,
                "follow_media_text": normalize_text(row.get("追评晒图/视频")),
                "review_hash": review_hash(product_id, buyer_name, review_time, sku_text, review_text),
                "raw_json": row,
            }
        )
    return out


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean Excel exports into normalized JSON and extracted media.")
    parser.add_argument("--product-file", default=str(DEFAULT_PRODUCT_FILE), help="Product Excel file path")
    parser.add_argument("--sku-file", default=str(DEFAULT_SKU_FILE), help="SKU Excel file path")
    parser.add_argument("--qa-file", default=str(DEFAULT_QA_FILE), help="QA Excel file path")
    parser.add_argument("--allow-missing-qa", action="store_true", help="Allow missing QA export and generate an empty QA dataset.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Output directory for cleaned files")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    product_file = Path(args.product_file).resolve()
    sku_file = Path(args.sku_file).resolve()
    qa_file_supplied = "--qa-file" in sys.argv
    qa_file = Path(args.qa_file).resolve() if args.qa_file and (qa_file_supplied or not args.allow_missing_qa) else None
    output_dir = Path(args.output_dir).resolve()
    media_dir = output_dir / "media"

    output_dir.mkdir(exist_ok=True)
    media_dir.mkdir(parents=True, exist_ok=True)

    product_rows = read_first_sheet(product_file)
    sku_rows = read_first_sheet(sku_file)
    qa_missing = qa_file is None or not qa_file.exists()
    if qa_missing and not args.allow_missing_qa:
        raise FileNotFoundError(f"QA Excel file not found: {qa_file}")
    qa_rows = [] if qa_missing else read_first_sheet(qa_file)
    embedded_images = extract_embedded_images(sku_file, media_dir)

    cleaned_product = clean_product_rows(product_rows, product_file)
    cleaned_sku, media_assets = clean_sku_rows(sku_rows, sku_file, embedded_images)
    cleaned_qa = [] if qa_missing else clean_qa_rows(qa_rows, qa_file)
    product_page_image_assets = clean_product_page_image_assets(product_file.parent / "product_page_images.json")
    cleaned_reviews = clean_review_comment_rows(product_file.parent / "review_comments.json")
    media_assets.extend(product_page_image_assets)

    manifest = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source_files": {
            "product": str(product_file),
            "sku": str(sku_file),
            "qa": str(qa_file) if qa_file and qa_file.exists() else None,
            "review_comments": str(product_file.parent / "review_comments.json") if (product_file.parent / "review_comments.json").exists() else None,
        },
        "source_status": {
            "qa_missing_allowed": bool(qa_missing and args.allow_missing_qa),
            "qa_status": "missing_allowed" if qa_missing and args.allow_missing_qa else "available",
        },
        "counts": {
            "product": len(cleaned_product),
            "sku": len(cleaned_sku),
            "qa": len(cleaned_qa),
            "review_comment": len(cleaned_reviews),
            "media_asset": len(media_assets),
            "product_page_image_asset": len(product_page_image_assets),
            "exported_images": len(embedded_images),
        },
    }

    write_json(output_dir / "product_snapshot.clean.json", cleaned_product)
    write_json(output_dir / "product_sku_snapshot.clean.json", cleaned_sku)
    write_json(output_dir / "product_qa_snapshot.clean.json", cleaned_qa)
    write_json(output_dir / "product_review_snapshot.clean.json", cleaned_reviews)
    write_json(output_dir / "product_page_image_asset.clean.json", product_page_image_assets)
    write_json(output_dir / "media_asset.clean.json", media_assets)
    write_json(output_dir / "manifest.json", manifest)

    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
