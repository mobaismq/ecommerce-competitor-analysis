#!/usr/bin/env python3
"""
Cross-platform 店透视 RPA runner.

This version avoids macOS AppleScript. It connects to an already-open Chrome
through Chrome DevTools Protocol, so it can work on Windows when Chrome is
started with --remote-debugging-port and the 店透视 extension/login is available
in that Chrome profile.

Windows Chrome example:
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" ^
    --remote-debugging-port=9222 ^
    --user-data-dir="%USERPROFILE%\\ChromeDTSProfile"

Install dependency:
  python -m pip install playwright

Run:
  python run_diantoushi_rpa_cdp.py --product-name "电脑"
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, quote, urlparse


GUARD_TERMS = [
    "淘宝验证",
    "安全验证",
    "验证码",
    "访问太频繁",
    "滑块",
    "拖动滑块",
    "请完成验证",
]

BUSY_TERMS = ["获取数据中", "加载中", "拼命加载中"]


def now_stamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def fs_stamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def safe_name(value: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|\n\r\t]+', "-", value).strip(" .-")
    return cleaned[:60] or "商品"


class Logger:
    def __init__(self, path: Path, echo: bool = True):
        self.path = path
        self.echo = echo
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def log(self, message: str = "") -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(message + "\n")
        if self.echo:
            print(message, flush=True)

    def section(self, title: str) -> None:
        self.log("")
        self.log(f"=== {title} {now_stamp()} ===")


def parse_item_id(url: str) -> Optional[str]:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    if query.get("id"):
        return query["id"][0]
    match = re.search(r"[?&]id=(\d+)", url)
    return match.group(1) if match else None


def parse_sales_count(text: str) -> Optional[int]:
    raw = text.replace(",", "")
    patterns = [
        r"([0-9]+(?:\.[0-9]+)?)\s*万\+?\s*(?:人付款|付款|已售|件)",
        r"([0-9]+(?:\.[0-9]+)?)\s*千\+?\s*(?:人付款|付款|已售|件)",
        r"([0-9]+)\+?\s*(?:人付款|付款|已售|件)",
    ]
    for index, pattern in enumerate(patterns):
        match = re.search(pattern, raw)
        if not match:
            continue
        value = float(match.group(1))
        if index == 0:
            return int(value * 10000)
        if index == 1:
            return int(value * 1000)
        return int(value)
    return None


def sales_raw(text: str) -> Optional[str]:
    match = re.search(
        r"([0-9]+(?:\.[0-9]+)?\s*(?:万|千)?\+?\s*(?:人付款|付款|已售|件))",
        text.replace(",", ""),
    )
    return match.group(1) if match else None


def workbook_text(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        if "xl/sharedStrings.xml" not in zf.namelist():
            return ""
        text = zf.read("xl/sharedStrings.xml").decode("utf-8", "ignore")
    return re.sub(r"<[^>]+>", " ", text)


def unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    for index in range(1, 1000):
        candidate = path.with_name(f"{path.stem} ({index}){path.suffix}")
        if not candidate.exists():
            return candidate
    raise RuntimeError(f"Could not make unique path for {path}")


def stable_new_files(download_dir: Path, since: float, patterns: list[str]) -> list[Path]:
    files: list[Path] = []
    for pattern in patterns:
        for path in download_dir.glob(pattern):
            if path.is_file() and path.stat().st_mtime >= since - 2 and path not in files:
                files.append(path)
    return sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)


def wait_normalize_xlsx(
    logger: Logger,
    download_dir: Path,
    kind: str,
    item_id: str,
    start_epoch: float,
    expected_name: str,
    validators: list[str],
    timeout: int = 180,
) -> Path:
    logger.section(f"wait normalize {kind}")
    deadline = time.time() + timeout
    patterns = [f"*{item_id}*.xlsx", f"*{item_id}*.crdownload", "*.crdownload", "*.tmp", ".com.google.Chrome*"]
    while time.time() < deadline:
        files = stable_new_files(download_dir, start_epoch, patterns)
        for path in files[:20]:
            logger.log(f"{datetime.fromtimestamp(path.stat().st_mtime).strftime('%F %T')} {path.stat().st_size} {path}")

        visible = [p for p in files if p.suffix.lower() == ".xlsx" and item_id in p.name]
        for path in visible:
            try:
                text = workbook_text(path)
            except Exception:
                continue
            if all(token in text for token in validators):
                logger.log(f"FOUND_XLSX={path}")
                return path

        for temp in [p for p in files if p.name.startswith(".com.google.Chrome") or p.suffix.lower() == ".tmp"]:
            try:
                text = workbook_text(temp)
            except Exception:
                continue
            if all(token in text for token in validators):
                target = unique_path(download_dir / expected_name)
                shutil.copy2(temp, target)
                logger.log(f"NORMALIZED_XLSX={target}")
                logger.log("preview=" + text[:900])
                return target
        time.sleep(2)
    raise RuntimeError(f"Timed out waiting for {kind} export for item {item_id}")


def import_playwright():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("Missing dependency. Run: python -m pip install playwright") from exc
    return sync_playwright


def connect_page(cdp_url: str):
    sync_playwright = import_playwright()
    pw = sync_playwright().start()
    browser = pw.chromium.connect_over_cdp(cdp_url)
    context = browser.contexts[0] if browser.contexts else browser.new_context()
    page = context.pages[-1] if context.pages else context.new_page()
    return pw, browser, context, page


def eval_json(page, js: str) -> Any:
    value = page.evaluate(js)
    if isinstance(value, str):
        return json.loads(value)
    return value


def page_title_url(page) -> dict[str, str]:
    return {
        "title": page.title(),
        "url": page.url,
        "ready": page.evaluate("document.readyState"),
    }


def guard_check(page, logger: Logger, label: str) -> dict[str, Any]:
    logger.section(f"guard {label}")
    js = """
() => {
  const text = document.body ? document.body.innerText : "";
  const exportControls = [...document.querySelectorAll("*")]
    .map(e => (e.innerText || "").trim())
    .filter(t => ["商品数据","问大家","SKU预览","导出表格"].includes(t));
  const dialogs = [...document.querySelectorAll(".el-dialog")]
    .filter(e => e.getBoundingClientRect().width > 100)
    .map(e => (e.innerText || "").trim().slice(0,1200));
  return {
    href: location.href,
    title: document.title,
    item_id: new URL(location.href).searchParams.get("id"),
    text,
    toolbar_present: exportControls.includes("商品数据") || exportControls.includes("SKU预览"),
    export_controls: [...new Set(exportControls)],
    dialogs
  };
}
"""
    data = page.evaluate(js)
    text = data.pop("text", "")
    data["guard_detected"] = any(term in text for term in GUARD_TERMS)
    data["busy_detected"] = any(term in text for term in BUSY_TERMS)
    data["matched_guard_terms"] = [term for term in GUARD_TERMS if term in text]
    data["matched_busy_terms"] = [term for term in BUSY_TERMS if term in text]
    data["ok"] = not data["guard_detected"]
    logger.log(json.dumps(data, ensure_ascii=False, indent=2))
    if data["guard_detected"]:
        raise RuntimeError(f"Taobao guard detected: {data['matched_guard_terms']} at {data['href']}")
    return data


def search_candidates(page, logger: Logger) -> list[dict[str, Any]]:
    logger.section("read search candidates")
    js = """
() => [...document.querySelectorAll('a[href]')]
  .map((a,i)=>({
    index:i,
    text:(a.innerText||a.getAttribute('aria-label')||a.title||'').trim().replace(/\\s+/g,' ').slice(0,260),
    href:a.href,
    rect:(()=>{const r=a.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})()
  }))
  .filter(x=>x.text && x.rect[2]>20 && x.rect[3]>10 && /(item\\.taobao|detail\\.tmall)/.test(x.href))
  .slice(0,160)
"""
    raw_candidates = page.evaluate(js)
    out = []
    seen_ids = set()
    for candidate in raw_candidates:
        item_id = parse_item_id(candidate["href"])
        if not item_id or item_id in seen_ids:
            continue
        seen_ids.add(item_id)
        parsed_sales = parse_sales_count(candidate["text"])
        if parsed_sales is None:
            continue
        out.append(
            {
                "item_id": item_id,
                "title": candidate["text"],
                "href": candidate["href"],
                "sales_raw": sales_raw(candidate["text"]),
                "sales_count": parsed_sales,
                "search_index": candidate["index"],
            }
        )
    out.sort(key=lambda x: (-x["sales_count"], x["search_index"]))
    logger.log(json.dumps({"candidate_count": len(out), "top_candidates": out[:10]}, ensure_ascii=False, indent=2))
    return out


def choose_highest_sales_product(page, logger: Logger, product_name: str) -> dict[str, Any]:
    search_url = f"https://s.taobao.com/search?q={quote(product_name)}"
    logger.section("open search")
    logger.log(f"search_url={search_url}")
    page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)
    logger.log(json.dumps(page_title_url(page), ensure_ascii=False, indent=2))
    guard_check(page, logger, "after search")
    candidates = search_candidates(page, logger)
    if not candidates:
        raise RuntimeError("No product candidates with parsable sales/payment count were found on the visible search page.")
    selected = candidates[0]
    logger.section("selected highest-sales product")
    logger.log(json.dumps(selected, ensure_ascii=False, indent=2))
    page.goto(selected["href"], wait_until="domcontentloaded", timeout=60000)
    time.sleep(12)
    logger.log(json.dumps(page_title_url(page), ensure_ascii=False, indent=2))
    guard_check(page, logger, "after item navigation")
    return selected


def wait_for_toolbar(page, logger: Logger, timeout: int = 60) -> dict[str, Any]:
    logger.section("wait toolbar")
    deadline = time.time() + timeout
    last = {}
    while time.time() < deadline:
        data = guard_check(page, logger, "toolbar poll")
        last = data
        if data.get("toolbar_present") and {"商品数据", "SKU预览", "问大家"}.issubset(set(data.get("export_controls", []))):
            return data
        time.sleep(5)
    raise RuntimeError(f"店透视 toolbar/export controls not ready: {last}")


def click_toolbar_control(page, label: str) -> dict[str, Any]:
    js = """
(label) => {
  const nodes = [...document.querySelectorAll('*')].filter(e =>
    (e.innerText||'').trim() === label &&
    String(e.className||'').includes('item-value') &&
    e.getBoundingClientRect().width > 0 &&
    e.getBoundingClientRect().height > 0
  );
  const e = nodes[nodes.length - 1];
  if (!e) return {error:'NOT_FOUND', label};
  const r = e.getBoundingClientRect();
  const cx = Math.round(r.x + r.width / 2);
  const cy = Math.round(r.y + r.height / 2);
  e.dispatchEvent(new MouseEvent('mouseover', {bubbles:true,clientX:cx,clientY:cy}));
  e.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,clientX:cx,clientY:cy}));
  e.dispatchEvent(new MouseEvent('mouseup', {bubbles:true,clientX:cx,clientY:cy}));
  e.click();
  return {clicked:e.innerText.trim(), count:nodes.length, rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]};
}
"""
    return page.evaluate(js, label)


def export_product_data(page, logger: Logger, download_dir: Path, item_id: str) -> Path:
    guard_check(page, logger, "before product export")
    logger.section("click product data")
    logger.log(json.dumps(click_toolbar_control(page, "商品数据"), ensure_ascii=False))
    start = time.time()
    return wait_normalize_xlsx(
        logger,
        download_dir,
        "product",
        item_id,
        start,
        f"商品数据ID_{item_id}_{datetime.now().strftime('%Y-%m-%d')}.xlsx",
        ["商品标题", "店铺名称", item_id],
        timeout=120,
    )


def sku_dialog_state(page) -> dict[str, Any]:
    js = """
() => {
  const d=[...document.querySelectorAll('.el-dialog')].find(x=>(x.innerText||'').includes('SKU预览')&&x.getBoundingClientRect().width>100);
  if(!d) return {error:'NO_SKU_DIALOG'};
  const text=(d.innerText||'').trim();
  const buttons=[...d.querySelectorAll('button,label,.el-radio-button')].map((e,i)=>({
    i,text:(e.innerText||'').trim(),cls:String(e.className||''),disabled:!!e.disabled||String(e.className||'').includes('is-disabled'),
    rect:(()=>{const r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})()
  })).filter(x=>x.rect[2]>0&&x.rect[3]>0).slice(0,80);
  return {title:text.slice(0,1200), buttons};
}
"""
    return page.evaluate(js)


def open_sku_dialog(page, logger: Logger) -> None:
    guard_check(page, logger, "before sku open")
    logger.section("click sku preview")
    logger.log(json.dumps(click_toolbar_control(page, "SKU预览"), ensure_ascii=False))
    time.sleep(8)
    state = sku_dialog_state(page)
    logger.log(json.dumps(state, ensure_ascii=False, indent=2))
    if state.get("error"):
        raise RuntimeError(f"Could not open SKU dialog: {state}")


def click_sku_export_prefer_image_links(page, logger: Logger) -> str:
    logger.section("click sku export xlsx image links")
    page.evaluate(
        """
() => {
  const dialog=[...document.querySelectorAll('.el-dialog')].find(d=>(d.innerText||'').includes('SKU预览')&&d.getBoundingClientRect().width>100);
  if(!dialog) return;
  const mode=[...dialog.querySelectorAll('label,.el-radio-button,button,span')]
    .find(e => (e.innerText||'').trim()==='导出表格' && e.getBoundingClientRect().width>0 && e.getBoundingClientRect().height>0);
  if(mode) mode.click();
}
"""
    )
    time.sleep(1)
    dropdown_result = page.evaluate(
        """
() => {
  const dialog=[...document.querySelectorAll('.el-dialog')].find(d=>(d.innerText||'').includes('SKU预览')&&d.getBoundingClientRect().width>100);
  if(!dialog) return {error:'NO_SKU_DIALOG'};
  const buttons=[...dialog.querySelectorAll('button')]
    .map((e,i)=>({e,i,text:(e.innerText||'').trim(),cls:String(e.className||''),rect:e.getBoundingClientRect(),disabled:!!e.disabled||String(e.className||'').includes('is-disabled')}))
    .filter(x=>x.rect.width>0&&x.rect.height>0&&!x.disabled);
  const exportBtn=buttons.filter(x=>x.text==='导出表格').pop();
  const caret=buttons.find(x=>x.cls.includes('el-dropdown__caret-button') && exportBtn && Math.abs(x.rect.y-exportBtn.rect.y)<12 && x.rect.x>exportBtn.rect.x);
  const pick=caret || exportBtn;
  if(!pick) return {error:'NO_EXPORT_BUTTON', buttons:buttons.map(x=>({text:x.text,cls:x.cls}))};
  const r=pick.rect;
  const cx=Math.round(r.x+r.width/2);
  const cy=Math.round(r.y+r.height/2);
  pick.e.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,clientX:cx,clientY:cy}));
  pick.e.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:cx,clientY:cy}));
  pick.e.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:cx,clientY:cy}));
  pick.e.click();
  return {openedDropdown:!!caret, rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]};
}
"""
    )
    logger.log(json.dumps(dropdown_result, ensure_ascii=False))
    time.sleep(1.2)

    menu_result = page.evaluate(
        """
() => {
  const visible = (e) => {
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden';
  };
  const norm = (text) => (text || '').trim().replace(/\\s+/g, '').replace(/默认/g, '');
  const all=[...document.querySelectorAll('li,div,span,a,button')].filter(visible).map((e,i)=>{
    const r=e.getBoundingClientRect();
    const text=(e.innerText||e.textContent||'').trim().replace(/\\s+/g,' ');
    return {e,i,text,normalized:norm(text),tag:e.tagName,cls:String(e.className||''),rect:r,area:r.width*r.height,disabled:!!e.disabled||String(e.className||'').includes('is-disabled')};
  }).filter(x=>!x.disabled && x.text.length > 0 && x.text.length <= 80 && (x.normalized.includes('xlsx') || x.normalized.includes('导出表格')));
  const candidates=all.filter(x => {
    if (x.area > 20000) return false;
    if ((x.normalized.match(/导出表格/g)||[]).length > 1) return false;
    return true;
  });
  const byNeedle = (needles) => candidates.find(x => needles.some(n => x.normalized === n || x.normalized.includes(n)));
  const preferred=byNeedle(['导出表格xlsx+图片链接','xlsx+图片链接']);
  const withImg=byNeedle(['导出表格xlsx+图片','xlsx+图片']);
  const normal=byNeedle(['导出表格xlsx','xlsx']);
  const pick=preferred || withImg || normal;
  if(!pick) return {error:'NO_MENU_ITEM', candidates:all.slice(0,40).map(x=>({text:x.text,cls:x.cls,tag:x.tag,area:Math.round(x.area)}))};
  const r=pick.rect;
  const cx=Math.round(r.x+r.width/2);
  const cy=Math.round(r.y+r.height/2);
  const hit=document.elementFromPoint(cx, cy);
  const target=(hit && hit.closest('li,[role="menuitem"],button,span,div')) || pick.e;
  target.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,clientX:cx,clientY:cy}));
  target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:cx,clientY:cy}));
  target.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:cx,clientY:cy}));
  target.click();
  return {
    clickedMenu: pick.text,
    clickedNormalized: pick.normalized,
    clickedTag: target.tagName,
    variant: preferred ? 'xlsx+图片链接' : (withImg ? 'xlsx+图片' : 'xlsx'),
    rect: [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)],
    candidates: candidates.slice(0,30).map(x=>x.text)
  };
}
"""
    )
    logger.log(json.dumps(menu_result, ensure_ascii=False, indent=2))
    if menu_result.get("variant"):
        return menu_result["variant"]

    fallback = page.evaluate(
        """
() => {
  const dialog=[...document.querySelectorAll('.el-dialog')].find(d=>(d.innerText||'').includes('SKU预览')&&d.getBoundingClientRect().width>100);
  if(!dialog) return {error:'NO_SKU_DIALOG'};
  const buttons=[...dialog.querySelectorAll('button')]
    .map((e,i)=>({e,i,text:(e.innerText||'').trim(),cls:String(e.className||''),rect:e.getBoundingClientRect(),disabled:!!e.disabled||String(e.className||'').includes('is-disabled')}))
    .filter(x=>x.rect.width>0&&x.rect.height>0&&!x.disabled);
  const pick=buttons.filter(x=>x.text==='导出表格').pop() || buttons.filter(x=>x.text.includes('导出')).pop();
  if(!pick) return {error:'NO_EXPORT_BUTTON'};
  pick.e.click();
  return {clickedFallback:pick.text};
}
"""
    )
    logger.log(json.dumps(fallback, ensure_ascii=False))
    return "fallback"


def workbook_has_image_links(path: Path) -> bool:
    text = workbook_text(path)
    return ("SKU图片" in text or "图片链接" in text or "图片URL" in text) and ("http://" in text or "https://" in text)


def export_sku(page, logger: Logger, download_dir: Path, item_id: str) -> tuple[Path, str, bool]:
    open_sku_dialog(page, logger)
    guard_check(page, logger, "before sku export")
    variant = click_sku_export_prefer_image_links(page, logger)
    start = time.time()
    sku_path = wait_normalize_xlsx(
        logger,
        download_dir,
        "sku",
        item_id,
        start,
        f"店透-SKU预览-表格-{item_id}-{datetime.now().strftime('%Y-%m-%d')}.xlsx",
        ["SKUID", "商品ID", item_id],
        timeout=180,
    )
    has_links = workbook_has_image_links(sku_path)
    logger.log(json.dumps({"sku_export_variant": variant, "sku_image_links_found": has_links, "sku_file": str(sku_path)}, ensure_ascii=False, indent=2))
    return sku_path, variant, has_links


def close_dialog(page, title_text: str) -> None:
    page.evaluate(
        """
(titleText) => {
  const d=[...document.querySelectorAll('.el-dialog')].find(e=>(e.innerText||'').includes(titleText)&&e.getBoundingClientRect().width>100);
  if(!d) return 'NO_DIALOG';
  const btn=d.querySelector('.el-dialog__headerbtn');
  if(!btn) return 'NO_CLOSE_BTN';
  btn.click();
  return 'CLOSED';
}
""",
        title_text,
    )


def export_ask(page, logger: Logger, download_dir: Path, item_id: str) -> Path:
    close_dialog(page, "SKU预览")
    time.sleep(24)
    guard_check(page, logger, "before ask open")
    logger.section("click ask")
    logger.log(json.dumps(click_toolbar_control(page, "问大家"), ensure_ascii=False))
    time.sleep(18)
    guard_check(page, logger, "before ask export")
    logger.section("click ask export")
    result = page.evaluate(
        """
() => {
  const dialog=[...document.querySelectorAll('.el-dialog')].find(d=>(d.innerText||'').includes('问大家分析')&&d.getBoundingClientRect().width>100);
  if(!dialog) return {error:'NO_ASK_DIALOG'};
  const buttons=[...dialog.querySelectorAll('button')]
    .map((e,i)=>({e,i,text:(e.innerText||'').trim(),cls:String(e.className||''),rect:e.getBoundingClientRect(),disabled:!!e.disabled||String(e.className||'').includes('is-disabled')}))
    .filter(x=>x.rect.width>0&&x.rect.height>0&&!x.disabled);
  const pick=buttons.filter(x=>x.text==='导出表格').pop();
  if(!pick) return {error:'NO_EXPORT_BUTTON', buttons:buttons.map(x=>x.text)};
  const r=pick.rect;
  pick.e.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
  pick.e.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  pick.e.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  pick.e.click();
  return {clicked:pick.text,index:pick.i,rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]};
}
"""
    )
    logger.log(json.dumps(result, ensure_ascii=False))
    start = time.time()
    return wait_normalize_xlsx(
        logger,
        download_dir,
        "ask",
        item_id,
        start,
        f"店透视-问大家分析-{item_id}-{datetime.now().strftime('%Y-%m-%d')}.xlsx",
        ["问题", "问答"],
        timeout=120,
    )


def collect_exports(logger: Logger, product_name: str, item_id: str, since_epoch: float, download_dir: Path, desktop_dir: Path) -> Path:
    logger.section("collect exports")
    target_dir = desktop_dir / f"店透视导出-{safe_name(product_name)}-{item_id}-{fs_stamp()}"
    target_dir.mkdir(parents=True, exist_ok=True)
    kinds = {
        "product_data": f"商品数据ID_{item_id}_*.xlsx",
        "sku_preview": f"店透-SKU预览-表格-{item_id}-*.xlsx",
        "ask_all": f"店透视-问大家分析-{item_id}-*.xlsx",
    }
    files = []
    for kind, pattern in kinds.items():
        matches = [
            p for p in download_dir.glob(pattern)
            if p.is_file() and p.stat().st_mtime >= since_epoch - 2
        ]
        matches.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        if not matches:
            files.append({"kind": kind, "missing": True})
            continue
        source = matches[0]
        dest = unique_path(target_dir / source.name)
        shutil.move(str(source), str(dest))
        files.append({"kind": kind, "source": str(source), "destination": str(dest), "action": "moved"})
    shutil.copy2(logger.path, target_dir / "run.log")
    summary = {"target_dir": str(target_dir), "files": files}
    logger.log(json.dumps(summary, ensure_ascii=False, indent=2))
    return target_dir


def run_pipeline(args: argparse.Namespace, logger: Logger) -> dict[str, Any]:
    start_epoch = time.time()
    download_dir = Path(args.download_dir).expanduser().resolve() if args.download_dir else Path.home() / "Downloads"
    desktop_dir = Path(args.desktop_dir).expanduser().resolve() if args.desktop_dir else Path.home() / "Desktop"
    download_dir.mkdir(parents=True, exist_ok=True)
    desktop_dir.mkdir(parents=True, exist_ok=True)

    logger.section("diantoushi rpa cdp start")
    logger.log(json.dumps({**vars(args), "download_dir": str(download_dir), "desktop_dir": str(desktop_dir)}, ensure_ascii=False, indent=2))
    pw, browser, _context, page = connect_page(args.cdp_url)
    try:
        if args.product_url:
            selected = {"href": args.product_url, "item_id": parse_item_id(args.product_url), "selection": "direct_url"}
            page.goto(args.product_url, wait_until="domcontentloaded", timeout=60000)
            time.sleep(12)
            guard_check(page, logger, "after direct product URL")
        else:
            selected = choose_highest_sales_product(page, logger, args.product_name)

        toolbar = wait_for_toolbar(page, logger)
        item_id = toolbar.get("item_id") or selected.get("item_id") or parse_item_id(page.url)
        if not item_id:
            raise RuntimeError("Could not determine item ID after navigation.")

        product_file = export_product_data(page, logger, download_dir, item_id)
        time.sleep(24)
        sku_file, sku_variant, sku_has_links = export_sku(page, logger, download_dir, item_id)
        ask_file = export_ask(page, logger, download_dir, item_id)
        target_dir = collect_exports(logger, args.product_name, item_id, start_epoch, download_dir, desktop_dir)
        summary = {
            "ok": True,
            "product_name": args.product_name,
            "item_id": item_id,
            "selected": selected,
            "target_dir": str(target_dir),
            "product_file": str(product_file),
            "sku_file": str(sku_file),
            "ask_file": str(ask_file),
            "sku_export_variant": sku_variant,
            "sku_image_links_found": sku_has_links,
            "log_file": str(target_dir / "run.log"),
        }
        logger.section("summary")
        logger.log(json.dumps(summary, ensure_ascii=False, indent=2))
        return summary
    finally:
        try:
            browser.close()
        finally:
            pw.stop()


def spawn_background(args: argparse.Namespace) -> dict[str, Any]:
    run_root = Path(args.run_dir).expanduser() if args.run_dir else Path.home() / "Desktop" / f"店透视RPA-{safe_name(args.product_name)}-{fs_stamp()}"
    run_root.mkdir(parents=True, exist_ok=True)
    log_file = run_root / "run.log"
    command = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--product-name",
        args.product_name,
        "--run-dir",
        str(run_root),
        "--cdp-url",
        args.cdp_url,
    ]
    if args.product_url:
        command += ["--product-url", args.product_url]
    if args.download_dir:
        command += ["--download-dir", args.download_dir]
    if args.desktop_dir:
        command += ["--desktop-dir", args.desktop_dir]
    env = os.environ.copy()
    env["DTS_RPA_BACKGROUND_CHILD"] = "1"
    creationflags = 0
    if os.name == "nt":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
    with log_file.open("ab") as log:
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, env=env, creationflags=creationflags)
    return {"pid": process.pid, "run_dir": str(run_root), "log_file": str(log_file), "command": command}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run 店透视 product research through Chrome CDP on Windows/macOS/Linux.")
    parser.add_argument("--product-name", required=True, help="Taobao search keyword/product name.")
    parser.add_argument("--product-url", help="Optional direct Taobao/Tmall product URL.")
    parser.add_argument("--cdp-url", default="http://127.0.0.1:9222", help="Chrome DevTools endpoint.")
    parser.add_argument("--download-dir", help="Chrome download directory. Defaults to ~/Downloads.")
    parser.add_argument("--desktop-dir", help="Output parent directory. Defaults to ~/Desktop.")
    parser.add_argument("--run-dir", help="Run log directory. Defaults to Desktop/店透视RPA-<product>-<timestamp>.")
    parser.add_argument("--background", action="store_true", help="Start in the background and return immediately.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.background:
        print(json.dumps(spawn_background(args), ensure_ascii=False, indent=2))
        return 0
    run_root = Path(args.run_dir).expanduser() if args.run_dir else Path.home() / "Desktop" / f"店透视RPA-{safe_name(args.product_name)}-{fs_stamp()}"
    logger = Logger(run_root / "run.log", echo=os.environ.get("DTS_RPA_BACKGROUND_CHILD") != "1")
    try:
        run_pipeline(args, logger)
        return 0
    except Exception as exc:
        logger.section("failed")
        logger.log(str(exc))
        logger.log(json.dumps({"ok": False, "error": str(exc), "log_file": str(logger.path)}, ensure_ascii=False, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
