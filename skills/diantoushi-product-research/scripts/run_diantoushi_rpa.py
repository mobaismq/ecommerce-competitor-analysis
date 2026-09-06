#!/usr/bin/env python3
import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tarfile
import time
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse, parse_qs, quote
from urllib.request import Request, urlopen


SKILL_DIR = Path(__file__).resolve().parents[1]
CHECK_GUARD = SKILL_DIR / "scripts" / "check_taobao_guard.py"
COLLECT_EXPORTS = SKILL_DIR / "scripts" / "collect_exports.py"
# 优先使用 workspace 内的 mysql-import skill，保持单一可信来源
_WORKSPACE_MYSQL_IMPORT = SKILL_DIR.parent / "mysql-import" / "bin" / "run_mysql_import.py"
MYSQL_IMPORT = _WORKSPACE_MYSQL_IMPORT if _WORKSPACE_MYSQL_IMPORT.exists() else Path("/Users/shuishoukeke/.codex/skills/mysql-import/bin/run_mysql_import.py")
COMPETITOR_ANALYSIS = Path("/Users/shuishoukeke/.codex/skills/competitor-analysis/bin/run_competitor_analysis.py")
CHROME_WINDOW_ID: Optional[int] = None

SPEED_PROFILES: dict[str, dict[str, float]] = {
    "conservative": {
        "export_cooldown": 30.0,
        "batch_delay": 45.0,
        "ask_ready_timeout": 60.0,
        "xlsx_first_timeout": 90.0,
        "xlsx_retry_timeout": 120.0,
        "sku_timeout": 180.0,
        "ask_export_timeout": 90.0,
        "review_timeout": 120.0,
        "download_poll_interval": 2.0,
        "search_scroll_wait": 3.5,
        "diantoushi_click_settle": 0.8,
        "diantoushi_dialog_settle": 0.8,
        "diantoushi_hover_dwell_ms": 700.0,
        "diantoushi_poll_interval": 1.0,
        "diantoushi_download_idle": 4.0,
        "diantoushi_file_stable_wait": 0.35,
    },
    "balanced": {
        "export_cooldown": 22.0,
        "batch_delay": 30.0,
        "ask_ready_timeout": 45.0,
        "xlsx_first_timeout": 75.0,
        "xlsx_retry_timeout": 90.0,
        "sku_timeout": 150.0,
        "ask_export_timeout": 60.0,
        "review_timeout": 75.0,
        "download_poll_interval": 1.2,
        "search_scroll_wait": 2.5,
        "diantoushi_click_settle": 0.55,
        "diantoushi_dialog_settle": 0.55,
        "diantoushi_hover_dwell_ms": 500.0,
        "diantoushi_poll_interval": 0.6,
        "diantoushi_download_idle": 3.0,
        "diantoushi_file_stable_wait": 0.25,
    },
    "fast": {
        # 只加速店透视侧等待；batch_delay/search_scroll_wait 与 balanced 保持一致，不改变淘宝页面节奏
        "export_cooldown": 8.0,
        "batch_delay": 30.0,
        "ask_ready_timeout": 28.0,
        "xlsx_first_timeout": 35.0,
        "xlsx_retry_timeout": 45.0,
        "sku_timeout": 70.0,
        "ask_export_timeout": 30.0,
        "review_timeout": 42.0,
        "download_poll_interval": 0.5,
        "search_scroll_wait": 2.5,
        "diantoushi_click_settle": 0.08,
        "diantoushi_dialog_settle": 0.25,
        "diantoushi_hover_dwell_ms": 180.0,
        "diantoushi_poll_interval": 0.22,
        "diantoushi_download_idle": 1.6,
        "diantoushi_file_stable_wait": 0.16,
    },
}


def now_stamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def fs_stamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def speed_value(args: Optional[argparse.Namespace], key: str) -> float:
    profile_name = getattr(args, "speed_profile", "fast") if args is not None else "fast"
    return float(SPEED_PROFILES.get(profile_name, SPEED_PROFILES["balanced"])[key])


def export_cooldown_seconds(args: argparse.Namespace) -> float:
    min_seconds = 8.0 if getattr(args, "speed_profile", "") == "fast" else 20.0
    if args.export_cooldown is not None:
        return max(min_seconds, float(args.export_cooldown))
    return speed_value(args, "export_cooldown")


def batch_delay_seconds(args: argparse.Namespace) -> float:
    if args.batch_delay is not None:
        return max(0.0, float(args.batch_delay))
    return speed_value(args, "batch_delay")


def download_poll_interval(args: argparse.Namespace) -> float:
    if args.download_poll_interval is not None:
        return max(0.5, float(args.download_poll_interval))
    return speed_value(args, "download_poll_interval")


def diantoushi_click_settle(args: Optional[argparse.Namespace] = None) -> float:
    return max(0.08, speed_value(args, "diantoushi_click_settle"))


def diantoushi_dialog_settle(args: Optional[argparse.Namespace] = None) -> float:
    return max(0.25, speed_value(args, "diantoushi_dialog_settle"))


def diantoushi_hover_dwell_ms(args: Optional[argparse.Namespace] = None) -> int:
    return max(180, int(speed_value(args, "diantoushi_hover_dwell_ms")))


def diantoushi_poll_interval(args: Optional[argparse.Namespace] = None) -> float:
    return max(0.18, speed_value(args, "diantoushi_poll_interval"))


def diantoushi_download_idle(args: Optional[argparse.Namespace] = None) -> float:
    return max(1.5, speed_value(args, "diantoushi_download_idle"))


def diantoushi_file_stable_wait(args: Optional[argparse.Namespace] = None) -> float:
    return max(0.15, speed_value(args, "diantoushi_file_stable_wait"))


def ask_ready_timeout(args: argparse.Namespace) -> float:
    if args.ask_ready_timeout is not None:
        return max(10.0, float(args.ask_ready_timeout))
    return speed_value(args, "ask_ready_timeout")


def xlsx_first_timeout_seconds(args: argparse.Namespace) -> int:
    return int(speed_value(args, "xlsx_first_timeout"))


def xlsx_retry_timeout_seconds(args: argparse.Namespace) -> int:
    return int(speed_value(args, "xlsx_retry_timeout"))


def sku_timeout_seconds(args: argparse.Namespace) -> int:
    return int(speed_value(args, "sku_timeout"))


def ask_export_timeout_seconds(args: argparse.Namespace) -> int:
    return int(speed_value(args, "ask_export_timeout"))


def review_timeout_seconds(args: argparse.Namespace) -> int:
    if args.review_timeout is not None:
        return max(30, int(args.review_timeout))
    return int(speed_value(args, "review_timeout"))


def human_wait(logger: "Logger", seconds: float, reason: str) -> None:
    seconds = max(0.0, float(seconds))
    if seconds <= 0:
        return
    logger.log(json.dumps({"wait_seconds": round(seconds, 2), "reason": reason}, ensure_ascii=False))
    time.sleep(seconds)


def safe_name(value: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|\n\r\t]+', "-", value).strip(" .-")
    return cleaned[:60] or "商品"


class Logger:
    def __init__(self, path: Path, echo: bool = True):
        self.path = path
        self.echo = echo
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def log(self, message: str = "") -> None:
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(message + "\n")
        if self.echo:
            print(message, flush=True)

    def section(self, title: str) -> None:
        self.log("")
        self.log(f"=== {title} {now_stamp()} ===")


def run_process(command: list[str], logger: Logger, env: Optional[dict[str, str]] = None, check: bool = True) -> subprocess.CompletedProcess:
    logger.log("RUN: " + " ".join(command))
    result = subprocess.run(command, text=True, capture_output=True, env=env)
    if result.stdout:
        logger.log(result.stdout.rstrip())
    if result.stderr:
        logger.log(result.stderr.rstrip())
    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed with exit {result.returncode}: {' '.join(command)}")
    return result


def extract_json_objects(text: str) -> list[Any]:
    decoder = json.JSONDecoder()
    objects: list[Any] = []
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


def run_osascript(script: str) -> str:
    result = subprocess.run(["osascript"], input=script, text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "osascript failed")
    return result.stdout.strip()


def is_stale_chrome_window_error(exc: Exception) -> bool:
    text = str(exc)
    return (
        "Target Chrome window is closed" in text
        or "-2700" in text
        or "Can't get window id" in text
        or "Invalid index" in text
    )


def reset_chrome_target() -> None:
    global CHROME_WINDOW_ID
    CHROME_WINDOW_ID = None


def ensure_chrome_target() -> int:
    global CHROME_WINDOW_ID
    if CHROME_WINDOW_ID is not None:
        return CHROME_WINDOW_ID
    script = '''
tell application "Google Chrome"
  activate
  make new window
  set URL of active tab of front window to "about:blank"
  set wid to id of front window
end tell
return (wid as text)
'''
    raw = run_osascript(script)
    CHROME_WINDOW_ID = int(raw)
    return CHROME_WINDOW_ID


def chrome_js(js: str) -> str:
    last_error: Optional[Exception] = None
    for _ in range(2):
        window_id = ensure_chrome_target()
        script = f'''
tell application "Google Chrome"
  activate
  if not (exists window id {window_id}) then error "Target Chrome window is closed"
  set targetWindow to window id {window_id}
  set index of targetWindow to 1
  set targetTab to active tab of targetWindow
  set jsResult to execute targetTab javascript {json.dumps(js, ensure_ascii=False)}
end tell
return jsResult
'''
        try:
            return run_osascript(script)
        except RuntimeError as exc:
            last_error = exc
            if is_stale_chrome_window_error(exc):
                reset_chrome_target()
                continue
            raise
    raise RuntimeError(str(last_error) if last_error else "Chrome JavaScript execution failed")


def chrome_set_url(url: str) -> None:
    last_error: Optional[Exception] = None
    for _ in range(2):
        window_id = ensure_chrome_target()
        script = f'''
tell application "Google Chrome"
  activate
  if not (exists window id {window_id}) then error "Target Chrome window is closed"
  set targetWindow to window id {window_id}
  set index of targetWindow to 1
  set targetTab to active tab of targetWindow
  set URL of targetTab to {json.dumps(url, ensure_ascii=False)}
end tell
'''
        try:
            run_osascript(script)
            return
        except RuntimeError as exc:
            last_error = exc
            if is_stale_chrome_window_error(exc):
                reset_chrome_target()
                continue
            raise
    raise RuntimeError(str(last_error) if last_error else "Chrome navigation failed")


def chrome_navigate_js(url: str) -> None:
    # Keep the script ASCII-only so AppleScript does not reinterpret Chinese
    # characters before Chrome's JavaScript engine receives the URL.
    chrome_js(f"location.href = {json.dumps(url)}; 'ok'")


def chrome_open_url_external(url: str, logger: Optional[Logger] = None) -> None:
    """Open a URL through macOS Launch Services, then bind automation to Chrome's front window."""
    global CHROME_WINDOW_ID
    # `open` receives non-ASCII URLs correctly through the user's shell on this
    # macOS/Chrome combination; Python argv form double-encodes Chinese query text.
    command = f"open -a {shlex.quote('Google Chrome')} {shlex.quote(url)}"
    if logger is not None:
        logger.log(json.dumps({"open_command": command}, ensure_ascii=False))
    result = subprocess.run(command, shell=True, text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"Could not open URL: {url}")
    time.sleep(2.0)
    parsed = urlparse(url)
    host_hint = parsed.netloc
    path_hint = parsed.path
    query_hint = parse_qs(parsed.query)
    q_hint = (query_hint.get("q") or [""])[0]
    matcher = f"""
set hostHint to {json.dumps(host_hint, ensure_ascii=False)}
set pathHint to {json.dumps(path_hint, ensure_ascii=False)}
set queryHint to {json.dumps(q_hint, ensure_ascii=False)}
set bestId to ""
tell application "Google Chrome"
  activate
  repeat with w in windows
    set tabIndex to 1
    repeat with t in tabs of w
      set u to URL of t
      if u contains hostHint then
        if pathHint is "" or u contains pathHint then
          if queryHint is "" or u contains queryHint or u contains "%E" then
            set active tab index of w to tabIndex
            set index of w to 1
            set bestId to id of w as text
            exit repeat
          end if
        end if
      end if
      set tabIndex to tabIndex + 1
    end repeat
    if bestId is not "" then exit repeat
  end repeat
  if bestId is "" then set bestId to id of front window as text
end tell
return bestId
"""
    raw = run_osascript(matcher)
    CHROME_WINDOW_ID = int(raw)
    if logger is not None:
        logger.log(json.dumps({"bound_chrome_window_id": CHROME_WINDOW_ID, "bound_state": chrome_title_url()}, ensure_ascii=False, indent=2))


def chrome_page_probe() -> dict[str, Any]:
    raw = chrome_js(
        "JSON.stringify({title:document.title,url:location.href,ready:document.readyState,bodyLength:(document.body&&document.body.innerText||'').length})"
    )
    return json.loads(raw)


def mac_open_url_address_bar(url: str) -> None:
    script = f'''
tell application "Google Chrome" to activate
delay 0.1
set the clipboard to {json.dumps(url, ensure_ascii=False)}
tell application "System Events"
  keystroke "l" using command down
  delay 0.1
  keystroke "v" using command down
  delay 0.1
  key code 36
end tell
'''
    run_osascript(script)


def open_url_with_fallback(logger: Logger, url: str, label: str, wait_seconds: float = 10.0) -> dict[str, Any]:
    chrome_set_url(url)
    deadline = time.time() + wait_seconds
    state = chrome_page_probe()
    while time.time() < deadline:
        state = chrome_page_probe()
        if state.get("url") not in ("about:blank", "") and int(state.get("bodyLength") or 0) > 0:
            return {"ok": True, "method": "chrome_set_url", "state": state}
        time.sleep(0.8)
    logger.log(json.dumps({
        "warning": f"{label} did not load after chrome_set_url; retrying through address bar",
        "target_url": url,
        "state": state,
    }, ensure_ascii=False, indent=2))
    mac_open_url_address_bar(url)
    deadline = time.time() + max(8.0, wait_seconds)
    while time.time() < deadline:
        state = chrome_page_probe()
        if state.get("url") not in ("about:blank", "") and int(state.get("bodyLength") or 0) > 0:
            return {"ok": True, "method": "address_bar", "state": state}
        time.sleep(0.8)
    return {"ok": False, "method": "address_bar", "state": state}


def chrome_title_url() -> dict[str, str]:
    raw = chrome_js("JSON.stringify({title:document.title,url:location.href,ready:document.readyState})")
    return json.loads(raw)


def taobao_search_url(product_name: str) -> str:
    # Keep the URL ASCII-only before it crosses AppleScript/Chrome automation.
    # Navigation is performed through JavaScript, which preserves valid percent
    # escapes while avoiding the Chinese double-encoding seen with `set URL`.
    return f"https://s.taobao.com/search?q={quote(product_name)}"


def wait_for_search_input_ready(logger: Logger, timeout: float = 35.0) -> dict[str, Any]:
    deadline = time.time() + timeout
    last_state: dict[str, Any] = {}
    while time.time() < deadline:
        state = json.loads(chrome_js(r"""
(() => {
  const visible = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  };
  const inputs = [...document.querySelectorAll('input')].filter(visible);
  const searchInputs = inputs.filter((i) => {
    const haystack = [
      i.className || '',
      i.placeholder || '',
      i.getAttribute('aria-label') || '',
      i.name || '',
      i.id || ''
    ].join(' ');
    return /powerfulQuery|search-suggest|搜索|宝贝|商品|query|keyword|q/i.test(haystack);
  });
  return JSON.stringify({
    title: document.title,
    url: location.href,
    ready: document.readyState,
    bodyLength: document.body ? (document.body.innerText || '').length : 0,
    inputCount: inputs.length,
    searchInputCount: searchInputs.length,
    firstInput: inputs[0] ? {
      className: String(inputs[0].className || ''),
      placeholder: inputs[0].placeholder || '',
      name: inputs[0].name || '',
      id: inputs[0].id || ''
    } : null
  });
})()
"""))
        last_state = state
        logger.log(json.dumps({"search_input_ready_probe": state}, ensure_ascii=False))
        if int(state.get("searchInputCount") or 0) > 0 or int(state.get("inputCount") or 0) > 0:
            return state
        time.sleep(1.0)
    return {"ok": False, "reason": "NO_SEARCH_INPUT_AFTER_WAIT", "last_state": last_state}


def open_taobao_search_from_page(logger: Logger, product_name: str) -> dict[str, Any]:
    reset_chrome_target()
    chrome_set_url("https://s.taobao.com/search")
    before = wait_for_search_input_ready(logger)
    logger.log(json.dumps({"search_base_page": before}, ensure_ascii=False, indent=2))
    js = r"""
(() => {
  const keyword = __KEYWORD__;
  const visible = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  };
  const textOf = (e) => (e.innerText || e.textContent || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, '');
  const inputs = [...document.querySelectorAll('input')].filter(visible);
  const input = inputs.find(i => String(i.className || '').includes('powerfulQuery')) ||
    inputs.find(i => String(i.className || '').includes('search-suggest')) ||
    inputs[0];
  if (!input) return JSON.stringify({ok:false, reason:'NO_SEARCH_INPUT', url:location.href});
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, keyword);
  input.dispatchEvent(new InputEvent('input', {bubbles:true, cancelable:true, inputType:'insertText', data:keyword}));
  input.dispatchEvent(new Event('change', {bubbles:true, cancelable:true}));
  input.focus();
  const buttons = [...document.querySelectorAll('button,a,div,span')].filter(visible).filter(e => {
    const text = textOf(e);
    return text === '搜索' || text.startsWith('搜索');
  });
  const button = buttons.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const score = (r) => Math.abs(r.y - 120) + Math.abs(r.x - 710);
    return score(ar) - score(br);
  })[0];
  if (button) {
    const r = button.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    button.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, view:window, clientX:cx, clientY:cy}));
    button.dispatchEvent(new MouseEvent('mouseup', {bubbles:true, cancelable:true, view:window, clientX:cx, clientY:cy}));
    button.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, view:window, clientX:cx, clientY:cy}));
    button.click();
  } else {
    input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', code:'Enter', bubbles:true, cancelable:true}));
    input.dispatchEvent(new KeyboardEvent('keyup', {key:'Enter', code:'Enter', bubbles:true, cancelable:true}));
  }
  return JSON.stringify({
    ok:true,
    method:'page_search_input',
    input:{className:String(input.className || ''), value:input.value || ''},
    button:button ? {text:textOf(button), className:String(button.className || '')} : null,
    beforeUrl:location.href
  });
})()
"""
    result = json.loads(chrome_js(js.replace("__KEYWORD__", json.dumps(product_name, ensure_ascii=False))))
    logger.log(json.dumps({"search_submit": result}, ensure_ascii=False, indent=2))
    if not result.get("ok"):
        raise RuntimeError(f"Taobao search input failed: {result.get('reason', 'UNKNOWN')}")
    time.sleep(8.0)
    return result


def open_taobao_search_by_input(logger: Logger, product_name: str) -> dict[str, Any]:
    logger.section("open taobao search by input")
    result = open_taobao_search_from_page(logger, product_name)
    run_guard(logger, "after search input submit")
    wait_for_search_page_ready(logger)
    return result


def mac_click_screen(x: float, y: float) -> None:
    last_error: Optional[Exception] = None
    for _ in range(2):
        window_id = ensure_chrome_target()
        activate_script = f'''
tell application "Google Chrome"
  activate
  if not (exists window id {window_id}) then error "Target Chrome window is closed"
  set index of window id {window_id} to 1
end tell
'''
        try:
            run_osascript(activate_script)
            break
        except RuntimeError as exc:
            last_error = exc
            if is_stale_chrome_window_error(exc):
                reset_chrome_target()
                continue
            raise
    else:
        raise RuntimeError(str(last_error) if last_error else "Could not activate Chrome target")
    swift = f'''
import CoreGraphics
import Foundation
let point = CGPoint(x: {float(x)}, y: {float(y)})
CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
usleep(30000)
CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
usleep(30000)
CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
'''
    result = subprocess.run(["/usr/bin/swift", "-e", swift], text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "CoreGraphics click failed")


def mac_move_screen(x: float, y: float, dwell_ms: int = 450) -> None:
    last_error: Optional[Exception] = None
    for _ in range(2):
        window_id = ensure_chrome_target()
        activate_script = f'''
tell application "Google Chrome"
  activate
  if not (exists window id {window_id}) then error "Target Chrome window is closed"
  set index of window id {window_id} to 1
end tell
'''
        try:
            run_osascript(activate_script)
            break
        except RuntimeError as exc:
            last_error = exc
            if is_stale_chrome_window_error(exc):
                reset_chrome_target()
                continue
            raise
    else:
        raise RuntimeError(str(last_error) if last_error else "Could not activate Chrome target")
    swift = f'''
import CoreGraphics
import Foundation
let point = CGPoint(x: {float(x)}, y: {float(y)})
CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
usleep({max(0, int(dwell_ms)) * 1000})
'''
    result = subprocess.run(["/usr/bin/swift", "-e", swift], text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "CoreGraphics move failed")


def dom_point_to_screen(x: float, y: float) -> tuple[float, float]:
    """Convert CSS viewport coordinates into macOS logical screen coordinates."""
    raw = chrome_js(
        "JSON.stringify({"
        "screenX:Number(window.screenX)||0,"
        "screenY:Number(window.screenY)||0,"
        "visualLeft:window.visualViewport?Number(window.visualViewport.offsetLeft)||0:0,"
        "visualTop:window.visualViewport?Number(window.visualViewport.offsetTop)||0:0"
        "})"
    )
    metrics = json.loads(raw)
    return (
        float(metrics.get("screenX") or 0) + float(x) - float(metrics.get("visualLeft") or 0),
        float(metrics.get("screenY") or 0) + float(y) - float(metrics.get("visualTop") or 0),
    )


def mac_click_dom_point(x: float, y: float) -> tuple[float, float]:
    screen_x, screen_y = dom_point_to_screen(x, y)
    mac_click_screen(screen_x, screen_y)
    return screen_x, screen_y


def mac_hover_dom_point(x: float, y: float, dwell_ms: int = 450) -> tuple[float, float]:
    screen_x, screen_y = dom_point_to_screen(x, y)
    mac_move_screen(screen_x, screen_y, dwell_ms=dwell_ms)
    return screen_x, screen_y


def mac_replace_text(text: str) -> None:
    script = f'''
tell application "Google Chrome" to activate
delay 0.1
tell application "System Events"
  keystroke "a" using command down
  key code 51
  keystroke {json.dumps(text, ensure_ascii=False)}
end tell
'''
    run_osascript(script)


def mac_press_escape() -> None:
    script = '''
tell application "Google Chrome" to activate
delay 0.1
tell application "System Events"
  key code 53
end tell
'''
    run_osascript(script)


def price_arg_text(value: Optional[float]) -> str:
    if value is None:
        return ""
    if float(value).is_integer():
        return str(int(value))
    return str(value)


def sha256_bytes(data: bytes) -> str:
    import hashlib

    return hashlib.sha256(data).hexdigest()


def normalize_page_image_url(raw: str) -> Optional[str]:
    text = (raw or "").strip()
    if not text:
        return None
    if text.startswith("data:"):
        return None
    text = text.replace("&amp;", "&")
    if text.startswith("//"):
        text = "https:" + text
    if text.startswith("http://"):
        text = "https://" + text[len("http://") :]
    if not text.startswith("https://"):
        return None
    if "alicdn.com" not in text and "taobao" not in text and "tmall" not in text:
        return None
    text = re.sub(r"_(?:\d+x\d+|sum|q\d+|webp|jpg|png)(?:xz)?(?:\.[a-zA-Z0-9]+)?$", "", text)
    return text


def image_ext_from_response(url: str, content_type: str) -> str:
    lowered = content_type.lower()
    if "png" in lowered:
        return ".png"
    if "webp" in lowered:
        return ".webp"
    if "gif" in lowered:
        return ".gif"
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return suffix
    return ".jpg"


def download_image_asset(url: str, target: Path, referer: str) -> dict[str, Any]:
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36",
            "Referer": referer,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
    )
    with urlopen(req, timeout=20) as resp:
        data = resp.read()
        content_type = resp.headers.get("Content-Type", "application/octet-stream")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return {
        "content_type": content_type,
        "file_size": len(data),
        "sha256": sha256_bytes(data),
    }


IMAGE_FILE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}


class ProductImageExportError(RuntimeError):
    """The 店透视 image export did not produce a trustworthy main/detail package."""


def safe_extract_zip(zip_path: Path, target_dir: Path) -> list[Path]:
    extracted: list[Path] = []
    target_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.infolist():
            if member.is_dir():
                continue
            member_name = member.filename.replace("\\", "/")
            if member_name.startswith("/") or ".." in Path(member_name).parts:
                continue
            destination = target_dir / member_name
            destination.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(member) as src, destination.open("wb") as dst:
                shutil.copyfileobj(src, dst)
            extracted.append(destination)
    return extracted


def safe_extract_tar(tar_path: Path, target_dir: Path) -> list[Path]:
    extracted: list[Path] = []
    target_dir.mkdir(parents=True, exist_ok=True)
    with tarfile.open(tar_path) as tf:
        for member in tf.getmembers():
            if not member.isfile():
                continue
            member_name = member.name.replace("\\", "/")
            if member_name.startswith("/") or ".." in Path(member_name).parts:
                continue
            source = tf.extractfile(member)
            if source is None:
                continue
            destination = target_dir / member_name
            destination.parent.mkdir(parents=True, exist_ok=True)
            with source, destination.open("wb") as dst:
                shutil.copyfileobj(source, dst)
            extracted.append(destination)
    return extracted


def classify_diantoushi_image_file(path: Path) -> Optional[str]:
    text = str(path).lower()
    if path.suffix.lower() not in IMAGE_FILE_EXTENSIONS:
        return None
    # 店透视会同时展示 `1:1主图`、`页面展示主图`、`主图视频`、`SKU图` 等类型。
    # Downstream analysis only wants the user-selected export types from 商品图自定义下载.
    if any(token in text for token in ["页面展示主图", "主图视频", "sku图"]):
        return None
    if any(token in text for token in ["详情长图", "detail_long", "detail-long"]):
        return "detail_image"
    if any(token in text for token in ["详情图", "detail"]):
        return None
    if any(token in text for token in ["1:1主图", "1比1主图"]):
        return "main_image"
    return None


def is_product_image_zip(path: Path) -> bool:
    """Detect 店透视 image zip files, including Chrome hidden temp files without .zip suffix."""
    try:
        if not path.is_file() or not zipfile.is_zipfile(path):
            return False
        with zipfile.ZipFile(path) as zf:
            names = [name.replace("\\", "/") for name in zf.namelist()[:300]]
    except Exception:
        return False
    image_names = [name for name in names if Path(name).suffix.lower() in IMAGE_FILE_EXTENSIONS]
    if not image_names:
        return False
    return any(("1:1主图" in name or "1比1主图" in name or "详情图" in name or "详情长图" in name) for name in image_names)


def is_product_image_download_file(path: Path) -> bool:
    suffix = path.suffix.lower()
    if suffix in IMAGE_FILE_EXTENSIONS:
        return True
    if suffix == ".zip":
        return True
    if path.name.startswith(".com.google.Chrome") and is_product_image_zip(path):
        return True
    return False


def stable_new_download_files(download_dir: Path, since: float, patterns: list[str]) -> list[Path]:
    candidates = stable_new_files(download_dir, since, patterns)
    completed = [p for p in candidates if p.suffix != ".crdownload" and not p.name.startswith(".com.google.Chrome")]
    stable: list[Path] = []
    for path in completed:
        try:
            size_1 = path.stat().st_size
            time.sleep(0.35)
            size_2 = path.stat().st_size
        except FileNotFoundError:
            continue
        if size_1 > 0 and size_1 == size_2:
            stable.append(path)
    return stable


def download_snapshot(download_dir: Path) -> dict[str, tuple[int, int]]:
    """Record current downloads so a 商品图 export can only consume new files."""
    snapshot: dict[str, tuple[int, int]] = {}
    for path in download_dir.iterdir():
        if not path.is_file():
            continue
        try:
            stat = path.stat()
        except FileNotFoundError:
            continue
        snapshot[str(path.resolve())] = (stat.st_size, stat.st_mtime_ns)
    return snapshot


def product_image_dialog_state() -> dict[str, Any]:
    js = r"""
JSON.stringify((()=>{
  const dialogs=[...document.querySelectorAll('.el-dialog')].filter(d=>d.getBoundingClientRect().width>100);
  const d=dialogs.find(x=>(x.innerText||'').includes('商品图自定义下载')) ||
          dialogs.find(x=>(x.innerText||'').includes('1:1主图') && ((x.innerText||'').includes('详情长图') || (x.innerText||'').includes('详情图')));
  if(!d) return {error:'NO_PRODUCT_IMAGE_DIALOG'};
  const text=(d.innerText||'').trim();
  const controls=[...d.querySelectorAll('button,label,.el-checkbox')].map((e,i)=>({
    i,
    text:(e.innerText||e.textContent||'').trim().replace(/\s+/g,' '),
    cls:String(e.className||''),
    disabled:!!e.disabled||String(e.className||'').includes('is-disabled'),
    checked:String(e.className||'').includes('is-checked') || !!e.querySelector('input:checked'),
    rect:(()=>{const r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})()
  })).filter(x=>x.rect[2]>0&&x.rect[3]>0).slice(0,120);
  return {title:text.slice(0,1600), controls};
})())
"""
    return json.loads(chrome_js(js))


def wait_for_product_image_dialog_loaded(
    logger: Logger,
    timeout: int = 35,
    poll_interval: float = 1.0,
) -> dict[str, Any]:
    logger.section("wait product image dialog loaded")
    deadline = time.time() + timeout
    last: dict[str, Any] = {}
    while time.time() < deadline:
        state = product_image_dialog_state()
        last = state
        title = str(state.get("title") or "")
        counts = {
            label: int(count)
            for label, count in re.findall(r"(1:1主图|1比1主图|详情图|详情长图|全部)\((\d+)\)", title)
        }
        loaded = (
            not state.get("error")
            and "加载中" not in title
            and "暂无数据" not in title
            and (
                counts.get("1:1主图", 0) > 0
                or counts.get("1比1主图", 0) > 0
                or counts.get("详情图", 0) > 0
                or counts.get("详情长图", 0) > 0
                or bool(re.search(r"(1比1主图|详情图|详情长图)\s*下载\s*预览", title))
            )
        )
        logger.log(json.dumps({
            "product_image_dialog_loaded_poll": {
                "loaded": loaded,
                "counts": counts,
                "error": state.get("error"),
            }
        }, ensure_ascii=False))
        if loaded:
            logger.log(json.dumps(state, ensure_ascii=False, indent=2))
            return state
        time.sleep(max(0.25, poll_interval))
    raise ProductImageExportError(f"商品图自定义下载弹窗加载超时或无主图/详情长图数据: {last}")


def click_visible_diantoushi_entry(label: str) -> dict[str, Any]:
    """Click one exact, visible 店透视 menu entry after its toolbar has opened it.

    店透视的 `下载 -> 商品图 -> 自定义下载` 有时把可见文字放在很窄的
    span 上，真正响应 hover/click 的是外层菜单行。这里优先选择菜单行，
    否则会出现点到 `商品图` 文案但二级菜单没有展开的问题。
    """
    js = f"""
(() => {{
  const label = {json.dumps(label, ensure_ascii=False)};
  const visible = (e) => {{
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden';
  }};
  const compact = (text) => String(text || '').trim().replace(/\s+/g, '');
  const hasToolbarContext = (e) => {{
    let node=e;
    for(let depth=0; node && depth<6; depth++, node=node.parentElement) {{
      const cls=String(node.className || '');
      const text=compact(node.innerText || node.textContent || '');
      if (/item-value|plain-hover|dropdown|popover|popper|menu|diantoushi/i.test(cls)) return true;
      if (text.includes('SKU预览') || text.includes('商品数据') || text.includes('问大家') || text.includes('店透视')) return true;
    }}
    return false;
  }};
  const aliases = label === '商品图' ? ['商品图', '商品图⌄', '商品图下载'] : [label];
  const textMatches=[...document.querySelectorAll('button,a,li,div,span,label,[role="button"]')].filter(e =>
    visible(e) && aliases.includes(compact(e.innerText || e.textContent)) && hasToolbarContext(e)
  );
  const candidates=[];
  for (const e of textMatches) {{
    let node=e;
    for (let depth=0; node && depth<7; depth++, node=node.parentElement) {{
      if (!visible(node)) continue;
      const text=compact(node.innerText || node.textContent || '');
      if (!text.includes(label)) continue;
      const r=node.getBoundingClientRect();
      if (r.width < 36 || r.height < 16 || r.width > 420 || r.height > 110) continue;
      const cls=String(node.className || '');
      const exact = aliases.includes(text);
      const menuish = /menu|dropdown|down|popover|popper|item|el-/i.test(cls);
      const dropdownish = label === '商品图' && /el-dropdown|plain-hover|downBox/i.test(cls);
      const score = (exact ? 800 : 0) + (menuish ? 300 : 0) + (dropdownish ? 120 : 0) + Math.min(r.width, 180) + Math.min(r.height, 40) - depth * 10;
      candidates.push({{
        e: node,
        cls,
        text,
        score,
        rect:[Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]
      }});
    }}
  }}
  candidates.sort((a,b)=>a.score-b.score);
  const pick=candidates[candidates.length-1];
  if(!pick) return JSON.stringify({{ok:false, label, reason:'NO_VISIBLE_DIANTOUSHI_ENTRY'}});
  const target = label === '商品图'
    ? (pick.e.closest('.el-dropdown-selfdefine,.el-dropdown,.plain-hover,.downBox') || pick.e)
    : (pick.e.closest('button,a,li,[role=menuitem],.el-dropdown-menu__item') || pick.e);
  const tr=target.getBoundingClientRect();
  const cx=label === '商品图' ? tr.x + Math.max(8, tr.width - 10) : tr.x + tr.width / 2;
  const cy=tr.y + tr.height / 2;
  for (const node of [target, pick.e]) {{
    for (const type of ['pointerover','pointerenter','mouseover','mouseenter','mousemove']) {{
      node.dispatchEvent(new MouseEvent(type, {{bubbles:true, clientX:cx, clientY:cy}}));
    }}
  }}
  for (const type of ['pointerdown','mousedown','pointerup','mouseup']) {{
    target.dispatchEvent(new MouseEvent(type, {{bubbles:true, clientX:cx, clientY:cy}}));
  }}
  target.click();
  return JSON.stringify({{ok:true, clicked:label, count:candidates.length, text:pick.text, className:pick.cls, rect:pick.rect, targetClassName:String(target.className || ''), targetRect:[Math.round(tr.x),Math.round(tr.y),Math.round(tr.width),Math.round(tr.height)], clickPoint:[Math.round(cx),Math.round(cy)], score:pick.score}});
}})()
"""
    return json.loads(chrome_js(js))


def locate_visible_diantoushi_entry(label: str) -> dict[str, Any]:
    js = f"""
(() => {{
  const label = {json.dumps(label, ensure_ascii=False)};
  const visible = (e) => {{
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0 && r.height>0 && r.bottom>0 && r.right>0 &&
      r.top<window.innerHeight && r.left<window.innerWidth &&
      s.display!=='none' && s.visibility!=='hidden';
  }};
  const compact = (text) => String(text || '').trim().replace(/\s+/g, '');
  const toolbarish = (e) => {{
    let node=e;
    for(let depth=0; node && depth<8; depth++, node=node.parentElement) {{
      const cls=String(node.className || '');
      const text=compact(node.innerText || node.textContent || '');
      if (/item-value|item-label|plain-hover|dropdown|popover|popper|menu|diantoushi|el-dropdown|el-popper/i.test(cls)) return true;
      if (text.includes('SKU预览') || text.includes('商品数据') || text.includes('问大家') || text.includes('店透视') || text.includes('自定义下载')) return true;
    }}
    return false;
  }};
  const aliases = label === '商品图' ? ['商品图', '商品图⌄', '商品图下载'] : [label];
  const matches=[...document.querySelectorAll('button,a,li,div,span,label,[role="button"]')].filter(e => {{
    if (!visible(e) || !toolbarish(e)) return false;
    const text=compact(e.innerText || e.textContent);
    return aliases.includes(text);
  }});
  const candidates=[];
  for (const e of matches) {{
    let node=e;
    for (let depth=0; node && depth<7; depth++, node=node.parentElement) {{
      if (!visible(node)) continue;
      const text=compact(node.innerText || node.textContent || '');
      if (!text.includes(label)) continue;
      const r=node.getBoundingClientRect();
      if (r.width < 36 || r.height < 16 || r.width > 420 || r.height > 110) continue;
      const cls=String(node.className || '');
      const exact = aliases.includes(text);
      const menuish = /menu|dropdown|down|popover|popper|item|el-/i.test(cls);
      const dropdownish = label === '商品图' && /el-dropdown|plain-hover|downBox/i.test(cls);
      const score = (exact ? 800 : 0) + (menuish ? 300 : 0) + (dropdownish ? 120 : 0) + Math.min(r.width, 180) + Math.min(r.height, 40) - depth * 10;
      candidates.push({{
        text,
        className: cls,
        score,
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]
      }});
    }}
  }}
  candidates.sort((a,b)=>a.score-b.score);
  const pick=candidates[candidates.length - 1];
  if (!pick) return JSON.stringify({{ok:false, label, reason:'NO_VISIBLE_DIANTOUSHI_ENTRY'}});
  return JSON.stringify({{ok:true, label, count:candidates.length, text:pick.text, className:pick.className, rect:pick.rect, score:pick.score}});
}})()
"""
    return json.loads(chrome_js(js))


def diantoushi_menu_snapshot() -> dict[str, Any]:
    """Return a compact snapshot of visible 店透视/menu nodes for debugging."""
    js = r"""
(() => {
  const visible = (e) => {
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden';
  };
  const compact = (text) => String(text || '').trim().replace(/\s+/g, '');
  const words = ['下载','商品图','自定义下载','1:1主图','1比1主图','详情图','详情长图','按类型下载'];
  const rows = [...document.querySelectorAll('button,a,li,div,span,label')].filter(visible).map((e) => {
    const text=compact(e.innerText || e.textContent || '');
    if (!text || !words.some(w => text.includes(w))) return null;
    const r=e.getBoundingClientRect();
    if (r.width > 700 || r.height > 180 || r.y < 60 || r.y > 820) return null;
    return {
      text,
      className:String(e.className || ''),
      rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]
    };
  }).filter(Boolean).slice(0,80);
  return JSON.stringify({rows});
})()
"""
    return json.loads(chrome_js(js))


def click_visible_diantoushi_entry_native(label: str) -> dict[str, Any]:
    located = locate_visible_diantoushi_entry(label)
    if not located.get("ok"):
        return located
    rect = located["rect"]
    click_x = rect[0] + rect[2] / 2
    if label == "商品图":
        click_x = rect[0] + max(8, rect[2] - 10)
    located["screen_point"] = list(
        mac_click_dom_point(click_x, rect[1] + rect[3] / 2)
    )
    located["native_clicked"] = True
    return located


def open_product_image_dialog(logger: Logger, args: Optional[argparse.Namespace] = None) -> dict[str, Any]:
    run_guard(logger, "before product image dialog open")
    logger.section("open product image dialog")
    attempts: list[dict[str, Any]] = []
    settle = diantoushi_click_settle(args)
    dialog_settle = diantoushi_dialog_settle(args)

    # Follow the visible 店透视 path shown by the user:
    # 下载 -> 商品图 -> 自定义下载 -> 商品图自定义下载 dialog.
    run_guard(logger, "before product image download menu open")
    download_menu = click_toolbar_control("下载")
    if download_menu.get("error"):
        download_menu = click_visible_diantoushi_entry("下载")
    if download_menu.get("error") or download_menu.get("ok") is False:
        download_menu = click_visible_diantoushi_entry_native("下载")
    attempts.append({"method": "open_download_menu", "result": download_menu})
    logger.log(json.dumps(attempts[-1], ensure_ascii=False))
    time.sleep(settle)
    logger.log(json.dumps({"menu_after_download": diantoushi_menu_snapshot()}, ensure_ascii=False, indent=2))

    nested = click_toolbar_control("商品图")
    if nested.get("error"):
        nested = click_visible_diantoushi_entry("商品图")
    attempts.append({"method": "download_menu_product_image", "result": nested})
    logger.log(json.dumps(attempts[-1], ensure_ascii=False))
    time.sleep(settle)
    logger.log(json.dumps({"menu_after_product_image": diantoushi_menu_snapshot()}, ensure_ascii=False, indent=2))

    custom = click_visible_diantoushi_entry("自定义下载")
    if not custom.get("ok"):
        native_nested = click_visible_diantoushi_entry_native("商品图")
        attempts.append({"method": "download_menu_product_image_native_retry", "result": native_nested})
        logger.log(json.dumps(attempts[-1], ensure_ascii=False))
        time.sleep(dialog_settle)
        logger.log(json.dumps({"menu_after_product_image_native_retry": diantoushi_menu_snapshot()}, ensure_ascii=False, indent=2))
        custom = click_visible_diantoushi_entry("自定义下载")
    if not custom.get("ok"):
        native_custom = click_visible_diantoushi_entry_native("自定义下载")
        attempts.append({"method": "product_image_custom_download_native_retry", "result": native_custom})
        logger.log(json.dumps(attempts[-1], ensure_ascii=False))
        if native_custom.get("ok"):
            custom = native_custom
    attempts.append({"method": "product_image_custom_download", "result": custom})
    logger.log(json.dumps(attempts[-1], ensure_ascii=False))
    time.sleep(dialog_settle)
    state = product_image_dialog_state()
    if not state.get("error"):
        logger.log(json.dumps(state, ensure_ascii=False, indent=2))
        return wait_for_product_image_dialog_loaded(logger, poll_interval=diantoushi_poll_interval(args))

    # Fallback for older layouts where 商品图 itself may open the dialog.
    direct = click_toolbar_control("商品图")
    attempts.append({"method": "fallback_toolbar_product_image", "result": direct})
    logger.log(json.dumps(attempts[-1], ensure_ascii=False))
    time.sleep(dialog_settle)
    state = product_image_dialog_state()
    logger.log(json.dumps({"product_image_dialog": state, "attempts": attempts}, ensure_ascii=False, indent=2))
    if state.get("error"):
        raise ProductImageExportError(f"Could not open 商品图 dialog: {state}; attempts={attempts}")
    return wait_for_product_image_dialog_loaded(logger, poll_interval=diantoushi_poll_interval(args))


def configure_product_image_dialog_main_detail_only(logger: Logger, args: Optional[argparse.Namespace] = None) -> dict[str, Any]:
    logger.section("select only 1:1 main image and detail long image")
    settle = diantoushi_click_settle(args)
    tiny_settle = min(0.35, max(0.18, settle / 2))
    read_js = r"""
(() => {
  const visible = (e) => {
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden';
  };
  const dialogs=[...document.querySelectorAll('.el-dialog')].filter(visible);
  const dialog=dialogs.find(d=>(d.innerText||'').includes('商品图自定义下载')) ||
    dialogs.find(d=>(d.innerText||'').includes('1:1主图') && ((d.innerText||'').includes('详情长图') || (d.innerText||'').includes('详情图')));
  if(!dialog) return JSON.stringify({ok:false, reason:'NO_PRODUCT_IMAGE_DIALOG'});
  const normalize = (text) => String(text || '').trim().replace(/\s+/g, '').replace(/：/g, ':');
  const wanted = (text) => {
    const t=normalize(text);
    return /^1:1主图/.test(t) || /^1比1主图/.test(t) || /^详情长图/.test(t);
  };
  const isChecked = (label) => String(label.className || '').includes('is-checked') || !!label.querySelector('input:checked');
  const candidateLabels=[...dialog.querySelectorAll('label.el-checkbox,.el-checkbox')].filter(visible);
  const filters = candidateLabels.filter(label => {
    const text=normalize(label.innerText || label.textContent || '');
    const r=label.getBoundingClientRect();
    return r.y < 180 && /^(全部|1:1主图|1比1主图|页面展示主图|主图视频|SKU图|详情图|详情长图)/.test(text);
  }).map((label, i) => {
    const text=normalize(label.innerText || label.textContent || '');
    const r=label.getBoundingClientRect();
    return {
      i,
      text,
      desired:wanted(text),
      checked:isChecked(label),
      rect:[Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]
    };
  }).filter(x => x.text);
  const selectedWanted = filters.filter(x => x.desired);
  const selectedOther = filters.filter(x => !x.desired && x.checked);
  const wantedReady = selectedWanted.length >= 2 && selectedWanted.every(x => x.checked);
  return JSON.stringify({
    // Strictly we want no other top-level types selected. In practice 店透视/Element
    // UI can reject synthetic unchecks for `全部`; if the wanted categories are
    // selected, continue and filter unwanted same-product folders after unzip.
    ok: wantedReady,
    strict_ok: wantedReady && selectedOther.length === 0,
    fallback_filter_after_download: wantedReady && selectedOther.length > 0,
    filters,
    selectedWanted,
    selectedOther
  });
})()
"""
    result: dict[str, Any] = {"ok": False, "reason": "not_run"}
    operations: list[dict[str, Any]] = []
    for attempt in range(4):
        result = json.loads(chrome_js(read_js))
        result["attempt"] = attempt + 1
        result["operations"] = operations
        logger.log(json.dumps(result, ensure_ascii=False, indent=2))
        if result.get("ok"):
            break
        filters = result.get("filters", [])

        def click_filter(filter_row: dict[str, Any], phase: str) -> None:
            rect = filter_row["rect"]
            # Click the visible checkbox square on the left side of the label.
            x = rect[0] + 12
            y = rect[1] + rect[3] / 2
            operations.append({
                "attempt": attempt + 1,
                "phase": phase,
                "text": filter_row.get("text"),
                "checked_before": filter_row.get("checked"),
                "desired": filter_row.get("desired"),
                "click": [round(x), round(y)],
            })
            mac_click_dom_point(x, y)
            time.sleep(tiny_settle)

        all_filter = next((row for row in filters if str(row.get("text", "")).startswith("全部")), None)
        if all_filter and all_filter.get("checked"):
            click_filter(all_filter, "clear_all")
            time.sleep(settle)
            continue

        clicked_any = False
        for row in filters:
            if not row.get("desired") and row.get("checked"):
                click_filter(row, "clear_unwanted")
                clicked_any = True
        if clicked_any:
            time.sleep(settle)
            continue

        for row in filters:
            if row.get("desired") and not row.get("checked"):
                click_filter(row, "select_wanted")
                clicked_any = True
        if clicked_any:
            time.sleep(settle)
            continue
        time.sleep(settle)
    state = product_image_dialog_state()
    logger.log(json.dumps({"after_select": state}, ensure_ascii=False, indent=2))
    if not result.get("ok"):
        raise ProductImageExportError(
            "商品图下载筛选校验失败：未能确认 1:1主图 与 详情长图已选中，当前状态="
            + json.dumps(result, ensure_ascii=False)
        )
    if result.get("fallback_filter_after_download"):
        logger.log(json.dumps({
            "product_image_filter_warning": "店透视未取消全部/其他类型，将继续按类型下载，并在入库前只保留1:1主图与详情长图",
            "selected_other": result.get("selectedOther", []),
        }, ensure_ascii=False, indent=2))
    return result


def click_product_image_download_by_type(logger: Logger) -> dict[str, Any]:
    logger.section("click product image by-type download")
    js = r"""
(() => {
  const visible = (e) => {
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden';
  };
  const dialogs=[...document.querySelectorAll('.el-dialog')].filter(visible);
  const dialog=dialogs.find(d=>(d.innerText||'').includes('商品图自定义下载')) ||
    dialogs.find(d=>(d.innerText||'').includes('1:1主图') && ((d.innerText||'').includes('详情长图') || (d.innerText||'').includes('详情图')));
  if(!dialog) return JSON.stringify({ok:false, reason:'NO_PRODUCT_IMAGE_DIALOG'});
  const buttons=[...dialog.querySelectorAll('button,a,span,div')].filter(visible).map((e,i)=>({
    e,i,text:(e.innerText||e.textContent||'').trim().replace(/\s+/g,''),cls:String(e.className||''),disabled:!!e.disabled||String(e.className||'').includes('is-disabled'),rect:e.getBoundingClientRect()
  })).filter(x=>!x.disabled && x.text);
  const pick=buttons.find(x=>x.text==='按类型下载') || buttons.find(x=>x.text.includes('按类型下载'));
  if(!pick) return JSON.stringify({ok:false, reason:'BY_TYPE_DOWNLOAD_NOT_FOUND', buttons:buttons.map(x=>x.text).slice(0,50)});
  const r=pick.rect;
  const cx=Math.round(r.x+r.width/2);
  const cy=Math.round(r.y+r.height/2);
  const hit=document.elementFromPoint(cx, cy);
  const target=(hit && hit.closest('button,a')) || pick.e.closest('button,a') || pick.e;
  target.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,clientX:cx,clientY:cy}));
  target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:cx,clientY:cy}));
  target.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:cx,clientY:cy}));
  target.click();
  return JSON.stringify({ok:true, clicked:pick.text, rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]});
})()
"""
    result = json.loads(chrome_js(js))
    logger.log(json.dumps(result, ensure_ascii=False, indent=2))
    if not result.get("ok"):
        raise RuntimeError(f"Could not click 按类型下载: {result}")
    return result


def wait_for_product_image_download(
    logger: Logger,
    start_epoch: float,
    before_downloads: dict[str, tuple[int, int]],
    timeout: int = 180,
    poll_interval: float = 1.2,
    stable_wait: float = 0.2,
    idle_seconds: float = 4.0,
) -> list[Path]:
    logger.section("wait product image download")
    download_dir = Path.home() / "Downloads"
    deadline = time.time() + timeout
    last_change_at: Optional[float] = None
    seen_new_paths: set[str] = set()
    latest_paths: list[Path] = []
    while time.time() < deadline:
        current = download_snapshot(download_dir)
        new_paths = [Path(path) for path in current if path not in before_downloads]
        current_new_paths = {str(path.resolve()) for path in new_paths}
        if current_new_paths != seen_new_paths:
            seen_new_paths = current_new_paths
            last_change_at = time.time()
        active = [path for path in new_paths if path.suffix == ".crdownload"]
        completed = [
            path for path in new_paths
            if is_product_image_download_file(path)
        ]
        stable = []
        for path in completed:
            try:
                size_1 = path.stat().st_size
                time.sleep(stable_wait)
                size_2 = path.stat().st_size
            except FileNotFoundError:
                continue
            if size_1 > 0 and size_1 == size_2:
                stable.append(path)
        if stable:
            latest_paths = stable
        # Store every new file triggered by this click, but wait for Chrome to finish
        # all types before moving anything out of Downloads.
        if latest_paths and not active and last_change_at and time.time() - last_change_at >= idle_seconds:
            logger.log(json.dumps({
                "downloaded_product_image_files": [str(p) for p in latest_paths],
                "download_source": "new_files_since_product_image_click",
            }, ensure_ascii=False, indent=2))
            return latest_paths
        time.sleep(max(0.5, poll_interval))
    raise ProductImageExportError("等待店透视 商品图下载超时：未发现本次点击产生的主图/详情长图压缩包或图片")


def clear_product_image_output(target_dir: Path) -> None:
    """Only remove prior image output for this product before replacing it."""
    image_root = target_dir / "product_page_images"
    for relative in [Path("main"), Path("detail"), Path("raw_export")]:
        candidate = image_root / relative
        if candidate.exists():
            shutil.rmtree(candidate)
    sidecar = target_dir / "product_page_images.json"
    if sidecar.exists():
        sidecar.unlink()


def build_product_page_image_payload_from_files(
    logger: Logger,
    target_dir: Path,
    product_id: str,
    downloaded_files: list[Path],
) -> dict[str, Any]:
    page_url = chrome_title_url().get("url", "")
    image_root = target_dir / "product_page_images"
    raw_root = image_root / "raw_export"
    extracted_root = raw_root / "extracted"
    raw_root.mkdir(parents=True, exist_ok=True)
    source_files: list[Path] = []
    raw_exports: list[str] = []
    for source in downloaded_files:
        destination_name = source.name
        source_is_zip = source.suffix.lower() == ".zip" or is_product_image_zip(source)
        if source_is_zip and source.suffix.lower() != ".zip":
            destination_name = f"{source.name}.zip"
        destination = unique_path(raw_root / destination_name)
        shutil.move(str(source), str(destination))
        raw_exports.append(str(destination.relative_to(target_dir)))
        if destination.suffix.lower() == ".zip" or is_product_image_zip(destination):
            try:
                source_files.extend(safe_extract_zip(destination, extracted_root / destination.stem))
            except Exception as exc:
                logger.log(json.dumps({"product_image_zip_extract_failed": {"file": str(destination), "error": str(exc)}}, ensure_ascii=False))
        elif destination.suffix.lower() in IMAGE_FILE_EXTENSIONS:
            source_files.append(destination)

    records: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    type_counts = {"main_image": 0, "detail_image": 0}
    for source in sorted(source_files):
        image_type = classify_diantoushi_image_file(source)
        if not image_type:
            continue
        type_counts[image_type] += 1
        subdir = image_root / ("main" if image_type == "main_image" else "detail")
        final_path = unique_path(subdir / f"{type_counts[image_type]:03d}{source.suffix.lower()}")
        try:
            final_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, final_path)
            data = final_path.read_bytes()
            records.append({
                "product_id": product_id,
                "image_type": image_type,
                "source_url": "",
                "storage_type": "local_file",
                "storage_path": str(final_path.relative_to(target_dir)),
                "file_name": final_path.name,
                "mime_type": "",
                "file_ext": final_path.suffix.lstrip("."),
                "file_size": len(data),
                "sha256": sha256_bytes(data),
                "sort_no": type_counts[image_type],
                "is_downloaded": 1,
                "page_url": page_url,
                "source_export": str(source.relative_to(target_dir)) if source.is_relative_to(target_dir) else str(source),
            })
        except Exception as exc:
            failures.append({"file": str(source), "image_type": image_type, "error": str(exc)})

    payload = {
        "ok": True,
        "source": "diantoushi_product_image_download",
        "detail_image_mode": "detail_long_image",
        "product_id": product_id,
        "page_url": page_url,
        "main_image_count": sum(1 for row in records if row["image_type"] == "main_image"),
        "detail_image_count": sum(1 for row in records if row["image_type"] == "detail_image"),
        "failed_count": len(failures),
        "raw_exports": raw_exports,
        "images": records,
        "failures": failures,
    }
    (target_dir / "product_page_images.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.log(json.dumps({
        "product_page_images": {
            "source": payload["source"],
            "detail_image_mode": payload["detail_image_mode"],
            "main_image_count": payload["main_image_count"],
            "detail_image_count": payload["detail_image_count"],
            "failed_count": payload["failed_count"],
            "raw_exports": raw_exports,
            "json_file": str(target_dir / "product_page_images.json"),
        }
    }, ensure_ascii=False, indent=2))
    return payload


def download_product_page_images_from_diantoushi(logger: Logger, args: argparse.Namespace, target_dir: Path, product_id: str) -> dict[str, Any]:
    logger.section("download product images from diantoushi 商品图")
    target_dir.mkdir(parents=True, exist_ok=True)
    clear_product_image_output(target_dir)
    open_product_image_dialog(logger, args)
    configure_product_image_dialog_main_detail_only(logger, args)
    run_guard(logger, "before product image by-type download")
    before_downloads = download_snapshot(Path.home() / "Downloads")
    start = time.time()
    click_product_image_download_by_type(logger)
    downloaded = wait_for_product_image_download(
        logger,
        start,
        before_downloads,
        timeout=180,
        poll_interval=download_poll_interval(args),
        stable_wait=diantoushi_file_stable_wait(args),
        idle_seconds=diantoushi_download_idle(args),
    )
    try:
        close_dialog("商品图自定义下载")
        close_dialog("商品图")
    except Exception:
        pass
    payload = build_product_page_image_payload_from_files(logger, target_dir, product_id, downloaded)
    if payload["main_image_count"] <= 0 or payload["detail_image_count"] <= 0:
        raise ProductImageExportError(f"店透视商品图已下载但未识别到主图/详情长图: {payload.get('raw_exports')}")
    return payload


def collect_product_page_image_urls(logger: Logger) -> dict[str, list[str]]:
    logger.section("collect product page image urls")
    run_guard(logger, "before collect product page images")
    chrome_js("window.scrollTo(0, 0); 'OK'")
    time.sleep(1.2)
    main_urls = json.loads(chrome_js(r"""
(() => {
  const norm = (u) => {
    if (!u) return '';
    u = String(u).trim();
    if (u.startsWith('//')) u = 'https:' + u;
    return u;
  };
  const imageUrl = (e) => norm(e.currentSrc || e.src || e.getAttribute('data-src') || e.getAttribute('data-ks-lazyload') || e.getAttribute('data-lazy') || '');
  const bgUrl = (e) => {
    const bg = getComputedStyle(e).backgroundImage || '';
    const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
    return norm(m ? m[1] : '');
  };
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width >= 60 && r.height >= 60 && s.display !== 'none' && s.visibility !== 'hidden';
  };
  const fromImgs = [...document.querySelectorAll('img')].filter(visible).map((img, i) => {
    const r = img.getBoundingClientRect();
    return {i, url:imageUrl(img), rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)], area:r.width*r.height};
  });
  const fromBg = [...document.querySelectorAll('div,section,a,li')].filter(visible).map((el, i) => {
    const r = el.getBoundingClientRect();
    return {i, url:bgUrl(el), rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)], area:r.width*r.height};
  });
  const imgs = [...fromImgs, ...fromBg].filter(x => x.url && /alicdn|taobao|tmall/.test(x.url));
  const topArea = imgs.filter(x => x.rect[0] >= 40 && x.rect[0] <= 1100 && x.rect[1] >= 180 && x.rect[1] <= 1150);
  return JSON.stringify(topArea.sort((a,b)=>b.area-a.area).slice(0,12));
})()
"""))

    detail_seen: dict[str, dict[str, Any]] = {}
    for step in range(0, 16):
        rows = json.loads(chrome_js(r"""
(() => {
  const norm = (u) => {
    if (!u) return '';
    u = String(u).trim();
    if (u.startsWith('//')) u = 'https:' + u;
    return u;
  };
  const imageUrl = (e) => norm(e.currentSrc || e.src || e.getAttribute('data-src') || e.getAttribute('data-ks-lazyload') || e.getAttribute('data-lazy') || '');
  const bgUrl = (e) => {
    const bg = getComputedStyle(e).backgroundImage || '';
    const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
    return norm(m ? m[1] : '');
  };
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width >= 120 && r.height >= 120 && r.bottom > 0 && r.top < window.innerHeight && s.display !== 'none' && s.visibility !== 'hidden';
  };
  const fromImgs = [...document.querySelectorAll('img')].filter(visible).map((img, i) => {
    const r = img.getBoundingClientRect();
    return {i, url:imageUrl(img), rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)], area:r.width*r.height, scrollY:Math.round(window.scrollY)};
  });
  const fromBg = [...document.querySelectorAll('div,section,a,li')].filter(visible).map((el, i) => {
    const r = el.getBoundingClientRect();
    return {i, url:bgUrl(el), rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)], area:r.width*r.height, scrollY:Math.round(window.scrollY)};
  });
  const imgs = [...fromImgs, ...fromBg].filter(x => x.url && /alicdn|taobao|tmall/.test(x.url));
  return JSON.stringify(imgs);
})()
"""))
        for row in rows:
            url = normalize_page_image_url(row.get("url", ""))
            if not url:
                continue
            detail_seen.setdefault(url, row)
        chrome_js("window.scrollBy(0, Math.max(850, window.innerHeight * 0.85)); 'OK'")
        time.sleep(0.6)
        if step in {5, 10, 15}:
            run_guard(logger, f"collect detail images scroll {step}")
    chrome_js("window.scrollTo(0, 0); 'OK'")

    main_out: list[str] = []
    for row in main_urls:
        url = normalize_page_image_url(row.get("url", ""))
        if url and url not in main_out:
            main_out.append(url)
    detail_out = [url for url in detail_seen.keys() if url not in set(main_out)]
    result = {
        "main_images": main_out[:12],
        "detail_images": detail_out[:80],
    }
    logger.log(json.dumps({
        "main_image_count": len(result["main_images"]),
        "detail_image_count": len(result["detail_images"]),
        "main_images": result["main_images"][:6],
        "detail_images": result["detail_images"][:10],
    }, ensure_ascii=False, indent=2))
    return result


def download_product_page_images_from_page_dom(logger: Logger, target_dir: Path, product_id: str) -> dict[str, Any]:
    logger.section("download product main/detail images from page dom")
    target_dir.mkdir(parents=True, exist_ok=True)
    page_url = chrome_title_url().get("url", "")
    urls = collect_product_page_image_urls(logger)
    image_root = target_dir / "product_page_images"
    records: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    for image_type, url_list in [("main_image", urls.get("main_images", [])), ("detail_image", urls.get("detail_images", []))]:
        subdir = image_root / ("main" if image_type == "main_image" else "detail")
        for index, url in enumerate(url_list, start=1):
            try:
                temp_name = f"{index:03d}.download"
                temp_path = subdir / temp_name
                meta = download_image_asset(url, temp_path, page_url)
                ext = image_ext_from_response(url, meta.get("content_type", ""))
                final_path = subdir / f"{index:03d}{ext}"
                if final_path.exists():
                    final_path = unique_path(final_path)
                temp_path.rename(final_path)
                records.append({
                    "product_id": product_id,
                    "image_type": image_type,
                    "source_url": url,
                    "storage_type": "local_file",
                    "storage_path": str(final_path.relative_to(target_dir)),
                    "file_name": final_path.name,
                    "mime_type": meta.get("content_type"),
                    "file_ext": final_path.suffix.lstrip("."),
                    "file_size": meta.get("file_size"),
                    "sha256": meta.get("sha256"),
                    "sort_no": index,
                    "is_downloaded": 1,
                    "page_url": page_url,
                })
            except Exception as exc:
                failures.append({"image_type": image_type, "source_url": url, "error": str(exc)})
                logger.log(json.dumps({"image_download_failed": failures[-1]}, ensure_ascii=False))
    payload = {
        "ok": True,
        "product_id": product_id,
        "page_url": page_url,
        "main_image_count": sum(1 for row in records if row["image_type"] == "main_image"),
        "detail_image_count": sum(1 for row in records if row["image_type"] == "detail_image"),
        "failed_count": len(failures),
        "images": records,
        "failures": failures,
    }
    (target_dir / "product_page_images.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.log(json.dumps({
        "product_page_images": {
            "main_image_count": payload["main_image_count"],
            "detail_image_count": payload["detail_image_count"],
            "failed_count": payload["failed_count"],
            "json_file": str(target_dir / "product_page_images.json"),
        }
    }, ensure_ascii=False, indent=2))
    return payload


def download_product_page_images(logger: Logger, args: argparse.Namespace, target_dir: Path, product_id: str) -> dict[str, Any]:
    logger.section("download product main/detail images")
    if args.skip_product_images:
        payload = {
            "ok": False,
            "source": "diantoushi_product_image_download",
            "product_id": product_id,
            "main_image_count": 0,
            "detail_image_count": 0,
            "failed_count": 0,
            "images": [],
            "status": "skipped_by_arg",
            "reason": "skip_product_images_enabled",
        }
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / "product_page_images.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        logger.log(json.dumps({"product_page_images": payload}, ensure_ascii=False, indent=2))
        return payload
    try:
        return download_product_page_images_from_diantoushi(logger, args, target_dir, product_id)
    except Exception as exc:
        payload = {
            "ok": False,
            "source": "diantoushi_product_image_download",
            "product_id": product_id,
            "main_image_count": 0,
            "detail_image_count": 0,
            "failed_count": 1,
            "images": [],
            "error": str(exc),
            "page_dom_fallback_disabled": True,
        }
        logger.log(json.dumps({
            "diantoushi_product_image_download_failed": {
                "error": str(exc),
                "fallback": "disabled_to_prevent_recommendation_or_other_product_images",
            }
        }, ensure_ascii=False, indent=2))
        try:
            close_dialog("商品图自定义下载")
            close_dialog("商品图")
        except Exception:
            pass
        (target_dir / "product_page_images.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return payload


def parse_item_id(url: str) -> Optional[str]:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    if query.get("id"):
        return query["id"][0]
    match = re.search(r"[?&]id=(\d+)", url)
    return match.group(1) if match else None


def canonical_item_urls(href: str, item_id: Optional[str]) -> list[str]:
    urls: list[str] = []
    if item_id:
        urls.append(f"https://item.taobao.com/item.htm?id={item_id}")
        urls.append(f"https://detail.tmall.com/item.htm?id={item_id}")
    if href:
        urls.append(href)
    deduped: list[str] = []
    for url in urls:
        if url and url not in deduped:
            deduped.append(url)
    return deduped


def canonical_item_url(href: str, item_id: Optional[str]) -> str:
    urls = canonical_item_urls(href, item_id)
    return urls[0] if urls else href


def is_chrome_privacy_error(state: dict[str, Any]) -> bool:
    return state.get("url") == "chrome-error://chromewebdata/" or "隐私设置错误" in str(state.get("title") or "")


def is_guard_privacy_error(data: dict[str, Any]) -> bool:
    return data.get("href") == "chrome-error://chromewebdata/" or "隐私设置错误" in str(data.get("title") or "")


def navigate_to_product(logger: Logger, selected: dict[str, Any], label: str, retries_per_url: int = 2) -> dict[str, str]:
    item_id = selected.get("item_id") or parse_item_id(selected.get("href", ""))
    urls = canonical_item_urls(selected.get("href", ""), item_id)
    last_state: dict[str, Any] = {}
    for url_index, url in enumerate(urls, start=1):
        for attempt in range(1, retries_per_url + 1):
            logger.section(f"navigate product {label} url {url_index}/{len(urls)} attempt {attempt}/{retries_per_url}")
            logger.log(f"open_url={url}")
            chrome_set_url(url)
            time.sleep(12 + (attempt - 1) * 5)
            state = chrome_title_url()
            last_state = state
            logger.log(json.dumps(state, ensure_ascii=False, indent=2))
            if is_chrome_privacy_error(state):
                logger.log("Chrome privacy error detected; retrying with a clean/canonical product URL.")
                continue
            guard = run_guard(logger, f"after item navigation {label}")
            last_state = {"title": str(guard.get("title") or ""), "url": str(guard.get("href") or state.get("url") or ""), "ready": state.get("ready", "")}
            if is_chrome_privacy_error(last_state):
                logger.log("Guard readback is still a Chrome privacy error; retrying with a clean/canonical product URL.")
                continue
            return state
    raise RuntimeError(f"Product page navigation failed after clean-link retries: {last_state}")


def run_guard(logger: Logger, label: str) -> dict[str, Any]:
    logger.section(f"guard {label}")
    window_id = ensure_chrome_target()
    try:
        chrome_js("location.href")
        window_id = ensure_chrome_target()
    except Exception as exc:
        logger.log(f"guard target activation failed: {exc}")
    result = run_process(
        [sys.executable, str(CHECK_GUARD), "--window-id", str(window_id)],
        logger,
        check=False,
    )
    try:
        data = json.loads(result.stdout)
    except Exception as exc:
        raise RuntimeError(f"Could not parse guard result: {exc}")
    if data.get("guard_detected"):
        raise RuntimeError(f"Taobao guard detected: {data.get('matched_guard_terms')} at {data.get('href')}")
    # The next RPA click must stay on the same product window even when Chrome has
    # other Taobao/search windows open.
    chrome_js("location.href")
    return data


def parse_sales_count(text: str) -> Optional[int]:
    raw = text.replace(",", "")
    patterns = [
        r"([0-9]+(?:\.[0-9]+)?)\s*万\+?\s*(?:人付款|人收货|付款|已售|件)",
        r"([0-9]+(?:\.[0-9]+)?)\s*千\+?\s*(?:人付款|人收货|付款|已售|件)",
        r"([0-9]+)\+?\s*(?:人付款|人收货|付款|已售|件)",
    ]
    for idx, pattern in enumerate(patterns):
        match = re.search(pattern, raw)
        if not match:
            continue
        value = float(match.group(1))
        if idx == 0:
            return int(value * 10000)
        if idx == 1:
            return int(value * 1000)
        return int(value)
    return None


def sales_raw(text: str) -> Optional[str]:
    match = re.search(r"([0-9]+(?:\.[0-9]+)?\s*(?:万|千)?\+?\s*(?:人付款|人收货|付款|已售|件))", text.replace(",", ""))
    return match.group(1) if match else None


def price_raw(text: str) -> Optional[str]:
    normalized = text.replace(",", "")
    match = re.search(r"¥\s*([0-9]+(?:\.[0-9]+)?)", normalized)
    return f"¥{match.group(1)}" if match else None


def parse_price(text: str) -> Optional[float]:
    raw = price_raw(text)
    if not raw:
        return None
    try:
        return float(raw.replace("¥", ""))
    except ValueError:
        return None


def price_in_range(price: Optional[float], min_price: Optional[float], max_price: Optional[float]) -> bool:
    if min_price is None and max_price is None:
        return True
    if price is None:
        return False
    if min_price is not None and price < min_price:
        return False
    if max_price is not None and price > max_price:
        return False
    return True


def search_candidates(logger: Logger, product_name: str, max_links: int = 260) -> list[dict[str, Any]]:
    logger.section("read search candidates")
    js = r"""
JSON.stringify([...document.querySelectorAll('a[href]')]
  .map((a,domIndex)=>({
    domIndex,
    text:(a.innerText||a.getAttribute('aria-label')||a.title||'').trim().replace(/\s+/g,' ').slice(0,320),
    href:a.href,
    rect:(()=>{const r=a.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})()
  }))
  .filter(x=>x.text && x.rect[2]>20 && x.rect[3]>10 && /(item\.taobao|detail\.tmall)/.test(x.href))
  .sort((a,b)=>a.rect[1]-b.rect[1] || a.rect[0]-b.rect[0] || a.domIndex-b.domIndex)
  .slice(0,__MAX_LINKS__)
  .map((x,visualIndex)=>({...x, visualIndex})))
""".replace("__MAX_LINKS__", str(max_links))
    raw = chrome_js(js)
    candidates = json.loads(raw)
    by_item: dict[str, dict[str, Any]] = {}
    for candidate in candidates:
        item_id = parse_item_id(candidate["href"])
        if not item_id:
            continue
        text = candidate["text"]
        parsed_sales = parse_sales_count(text)
        if parsed_sales is None:
            continue
        original_href = re.sub(r"([?&])ns=[^&]+&?", r"\1", candidate["href"])
        href = canonical_item_url(original_href, item_id)
        row = {
            "item_id": item_id,
            "title": text,
            "href": href,
            "original_href": original_href,
            "sales_raw": sales_raw(text),
            "sales_count": parsed_sales,
            "price_raw": price_raw(text),
            "price": parse_price(text),
            "search_index": candidate["visualIndex"],
            "visual_index": candidate["visualIndex"],
            "dom_index": candidate["domIndex"],
            "rect": candidate["rect"],
        }
        current = by_item.get(item_id)
        if current is None or row["visual_index"] < current["visual_index"]:
            by_item[item_id] = row
    out = sorted(by_item.values(), key=lambda x: x["visual_index"])
    logger.log(json.dumps({
        "candidate_count": len(out),
        "visual_order_candidates": out[:10],
        "top_sales_candidates": sorted(out, key=lambda x: (-x["sales_count"], x["visual_index"]))[:10],
    }, ensure_ascii=False, indent=2))
    return out


def click_next_search_page(logger: Logger) -> bool:
    logger.section("click next search page")
    js = r"""
(() => {
  const nodes = [...document.querySelectorAll('a,button,span,div')].filter(e => {
    const text = (e.innerText || e.textContent || '').trim().replace(/\s+/g, '');
    const r = e.getBoundingClientRect();
    const disabled = e.disabled || e.getAttribute('aria-disabled') === 'true' ||
      String(e.className || '').includes('disabled') || String(e.className || '').includes('is-disabled');
    return text.startsWith('下一页') && r.width > 20 && r.height > 10 && !disabled;
  });
  const e = nodes[nodes.length - 1];
  if (!e) return JSON.stringify({ok:false, reason:'NO_NEXT_PAGE'});
  const target = e.closest('a,button') || e;
  target.scrollIntoView({block:'center', inline:'center'});
  const before = location.href;
  target.dispatchEvent(new MouseEvent('mouseover', {bubbles:true}));
  target.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
  target.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
  target.click();
  const r = target.getBoundingClientRect();
  return JSON.stringify({ok:true, text:(target.innerText||target.textContent||'').trim(), before, rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]});
})()
"""
    result = json.loads(chrome_js(js))
    logger.log(json.dumps(result, ensure_ascii=False))
    return bool(result.get("ok"))


def apply_price_filter_native(
    logger: Logger,
    min_price: Optional[float],
    max_price: Optional[float],
) -> dict[str, Any]:
    before_filter_url = chrome_title_url().get("url", "")
    js_open_range = r"""
(() => {
  window.scrollTo(0, 0);
  const visible = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  };
  const textOf = (e) => (e.innerText || e.textContent || e.getAttribute('aria-label') || e.placeholder || '').trim().replace(/\s+/g, '');
  const clickNode = (e) => {
    const r = e.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    e.scrollIntoView({block:'nearest', inline:'center'});
    for (const type of ['pointerover', 'mouseover', 'pointerenter', 'mouseenter', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      e.dispatchEvent(new MouseEvent(type, {bubbles:true, cancelable:true, view:window, clientX:cx, clientY:cy}));
    }
    e.click();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  };
  const nodes = [...document.querySelectorAll('button,a,span,div')].filter(visible);
  const rangeNode = nodes.find(e => textOf(e) === '区间' || textOf(e).startsWith('区间'));
  if (!rangeNode) return JSON.stringify({ok:false, reason:'RANGE_FILTER_NOT_FOUND'});
  const target = rangeNode.closest('button,a') || rangeNode;
  return JSON.stringify({
    ok:true,
    text:textOf(target),
    rect:clickNode(target),
    url:location.href
  });
})()
"""
    range_result = json.loads(chrome_js(js_open_range))
    if not range_result.get("ok"):
        return range_result
    time.sleep(1.0)

    js_controls = r"""
(() => {
  const visible = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  };
  const textOf = (e) => (e.innerText || e.textContent || e.getAttribute('aria-label') || e.placeholder || '').trim().replace(/\s+/g, '');
  const pack = (e) => {
    const r = e.getBoundingClientRect();
    return {
      text:textOf(e),
      placeholder:e.placeholder || '',
      className:String(e.className || ''),
      value:e.value || '',
      rect:[Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]
    };
  };
  const inputs = [...document.querySelectorAll('input')].filter(visible).filter(input => {
    const r = input.getBoundingClientRect();
    const p = (input.placeholder || '').replace(/\s+/g, '');
    const inRangePopover = r.x >= 150 && r.x <= 650 && r.y >= 300 && r.y <= 700;
    return /最低价|最高价|价格|¥|￥/.test(p + textOf(input)) || (inRangePopover && input.type === 'text');
  });
  const low = inputs.find(input => /最低/.test(input.placeholder || textOf(input))) || inputs[0];
  const high = inputs.find(input => /最高/.test(input.placeholder || textOf(input))) || inputs.find(input => input !== low);
  const all = [...document.querySelectorAll('button,a,span,div')].filter(visible);
  const confirms = all.filter(e => {
    const r = e.getBoundingClientRect();
    const cls = String(e.className || '');
    const text = textOf(e);
    return text === '确定' || (cls.includes('confirmButton') && text.includes('确定')) || (text.includes('确定') && r.width <= 180 && r.height <= 60);
  }).sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const score = (e, r) => {
      const clsBonus = String(e.className || '').includes('confirmButton') ? -1000 : 0;
      const sizePenalty = r.width > 180 || r.height > 80 ? 10000 : 0;
      return clsBonus + sizePenalty + Math.abs(r.x - 280) + Math.abs(r.y - 630);
    };
    return score(a, ar) - score(b, br);
  });
  if (!low || !high) {
    return JSON.stringify({ok:false, reason:'PRICE_INPUTS_NOT_FOUND', inputCount:inputs.length, inputs:inputs.map(pack).slice(0,8)});
  }
  if (!confirms[0]) return JSON.stringify({ok:false, reason:'CONFIRM_NOT_FOUND', inputs:[pack(low), pack(high)]});
  return JSON.stringify({ok:true, low:pack(low), high:pack(high), confirm:pack(confirms[0])});
})()
"""
    controls = json.loads(chrome_js(js_controls))
    if not controls.get("ok"):
        return {"ok": False, "reason": controls.get("reason", "PRICE_CONTROLS_NOT_FOUND"), "range": range_result, "controls": controls}

    fill_price_js = r"""
(() => {
  const visible=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
  const inputs=[...document.querySelectorAll('input')].filter(visible).filter(i=>/最低|最高|¥|￥/.test(i.placeholder||''));
  const values = [__LOW_PRICE__, __HIGH_PRICE__];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  inputs.slice(0, 2).forEach((input, index) => {
    input.focus();
    input.select();
    setter.call(input, values[index]);
    input.dispatchEvent(new InputEvent('input', {bubbles:true, cancelable:true, inputType:'insertText', data:values[index]}));
    input.dispatchEvent(new Event('change', {bubbles:true, cancelable:true}));
    input.blur();
  });
  return JSON.stringify({
    ok: inputs.length >= 2,
    values: inputs.slice(0, 2).map(i=>i.value || ''),
    active: {tag: document.activeElement.tagName, placeholder: document.activeElement.placeholder || '', value: document.activeElement.value || '', className: String(document.activeElement.className || '')}
  });
})()
"""
    fill_price_js = fill_price_js.replace("__LOW_PRICE__", json.dumps(price_arg_text(min_price))).replace("__HIGH_PRICE__", json.dumps(price_arg_text(max_price)))
    filled_values = json.loads(chrome_js(fill_price_js))
    expected_values = [price_arg_text(min_price), price_arg_text(max_price)]
    if filled_values.get("values") != expected_values:
        return {
            "ok": False,
            "reason": "PRICE_INPUT_VALUES_NOT_SET",
            "method": "dom_focus_plus_keyboard",
            "minPrice": min_price,
            "maxPrice": max_price,
            "range": range_result,
            "controls": controls,
            "filledValues": filled_values,
            "expectedValues": expected_values,
        }
    confirm_result = json.loads(chrome_js(r"""
(() => {
  const visible=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
  const textOf=e=>(e.innerText||e.textContent||e.getAttribute('aria-label')||'').trim().replace(/\s+/g,'');
  const all=[...document.querySelectorAll('button,a,span,div')].filter(visible);
  const confirm=all.filter(e=>{
    const r=e.getBoundingClientRect();
    const cls=String(e.className||'');
    const text=textOf(e);
    return text==='确定' || (cls.includes('confirmButton') && text.includes('确定')) || (text.includes('确定') && r.width<=180 && r.height<=60);
  }).sort((a,b)=>{
    const ar=a.getBoundingClientRect();
    const br=b.getBoundingClientRect();
    const score=(e,r)=>{
      const clsBonus=String(e.className||'').includes('confirmButton') ? -1000 : 0;
      const sizePenalty=r.width>180 || r.height>80 ? 10000 : 0;
      return clsBonus + sizePenalty + Math.abs(r.x-280) + Math.abs(r.y-630);
    };
    return score(a,ar)-score(b,br);
  })[0];
  if (!confirm) return JSON.stringify({ok:false, reason:'CONFIRM_NOT_FOUND'});
  const r=confirm.getBoundingClientRect();
  const cx=r.x+r.width/2;
  const cy=r.y+r.height/2;
  confirm.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy}));
  confirm.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy}));
  confirm.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy}));
  confirm.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy}));
  confirm.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy}));
  return JSON.stringify({ok:true, method:'dom_confirm_only', text:textOf(confirm), className:String(confirm.className||''), rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]});
})()
"""))
    time.sleep(5.0)

    verify = json.loads(chrome_js(r"""
(() => {
  const visible=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
  const cards=[...document.querySelectorAll('a[href*="item.htm"], a[href*="id="]')].filter(visible).map(a=>{
    const text=(a.innerText||a.textContent||'').replace(/\s+/g,' ').trim();
    const m=text.match(/¥\s*([0-9]+(?:\.[0-9]+)?)/);
    return m ? Number(m[1]) : null;
  }).filter(v=>v !== null).slice(0,12);
  const host = location.hostname || '';
  const href = location.href || '';
  const onSearchPage = host.includes('s.taobao.com') || href.includes('/search');
  const onDetailPage = host.includes('detail.tmall.com') || host.includes('item.taobao.com') || href.includes('/item.htm');
  return JSON.stringify({url:href, onSearchPage, onDetailPage, samplePrices:cards});
})()
"""))
    if verify.get("onDetailPage") or not verify.get("onSearchPage"):
        recovery = open_url_with_fallback(logger, before_filter_url, "recover search page after price filter", wait_seconds=8.0)
        recovery_ready = None
        if recovery.get("ok"):
            try:
                recovery_ready = wait_for_search_page_ready(logger, timeout=20.0)
            except Exception as exc:
                recovery_ready = {"ok": False, "error": str(exc)}
        if not recovery.get("ok") or not (recovery_ready or {}).get("hasRange") or not (recovery_ready or {}).get("hasSales"):
            return {
                "ok": False,
                "reason": "PRICE_FILTER_RECOVERY_SEARCH_NOT_READY",
                "method": "mac_system_events",
                "minPrice": min_price,
                "maxPrice": max_price,
                "beforeFilterUrl": before_filter_url,
                "range": range_result,
                "controls": controls,
                "filledValues": filled_values,
                "confirm": confirm_result,
                "verify": verify,
                "recovery": recovery,
                "recoveryReady": recovery_ready,
            }
        return {
            "ok": True,
            "reason": "PRICE_FILTER_LEFT_SEARCH_PAGE_RECOVERED",
            "method": "mac_system_events",
            "minPrice": min_price,
            "maxPrice": max_price,
            "beforeFilterUrl": before_filter_url,
            "range": range_result,
            "controls": controls,
            "filledValues": filled_values,
            "confirm": confirm_result,
            "verify": verify,
            "recovery": recovery,
            "recoveryReady": recovery_ready,
            "likelyApplied": False,
        }
    ok_prices = verify.get("samplePrices") or []
    if min_price is not None:
        ok_prices = [p for p in ok_prices if p >= float(min_price)]
    if max_price is not None:
        ok_prices = [p for p in ok_prices if p <= float(max_price)]
    likely_applied = not verify.get("samplePrices") or len(ok_prices) >= max(1, len(verify["samplePrices"]) // 2)
    retry_verify = None
    if likely_applied is False:
        # Taobao sometimes accepts the values but does not trigger the search after a synthetic click.
        # Pressing Enter from the highest-price input and waiting for the item cards to settle is a
        # low-risk retry. If the UI still looks unfiltered, batch collection will keep a local price
        # safety filter instead of downloading out-of-range products.
        chrome_js(r"""
(() => {
  const visible=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
  const inputs=[...document.querySelectorAll('input')].filter(visible).filter(i=>/最低|最高|¥|￥/.test(i.placeholder||''));
  const high=inputs[1] || inputs[0];
  if (high) { high.focus(); high.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true})); high.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true})); }
  return 'OK';
})()
""")
        time.sleep(5.0)
        retry_verify = json.loads(chrome_js(r"""
(() => {
  const visible=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
  const cards=[...document.querySelectorAll('a[href*="item.htm"], a[href*="id="]')].filter(visible).map(a=>{
    const text=(a.innerText||a.textContent||'').replace(/\s+/g,' ').trim();
    const m=text.match(/¥\s*([0-9]+(?:\.[0-9]+)?)/);
    return m ? Number(m[1]) : null;
  }).filter(v=>v !== null).slice(0,12);
  const host = location.hostname || '';
  const href = location.href || '';
  const onSearchPage = host.includes('s.taobao.com') || href.includes('/search');
  const onDetailPage = host.includes('detail.tmall.com') || host.includes('item.taobao.com') || href.includes('/item.htm');
  return JSON.stringify({url:href, onSearchPage, onDetailPage, samplePrices:cards});
})()
"""))
        if retry_verify.get("onDetailPage") or not retry_verify.get("onSearchPage"):
            return {
                "ok": False,
                "reason": "PRICE_FILTER_LEFT_SEARCH_PAGE_AFTER_RETRY",
                "method": "mac_system_events",
                "minPrice": min_price,
                "maxPrice": max_price,
                "beforeFilterUrl": before_filter_url,
                "range": range_result,
                "controls": controls,
                "filledValues": filled_values,
                "confirm": confirm_result,
                "verify": verify,
                "retryVerify": retry_verify,
            }
        retry_ok_prices = retry_verify.get("samplePrices") or []
        if min_price is not None:
            retry_ok_prices = [p for p in retry_ok_prices if p >= float(min_price)]
        if max_price is not None:
            retry_ok_prices = [p for p in retry_ok_prices if p <= float(max_price)]
        likely_applied = not retry_verify.get("samplePrices") or len(retry_ok_prices) >= max(1, len(retry_verify["samplePrices"]) // 2)
    return {
        "ok": True,
        "method": "mac_system_events",
        "minPrice": min_price,
        "maxPrice": max_price,
        "beforeFilterUrl": before_filter_url,
        "range": range_result,
        "controls": controls,
        "filledValues": filled_values,
        "confirm": confirm_result,
        "verify": verify,
        "retryVerify": retry_verify,
        "likelyApplied": likely_applied,
    }


def apply_search_filters_and_sort(
    logger: Logger,
    min_price: Optional[float],
    max_price: Optional[float],
    sort_by_sales: bool = True,
) -> dict[str, Any]:
    if min_price is None and max_price is None and not sort_by_sales:
        return {}
    logger.section("apply search filters and sales sort")
    run_guard(logger, "before search filter/sort")
    result: dict[str, Any] = {}
    if min_price is not None or max_price is not None:
        result["price_filter_ui"] = apply_price_filter_native(logger, min_price, max_price)
        logger.log(json.dumps(result["price_filter_ui"], ensure_ascii=False, indent=2))
        if not result["price_filter_ui"].get("ok"):
            raise RuntimeError(f"Price filter failed: {result['price_filter_ui'].get('reason', 'UNKNOWN')}")
        if result["price_filter_ui"].get("likelyApplied") is False:
            logger.log(json.dumps({
                "warning": "Price filter did not appear to apply after retry; continuing with local price safety filter.",
                "min_price": min_price,
                "max_price": max_price,
            }, ensure_ascii=False, indent=2))
        logger.log(json.dumps(chrome_title_url(), ensure_ascii=False, indent=2))
        run_guard(logger, "after price filter")
        try:
            result["price_filter_ready"] = wait_for_search_cards_stable(logger, "after price filter")
        except Exception as exc:
            result["price_filter_ready"] = {"ok": False, "error": str(exc)}
            logger.log(json.dumps({
                "warning": "价格筛选后商品卡片未稳定，继续尝试点击销量。",
                "error": str(exc),
            }, ensure_ascii=False, indent=2))

    if sort_by_sales:
        js_sales = r"""
(() => {
  const visible = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  };
  const textOf = (e) => (e.innerText || e.textContent || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, '');
  const nodes = [...document.querySelectorAll('button,a,span,div')].filter(visible);
  const salesNode = nodes.find(e => textOf(e) === '销量') || nodes.find(e => textOf(e).startsWith('销量'));
  if (!salesNode) return JSON.stringify({ok:false, reason:'SALES_SORT_NOT_FOUND'});
  const target = salesNode.closest('button,a') || salesNode;
  const r = target.getBoundingClientRect();
  const cx = Math.round(r.x + r.width / 2);
  const cy = Math.round(r.y + r.height / 2);
  target.scrollIntoView({block:'center', inline:'center'});
  target.dispatchEvent(new MouseEvent('mouseover', {bubbles:true, clientX:cx, clientY:cy}));
  target.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, clientX:cx, clientY:cy}));
  target.dispatchEvent(new MouseEvent('mouseup', {bubbles:true, clientX:cx, clientY:cy}));
  target.click();
  return JSON.stringify({ok:true, clicked:textOf(target), rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]});
})()
"""
        result["sales_sort_ui"] = json.loads(chrome_js(js_sales))
        logger.log(json.dumps(result["sales_sort_ui"], ensure_ascii=False, indent=2))
        time.sleep(2)
        try:
            result["sales_sort_ready"] = wait_for_search_cards_stable(logger, "after sales sort")
        except Exception as exc:
            result["sales_sort_ready"] = {"ok": False, "error": str(exc)}
            logger.log(json.dumps({
                "warning": "销量排序后商品卡片未稳定；候选采集会继续等待/兜底。",
                "error": str(exc),
            }, ensure_ascii=False, indent=2))
        logger.log(json.dumps(chrome_title_url(), ensure_ascii=False, indent=2))
        run_guard(logger, "after sales sort")
    logger.log(json.dumps({"search_filter_sort_result": result}, ensure_ascii=False, indent=2))
    return result


def wait_for_search_page_ready(logger: Logger, timeout: float = 35.0) -> dict[str, Any]:
    logger.section("wait search page ready")
    deadline = time.time() + timeout
    last_state: dict[str, Any] = {}
    while time.time() < deadline:
        state = json.loads(chrome_js(r"""
(() => {
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  };
  const text = document.body ? document.body.innerText || '' : '';
  const controls = [...document.querySelectorAll('button,a,span,div')]
    .filter(visible)
    .map(e => (e.innerText || e.textContent || '').trim().replace(/\s+/g, ''))
    .filter(Boolean)
    .slice(0, 400);
  const hasRange = controls.some(t => t === '区间' || t.startsWith('区间'));
  const hasSales = controls.some(t => t === '销量' || t.startsWith('销量'));
  const cardCount = [...document.querySelectorAll('a[href*="item.htm"], a[href*="id="]')]
    .filter(visible)
    .length;
  return JSON.stringify({
    title: document.title,
    url: location.href,
    ready: document.readyState,
    bodyLength: text.length,
    loadingText: /加载中|loading/i.test(text),
    hasRange,
    hasSales,
    cardCount
  });
})()
"""))
        last_state = state
        logger.log(json.dumps({"search_ready_probe": state}, ensure_ascii=False))
        if state.get("hasRange") and state.get("hasSales") and int(state.get("cardCount") or 0) > 0:
            return state
        time.sleep(2.0)
    raise RuntimeError(f"Search page did not become ready before filtering: {last_state}")


def wait_for_search_cards_stable(logger: Logger, label: str, timeout: float = 45.0) -> dict[str, Any]:
    logger.section(f"wait search cards stable {label}")
    deadline = time.time() + timeout
    last_state: dict[str, Any] = {}
    last_signature = ""
    stable_rounds = 0
    while time.time() < deadline:
        state = json.loads(chrome_js(r"""
(() => {
  const visible = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  };
  const text = document.body ? document.body.innerText || '' : '';
  const links = [...document.querySelectorAll('a[href]')]
    .map((a, domIndex) => {
      const r = a.getBoundingClientRect();
      const cardText = (a.innerText || a.textContent || a.getAttribute('aria-label') || a.title || '').trim().replace(/\s+/g, ' ');
      return {
        domIndex,
        href: a.href,
        text: cardText,
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]
      };
    })
    .filter(x => x.text && x.rect[2] > 20 && x.rect[3] > 10 && /(item\.taobao|detail\.tmall|id=)/.test(x.href))
    .sort((a,b) => a.rect[1]-b.rect[1] || a.rect[0]-b.rect[0] || a.domIndex-b.domIndex);
  const productLinks = links.filter(x => /¥|人付款|人收货|付款|已售|件/.test(x.text));
  const signature = productLinks.slice(0, 8).map(x => `${x.href}|${x.text.slice(0, 40)}|${x.rect.join(',')}`).join('||');
  return JSON.stringify({
    title: document.title,
    url: location.href,
    ready: document.readyState,
    loadingText: /加载中|loading/i.test(text),
    linkCount: links.length,
    productLinkCount: productLinks.length,
    firstProduct: productLinks[0] || null,
    signature
  });
})()
"""))
        last_state = state
        signature = str(state.get("signature") or "")
        if signature and signature == last_signature and not state.get("loadingText") and int(state.get("productLinkCount") or 0) > 0:
            stable_rounds += 1
        else:
            stable_rounds = 0
        last_signature = signature
        logger.log(json.dumps({
            "search_cards_stable_probe": {k: v for k, v in state.items() if k != "signature"},
            "stable_rounds": stable_rounds,
        }, ensure_ascii=False))
        if stable_rounds >= 1:
            return state
        time.sleep(1.5)
    raise RuntimeError(f"Search cards did not become stable after {label}: {last_state}")


def collect_top_search_candidates(
    logger: Logger,
    product_name: str,
    top_n: int,
    max_scrolls: int = 18,
    max_pages: int = 5,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    scroll_wait: float = 3.5,
) -> list[dict[str, Any]]:
    logger.section("open search")
    logger.log(json.dumps({"price_filter": {"min_price": min_price, "max_price": max_price}}, ensure_ascii=False))
    search_submit = open_taobao_search_by_input(logger, product_name)
    logger.log(json.dumps({"search_submit": search_submit}, ensure_ascii=False, indent=2))
    apply_search_filters_and_sort(logger, min_price, max_price, sort_by_sales=True)
    by_item: dict[str, dict[str, Any]] = {}
    raw_seen_items: set[str] = set()
    skipped_by_price = 0
    skipped_unknown_price = 0
    for page_index in range(1, max_pages + 1):
        logger.section(f"search page {page_index}/{max_pages}")
        stagnant_rounds = 0
        last_raw_count = len(raw_seen_items)
        for scroll_index in range(max_scrolls + 1):
            for candidate in search_candidates(logger, product_name, max_links=700):
                item_id = candidate["item_id"]
                raw_seen_items.add(item_id)
                if not price_in_range(candidate.get("price"), min_price, max_price):
                    candidate["price_in_requested_range"] = False
                    if candidate.get("price") is None:
                        skipped_unknown_price += 1
                    else:
                        skipped_by_price += 1
                    if min_price is not None or max_price is not None:
                        continue
                else:
                    candidate["price_in_requested_range"] = True
                current = by_item.get(item_id)
                if current is None or candidate["sales_count"] > current["sales_count"]:
                    candidate["search_page"] = page_index
                    by_item[item_id] = candidate
            count = len(by_item)
            raw_count = len(raw_seen_items)
            logger.log(
                json.dumps(
                    {
                        "page_index": page_index,
                        "scroll_index": scroll_index,
                        "raw_unique_candidate_count": raw_count,
                        "selected_unique_candidate_count": count,
                        "display_price_out_of_range_count": skipped_by_price,
                        "display_price_unknown_count": skipped_unknown_price,
                        "price_filter": {"min_price": min_price, "max_price": max_price},
                        "price_filter_note": "淘宝区间筛选已执行；同时启用本地严格价格过滤，区间外或无法解析展示价的商品不会进入下载队列。",
                    },
                    ensure_ascii=False,
                )
            )
            if count >= top_n:
                break
            if raw_count == last_raw_count:
                stagnant_rounds += 1
            else:
                stagnant_rounds = 0
            if stagnant_rounds >= 3:
                break
            last_raw_count = raw_count
            chrome_js("window.scrollBy(0, Math.max(900, window.innerHeight * 0.85)); 'OK'")
            human_wait(logger, scroll_wait, "search result lazy-load after scroll")
            run_guard(logger, f"after search page {page_index} scroll {scroll_index + 1}")
        if len(by_item) >= top_n:
            break
        if page_index >= max_pages:
            break
        run_guard(logger, f"before next search page {page_index + 1}")
        if not click_next_search_page(logger):
            break
        time.sleep(8)
        logger.log(json.dumps(chrome_title_url(), ensure_ascii=False, indent=2))
        run_guard(logger, f"after next search page {page_index + 1}")
    out = sorted(by_item.values(), key=lambda x: (-x["sales_count"], x["search_index"]))[:top_n]
    for index, candidate in enumerate(out, start=1):
        candidate["rank"] = index
    logger.section("selected top candidates")
    logger.log(
        json.dumps(
            {
                "requested_top_n": top_n,
                "selected_count": len(out),
                "raw_unique_candidate_count": len(raw_seen_items),
                "display_price_out_of_range_count": skipped_by_price,
                "display_price_unknown_count": skipped_unknown_price,
                "price_filter": {"min_price": min_price, "max_price": max_price},
                "price_filter_note": "淘宝区间筛选已执行；同时启用本地严格价格过滤，区间外或无法解析展示价的商品不会进入下载队列。",
                "top_candidates": out,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return out


def open_filtered_sales_search(
    logger: Logger,
    product_name: str,
    min_price: Optional[float],
    max_price: Optional[float],
) -> dict[str, Any]:
    logger.section("open filtered sales search")
    logger.log(json.dumps({"price_filter": {"min_price": min_price, "max_price": max_price}}, ensure_ascii=False))
    search_submit = open_taobao_search_by_input(logger, product_name)
    logger.log(json.dumps({"search_submit": search_submit}, ensure_ascii=False, indent=2))
    logger.log(json.dumps(chrome_title_url(), ensure_ascii=False, indent=2))
    try:
        result = apply_search_filters_and_sort(logger, min_price, max_price, sort_by_sales=True)
        if result.get("sales_sort_ui", {}).get("ok") is False:
            logger.log(json.dumps({
                "warning": "淘宝销量排序按钮未能确认点击成功；后续会继续按本地解析销量降序选择候选。",
                "sales_sort_ui": result.get("sales_sort_ui"),
            }, ensure_ascii=False, indent=2))
    except Exception as exc:
        result = {
            "price_filter_ui": {
                "ok": False,
                "method": "taobao_ui_filter_failed_local_price_filter_fallback",
                "minPrice": min_price,
                "maxPrice": max_price,
                "likelyApplied": False,
                "error": str(exc),
            },
            "sales_sort_ui": {
                "ok": False,
                "method": "taobao_ui_sort_failed_parsed_sales_sort_fallback",
                "error": str(exc),
            },
        }
        logger.log(json.dumps({
            "warning": "淘宝页面筛选/销量排序未成功，继续使用本地严格价格过滤和本地销量排序兜底。",
            "error": str(exc),
        }, ensure_ascii=False, indent=2))
        wait_for_search_page_ready(logger)
    logger.log(json.dumps({"search_filter_sort_result": result}, ensure_ascii=False, indent=2))
    return result


def goto_search_page(logger: Logger, target_page: int) -> bool:
    if target_page <= 1:
        return True
    for page in range(2, target_page + 1):
        run_guard(logger, f"before next search page {page}")
        if not click_next_search_page(logger):
            return False
        time.sleep(8)
        logger.log(json.dumps(chrome_title_url(), ensure_ascii=False, indent=2))
        run_guard(logger, f"after next search page {page}")
    return True


def collect_current_search_page_candidates(
    logger: Logger,
    product_name: str,
    page_index: int,
    remaining: int,
    seen_item_ids: set[str],
    max_scrolls: int,
    min_price: Optional[float],
    max_price: Optional[float],
    scroll_wait: float,
    enforce_local_price_filter: bool = False,
    prefer_page_order: bool = True,
) -> list[dict[str, Any]]:
    logger.section(f"collect current search page {page_index}")
    logger.log(json.dumps({
        "download_strategy": "sequential_page_first",
        "message": f"先采集当前第 {page_index} 页候选，当前页候选会先下载；只有不够 TopN 时才进入下一页。",
        "remaining_needed": remaining,
        "enforce_local_price_filter": enforce_local_price_filter,
        "prefer_page_order": prefer_page_order,
        "price_filter": {"min_price": min_price, "max_price": max_price},
    }, ensure_ascii=False, indent=2))
    by_item: dict[str, dict[str, Any]] = {}
    raw_seen_items: set[str] = set()
    skipped_seen = 0
    skipped_by_price = 0
    skipped_unknown_price = 0
    stagnant_rounds = 0
    last_raw_count = 0
    for scroll_index in range(max_scrolls + 1):
        candidates = search_candidates(logger, product_name, max_links=700)
        if not candidates and scroll_index == 0:
            try:
                wait_for_search_cards_stable(logger, "before collecting page candidates")
                candidates = search_candidates(logger, product_name, max_links=700)
            except Exception as exc:
                logger.log(json.dumps({
                    "warning": "采集候选前商品卡片仍未稳定，继续按当前页面读取结果。",
                    "error": str(exc),
                }, ensure_ascii=False, indent=2))
        for candidate in candidates:
            item_id = candidate["item_id"]
            raw_seen_items.add(item_id)
            if item_id in seen_item_ids:
                skipped_seen += 1
                continue
            if not price_in_range(candidate.get("price"), min_price, max_price):
                candidate["price_in_requested_range"] = False
                if candidate.get("price") is None:
                    skipped_unknown_price += 1
                else:
                    skipped_by_price += 1
                if enforce_local_price_filter:
                    continue
            else:
                candidate["price_in_requested_range"] = True
            current = by_item.get(item_id)
            if current is None or candidate["search_index"] < current["search_index"]:
                candidate["search_page"] = page_index
                by_item[item_id] = candidate
        count = len(by_item)
        raw_count = len(raw_seen_items)
        logger.log(
            json.dumps(
                {
                    "page_index": page_index,
                    "scroll_index": scroll_index,
                    "raw_unique_candidate_count": raw_count,
                    "page_candidate_count": count,
                    "remaining_needed": remaining,
                    "skipped_already_downloaded_count": skipped_seen,
                    "display_price_out_of_range_count": skipped_by_price,
                    "display_price_unknown_count": skipped_unknown_price,
                    "enforce_local_price_filter": enforce_local_price_filter,
                    "order_note": "优先按淘宝页面当前顺序采集；页面已点销量时，第一个合格商品会先下载。",
                },
                ensure_ascii=False,
            )
        )
        if count >= remaining:
            break
        if raw_count == last_raw_count:
            stagnant_rounds += 1
        else:
            stagnant_rounds = 0
        if stagnant_rounds >= 3:
            break
        last_raw_count = raw_count
        chrome_js("window.scrollBy(0, Math.max(900, window.innerHeight * 0.85)); 'OK'")
        human_wait(logger, scroll_wait, "search result lazy-load after scroll")
        run_guard(logger, f"after search page {page_index} scroll {scroll_index + 1}")
    if prefer_page_order:
        out = sorted(by_item.values(), key=lambda x: x["search_index"])[:remaining]
        selection_order = "按淘宝页面当前顺序选择；价格区间外商品会被本地严格过滤跳过。"
    else:
        out = sorted(by_item.values(), key=lambda x: (-x["sales_count"], x["search_index"]))[:remaining]
        selection_order = "淘宝销量排序未确认成功，按本地解析销量从高到低兜底选择。"
    logger.section(f"selected page {page_index} candidates")
    logger.log(json.dumps({
        "selected_count": len(out),
        "page_index": page_index,
        "download_order": "these_candidates_will_be_downloaded_before_next_page",
        "next_page_policy": "只有当前页下载/尝试完成后，如果总数仍小于 TopN，才会重新打开搜索并进入下一页。",
        "selection_order": selection_order,
        "candidates": out,
    }, ensure_ascii=False, indent=2))
    return out


def collect_one_sales_page_candidates(
    logger: Logger,
    args: argparse.Namespace,
    page_index: int,
    remaining: int,
    seen_item_ids: set[str],
) -> list[dict[str, Any]]:
    logger.section(f"sequential page mode prepare page {page_index}")
    logger.log(json.dumps({
        "download_strategy": "sequential_page_first",
        "page_index": page_index,
        "remaining_needed": remaining,
        "message": "本轮只处理这一页：采集当前页候选后立即下载，不会先预翻后面页面。",
    }, ensure_ascii=False, indent=2))
    filter_sort_result = open_filtered_sales_search(logger, args.product_name, args.min_price, args.max_price)
    if not goto_search_page(logger, page_index):
        return []
    sales_sort_ui = (filter_sort_result or {}).get("sales_sort_ui") or {}
    prefer_page_order = sales_sort_ui.get("ok") is not False
    enforce_local_price_filter = args.min_price is not None or args.max_price is not None
    if enforce_local_price_filter:
        logger.log(json.dumps({
            "price_filter_policy": "已启用本地严格价格过滤；不在价格区间或无法解析展示价的搜索卡片不会进入下载队列。",
            "page_index": page_index,
            "price_filter": {"min_price": args.min_price, "max_price": args.max_price},
            "selection_policy": "销量排序点击成功时，按淘宝页面顺序取第一个价格合格商品；销量排序失败时才按本地解析销量兜底。",
        }, ensure_ascii=False, indent=2))
    return collect_current_search_page_candidates(
        logger,
        args.product_name,
        page_index,
        remaining,
        seen_item_ids,
        max_scrolls=18,
        min_price=args.min_price,
        max_price=args.max_price,
        scroll_wait=speed_value(args, "search_scroll_wait"),
        enforce_local_price_filter=enforce_local_price_filter,
        prefer_page_order=prefer_page_order,
    )


def choose_highest_sales_product(
    logger: Logger,
    product_name: str,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
) -> dict[str, Any]:
    candidates = collect_top_search_candidates(logger, product_name, 1, max_scrolls=0, min_price=min_price, max_price=max_price)
    if not candidates:
        raise RuntimeError("No product candidates with parsable sales/payment count were found on the visible search page.")
    selected = candidates[0]
    logger.section("selected highest-sales product")
    logger.log(json.dumps(selected, ensure_ascii=False, indent=2))
    return selected


def wait_for_toolbar(logger: Logger, timeout: int = 60, poll_interval: float = 5.0) -> dict[str, Any]:
    logger.section("wait toolbar")
    deadline = time.time() + timeout
    last = {}
    while time.time() < deadline:
        data = run_guard(logger, "toolbar poll")
        last = data
        if is_guard_privacy_error(data):
            raise RuntimeError(f"Product page is Chrome privacy error while waiting toolbar: {data}")
        if data.get("toolbar_present") and {"商品数据", "SKU预览", "问大家"}.issubset(set(data.get("export_controls", []))):
            return data
        time.sleep(max(0.5, poll_interval))
    raise RuntimeError(f"店透视 toolbar/export controls not ready: {last}")


def navigate_to_product_with_toolbar(
    logger: Logger,
    selected: dict[str, Any],
    label: str,
    retries_per_url: int = 2,
    toolbar_timeout: int = 60,
    toolbar_poll_interval: float = 5.0,
) -> dict[str, Any]:
    item_id = selected.get("item_id") or parse_item_id(selected.get("href", ""))
    urls = canonical_item_urls(selected.get("href", ""), item_id)
    last_error = ""
    for url_index, url in enumerate(urls, start=1):
        for attempt in range(1, retries_per_url + 1):
            try:
                logger.section(f"navigate+toolbar {label} url {url_index}/{len(urls)} attempt {attempt}/{retries_per_url}")
                logger.log(f"open_url={url}")
                chrome_set_url(url)
                time.sleep(12 + (attempt - 1) * 5)
                state = chrome_title_url()
                logger.log(json.dumps(state, ensure_ascii=False, indent=2))
                if is_chrome_privacy_error(state):
                    last_error = f"Chrome privacy error after navigation: {state}"
                    logger.log(last_error)
                    continue
                guard = run_guard(logger, f"after item navigation {label}")
                if is_guard_privacy_error(guard):
                    last_error = f"Chrome privacy error after guard readback: {guard}"
                    logger.log(last_error)
                    continue
                return wait_for_toolbar(logger, timeout=toolbar_timeout, poll_interval=toolbar_poll_interval)
            except RuntimeError as exc:
                last_error = str(exc)
                logger.log(f"navigation toolbar attempt failed: {last_error}")
                if "Taobao guard detected" in last_error:
                    raise
                continue
    raise RuntimeError(f"Product page or 店透视 toolbar failed after clean-link retries: {last_error}")


def click_toolbar_control(label: str) -> dict[str, Any]:
    js = f"""
(() => {{
  const label = {json.dumps(label, ensure_ascii=False)};
  const compact = (value) => {{
    if (!value) return '';
    if (typeof value === 'string') return value.trim().replace(/\\s+/g, '');
    return String(value.innerText || value.textContent || '').trim().replace(/\\s+/g, '');
  }};
  const visible = (e) => {{
    if (!e) return false;
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0 && r.height>0 && r.bottom>0 && r.right>0 &&
      r.top<window.innerHeight && r.left<window.innerWidth &&
      s.display!=='none' && s.visibility!=='hidden' && Number(s.opacity || 1) !== 0;
  }};
  const clickNode = (e) => {{
    const r=e.getBoundingClientRect();
    const cx=r.x+r.width/2;
    const cy=r.y+r.height/2;
    for (const type of ['pointerover','pointerenter','mouseover','mouseenter','mousemove','pointerdown','mousedown','pointerup','mouseup']) {{
      e.dispatchEvent(new MouseEvent(type, {{bubbles:true, cancelable:true, view:window, clientX:cx, clientY:cy}}));
    }}
    e.click();
    return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];
  }};
  const toolbarish = (e) => {{
    let node=e;
    for(let depth=0; node && depth<8; depth++, node=node.parentElement) {{
      const cls=String(node.className || '');
      const text=compact(node);
      if (/item-value|item-label|plain-hover|toolbar|dropdown|popover|popper|menu|diantoushi|el-dropdown|el-popper/i.test(cls)) return true;
      if (text.includes('SKU预览') || text.includes('商品数据') || text.includes('问大家') || text.includes('店透视')) return true;
    }}
    return false;
  }};
  const nodes = [...document.querySelectorAll('button,a,li,div,span,label,[role="button"]')].filter(e =>
    visible(e) && compact(e) === label && toolbarish(e)
  );
  const candidates=[];
  for (const e of nodes) {{
    let node=e;
    for (let depth=0; node && depth<6; depth++, node=node.parentElement) {{
      if (!visible(node)) continue;
      const text=compact(node);
      if (text !== label && !text.includes(label)) continue;
      const r=node.getBoundingClientRect();
      if (r.width < 30 || r.height < 14 || r.width > 360 || r.height > 96) continue;
      const cls=String(node.className || '');
      const exact = text === label;
      const clickable = node.closest('button,a,li,[role=button],[role=menuitem],.item-value,.item-label,.plain-hover,.el-dropdown-menu__item') || node;
      const score = (exact ? 1000 : 0) +
        (/item-value|item-label|plain-hover|toolbar|dropdown|menu|el-/i.test(cls) ? 300 : 0) +
        Math.min(r.width, 160) + Math.min(r.height, 40) - depth * 20;
      candidates.push({{e: clickable, text, className: cls, score, rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]}});
    }}
  }}
  candidates.sort((a,b)=>a.score-b.score);
  const pick = candidates[candidates.length - 1];
  if (pick) {{
    const rect = clickNode(pick.e);
    return JSON.stringify({{clicked:label, method:'toolbar_candidate', count:candidates.length, text:pick.text, className:pick.className, rect, score:pick.score}});
  }}

  const overflow = [...document.querySelectorAll('*')].filter(e => {{
    if (!visible(e)) return false;
    const t=compact(e);
    const r=e.getBoundingClientRect();
    return t.includes(label) && t.length <= 20 && r.width > 10 && r.width < 120 && r.height > 10 && r.height < 60;
  }}).pop();
  if (overflow) {{
    const r=overflow.getBoundingClientRect();
    const cx=r.x+r.width/2;
    const cy=r.y+r.height/2;
    for (const type of ['pointerover','pointerenter','mouseover','mouseenter','mousemove']) {{
      overflow.dispatchEvent(new MouseEvent(type, {{bubbles:true, cancelable:true, view:window, clientX:cx, clientY:cy}}));
    }}
    setTimeout(()=>{{}}, 0);
    const popperNode = [...document.querySelectorAll('*')].filter(e =>
      compact(e) === label &&
      visible(e) &&
      /item-value|plain-hover|popper-toolbar-item|popover|popper|menu/i.test(String(e.className||''))
    ).pop();
    if (popperNode) {{
      const target = popperNode.closest('button,a,li,[role=menuitem],.item-value,.plain-hover,.popper-toolbar-item') || popperNode;
      const rect = clickNode(target);
      return JSON.stringify({{clicked:label, method:'hover_overflow_then_click', overflowText:compact(overflow), text:compact(target), className:String(target.className||''), rect}});
    }}
    return JSON.stringify({{error:'NOT_FOUND_AFTER_OVERFLOW_HOVER', label, overflowText:compact(overflow), overflowRect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]}});
  }}
  return JSON.stringify({{error:'NOT_FOUND', label, count:nodes.length}});
}})()
"""
    result = json.loads(chrome_js(js))
    if not result.get("error") or label not in {"SKU预览", "商品数据"}:
        return result

    reveal_js = f"""
(() => {{
  const label = {json.dumps(label, ensure_ascii=False)};
  const visible = (e) => {{
    if (!e) return false;
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden';
  }};
  const compact = (e) => (e.innerText||e.textContent||'').trim().replace(/\\s+/g, '');
  const overflow = [...document.querySelectorAll('*')].filter(e => {{
    if (!visible(e)) return false;
    const t=compact(e);
    const r=e.getBoundingClientRect();
    return t.includes(label) && t.length <= 20 && r.width > 10 && r.width < 140 && r.height > 10 && r.height < 60;
  }}).pop();
  if (!overflow) return JSON.stringify({{ok:false, reason:'NO_OVERFLOW_TRIGGER', label}});
  const r=overflow.getBoundingClientRect();
  return JSON.stringify({{ok:true, label, text:compact(overflow), rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)], className:String(overflow.className||'')}});
}})()
"""
    reveal = json.loads(chrome_js(reveal_js))
    if reveal.get("ok"):
        rect = reveal["rect"]
        reveal["screen_point"] = list(mac_hover_dom_point(
            rect[0] + rect[2] / 2,
            rect[1] + rect[3] / 2,
            dwell_ms=diantoushi_hover_dwell_ms(),
        ))
        time.sleep(diantoushi_click_settle())
        retry = json.loads(chrome_js(js))
        retry["overflow_reveal"] = reveal
        retry["first_attempt"] = result
        return retry
    result["overflow_reveal"] = reveal
    return result


def stable_new_files(download_dir: Path, since: float, patterns: list[str]) -> list[Path]:
    files: list[Path] = []
    for pattern in patterns:
        for path in download_dir.glob(pattern):
            if path.is_file() and path.stat().st_mtime >= since - 2 and path not in files:
                files.append(path)
    return sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)


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


def wait_normalize_xlsx(
    logger: Logger,
    kind: str,
    item_id: str,
    start_epoch: float,
    expected_name: str,
    validators: list[str],
    timeout: int = 90,
    poll_interval: float = 2.0,
) -> Path:
    logger.section(f"wait normalize {kind}")
    download_dir = Path.home() / "Downloads"
    deadline = time.time() + timeout
    patterns = [f"*{item_id}*.xlsx", f"*{item_id}*.crdownload", ".com.google.Chrome*", "*.crdownload"]
    while time.time() < deadline:
        files = stable_new_files(download_dir, start_epoch, patterns)
        for path in files[:20]:
            logger.log(f"{datetime.fromtimestamp(path.stat().st_mtime).strftime('%F %T')} {path.stat().st_size} {path}")
        visible = [p for p in files if p.suffix == ".xlsx" and item_id in p.name]
        for path in visible:
            text = workbook_text(path)
            if all(token in text for token in validators):
                logger.log(f"FOUND_XLSX={path}")
                return path
        for temp in [p for p in files if p.name.startswith(".com.google.Chrome")]:
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
        time.sleep(max(0.5, poll_interval))
    raise RuntimeError(f"Timed out waiting for {kind} export for item {item_id}")


def wait_normalize_xlsx_with_export_retry(
    logger: Logger,
    args: argparse.Namespace,
    kind: str,
    item_id: str,
    expected_name: str,
    validators: list[str],
    click_label: str,
    first_timeout: Optional[int] = None,
    retry_timeout: Optional[int] = None,
) -> Path:
    start = time.time()
    first_timeout = first_timeout if first_timeout is not None else xlsx_first_timeout_seconds(args)
    retry_timeout = retry_timeout if retry_timeout is not None else xlsx_retry_timeout_seconds(args)
    try:
        return wait_normalize_xlsx(
            logger,
            kind,
            item_id,
            start,
            expected_name,
            validators,
            timeout=first_timeout,
            poll_interval=download_poll_interval(args),
        )
    except RuntimeError as first_exc:
        logger.log(json.dumps({
            "export_wait_retry": {
                "kind": kind,
                "item_id": item_id,
                "first_error": str(first_exc),
                "retry_click": click_label,
            }
        }, ensure_ascii=False, indent=2))
        run_guard(logger, f"before retry {kind} export")
        retry_click = click_toolbar_control(click_label)
        if retry_click.get("error"):
            retry_click = click_visible_diantoushi_entry_native(click_label)
        logger.log(json.dumps({"retry_export_click": retry_click}, ensure_ascii=False))
        retry_start = time.time()
        return wait_normalize_xlsx(
            logger,
            kind,
            item_id,
            retry_start,
            expected_name,
            validators,
            timeout=retry_timeout,
            poll_interval=download_poll_interval(args),
        )


def export_product_data(logger: Logger, args: argparse.Namespace, item_id: str) -> Path:
    run_guard(logger, "before product export")
    logger.section("click product data")
    logger.log(json.dumps(click_toolbar_control("商品数据"), ensure_ascii=False))
    return wait_normalize_xlsx_with_export_retry(
        logger,
        args,
        "product",
        item_id,
        f"商品数据ID_{item_id}_{datetime.now().strftime('%Y-%m-%d')}.xlsx",
        ["商品标题", "店铺名称", item_id],
        "商品数据",
    )


def sku_dialog_state() -> dict[str, Any]:
    js = r"""
JSON.stringify((()=>{
  const d=[...document.querySelectorAll('.el-dialog')].find(x=>(x.innerText||'').includes('SKU预览')&&x.getBoundingClientRect().width>100);
  if(!d) return {error:'NO_SKU_DIALOG'};
  const text=(d.innerText||'').trim();
  const buttons=[...d.querySelectorAll('button,label,.el-radio-button')].map((e,i)=>({
    i,text:(e.innerText||'').trim(),cls:String(e.className||''),disabled:!!e.disabled||String(e.className||'').includes('is-disabled'),
    rect:(()=>{const r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})()
  })).filter(x=>x.rect[2]>0&&x.rect[3]>0).slice(0,80);
  return {title:text.slice(0,1200), buttons};
})())
"""
    return json.loads(chrome_js(js))


def open_sku_dialog(logger: Logger, args: Optional[argparse.Namespace] = None) -> None:
    run_guard(logger, "before sku open")
    logger.section("click sku preview")
    logger.log(json.dumps(click_toolbar_control("SKU预览"), ensure_ascii=False))
    deadline = time.time() + 12.0
    state: dict[str, Any] = {}
    while time.time() < deadline:
        state = sku_dialog_state()
        logger.log(json.dumps({"sku_dialog_poll": state}, ensure_ascii=False, indent=2))
        if not state.get("error"):
            return
        time.sleep(diantoushi_poll_interval(args))
    raise RuntimeError(f"Could not open SKU dialog: {state}")


def click_sku_export_prefer_image_links(logger: Logger, args: Optional[argparse.Namespace] = None) -> str:
    logger.section("click sku export xlsx image links")
    settle = diantoushi_click_settle(args)
    js = r"""
(() => {
  const dialog=[...document.querySelectorAll('.el-dialog')].find(d=>(d.innerText||'').includes('SKU预览')&&d.getBoundingClientRect().width>100);
  if(!dialog) return JSON.stringify({error:'NO_SKU_DIALOG'});
  const mode=[...dialog.querySelectorAll('label,.el-radio-button,button,span')].find(e => (e.innerText||'').trim()==='导出表格' && e.getBoundingClientRect().width>0 && e.getBoundingClientRect().height>0);
  if(mode) mode.click();
  return JSON.stringify({ok:true});
})()
"""
    logger.log(chrome_js(js))
    time.sleep(settle)
    # Try opening the dropdown caret next to the dialog toolbar export button, then select xlsx+图片链接.
    js_dropdown = r"""
(() => {
  const dialog=[...document.querySelectorAll('.el-dialog')].find(d=>(d.innerText||'').includes('SKU预览')&&d.getBoundingClientRect().width>100);
  if(!dialog) return JSON.stringify({error:'NO_SKU_DIALOG'});
  const controls=[...dialog.querySelectorAll('button,label,[role="button"],.el-button,.el-radio-button,.el-dropdown')].map((e,i)=>({e,i,text:(e.innerText||e.textContent||'').trim().replace(/\\s+/g,' '),cls:String(e.className||''),rect:e.getBoundingClientRect(),disabled:!!e.disabled||String(e.className||'').includes('is-disabled')})).filter(x=>x.rect.width>0&&x.rect.height>0&&!x.disabled);
  const exportBtn=controls.filter(x=>x.text==='导出表格').pop();
  const caret=controls.find(x=>x.cls.includes('el-dropdown__caret-button') && exportBtn && Math.abs(x.rect.y-exportBtn.rect.y)<8 && x.rect.x>exportBtn.rect.x);
  if(caret){
    caret.e.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
    caret.e.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
    caret.e.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    caret.e.click();
    return JSON.stringify({openedDropdown:true, caretRect:[Math.round(caret.rect.x),Math.round(caret.rect.y),Math.round(caret.rect.width),Math.round(caret.rect.height)]});
  }
  if(exportBtn){
    exportBtn.e.click();
    return JSON.stringify({openedDropdown:false, clickedFallback:exportBtn.text});
  }
  return JSON.stringify({error:'NO_EXPORT_BUTTON', buttons:buttons.map(x=>({text:x.text,cls:x.cls}))});
})()
"""
    logger.log(chrome_js(js_dropdown))
    time.sleep(settle)
    js_menu = r"""
(() => {
  const visible = (e) => {
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden';
  };
  const norm = (text) => (text || '').trim().replace(/\s+/g, '').replace(/默认/g, '');
  const menuSelectors = [
    'li.el-dropdown-menu__item',
    '.el-dropdown-menu__item',
    '[role="menuitem"]',
    '.el-select-dropdown__item',
    '.el-popper li',
    '.el-popper button',
    '.el-popper span'
  ].join(',');
  const candidates=[...document.querySelectorAll(menuSelectors)]
    .filter(visible)
    .map((e,i)=>({e,i,text:(e.innerText||e.textContent||'').trim().replace(/\s+/g,' '),normalized:norm(e.innerText||e.textContent),cls:String(e.className||''),rect:e.getBoundingClientRect(),disabled:!!e.disabled||String(e.className||'').includes('is-disabled')}))
    .filter(x=>!x.disabled && x.text.length > 0 && x.text.length <= 50 && (x.text.includes('导出表格') || x.text.includes('xlsx')));
  const leafCandidates = candidates.filter(x => {
    const childText = [...x.e.children].map(c => norm(c.innerText || c.textContent)).filter(Boolean);
    return childText.length === 0 || !childText.some(t => t.includes('导出表格xlsx+图片链接') && t !== x.normalized);
  });
  const pool = leafCandidates.length ? leafCandidates : candidates;
  const byNeedle = (needles) => pool.find(x => needles.some(n => x.normalized === n || x.normalized.includes(n)));
  const preferred=byNeedle(['导出表格xlsx+图片链接', 'xlsx+图片链接']);
  const withImg=byNeedle(['导出表格xlsx+图片', 'xlsx+图片']);
  const normal=byNeedle(['导出表格xlsx', 'xlsx']);
  const pick=preferred || withImg || normal;
  if(pick){
    const r=pick.rect;
    const cx=Math.round(r.x + r.width/2);
    const cy=Math.round(r.y + r.height/2);
    const hit=document.elementFromPoint(cx, cy);
    const target=(hit && hit.closest('li.el-dropdown-menu__item,.el-dropdown-menu__item,[role="menuitem"],.el-select-dropdown__item,button')) || pick.e;
    target.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,clientX:cx,clientY:cy}));
    target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:cx,clientY:cy}));
    target.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:cx,clientY:cy}));
    target.click();
    return JSON.stringify({
      clickedMenu: pick.text,
      clickedNormalized: pick.normalized,
      clickedTag: target.tagName,
      variant: preferred ? 'xlsx+图片链接' : (withImg ? 'xlsx+图片' : 'xlsx'),
      rect: [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)],
      candidates: pool.map(x=>x.text).slice(0,20)
    });
  }
  return JSON.stringify({error:'NO_MENU_ITEM', candidates:candidates.map(x=>x.text).slice(0,30)});
})()
"""
    menu_result = json.loads(chrome_js(js_menu))
    logger.log(json.dumps(menu_result, ensure_ascii=False, indent=2))
    if menu_result.get("variant"):
        return menu_result["variant"]
    # Fallback: click toolbar export button.
    js_fallback = r"""
(() => {
  const dialog=[...document.querySelectorAll('.el-dialog')].find(d=>(d.innerText||'').includes('SKU预览')&&d.getBoundingClientRect().width>100);
  if(!dialog) return JSON.stringify({error:'NO_SKU_DIALOG'});
  const buttons=[...dialog.querySelectorAll('button,label,[role="button"],.el-button,.el-radio-button')].map((e,i)=>({e,i,text:(e.innerText||e.textContent||'').trim().replace(/\\s+/g,' '),cls:String(e.className||''),rect:e.getBoundingClientRect(),disabled:!!e.disabled||String(e.className||'').includes('is-disabled')})).filter(x=>x.rect.width>0&&x.rect.height>0&&!x.disabled);
  const pick=buttons.filter(x=>x.text==='导出表格').pop() || buttons.filter(x=>x.text.includes('导出')).pop();
  if(!pick) return JSON.stringify({error:'NO_EXPORT_BUTTON'});
  pick.e.click();
  return JSON.stringify({clickedFallback:pick.text});
})()
"""
    logger.log(chrome_js(js_fallback))
    return "fallback"


def workbook_has_image_links(path: Path) -> bool:
    text = workbook_text(path)
    return ("SKU图片" in text or "图片链接" in text or "图片URL" in text) and ("http://" in text or "https://" in text)


def export_sku(logger: Logger, args: argparse.Namespace, item_id: str) -> tuple[Path, str, bool]:
    open_sku_dialog(logger, args)
    run_guard(logger, "before sku export")
    variant = click_sku_export_prefer_image_links(logger, args)
    start = time.time()
    sku_path = wait_normalize_xlsx(
        logger,
        "sku",
        item_id,
        start,
        f"店透-SKU预览-表格-{item_id}-{datetime.now().strftime('%Y-%m-%d')}.xlsx",
        ["SKUID", "商品ID", item_id],
        timeout=sku_timeout_seconds(args),
        poll_interval=download_poll_interval(args),
    )
    has_links = workbook_has_image_links(sku_path)
    logger.log(json.dumps({"sku_export_variant": variant, "sku_image_links_found": has_links, "sku_file": str(sku_path)}, ensure_ascii=False, indent=2))
    return sku_path, variant, has_links


def close_dialog(title_text: str) -> None:
    js = f"""
(() => {{
  const d=[...document.querySelectorAll('.el-dialog')].find(e=>(e.innerText||'').includes({json.dumps(title_text, ensure_ascii=False)})&&e.getBoundingClientRect().width>100);
  if(!d) return 'NO_DIALOG';
  const btn=d.querySelector('.el-dialog__headerbtn');
  if(!btn) return 'NO_CLOSE_BTN';
  btn.click();
  return 'CLOSED';
}})()
"""
    chrome_js(js)


def ask_dialog_state() -> dict[str, Any]:
    js = r"""
JSON.stringify((()=>{
  const d=[...document.querySelectorAll('.el-dialog')].find(x=>(x.innerText||'').includes('问大家分析')&&x.getBoundingClientRect().width>100);
  if(!d) return {error:'NO_ASK_DIALOG'};
  const text=(d.innerText||'').trim();
  const buttons=[...d.querySelectorAll('button,.el-button,label')].map((e,i)=>({i,text:(e.innerText||'').trim(),cls:String(e.className||''),disabled:!!e.disabled||String(e.className||'').includes('is-disabled'),rect:(()=>{const r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})()})).filter(x=>x.rect[2]>0&&x.rect[3]>0).slice(0,80);
  return {title:text.slice(0,1800), buttons};
})())
"""
    return json.loads(chrome_js(js))


def ask_dialog_ready(state: dict[str, Any]) -> bool:
    if state.get("error"):
        return False
    title = str(state.get("title") or "")
    if "0/0条数据" in title or "暂无数据" in title:
        return True
    export_buttons = [
        button for button in state.get("buttons", [])
        if button.get("text") == "导出表格" and not button.get("disabled")
    ]
    return bool(export_buttons) and ("已成功加载" in title or "问题" in title or "问答" in title)


def wait_for_ask_dialog_ready(logger: Logger, timeout: float, poll_interval: float = 2.0) -> dict[str, Any]:
    deadline = time.time() + timeout
    last: dict[str, Any] = {}
    while time.time() < deadline:
        state = ask_dialog_state()
        last = state
        logger.log(json.dumps({"ask_ready_poll": state}, ensure_ascii=False, indent=2))
        if ask_dialog_ready(state):
            return state
        time.sleep(max(0.25, poll_interval))
    return last


def export_ask(logger: Logger, args: argparse.Namespace, item_id: str) -> Path:
    close_dialog("SKU预览")
    human_wait(logger, export_cooldown_seconds(args), "cooldown before opening ask dialog")
    run_guard(logger, "before ask open")
    logger.section("click ask")
    logger.log(json.dumps(click_toolbar_control("问大家"), ensure_ascii=False))
    state = wait_for_ask_dialog_ready(logger, ask_ready_timeout(args), poll_interval=diantoushi_poll_interval(args))
    logger.log(json.dumps(state, ensure_ascii=False, indent=2))
    if state.get("error"):
        raise RuntimeError(f"Could not open ask dialog: {state}")
    run_guard(logger, "before ask export")
    logger.section("click ask export")
    js = r"""
(() => {
  const dialog=[...document.querySelectorAll('.el-dialog')].find(d=>(d.innerText||'').includes('问大家分析')&&d.getBoundingClientRect().width>100);
  if(!dialog) return JSON.stringify({error:'NO_ASK_DIALOG'});
  if(!(dialog.innerText||'').includes('已成功加载')) return JSON.stringify({error:'ASK_NOT_READY', text:(dialog.innerText||'').slice(0,500)});
  const buttons=[...dialog.querySelectorAll('button')].map((e,i)=>({e,i,text:(e.innerText||'').trim(),cls:String(e.className||''),rect:e.getBoundingClientRect(),disabled:!!e.disabled||String(e.className||'').includes('is-disabled')})).filter(x=>x.rect.width>0&&x.rect.height>0&&!x.disabled);
  const pick=buttons.filter(x=>x.text==='导出表格').pop();
  if(!pick) return JSON.stringify({error:'NO_EXPORT_BUTTON', buttons:buttons.map(x=>x.text)});
  pick.e.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
  pick.e.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  pick.e.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  pick.e.click();
  const r=pick.rect;
  return JSON.stringify({clicked:pick.text,index:pick.i,rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]});
})()
"""
    logger.log(chrome_js(js))
    start = time.time()
    return wait_normalize_xlsx(
        logger,
        "ask",
        item_id,
        start,
        f"店透视-问大家分析-{item_id}-{datetime.now().strftime('%Y-%m-%d')}.xlsx",
        ["问题", "问答"],
        timeout=ask_export_timeout_seconds(args),
        poll_interval=download_poll_interval(args),
    )


def review_dialog_state() -> dict[str, Any]:
    js = r"""
JSON.stringify((()=>{
  const dialogs=[...document.querySelectorAll('.el-dialog')].filter(d=>d.getBoundingClientRect().width>100);
  const d=dialogs.find(x=>(x.innerText||'').includes('商品评价')&&(x.innerText||'').includes('评价/买家秀下载'));
  if(!d) return {error:'NO_REVIEW_DIALOG'};
  const text=(d.innerText||'').trim();
  const controls=[...d.querySelectorAll('button,label,.el-checkbox,.el-radio,.el-switch,input')].map((e,i)=>({
    i,
    tag:e.tagName,
    text:(e.innerText||e.textContent||'').trim().replace(/\s+/g,' '),
    value:e.value || '',
    cls:String(e.className||''),
    disabled:!!e.disabled||String(e.className||'').includes('is-disabled'),
    checked:String(e.className||'').includes('is-checked') || String(e.className||'').includes('is-active') || !!e.querySelector('input:checked') || e.checked === true,
    rect:(()=>{const r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})()
  })).filter(x=>x.rect[2]>0&&x.rect[3]>0).slice(0,140);
  return {title:text.slice(0,1800), controls};
})())
"""
    return json.loads(chrome_js(js))


def wait_for_review_dialog_ready(logger: Logger, timeout: float = 45.0, poll_interval: float = 2.0) -> dict[str, Any]:
    deadline = time.time() + timeout
    last: dict[str, Any] = {}
    while time.time() < deadline:
        state = review_dialog_state()
        last = state
        logger.log(json.dumps({"review_ready_poll": state}, ensure_ascii=False, indent=2))
        if not state.get("error"):
            text = str(state.get("title") or "")
            has_download_button = any(
                control.get("text") == "批量下载" and not control.get("disabled")
                for control in state.get("controls", [])
            ) or "批量下载" in text
            loaded_match = re.search(r"当前表格中共有\s*(\d+)\s*条数据", text)
            loaded_count = int(loaded_match.group(1)) if loaded_match else 0
            still_loading = any(
                marker in text
                for marker in ["当前正在加载", "拼命加载中", "加载中", "请稍等", "80%"]
            )
            loaded_empty = "已成功加载：0/0条数据" in text and not still_loading
            if has_download_button and not still_loading and (loaded_count > 0 or loaded_empty):
                return state
        time.sleep(max(0.25, poll_interval))
    return last


def open_review_dialog(logger: Logger, args: argparse.Namespace) -> dict[str, Any]:
    for title in ["SKU预览", "问大家分析", "商品图自定义下载"]:
        try:
            close_dialog(title)
        except Exception:
            pass
    human_wait(logger, export_cooldown_seconds(args), "cooldown before opening review dialog")
    run_guard(logger, "before review open")
    logger.section("click review analysis")
    chrome_js("window.scrollTo(0, 0); 'OK'")
    time.sleep(diantoushi_click_settle(args))
    click_result = click_toolbar_control("评价分析")
    time.sleep(diantoushi_click_settle(args))
    state = review_dialog_state()
    if state.get("error"):
        click_result = click_visible_diantoushi_entry_native("评价分析")
    logger.log(json.dumps({"review_click": click_result}, ensure_ascii=False, indent=2))
    state = wait_for_review_dialog_ready(
        logger,
        timeout=max(30.0, ask_ready_timeout(args)),
        poll_interval=diantoushi_poll_interval(args),
    )
    if state.get("error"):
        raise RuntimeError(f"Could not open review dialog: {state}")
    return state


def configure_review_download_settings(logger: Logger, args: argparse.Namespace) -> dict[str, Any]:
    logger.section("configure review download settings")
    pages = max(1, int(args.review_pages))
    js = f"""
(() => {{
  const wantPages = {pages};
  const visible = (e) => {{
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden';
  }};
  const clickNode = (e) => {{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const x=Math.round(r.x+r.width/2);
    const y=Math.round(r.y+r.height/2);
    e.dispatchEvent(new MouseEvent('mouseover',{{bubbles:true,clientX:x,clientY:y}}));
    e.dispatchEvent(new MouseEvent('mousedown',{{bubbles:true,clientX:x,clientY:y}}));
    e.dispatchEvent(new MouseEvent('mouseup',{{bubbles:true,clientX:x,clientY:y}}));
    e.click();
    return true;
  }};
  const dialogs=[...document.querySelectorAll('.el-dialog')].filter(visible);
  const dialog=dialogs.find(d=>(d.innerText||'').includes('商品评价')&&(d.innerText||'').includes('评价/买家秀下载'));
  if(!dialog) return JSON.stringify({{error:'NO_REVIEW_DIALOG'}});
  const tab=[...dialog.querySelectorAll('*')].find(e=>visible(e)&&(e.innerText||'').trim()==='评价/买家秀下载');
  if(tab) clickNode(tab);
  const defaultFilter=[...dialog.querySelectorAll('label,.el-switch,.el-checkbox')].find(e=>visible(e)&&(e.innerText||'').includes('过滤默认评价'));
  if(defaultFilter && !String(defaultFilter.className||'').includes('is-checked')) clickNode(defaultFilter);
  const settings=[...dialog.querySelectorAll('button,*')].filter(visible).find(e=>(e.innerText||'').trim()==='下载设置');
  if(!settings) return JSON.stringify({{error:'NO_SETTINGS_BUTTON'}});
  clickNode(settings);
  return JSON.stringify({{ok:true, openedSettings:true}});
}})()
"""
    first = json.loads(chrome_js(js))
    logger.log(json.dumps({"review_settings_open": first}, ensure_ascii=False, indent=2))
    if first.get("error"):
        return first
    time.sleep(diantoushi_click_settle(args))
    js_popover = f"""
(() => {{
  const wantPages = {pages};
  const visible = (e) => {{
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden';
  }};
  const clickNode = (e) => {{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const x=Math.round(r.x+r.width/2);
    const y=Math.round(r.y+r.height/2);
    e.dispatchEvent(new MouseEvent('mouseover',{{bubbles:true,clientX:x,clientY:y}}));
    e.dispatchEvent(new MouseEvent('mousedown',{{bubbles:true,clientX:x,clientY:y}}));
    e.dispatchEvent(new MouseEvent('mouseup',{{bubbles:true,clientX:x,clientY:y}}));
    e.click();
    return true;
  }};
  const checked = (e) => String(e.className||'').includes('is-checked') || String(e.className||'').includes('is-active') || !!e.querySelector('input:checked') || e.checked === true;
  const poppers=[...document.querySelectorAll('.el-popper,.el-popover,[role="tooltip"]')].filter(visible);
  const panel=poppers.find(p=>(p.innerText||'').includes('下载范围')&&(p.innerText||'').includes('下载内容'));
  if(!panel) return JSON.stringify({{
    ok:true,
    status:'settings_panel_not_found_keep_current_defaults',
    panelText:'',
    pageInputs:[],
    checks:[]
  }});
  const labels=[...panel.querySelectorAll('label,.el-checkbox,.el-radio')].filter(visible);
  const pickLabel = (text) => labels.find(e=>(e.innerText||'').replace(/\\s+/g,'').includes(text));
  const pageRadio = pickLabel('按页数');
  if(pageRadio && !checked(pageRadio)) clickNode(pageRadio);
  const setBox = (text, want) => {{
    const box=pickLabel(text);
    if(!box) return {{text, found:false}};
    const before=checked(box);
    if(before !== want) clickNode(box);
    return {{text, found:true, before, want, after:checked(box)}};
  }};
  const allInputs=[...panel.querySelectorAll('input,textarea,[contenteditable="true"]')];
  const writableInputs=allInputs.filter(i=>!i.disabled && !i.readOnly && (
    i.matches('[contenteditable="true"]') ||
    i.tagName==='TEXTAREA' ||
    i.type==='text' ||
    i.type==='number' ||
    i.type==='' ||
    String(i.className||'').includes('el-input__inner')
  ));
  const setValue = (el, value) => {{
    el.focus && el.focus();
    if(el.matches && el.matches('[contenteditable="true"]')) {{
      el.textContent = String(value);
      el.dispatchEvent(new InputEvent('input',{{bubbles:true,inputType:'insertText',data:String(value)}}));
      el.dispatchEvent(new Event('change',{{bubbles:true}}));
      el.blur && el.blur();
      return;
    }}
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if(setter) setter.call(el, String(value));
    else el.value = String(value);
    el.dispatchEvent(new InputEvent('input',{{bubbles:true,inputType:'insertText',data:String(value)}}));
    el.dispatchEvent(new Event('change',{{bubbles:true}}));
    el.blur && el.blur();
  }};
  if(writableInputs.length >= 2) {{
    setValue(writableInputs[0], '1');
    setValue(writableInputs[1], String(wantPages));
  }}
  const checks=[
    setBox('评价文字', true),
    setBox('Excel数据', true),
    setBox('晒图', false),
    setBox('视频', false),
  ];
  return JSON.stringify({{
    ok:true,
    panelText:(panel.innerText||'').slice(0,1200),
    pageInputs:writableInputs.slice(0,4).map(i=>i.value || i.textContent || ''),
    inputDebug:allInputs.slice(0,8).map(i=>{{
      const r=i.getBoundingClientRect();
      const s=getComputedStyle(i);
      return {{
        tag:i.tagName,
        type:i.type || '',
        cls:String(i.className||''),
        value:i.value || i.textContent || '',
        disabled:!!i.disabled,
        readOnly:!!i.readOnly,
        rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)],
        display:s.display,
        visibility:s.visibility,
      }};
    }}),
    checks
  }});
}})()
"""
    result = json.loads(chrome_js(js_popover))
    logger.log(json.dumps({"review_settings_configured": result}, ensure_ascii=False, indent=2))
    return result


def review_download_control_state() -> dict[str, Any]:
    """Read the real Element UI control state used by the review downloader."""
    js = r"""
JSON.stringify((()=>{
  const visible = (e) => {
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden';
  };
  const compact = (value) => String(value || '').trim().replace(/\s+/g,'');
  const rect = (e) => {
    if(!e) return null;
    const r=e.getBoundingClientRect();
    return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];
  };
  const dialogs=[...document.querySelectorAll('.el-dialog')].filter(visible);
  const dialog=dialogs.find(d=>(d.innerText||'').includes('商品评价')&&(d.innerText||'').includes('评价/买家秀下载'));
  if(!dialog) return {error:'NO_REVIEW_DIALOG'};

  const exactNode = (text) => [...dialog.querySelectorAll('button,span,div,a,label')]
    .filter(visible)
    .filter(e=>compact(e.innerText||e.textContent)===compact(text))
    .sort((a,b)=>{
      const ar=a.getBoundingClientRect();
      const br=b.getBoundingClientRect();
      const aButton=(a.tagName==='BUTTON'||String(a.className||'').includes('el-button'))?1:0;
      const bButton=(b.tagName==='BUTTON'||String(b.className||'').includes('el-button'))?1:0;
      if(aButton!==bButton) return bButton-aButton;
      return (ar.width*ar.height)-(br.width*br.height);
    })[0] || null;

  const filterText=exactNode('过滤默认评价');
  const switches=[...dialog.querySelectorAll('.el-switch')].filter(visible);
  let filterSwitch=null;
  if(filterText) {
    const fr=filterText.getBoundingClientRect();
    filterSwitch=switches
      .map(e=>{
        const r=e.getBoundingClientRect();
        const dx=Math.abs((r.x+r.width/2)-(fr.right+22));
        const dy=Math.abs((r.y+r.height/2)-(fr.y+fr.height/2));
        return {e,score:dx+dy*4};
      })
      .sort((a,b)=>a.score-b.score)[0]?.e || null;
  }
  filterSwitch=filterSwitch || switches[0] || null;
  const filterInput=filterSwitch?.querySelector('input[type="checkbox"]') || null;

  const settingsText=exactNode('下载设置');
  const settings=settingsText?.closest('.el-popover__reference,.btnItem,[tabindex]') || settingsText;
  const batchText=exactNode('批量下载');
  const batch=batchText?.closest('.btn2,.el-button,[tabindex]') || batchText;
  const panels=[...document.querySelectorAll('.el-popper,.el-popover,[role="tooltip"]')].filter(visible);
  const panel=panels.find(p=>(p.innerText||'').includes('下载范围')&&(p.innerText||'').includes('下载内容')) || null;

  let pageRadio=null;
  let pageInputs=[];
  let checks=[];
  if(panel) {
    const radioInputs=[...panel.querySelectorAll('input[type="radio"]')];
    const radioLabels=[...panel.querySelectorAll('label,.el-radio')].filter(visible);
    const pageTextNode=[...panel.querySelectorAll('span,div,label')]
      .filter(visible)
      .find(e=>compact(e.innerText||e.textContent).includes('按页数:第') || compact(e.innerText||e.textContent).includes('按页数第'));
    const pageTextLabel=pageTextNode?.closest('label,.el-radio') || null;
    const pageByValue=radioInputs.find(input=>String(input.value||'').toLowerCase().includes('page')) || null;
    const pageByOrder=radioInputs.length >= 2 ? radioInputs[1] : null;
    pageRadio=pageByValue?.closest('label,.el-radio') || pageTextLabel || pageByOrder?.closest('label,.el-radio') || pageByOrder || null;
    pageInputs=[...panel.querySelectorAll('input.el-input__inner,input[type="text"],input[type="number"]')]
      .filter(visible)
      .slice(0,2);
    const checkboxState=(text)=>{
      const labels=[...panel.querySelectorAll('label,.el-checkbox')].filter(visible);
      const label=labels.find(e=>compact(e.innerText||e.textContent)===compact(text)) ||
                  labels.find(e=>compact(e.innerText||e.textContent).includes(compact(text)));
      const input=label?.querySelector('input[type="checkbox"]') || null;
      return {
        text,
        found:!!label,
        checked:!!input?.checked || String(label?.className||'').includes('is-checked'),
        rect:rect(label)
      };
    };
    checks=['评价文字','晒图','视频','Excel数据'].map(checkboxState);
  }

  const pageInput=pageRadio?.querySelector('input[type="radio"]') ||
                  (pageRadio?.matches?.('input[type="radio"]') ? pageRadio : null);
  const pageRadioClick=pageRadio?.querySelector('.el-radio__input') || pageRadio;
  return {
    ok:true,
    filter:{
      found:!!filterSwitch,
      checked:!!filterInput?.checked || String(filterSwitch?.className||'').includes('is-checked'),
      rect:rect(filterSwitch)
    },
    settings:{found:!!settings,rect:rect(settings)},
    batch:{found:!!batch,disabled:!!batch?.disabled||String(batch?.className||'').includes('is-disabled'),rect:rect(batch)},
    panelOpen:!!panel,
    pageRadio:{
      found:!!pageRadio,
      checked:!!pageInput?.checked || String(pageRadio?.className||'').includes('is-checked'),
      rect:rect(pageRadioClick)
    },
    pageInputs:pageInputs.map(input=>({
      value:String(input.value||''),
      disabled:!!input.disabled,
      rect:rect(input)
    })),
    checks
  };
})())
"""
    return json.loads(chrome_js(js))


def click_review_rect(rect: Any) -> None:
    if not isinstance(rect, list) or len(rect) != 4 or rect[2] <= 0 or rect[3] <= 0:
        raise RuntimeError(f"Invalid review control rectangle: {rect}")
    mac_click_dom_point(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2)


def close_review_settings_panel_dom() -> dict[str, Any]:
    """Hide the Store Insight review download popover when normal clicks leave it open."""
    js = r"""
JSON.stringify((()=>{
  const visible=(e)=>{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&s.pointerEvents!=='none';
  };
  const rect=(e)=>{
    if(!e) return null;
    const r=e.getBoundingClientRect();
    return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];
  };
  const isReviewPanel=(p)=>(p.innerText||'').includes('下载范围')&&(p.innerText||'').includes('下载内容');
  const panels=[...document.querySelectorAll('.el-popper,.el-popover,[role="tooltip"]')]
    .filter(visible)
    .filter(isReviewPanel);
  const before=panels.map(p=>({text:(p.innerText||'').slice(0,80),rect:rect(p)}));
  for(const panel of panels) {
    panel.dataset.codexHiddenReviewSettings = '1';
    panel.style.display = 'none';
    panel.style.visibility = 'hidden';
    panel.style.pointerEvents = 'none';
    panel.setAttribute('aria-hidden','true');
  }
  const after=[...document.querySelectorAll('.el-popper,.el-popover,[role="tooltip"]')]
    .filter(visible)
    .filter(isReviewPanel)
    .map(p=>({text:(p.innerText||'').slice(0,80),rect:rect(p)}));
  return {ok:true,hidden:before.length,before,after,panelOpenAfter:after.length>0};
})())
"""
    return json.loads(chrome_js(js))


def open_review_settings_panel() -> dict[str, Any]:
    js = r"""
JSON.stringify((()=>{
  const visible=(e)=>{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
  };
  const dialog=[...document.querySelectorAll('.el-dialog')]
    .find(e=>visible(e)&&(e.innerText||'').includes('商品评价')&&(e.innerText||'').includes('评价/买家秀下载'));
  if(!dialog) return {error:'NO_REVIEW_DIALOG'};
  const reference=[...dialog.querySelectorAll('.el-popover__reference')]
    .find(e=>(e.innerText||'').includes('下载设置'));
  if(!reference) return {error:'NO_SETTINGS_REFERENCE'};
  const r=reference.getBoundingClientRect();
  const cx=r.x+r.width/2;
  const cy=r.y+r.height/2;
  for(const type of ['pointerdown','mousedown','pointerup','mouseup','click']) {
    reference.dispatchEvent(new MouseEvent(type,{
      bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy
    }));
  }
  return {ok:true,rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]};
})())
"""
    return json.loads(chrome_js(js))


def set_review_page_range_dom(start_page: int, end_page: int) -> dict[str, Any]:
    js = f"""
JSON.stringify((()=>{{
  const startPage = {int(start_page)};
  const endPage = {int(end_page)};
  const visible=(e)=>{{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
  }};
  const compact=(text)=>String(text||'').trim().replace(/\\s+/g,'');
  const clickNode=(e)=>{{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const cx=r.x+r.width/2;
    const cy=r.y+r.height/2;
    try {{ e.click(); }} catch (_) {{}}
    for (const type of ['pointerover','mouseover','pointerdown','mousedown','pointerup','mouseup','click']) {{
      e.dispatchEvent(new MouseEvent(type,{{bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy}}));
    }}
    return true;
  }};
  const setInputValue=(input,value)=>{{
    input.focus();
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
    if(setter) setter.call(input, String(value));
    else input.value=String(value);
    input.dispatchEvent(new InputEvent('input',{{bubbles:true,cancelable:true,inputType:'insertText',data:String(value)}}));
    input.dispatchEvent(new Event('change',{{bubbles:true,cancelable:true}}));
    input.blur();
  }};
  const panels=[...document.querySelectorAll('.el-popper,.el-popover,[role="tooltip"]')].filter(visible);
  const panel=panels.find(p=>(p.innerText||'').includes('下载范围')&&(p.innerText||'').includes('下载内容'));
  if(!panel) return {{error:'NO_SETTINGS_PANEL'}};
  const radioInputs=[...panel.querySelectorAll('input[type="radio"]')];
  const pageTextNode=[...panel.querySelectorAll('span,div,label')]
    .filter(visible)
    .find(e=>compact(e.innerText||e.textContent).includes('按页数:第') || compact(e.innerText||e.textContent).includes('按页数第'));
  const pageRadio=pageTextNode?.closest('label,.el-radio') ||
    (radioInputs.find(input=>String(input.value||'').toLowerCase().includes('page'))?.closest('label,.el-radio')) ||
    (radioInputs.length>=2 ? radioInputs[1].closest('label,.el-radio') : null);
  if(!pageRadio) return {{error:'NO_PAGE_RANGE_RADIO'}};
  const pageInput=pageRadio.querySelector('input[type="radio"]') || null;
  if(!pageInput?.checked && !String(pageRadio.className||'').includes('is-checked')) {{
    if(pageInput) {{
      try {{ pageInput.click(); }} catch (_) {{}}
      try {{ pageInput.checked = true; }} catch (_) {{}}
      pageInput.dispatchEvent(new Event('input',{{bubbles:true,cancelable:true}}));
      pageInput.dispatchEvent(new Event('change',{{bubbles:true,cancelable:true}}));
    }}
    clickNode(pageRadio.querySelector('.el-radio__input') || pageRadio);
    clickNode(pageRadio);
  }}
  const inputs=[...panel.querySelectorAll('input.el-input__inner,input[type="text"],input[type="number"]')]
    .filter(visible)
    .slice(0,2);
  if(inputs.length<2) return {{error:'NO_PAGE_INPUTS', radioChecked:!!pageInput?.checked}};
  if(inputs.some(input=>input.disabled)) return {{
    error:'PAGE_INPUTS_DISABLED',
    radioChecked:!!pageInput?.checked || String(pageRadio.className||'').includes('is-checked'),
    inputs:inputs.map(input=>({{value:input.value,disabled:input.disabled}}))
  }};
  setInputValue(inputs[0], startPage);
  setInputValue(inputs[1], endPage);
  return {{
    ok:true,
    radioChecked:!!pageInput?.checked || String(pageRadio.className||'').includes('is-checked'),
    inputs:inputs.map(input=>({{value:input.value,disabled:input.disabled}}))
  }};
}})())
"""
    return json.loads(chrome_js(js))


def set_review_filter_default_dom(want: bool = True) -> dict[str, Any]:
    js = f"""
JSON.stringify((()=>{{
  const want = {str(bool(want)).lower()};
  const visible=(e)=>{{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
  }};
  const compact=(text)=>String(text||'').trim().replace(/\\s+/g,'');
  const clickNode=(e)=>{{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const cx=r.x+r.width/2;
    const cy=r.y+r.height/2;
    for (const type of ['pointerover','mouseover','pointerdown','mousedown','pointerup','mouseup','click']) {{
      e.dispatchEvent(new MouseEvent(type,{{bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy}}));
    }}
    return true;
  }};
  const dialog=[...document.querySelectorAll('.el-dialog')]
    .find(e=>visible(e)&&(e.innerText||'').includes('商品评价')&&(e.innerText||'').includes('评价/买家秀下载'));
  if(!dialog) return {{error:'NO_REVIEW_DIALOG'}};
  const label=[...dialog.querySelectorAll('span,div,label')]
    .filter(visible)
    .find(e=>compact(e.innerText||e.textContent)==='过滤默认评价');
  const switches=[...dialog.querySelectorAll('.el-switch')].filter(visible);
  let target=null;
  if(label) {{
    const lr=label.getBoundingClientRect();
    target=switches.map(e=>{{
      const r=e.getBoundingClientRect();
      return {{e,score:Math.abs((r.x+r.width/2)-(lr.right+22))+Math.abs((r.y+r.height/2)-(lr.y+lr.height/2))*4}};
    }}).sort((a,b)=>a.score-b.score)[0]?.e || null;
  }}
  target=target || switches[0] || null;
  if(!target) return {{error:'NO_FILTER_SWITCH'}};
  const input=target.querySelector('input[type="checkbox"]');
  const before=!!input?.checked || String(target.className||'').includes('is-checked');
  if(before !== want) clickNode(target);
  const after=!!input?.checked || String(target.className||'').includes('is-checked');
  return {{ok:true,before,after,want}};
}})())
"""
    return json.loads(chrome_js(js))


def ensure_review_filter_default(logger: Logger, args: Optional[argparse.Namespace] = None) -> dict[str, Any]:
    """Ensure 店透视评论弹窗启用「过滤默认评价」."""
    try:
        state = review_download_control_state()
        filter_state = state.get("filter") or {}
        if state.get("error"):
            return {"ok": False, "error": state.get("error"), "state": state}
        if not filter_state.get("found"):
            return {"ok": False, "error": "NO_FILTER_DEFAULT_REVIEW_SWITCH", "state": state}
        if filter_state.get("checked"):
            result = {"ok": True, "filter_default_review": True, "changed": False}
            logger.log(json.dumps({"review_filter_default": result}, ensure_ascii=False, indent=2))
            return result
        forced = set_review_filter_default_dom(True)
        time.sleep(diantoushi_click_settle(args))
        state = review_download_control_state()
        checked = bool((state.get("filter") or {}).get("checked"))
        result = {
            "ok": checked,
            "filter_default_review": checked,
            "changed": True,
            "force_result": forced,
        }
        if not checked:
            result["error"] = "FILTER_DEFAULT_REVIEW_NOT_ENABLED"
            result["state"] = state
        logger.log(json.dumps({"review_filter_default": result}, ensure_ascii=False, indent=2))
        return result
    except Exception as exc:
        result = {"ok": False, "error": str(exc)}
        logger.log(json.dumps({"review_filter_default": result}, ensure_ascii=False, indent=2))
        return result


def select_review_all_loaded_rows_dom(logger: Logger) -> dict[str, Any]:
    """Click the review table header checkbox so 店透视 downloads selected loaded comments."""
    logger.section("select all loaded review rows")
    js = r"""
JSON.stringify((()=>{
  const visible=(e)=>{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
  };
  const rect=(e)=>{
    if(!e) return null;
    const r=e.getBoundingClientRect();
    return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];
  };
  const clickNode=(e)=>{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const cx=r.x+r.width/2;
    const cy=r.y+r.height/2;
    for(const type of ['pointerover','mouseover','pointerdown','mousedown','pointerup','mouseup','click']) {
      e.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy}));
    }
    return true;
  };
  const dialog=[...document.querySelectorAll('.el-dialog')]
    .find(e=>visible(e)&&(e.innerText||'').includes('商品评价')&&(e.innerText||'').includes('评价/买家秀下载'));
  if(!dialog) return {ok:false,error:'NO_REVIEW_DIALOG'};
  const table=[...dialog.querySelectorAll('.el-table')].find(t=>{
    const text=t.innerText||'';
    return text.includes('旺旺号') && text.includes('初评') && text.includes('初评时间');
  });
  if(!table) return {ok:false,error:'NO_REVIEW_TABLE'};
  const totalMatch=(dialog.innerText||'').match(/当前表格中共有\s*(\d+)\s*条数据/);
  const declaredTotal=totalMatch ? Number(totalMatch[1]) : null;
  const headerCheckbox =
    table.querySelector('.el-table__header-wrapper th .el-checkbox') ||
    table.querySelector('.el-table__header-wrapper .el-checkbox') ||
    table.querySelector('thead .el-checkbox');
  if(!headerCheckbox) return {ok:false,error:'NO_HEADER_SELECT_ALL_CHECKBOX',declaredTotal};
  const before={
    checked:String(headerCheckbox.className||'').includes('is-checked') ||
      !!headerCheckbox.querySelector('input[type="checkbox"]')?.checked,
    indeterminate:String(headerCheckbox.className||'').includes('is-indeterminate'),
    rect:rect(headerCheckbox)
  };
  if(!before.checked) {
    clickNode(headerCheckbox.querySelector('.el-checkbox__input') || headerCheckbox);
  }
  const bodyRows=[...table.querySelectorAll('.el-table__body-wrapper tbody tr.el-table__row, .el-table__body-wrapper tbody tr')]
    .filter(visible);
  const selectedRows=bodyRows.filter(row=>{
    const checkbox=row.querySelector('.el-checkbox');
    return checkbox && (String(checkbox.className||'').includes('is-checked') ||
      !!checkbox.querySelector('input[type="checkbox"]')?.checked);
  }).length;
  const after={
    checked:String(headerCheckbox.className||'').includes('is-checked') ||
      !!headerCheckbox.querySelector('input[type="checkbox"]')?.checked,
    indeterminate:String(headerCheckbox.className||'').includes('is-indeterminate'),
    rect:rect(headerCheckbox)
  };
  return {
    ok: after.checked || selectedRows > 0,
    clicked: !before.checked,
    declaredTotal,
    visibleRows: bodyRows.length,
    selectedRows,
    before,
    after
  };
})())
"""
    result = json.loads(chrome_js(js))
    logger.log(json.dumps({"review_select_all_loaded": result}, ensure_ascii=False, indent=2))
    return result


def configure_review_download_content_native(logger: Logger, args: Optional[argparse.Namespace] = None) -> dict[str, Any]:
    """Configure review export content without requiring page-range controls."""
    logger.section("configure review download content native")
    state = review_download_control_state()
    logger.log(json.dumps({"review_content_before": state}, ensure_ascii=False, indent=2))
    if state.get("error"):
        return state

    if not state.get("panelOpen"):
        settings_state = state.get("settings") or {}
        if not settings_state.get("found"):
            return {"error": "NO_SETTINGS_BUTTON", "state": state}
        click_review_rect(settings_state.get("rect"))
        time.sleep(diantoushi_click_settle(args))
        state = review_download_control_state()
        logger.log(json.dumps({"review_content_settings_open": {
            "panelOpen": bool(state.get("panelOpen")),
            "state_error": state.get("error"),
        }}, ensure_ascii=False, indent=2))
    if not state.get("panelOpen"):
        return {"error": "SETTINGS_PANEL_DID_NOT_OPEN", "state": state}

    desired_checks = {
        "评价文字": True,
        "Excel数据": True,
        "晒图": False,
        "视频": False,
    }
    for check in state.get("checks") or []:
        wanted = desired_checks.get(str(check.get("text")))
        if wanted is None or not check.get("found") or bool(check.get("checked")) == wanted:
            continue
        click_review_rect(check.get("rect"))
        time.sleep(diantoushi_click_settle(args))
        state = review_download_control_state()

    actual_checks = {
        str(check.get("text")): bool(check.get("checked"))
        for check in state.get("checks") or []
        if check.get("found")
    }
    mismatches = {
        key: {"expected": wanted, "actual": actual_checks.get(key)}
        for key, wanted in desired_checks.items()
        if actual_checks.get(key) is not wanted
    }
    result = {
        "ok": not mismatches,
        "selected_rows_mode": True,
        "checks": actual_checks,
        "mismatches": mismatches,
    }
    if mismatches:
        result["error"] = "REVIEW_CONTENT_CHECKS_NOT_APPLIED"
    logger.log(json.dumps({"review_content_configured": result}, ensure_ascii=False, indent=2))
    return result


def configure_review_download_settings_native(logger: Logger, args: argparse.Namespace) -> dict[str, Any]:
    """Configure review export with native clicks and verify every resulting state."""
    logger.section("configure review download settings native")
    want_pages = max(1, int(args.review_pages))
    state = review_download_control_state()
    logger.log(json.dumps({"review_native_before": state}, ensure_ascii=False, indent=2))
    if state.get("error"):
        return state

    if not state.get("panelOpen"):
        settings_state = state.get("settings") or {}
        if not settings_state.get("found"):
            return {"error": "NO_SETTINGS_BUTTON", "state": state}
        try:
            click_review_rect(settings_state.get("rect"))
            time.sleep(diantoushi_click_settle(args))
            state = review_download_control_state()
            logger.log(json.dumps({"review_settings_open_native": {
                "panelOpen": bool(state.get("panelOpen")),
                "state_error": state.get("error"),
            }}, ensure_ascii=False, indent=2))
        except Exception as exc:
            logger.log(json.dumps({"review_settings_open_native": {"error": str(exc)}}, ensure_ascii=False, indent=2))
    if not state.get("panelOpen"):
        settings_state = state.get("settings") or {}
        if not settings_state.get("found"):
            return {"error": "NO_SETTINGS_BUTTON_AFTER_NATIVE_OPEN", "state": state}
        opened = open_review_settings_panel()
        logger.log(json.dumps({"review_settings_open": opened}, ensure_ascii=False, indent=2))
        time.sleep(diantoushi_click_settle(args))
        state = review_download_control_state()
    if not state.get("panelOpen"):
        settings_state = state.get("settings") or {}
        if settings_state.get("found"):
            try:
                click_review_rect(settings_state.get("rect"))
                time.sleep(diantoushi_click_settle(args))
                state = review_download_control_state()
                logger.log(json.dumps({"review_settings_open_native_retry": {
                    "panelOpen": bool(state.get("panelOpen")),
                    "state_error": state.get("error"),
                }}, ensure_ascii=False, indent=2))
            except Exception as exc:
                logger.log(json.dumps({"review_settings_open_native_retry": {"error": str(exc)}}, ensure_ascii=False, indent=2))
    if not state.get("panelOpen"):
        return {"error": "SETTINGS_PANEL_DID_NOT_OPEN", "state": state}

    page_radio = state.get("pageRadio") or {}
    if not page_radio.get("found"):
        return {"error": "NO_PAGE_RANGE_RADIO", "state": state}
    if not page_radio.get("checked"):
        forced = set_review_page_range_dom(1, want_pages)
        logger.log(json.dumps({"review_page_range_dom_select": forced}, ensure_ascii=False, indent=2))
        time.sleep(diantoushi_click_settle(args))
        state = review_download_control_state()
    if not (state.get("pageRadio") or {}).get("checked"):
        forced = set_review_page_range_dom(1, want_pages)
        logger.log(json.dumps({"review_page_range_force_select": forced}, ensure_ascii=False, indent=2))
        time.sleep(diantoushi_click_settle(args))
        state = review_download_control_state()

    page_inputs = state.get("pageInputs") or []
    if not (state.get("pageRadio") or {}).get("checked"):
        return {"error": "PAGE_RANGE_RADIO_NOT_SELECTED", "state": state}
    if len(page_inputs) < 2 or any(item.get("disabled") for item in page_inputs[:2]):
        return {"error": "PAGE_RANGE_INPUTS_NOT_ENABLED", "state": state}

    for item, value in zip(page_inputs[:2], ("1", str(want_pages))):
        click_review_rect(item.get("rect"))
        time.sleep(min(0.2, diantoushi_click_settle(args)))
        mac_replace_text(value)
        time.sleep(min(0.35, diantoushi_click_settle(args)))

    state = review_download_control_state()
    page_inputs = state.get("pageInputs") or []
    values = [str(item.get("value") or "") for item in page_inputs[:2]]
    if values != ["1", str(want_pages)]:
        forced = set_review_page_range_dom(1, want_pages)
        logger.log(json.dumps({"review_page_range_force_values": forced}, ensure_ascii=False, indent=2))
        time.sleep(diantoushi_click_settle(args))
        state = review_download_control_state()
        page_inputs = state.get("pageInputs") or []
        values = [str(item.get("value") or "") for item in page_inputs[:2]]
        if values != ["1", str(want_pages)]:
            return {
                "error": "PAGE_RANGE_VALUES_NOT_APPLIED",
                "expected": ["1", str(want_pages)],
                "actual": values,
                "state": state,
            }

    desired_checks = {
        "评价文字": True,
        "Excel数据": True,
        "晒图": False,
        "视频": False,
    }
    for check in state.get("checks") or []:
        wanted = desired_checks.get(str(check.get("text")))
        if wanted is None or not check.get("found") or bool(check.get("checked")) == wanted:
            continue
        click_review_rect(check.get("rect"))
        time.sleep(diantoushi_click_settle(args))
        state = review_download_control_state()

    actual_checks = {
        str(check.get("text")): bool(check.get("checked"))
        for check in state.get("checks") or []
        if check.get("found")
    }
    mismatches = {
        key: {"expected": wanted, "actual": actual_checks.get(key)}
        for key, wanted in desired_checks.items()
        if actual_checks.get(key) is not wanted
    }
    if mismatches:
        return {"error": "REVIEW_CONTENT_CHECKS_NOT_APPLIED", "mismatches": mismatches, "state": state}

    filter_state = state.get("filter") or {}
    if not filter_state.get("found"):
        return {"error": "NO_FILTER_DEFAULT_REVIEW_SWITCH", "state": state}
    if not filter_state.get("checked"):
        click_review_rect(filter_state.get("rect"))
        time.sleep(diantoushi_click_settle(args))
        state = review_download_control_state()
        if not (state.get("filter") or {}).get("checked"):
            forced_filter = set_review_filter_default_dom(True)
            logger.log(json.dumps({"review_filter_force_enable": forced_filter}, ensure_ascii=False, indent=2))
            time.sleep(diantoushi_click_settle(args))
            state = review_download_control_state()
            if not (state.get("filter") or {}).get("checked"):
                return {"error": "FILTER_DEFAULT_REVIEW_NOT_ENABLED", "state": state}

    result = {
        "ok": True,
        "filter_default_review": True,
        "page_range": [1, want_pages],
        "checks": actual_checks,
        "state": state,
    }
    logger.log(json.dumps({"review_native_configured": result}, ensure_ascii=False, indent=2))
    return result


def click_review_batch_download(logger: Logger, args: Optional[argparse.Namespace] = None) -> dict[str, Any]:
    logger.section("click review batch download")
    state = review_download_control_state()
    if state.get("error"):
        return state
    close_attempts: list[dict[str, Any]] = []
    if state.get("panelOpen"):
        settings = state.get("settings") or {}
        if settings.get("found"):
            click_review_rect(settings.get("rect"))
            time.sleep(diantoushi_click_settle(args))
            state = review_download_control_state()
            close_attempts.append({
                "method": "settings_toggle",
                "panelOpen": bool(state.get("panelOpen")),
            })
        if state.get("panelOpen"):
            try:
                dom_closed = close_review_settings_panel_dom()
                time.sleep(diantoushi_click_settle(args))
                state = review_download_control_state()
                close_attempts.append({
                    "method": "dom_hide_popover",
                    "result": dom_closed,
                    "panelOpen": bool(state.get("panelOpen")),
                })
            except Exception as exc:
                close_attempts.append({"method": "dom_hide_popover", "error": str(exc)})
        logger.log(json.dumps({"review_settings_panel_close_attempts": close_attempts}, ensure_ascii=False, indent=2))
        state = review_download_control_state()
    batch = state.get("batch") or {}
    if not batch.get("found"):
        return {"error": "NO_BATCH_DOWNLOAD_BUTTON", "state": state}
    if batch.get("disabled"):
        return {"error": "BATCH_DOWNLOAD_BUTTON_DISABLED", "state": state}
    click_review_rect(batch.get("rect"))
    time.sleep(diantoushi_click_settle(args))
    return {
        "clicked": "批量下载",
        "native_clicked": True,
        "rect": batch.get("rect"),
        "configured_page_range": True,
        "settings_panel_close_attempts": close_attempts,
        "panel_open_before_click": bool(state.get("panelOpen")),
    }


def is_xlsx_archive(path: Path) -> bool:
    try:
        if not zipfile.is_zipfile(path):
            return False
        with zipfile.ZipFile(path) as zf:
            names = set(zf.namelist())
        return "xl/workbook.xml" in names or any(name.startswith("xl/worksheets/") for name in names)
    except Exception:
        return False


def infer_review_download_suffix(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".xlsx", ".xls", ".csv", ".zip", ".tar", ".tgz", ".gz", ".rar"}:
        return suffix
    if is_xlsx_archive(path):
        return ".xlsx"
    try:
        if tarfile.is_tarfile(path):
            return ".tar"
    except Exception:
        pass
    try:
        if zipfile.is_zipfile(path):
            return ".zip"
    except Exception:
        pass
    return ".download"


def is_review_download_file(path: Path) -> bool:
    if not path.is_file() or path.suffix == ".crdownload":
        return False
    suffix = infer_review_download_suffix(path)
    if suffix in {".xlsx", ".xls", ".csv", ".zip", ".tar", ".tgz", ".gz", ".rar"}:
        return True
    return False


def wait_for_review_download(
    logger: Logger,
    before_downloads: dict[str, tuple[int, int]],
    timeout: int = 180,
    poll_interval: float = 2.0,
    stable_wait: float = 0.35,
) -> list[Path]:
    logger.section("wait review comments download")
    download_dir = Path.home() / "Downloads"
    deadline = time.time() + timeout
    latest: list[Path] = []
    while time.time() < deadline:
        current = download_snapshot(download_dir)
        new_paths = [Path(path) for path in current if path not in before_downloads]
        active = [path for path in new_paths if path.suffix == ".crdownload"]
        candidates = [path for path in new_paths if is_review_download_file(path)]
        stable: list[Path] = []
        for path in candidates:
            try:
                size_1 = path.stat().st_size
                time.sleep(stable_wait)
                size_2 = path.stat().st_size
            except FileNotFoundError:
                continue
            if size_1 > 0 and size_1 == size_2:
                stable.append(path)
        latest = sorted(stable, key=lambda p: p.stat().st_mtime, reverse=True)
        logger.log(json.dumps({
            "review_download_poll": {
                "new": [str(p) for p in new_paths[:12]],
                "candidate": [str(p) for p in candidates[:12]],
                "stable": [str(p) for p in latest[:12]],
                "active": [str(p) for p in active[:12]],
            }
        }, ensure_ascii=False, indent=2))
        if latest:
            return latest
        time.sleep(max(0.5, poll_interval))
    raise RuntimeError("Timed out waiting for review comments export")


def build_review_comments_payload_from_files(
    logger: Logger,
    target_dir: Path,
    product_id: str,
    downloaded_files: list[Path],
) -> dict[str, Any]:
    review_root = target_dir / "review_comments"
    raw_root = review_root / "raw_export"
    extracted_root = review_root / "extracted"
    if review_root.exists():
        shutil.rmtree(review_root)
    raw_root.mkdir(parents=True, exist_ok=True)
    extracted_root.mkdir(parents=True, exist_ok=True)

    raw_files: list[Path] = []
    extracted_files: list[Path] = []
    errors: list[dict[str, Any]] = []
    for index, source in enumerate(downloaded_files, start=1):
        suffix = infer_review_download_suffix(source)
        destination = unique_path(raw_root / f"{index:03d}-review-comments-{product_id}{suffix}")
        try:
            shutil.move(str(source), str(destination))
        except Exception:
            shutil.copy2(source, destination)
        raw_files.append(destination)
        try:
            if suffix == ".xlsx":
                extracted_files.append(destination)
            elif suffix == ".zip":
                extracted_files.extend(safe_extract_zip(destination, extracted_root / destination.stem))
            elif suffix in {".tar", ".tgz", ".gz"}:
                extracted_files.extend(safe_extract_tar(destination, extracted_root / destination.stem))
        except Exception as exc:
            errors.append({"file": str(destination), "error": str(exc)})

    workbook_files = [
        path for path in sorted(set(extracted_files + raw_files))
        if path.suffix.lower() in {".xlsx", ".xls", ".csv"} or is_xlsx_archive(path)
    ]
    payload = {
        "ok": bool(raw_files),
        "source": "diantoushi_review_comments_download",
        "product_id": product_id,
        "raw_files": [str(path) for path in raw_files],
        "extracted_files": [str(path) for path in extracted_files],
        "workbook_files": [str(path) for path in workbook_files],
        "raw_file_count": len(raw_files),
        "workbook_count": len(workbook_files),
        "errors": errors,
        "time": now_stamp(),
    }
    (target_dir / "review_comments.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.log(json.dumps({"review_comments": payload}, ensure_ascii=False, indent=2))
    return payload


def parse_review_clipboard_table(text: str) -> list[dict[str, str]]:
    lines = [line.rstrip("\r") for line in text.splitlines() if line.strip()]
    if not lines:
        return []
    tab_lines = [line for line in lines if "\t" in line]
    if not tab_lines:
        return []
    header_index = 0
    for index, line in enumerate(tab_lines[:8]):
        compact = line.replace("\t", "")
        if "旺旺号" in compact and "初评" in compact:
            header_index = index
            break
    headers = [cell.strip() for cell in tab_lines[header_index].split("\t")]
    headers = [header or f"字段{index + 1}" for index, header in enumerate(headers)]
    rows: list[dict[str, str]] = []
    for line in tab_lines[header_index + 1:]:
        cells = [cell.strip() for cell in line.split("\t")]
        if len(cells) < 2:
            continue
        row: dict[str, str] = {}
        for index, value in enumerate(cells):
            key = headers[index] if index < len(headers) else f"字段{index + 1}"
            row[key] = value
        if any(row.values()):
            rows.append(row)
    return rows


def extract_review_comments_table_dom(logger: Logger) -> dict[str, Any]:
    logger.section("extract review comments table dom fallback")
    js = r"""
JSON.stringify((()=>{
  const visible=(e)=>{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
  };
  const textOf=(e)=>(e.innerText||e.textContent||'').replace(/\s+/g,' ').trim();
  const dialog=[...document.querySelectorAll('.el-dialog')]
    .find(e=>visible(e)&&(e.innerText||'').includes('商品评价')&&(e.innerText||'').includes('评价/买家秀下载'));
  if(!dialog) return {ok:false,error:'NO_REVIEW_DIALOG'};

  const tables=[...dialog.querySelectorAll('.el-table')].filter(t=>{
    const text=t.innerText||'';
    return text.includes('旺旺号') && text.includes('初评') && text.includes('初评时间');
  });
    const candidates=tables.map((table, tableIndex)=>{
      const headers=[...table.querySelectorAll('.el-table__header-wrapper th')]
        .map(th=>textOf(th)).filter(Boolean);
      const rows=[...table.querySelectorAll('.el-table__body-wrapper tbody tr.el-table__row, .el-table__body-wrapper tbody tr')]
        .map((tr,rowIndex)=>{
        let cells=[...tr.querySelectorAll('td')].map(td=>textOf(td));
        if(cells.length>headers.length && cells[0]==='') cells=cells.slice(1);
        if(headers[0]==='序号' && /^第\d+页\s+\d+$/.test(cells[0]||'')) {
          const m=String(cells[0]).match(/(\d+)$/);
          cells[0]=m ? m[1] : cells[0];
        }
        if(cells.length>headers.length && cells[cells.length-1]==='下载') cells=cells.slice(0,headers.length);
        const row={};
        cells.forEach((value,i)=>{
          const key=headers[i] || `字段${i+1}`;
          row[key]=value;
        });
        row.__row_index=String(rowIndex+1);
        return row;
      })
      .filter(row=>Object.entries(row).some(([k,v])=>!k.startsWith('__') && String(v||'').trim()));
    const score=rows.length*10 + (headers.includes('初评') ? 5 : 0) + (headers.includes('旺旺号') ? 3 : 0);
    return {tableIndex, headers, rows, score};
  }).sort((a,b)=>b.score-a.score);

  let best=candidates[0];
  const scroll = best ? tables[best.tableIndex]?.querySelector('.el-table__body-wrapper') : null;
  const dialogBody = dialog.querySelector('.el-dialog__body') || dialog;
  const totalMatch = (dialog.innerText || '').match(/当前表格中共有\s*(\d+)\s*条数据/);
  const declaredTotal = totalMatch ? Number(totalMatch[1]) : null;
  if(!best || !best.rows.length) {
    const dialogText=(dialog.innerText||'').replace(/\r/g,'');
    return {ok:false,error:'NO_REVIEW_ROWS_IN_DOM', tableCount:tables.length, declaredTotal, dialogTextPreview:dialogText.slice(0,2000)};
  }

  const cleaned=best.rows.map(row=>{
    const out={};
    for(const [key,value] of Object.entries(row)) {
      if(key.startsWith('__')) continue;
      out[key]=String(value||'').trim();
    }
    return out;
  }).filter(row=>{
    const review=row['初评'] || row['评论'] || '';
    const nick=row['旺旺号'] || '';
    return review || nick;
  });

  const dialogText=(dialog.innerText||'').replace(/\r/g,'');
  return {
    ok: cleaned.length>0,
    row_count: cleaned.length,
    headers: best.headers,
    rows: cleaned,
    tableCount: tables.length,
    selectedTableIndex: best.tableIndex,
    declaredTotal,
    scroll: scroll ? {
      top: scroll.scrollTop,
      height: scroll.scrollHeight,
      clientHeight: scroll.clientHeight
    } : null,
    dialogScroll: dialogBody ? {
      top: dialogBody.scrollTop,
      height: dialogBody.scrollHeight,
      clientHeight: dialogBody.clientHeight
    } : null,
    dialogTextPreview: dialogText.slice(0,2000)
  };
})())
"""
    def collect_visible_rows() -> dict[str, Any]:
        return json.loads(chrome_js(js))

    first = collect_visible_rows()
    headers = [str(item) for item in first.get("headers") or []]
    declared_total = first.get("declaredTotal")
    rows_by_key: dict[str, dict[str, str]] = {}

    def add_rows(result: dict[str, Any]) -> None:
        nonlocal headers
        if not headers and result.get("headers"):
            headers = [str(item) for item in result.get("headers") or []]
        for row in result.get("rows") or []:
            key = "|".join(str(row.get(field, "")) for field in ("序号", "旺旺号", "初评时间", "SKU", "初评"))
            if not key.strip("|"):
                key = json.dumps(row, ensure_ascii=False, sort_keys=True)
            rows_by_key[key] = row

    add_rows(first)
    if first.get("ok"):
        last_scroll = None
        stable_steps = 0
        max_steps = 35
        for _ in range(max_steps):
            if declared_total and len(rows_by_key) >= int(declared_total):
                break
            scroll_info = first.get("scroll") or {}
            dialog_scroll = first.get("dialogScroll") or {}
            current = (
                int(scroll_info.get("top") or 0),
                int(scroll_info.get("height") or 0),
                int(scroll_info.get("clientHeight") or 0),
                int(dialog_scroll.get("top") or 0),
                int(dialog_scroll.get("height") or 0),
                int(dialog_scroll.get("clientHeight") or 0),
            )
            if current == last_scroll:
                stable_steps += 1
            else:
                stable_steps = 0
            last_scroll = current
            if stable_steps >= 2:
                break
            chrome_js(r"""
(() => {
  const visible=(e)=>{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
  };
  const dialog=[...document.querySelectorAll('.el-dialog')]
    .find(e=>visible(e)&&(e.innerText||'').includes('商品评价')&&(e.innerText||'').includes('评价/买家秀下载'));
  if(!dialog) return 'NO_DIALOG';
  const table=[...dialog.querySelectorAll('.el-table')].find(t=>{
    const text=t.innerText||'';
    return text.includes('旺旺号') && text.includes('初评') && text.includes('初评时间');
  });
  const body=table?.querySelector('.el-table__body-wrapper');
  const dialogBody=dialog.querySelector('.el-dialog__body') || dialog;
  if(body && body.scrollHeight > body.clientHeight) {
    body.scrollTop = Math.min(body.scrollTop + Math.max(180, Math.floor(body.clientHeight * 0.85)), body.scrollHeight);
    body.dispatchEvent(new Event('scroll', {bubbles:true}));
  } else if(dialogBody && dialogBody.scrollHeight > dialogBody.clientHeight) {
    dialogBody.scrollTop = Math.min(dialogBody.scrollTop + Math.max(180, Math.floor(dialogBody.clientHeight * 0.85)), dialogBody.scrollHeight);
    dialogBody.dispatchEvent(new Event('scroll', {bubbles:true}));
  }
  return 'OK';
})()
""")
            time.sleep(0.25)
            first = collect_visible_rows()
            add_rows(first)

    result = first
    if rows_by_key:
        result["ok"] = True
        result["headers"] = headers
        result["rows"] = list(rows_by_key.values())
        result["row_count"] = len(rows_by_key)
        result["declaredTotal"] = declared_total
    logger.log(json.dumps({"review_dom_table": {
        "ok": result.get("ok"),
        "row_count": result.get("row_count", 0),
        "declared_total": result.get("declaredTotal"),
        "headers": result.get("headers", []),
        "tableCount": result.get("tableCount", 0),
        "error": result.get("error"),
        "dialogTextPreview": result.get("dialogTextPreview", "")[:500],
    }}, ensure_ascii=False, indent=2))
    return result


def copy_review_comments_table(logger: Logger) -> dict[str, Any]:
    logger.section("copy review comments table fallback")
    try:
        subprocess.run(["pbcopy"], input="", text=True, check=False)
    except Exception as exc:
        logger.log(json.dumps({"review_clipboard_clear_failed": str(exc)}, ensure_ascii=False))

    js = r"""
JSON.stringify((()=>{
  const visible=(e)=>{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const s=getComputedStyle(e);
    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
  };
  const rect=(e)=>{
    if(!e) return null;
    const r=e.getBoundingClientRect();
    return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];
  };
  const clickNode=(e)=>{
    if(!e) return false;
    const r=e.getBoundingClientRect();
    const cx=r.x+r.width/2;
    const cy=r.y+r.height/2;
    try { e.click(); } catch (_) {}
    for (const type of ['pointerover','mouseover','pointerdown','mousedown','pointerup','mouseup','click']) {
      e.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy}));
    }
    return true;
  };
  const dialog=[...document.querySelectorAll('.el-dialog')]
    .find(e=>visible(e)&&(e.innerText||'').includes('商品评价')&&(e.innerText||'').includes('评价/买家秀下载'));
  if(!dialog) return {error:'NO_REVIEW_DIALOG'};
  const panels=[...document.querySelectorAll('.el-popper,.el-popover,[role="tooltip"]')].filter(visible);
  for(const panel of panels) {
    if((panel.innerText||'').includes('下载范围')&&(panel.innerText||'').includes('下载内容')) {
      panel.style.display='none';
      panel.style.visibility='hidden';
      panel.style.pointerEvents='none';
    }
  }
  const buttons=[...dialog.querySelectorAll('button,.el-button')]
    .filter(visible)
    .filter(e=>(e.innerText||e.textContent||'').trim()==='复制表格')
    .filter(e=>!e.disabled&&!String(e.className||'').includes('is-disabled'))
    .map(e=>({e,r:e.getBoundingClientRect()}))
    .sort((a,b)=>a.r.y-b.r.y || a.r.x-b.r.x);
  const button=buttons[0]?.e || null;
  if(!button) return {error:'NO_COPY_TABLE_BUTTON'};
  clickNode(button);
  return {ok:true,clicked:'复制表格',rect:rect(button),candidateCount:buttons.length};
})())
"""
    click_result = json.loads(chrome_js(js))
    logger.log(json.dumps({"review_copy_table_click": click_result}, ensure_ascii=False, indent=2))
    if click_result.get("error"):
        return click_result
    time.sleep(1.2)
    paste = subprocess.run(["pbpaste"], text=True, capture_output=True, check=False)
    text = paste.stdout or ""
    rows = parse_review_clipboard_table(text)
    result = {
        "ok": bool(rows),
        "row_count": len(rows),
        "clipboard_chars": len(text),
        "clipboard_preview": text[:500],
        "rows": rows,
    }
    logger.log(json.dumps({"review_clipboard_table": {
        "ok": result["ok"],
        "row_count": result["row_count"],
        "clipboard_chars": result["clipboard_chars"],
        "clipboard_preview": result["clipboard_preview"],
    }}, ensure_ascii=False, indent=2))
    return result


def build_review_comments_payload_from_clipboard(
    logger: Logger,
    target_dir: Path,
    product_id: str,
    fallback_reason: str,
) -> dict[str, Any]:
    filter_default_review = None
    try:
        state = review_download_control_state()
        filter_state = state.get("filter") or {}
        if filter_state.get("found") and not filter_state.get("checked"):
            forced_filter = set_review_filter_default_dom(True)
            logger.log(json.dumps({"review_fallback_filter_force_enable": forced_filter}, ensure_ascii=False, indent=2))
            time.sleep(0.8)
            state = review_download_control_state()
            filter_state = state.get("filter") or {}
        filter_default_review = bool(filter_state.get("checked")) if filter_state.get("found") else None
    except Exception as exc:
        logger.log(json.dumps({"review_fallback_filter_check_failed": str(exc)}, ensure_ascii=False, indent=2))
    dom_result = extract_review_comments_table_dom(logger)
    copied = dom_result if dom_result.get("ok") else copy_review_comments_table(logger)
    review_root = target_dir / "review_comments"
    raw_root = review_root / "raw_export"
    raw_root.mkdir(parents=True, exist_ok=True)
    raw_text = ""
    raw_path = raw_root / f"review-comments-{product_id}.txt"
    if copied is dom_result and dom_result.get("ok"):
        headers = [str(header) for header in dom_result.get("headers") or []]
        rows = dom_result.get("rows") or []
        if not headers and rows:
            headers = list(rows[0].keys())
        raw_lines = ["\t".join(headers)] if headers else []
        for row in rows:
            raw_lines.append("\t".join(str(row.get(header, "")) for header in headers))
        raw_text = "\n".join(raw_lines)
    else:
        raw_text = str(copied.get("clipboard_preview") or "")
        raw_path = raw_root / f"clipboard-review-comments-{product_id}.txt"
    if copied.get("clipboard_chars", 0) > len(raw_text):
        paste = subprocess.run(["pbpaste"], text=True, capture_output=True, check=False)
        raw_text = paste.stdout or raw_text
    raw_path.write_text(raw_text, encoding="utf-8")
    payload = {
        "ok": bool(copied.get("ok")),
        "source": "diantoushi_review_comments_dom" if copied is dom_result and dom_result.get("ok") else "diantoushi_review_comments_clipboard",
        "product_id": product_id,
        "fallback_reason": fallback_reason,
        "raw_files": [str(raw_path)] if raw_text else [],
        "extracted_files": [],
        "workbook_files": [],
        "raw_file_count": 1 if raw_text else 0,
        "workbook_count": 0,
        "row_count": int(copied.get("row_count") or 0),
        "declared_total": copied.get("declaredTotal"),
        "filter_default_review": filter_default_review,
        "filter_note": "DOM兜底读取前会尽量开启店透视「过滤默认评价」。若为 null，表示没有识别到该开关。",
        "rows": copied.get("rows") or [],
        "time": now_stamp(),
    }
    if not payload["ok"]:
        payload["reason"] = copied.get("error") or dom_result.get("error") or "review_clipboard_copy_empty"
    (target_dir / "review_comments.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.log(json.dumps({"review_comments": payload}, ensure_ascii=False, indent=2))
    return payload


def export_review_comments(logger: Logger, args: argparse.Namespace, item_id: str, target_dir: Path) -> dict[str, Any]:
    if args.skip_reviews:
        return {"ok": False, "status": "skipped_by_arg", "product_id": item_id, "time": now_stamp()}
    open_review_dialog(logger, args)
    filter_result = ensure_review_filter_default(logger, args)
    select_all_result = select_review_all_loaded_rows_dom(logger)
    content_settings = configure_review_download_content_native(logger, args)
    if not select_all_result.get("ok"):
        logger.log(json.dumps({
            "review_select_all_warning": "未能点选表格全选，回退到按页数下载设置",
            "filter_result": filter_result,
            "select_all_result": select_all_result,
            "content_settings": content_settings,
        }, ensure_ascii=False, indent=2))
        settings = configure_review_download_settings_native(logger, args)
        if settings.get("error"):
            return build_review_comments_payload_from_clipboard(
                logger,
                target_dir,
                item_id,
                f"Could not configure selected-row or page-range review download: filter={filter_result}, select_all={select_all_result}, content={content_settings}, page={settings}",
            )
    elif not content_settings.get("ok"):
        logger.log(json.dumps({
            "review_content_settings_warning": "已点选评论表格全选，但下载内容设置未完全确认，继续尝试批量下载",
            "filter_result": filter_result,
            "select_all_result": select_all_result,
            "content_settings": content_settings,
        }, ensure_ascii=False, indent=2))
    run_guard(logger, "before review batch download")
    before_downloads = download_snapshot(Path.home() / "Downloads")
    click_result = click_review_batch_download(logger, args)
    logger.log(json.dumps({"review_batch_download_click": click_result}, ensure_ascii=False, indent=2))
    if click_result.get("error"):
        return build_review_comments_payload_from_clipboard(
            logger,
            target_dir,
            item_id,
            f"Could not click review batch download: {click_result}",
        )
    total_timeout = review_timeout_seconds(args)
    review_first_wait_floor = 10 if getattr(args, "speed_profile", "") == "fast" else 20
    review_retry_wait_floor = 30 if getattr(args, "speed_profile", "") == "fast" else 60
    first_wait = min(30 if getattr(args, "speed_profile", "") == "fast" else 45, max(review_first_wait_floor, total_timeout // 3))
    try:
        downloaded = wait_for_review_download(
            logger,
            before_downloads,
            timeout=first_wait,
            poll_interval=download_poll_interval(args),
            stable_wait=diantoushi_file_stable_wait(args),
        )
    except RuntimeError as first_exc:
        logger.log(json.dumps({
            "review_download_first_wait_failed": str(first_exc),
            "retry": "reclick_batch_download",
        }, ensure_ascii=False, indent=2))
        run_guard(logger, "before review batch download retry")
        before_retry = download_snapshot(Path.home() / "Downloads")
        retry_click = click_review_batch_download(logger, args)
        logger.log(json.dumps({"review_batch_download_retry_click": retry_click}, ensure_ascii=False, indent=2))
        if retry_click.get("error"):
            return build_review_comments_payload_from_clipboard(
                logger,
                target_dir,
                item_id,
                f"Could not click review batch download on retry: {retry_click}",
            )
        try:
            downloaded = wait_for_review_download(
                logger,
                before_retry,
                timeout=max(review_retry_wait_floor, total_timeout - first_wait),
                poll_interval=download_poll_interval(args),
                stable_wait=diantoushi_file_stable_wait(args),
            )
        except RuntimeError as second_exc:
            return build_review_comments_payload_from_clipboard(
                logger,
                target_dir,
                item_id,
                f"Timed out waiting for review comments export: {second_exc}",
            )
    return build_review_comments_payload_from_files(logger, target_dir, item_id, downloaded)


def collect_exports(logger: Logger, product_name: str, item_id: str, since_epoch: float) -> Path:
    logger.section("collect exports")
    result = run_process(
        [
            sys.executable,
            str(COLLECT_EXPORTS),
            "--product-name",
            product_name,
            "--item-id",
            item_id,
            "--since-epoch",
            str(since_epoch),
        ],
        logger,
        check=False,
    )
    objects = extract_json_objects(result.stdout)
    if not objects:
        raise RuntimeError("collect_exports did not return JSON summary")
    summary = objects[-1]
    target_dir = Path(summary["target_dir"])
    shutil.copy2(logger.path, target_dir / "run.log")
    return target_dir


def mysql_import_env() -> dict[str, str]:
    # 不注入 localhost 默认值，让 mysql-import skill 的 .env 决定目标库
    return os.environ.copy()


def maybe_import_mysql(logger: Logger, target_dir: Path) -> Optional[dict[str, Any]]:
    logger.section("mysql import")
    product_files = sorted(target_dir.glob("商品数据ID_*.xlsx"))
    sku_files = sorted(target_dir.glob("店透-SKU预览-表格-*.xlsx"))
    qa_files = sorted(target_dir.glob("店透视-问大家分析-*.xlsx"))
    # 只要有商品数据就入库：SKU/QA 缺失走 --allow-missing-* 容错
    if not product_files:
        result = {
            "ok": False,
            "status": "skipped_missing_files",
            "missing": ["product_file"],
            "target_dir": str(target_dir),
            "time": now_stamp(),
        }
        logger.log(json.dumps(result, ensure_ascii=False, indent=2))
        return result
    product_file = product_files[0]
    sku_file = sku_files[0] if sku_files else None
    qa_file = qa_files[0] if qa_files else None
    output_dir = target_dir / "cleaned_output"
    command = [
        sys.executable,
        str(MYSQL_IMPORT),
        "clean-and-load",
        "--product-file",
        str(product_file),
        "--output-dir",
        str(output_dir),
    ]
    if sku_file:
        command += ["--sku-file", str(sku_file)]
    else:
        command.append("--allow-missing-sku")
    if qa_file:
        command += ["--qa-file", str(qa_file)]
    else:
        command.append("--allow-missing-qa")
    result = run_process(command, logger, env=mysql_import_env())
    objects = extract_json_objects(result.stdout)
    import_result = objects[-1] if objects else None
    if isinstance(import_result, dict):
        import_result = {
            "ok": True,
            "status": "imported",
            "qa_file_present": bool(qa_file),
            "sku_file_present": bool(sku_file),
            **import_result,
        }
    return import_result


def maybe_run_market_analysis(logger: Logger, args: argparse.Namespace, output_root: Path, limit: int) -> Optional[dict[str, Any]]:
    if not args.analyze_after_import:
        return None
    logger.section("market analysis after import")
    if not args.import_mysql:
        result = {
            "ok": False,
            "status": "skipped_import_mysql_disabled",
            "message": "--analyze-after-import requires --import-mysql so the latest downloaded data is available in MySQL.",
            "time": now_stamp(),
        }
        logger.log(json.dumps(result, ensure_ascii=False, indent=2))
        return result
    if not COMPETITOR_ANALYSIS.exists():
        result = {
            "ok": False,
            "status": "missing_competitor_analysis_script",
            "script": str(COMPETITOR_ANALYSIS),
            "time": now_stamp(),
        }
        logger.log(json.dumps(result, ensure_ascii=False, indent=2))
        return result

    analysis_dir = output_root / "market_analysis"
    analysis_dir.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable,
        str(COMPETITOR_ANALYSIS),
        "db-only",
        "--market-report",
        "--keyword",
        args.analysis_keyword or args.product_name,
        "--limit",
        str(max(1, int(args.analysis_limit or limit or args.top_n))),
        "--output-dir",
        str(analysis_dir),
        "--shipping-cost",
        str(args.analysis_shipping_cost),
        "--packaging-cost",
        str(args.analysis_packaging_cost),
        "--labor-cost",
        str(args.analysis_labor_cost),
        "--platform-fee-rate",
        str(args.analysis_platform_fee_rate),
        "--ad-fee-rate",
        str(args.analysis_ad_fee_rate),
        "--target-margin",
        str(args.analysis_target_margin),
        "--format",
        "both",
        "--save-to-db",
    ]
    if args.analysis_cost_price is not None:
        command += ["--cost-price", str(args.analysis_cost_price)]

    try:
        process = run_process(command, logger, env=mysql_import_env())
        objects = extract_json_objects(process.stdout)
        summary = objects[0] if objects else None
        save_result = objects[1] if len(objects) > 1 else None
        result = {
            "ok": True,
            "status": "analyzed_and_saved",
            "keyword": args.analysis_keyword or args.product_name,
            "limit": max(1, int(args.analysis_limit or limit or args.top_n)),
            "output_dir": str(analysis_dir),
            "summary": summary,
            "save_result": save_result,
            "time": now_stamp(),
        }
    except Exception as exc:
        result = {
            "ok": False,
            "status": "analysis_failed",
            "error": str(exc),
            "output_dir": str(analysis_dir),
            "time": now_stamp(),
        }
    (analysis_dir / "market_analysis_run.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.log(json.dumps({"market_analysis": result}, ensure_ascii=False, indent=2))
    return result


PROJECT_ROOT = Path(__file__).resolve().parents[3]
RPA_RUNS_ROOT = PROJECT_ROOT / "rpa_runs"


def make_master_dir(args: argparse.Namespace) -> Path:
    if args.master_dir:
        root = Path(args.master_dir).expanduser()
    else:
        price_parts = []
        if args.min_price is not None:
            price_parts.append(f"min{args.min_price:g}")
        if args.max_price is not None:
            price_parts.append(f"max{args.max_price:g}")
        price_suffix = "-" + "-".join(price_parts) if price_parts else ""
        root = RPA_RUNS_ROOT / f"店透视批量导出-{safe_name(args.product_name)}{price_suffix}-Top{args.top_n}-{fs_stamp()}"
    root.mkdir(parents=True, exist_ok=True)
    return root


def move_export_files_to_item_dir(
    logger: Logger,
    item_dir: Path,
    product_file: Path,
    sku_file: Optional[Path],
    ask_file: Optional[Path],
    summary: dict[str, Any],
) -> Path:
    item_dir.mkdir(parents=True, exist_ok=True)
    moved: dict[str, str] = {}
    for key, source in [("product_file", product_file), ("sku_file", sku_file), ("ask_file", ask_file)]:
        if source is None:
            continue
        destination = unique_path(item_dir / source.name)
        shutil.move(str(source), str(destination))
        moved[key] = str(destination)
    summary["files"] = moved
    (item_dir / "product_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.copy2(logger.path, unique_path(item_dir / "run.log"))
    return item_dir


def copy_generated_export_files_to_target(
    logger: Logger,
    target_dir: Path,
    product_file: Path,
    ask_file: Optional[Path],
) -> dict[str, Any]:
    target_dir.mkdir(parents=True, exist_ok=True)
    result: dict[str, Any] = {"ok": True, "files": {}, "missing": []}
    for key, source in [("product_file", product_file), ("ask_file", ask_file)]:
        if source is None:
            continue
        if not source.exists():
            result["ok"] = False
            result["missing"].append({"key": key, "source": str(source)})
            continue
        destination = target_dir / source.name
        if source.resolve() == destination.resolve():
            action = "already_in_target"
        elif destination.exists() and destination.stat().st_size == source.stat().st_size:
            action = "already_exists"
        else:
            destination = unique_path(destination) if destination.exists() else destination
            shutil.copy2(source, destination)
            action = "copied"
        result["files"][key] = {
            "action": action,
            "source": str(source),
            "destination": str(destination),
        }
    logger.log(json.dumps({"generated_exports_collected": result}, ensure_ascii=False, indent=2))
    return result


def move_product_page_images_to_target(logger: Logger, source_dir: Path, target_dir: Path) -> dict[str, Any]:
    source_json = source_dir / "product_page_images.json"
    source_images = source_dir / "product_page_images"
    if not source_json.exists():
        return {"ok": False, "reason": "missing_product_page_images_json", "source_dir": str(source_dir)}

    target_json = target_dir / "product_page_images.json"
    target_images = target_dir / "product_page_images"
    if target_json.exists():
        target_json.unlink()
    if target_images.exists():
        shutil.rmtree(target_images)

    shutil.move(str(source_json), str(target_json))
    if source_images.exists():
        shutil.move(str(source_images), str(target_images))

    result = {
        "ok": True,
        "json_file": str(target_json),
        "image_dir": str(target_images),
    }
    logger.log(json.dumps({"product_page_images_collected": result}, ensure_ascii=False, indent=2))
    return result


def move_review_comments_to_target(logger: Logger, source_dir: Path, target_dir: Path) -> dict[str, Any]:
    source_json = source_dir / "review_comments.json"
    source_reviews = source_dir / "review_comments"
    if not source_json.exists():
        return {"ok": False, "reason": "missing_review_comments_json", "source_dir": str(source_dir)}
    try:
        source_payload = json.loads(source_json.read_text(encoding="utf-8"))
    except Exception as exc:
        source_payload = {"ok": False, "reason": "invalid_review_comments_json", "error": str(exc)}

    target_json = target_dir / "review_comments.json"
    target_reviews = target_dir / "review_comments"
    if target_json.exists():
        target_json.unlink()
    if target_reviews.exists():
        shutil.rmtree(target_reviews)

    shutil.move(str(source_json), str(target_json))
    if source_reviews.exists():
        shutil.move(str(source_reviews), str(target_reviews))

    result = {
        "ok": bool(source_payload.get("ok")),
        "json_file": str(target_json),
        "review_dir": str(target_reviews),
        "raw_file_count": int(source_payload.get("raw_file_count") or 0),
        "workbook_count": int(source_payload.get("workbook_count") or 0),
    }
    if not result["ok"]:
        result["reason"] = source_payload.get("reason") or source_payload.get("error") or "review_comments_payload_not_ok"
    logger.log(json.dumps({"review_comments_collected": result}, ensure_ascii=False, indent=2))
    return result


# ---------------------------------------------------------------------------
# 店透视 DOM 直采模式（--scrape-mode dom，默认）
# 不再点击「导出表格/下载」等 UI 下载流程，而是直接读取店透视面板/弹窗里
# 已经渲染好的数据，本地生成与历史导出完全一致的 xlsx / review_comments.json。
# 失败时自动回退到旧版下载流程，保证可用性。
# ---------------------------------------------------------------------------


def scrape_mode(args: argparse.Namespace) -> str:
    return str(getattr(args, "scrape_mode", "dom") or "dom")


def _xml_escape(value: str) -> str:
    return (
        str(value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def write_xlsx(path: Path, sheet_name: str, headers: list[str], rows: list[list[str]]) -> Path:
    """Minimal zero-dependency xlsx writer (inline strings, openpyxl-readable)."""
    sheet_rows = [headers] + rows
    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    )
    for row in sheet_rows:
        sheet_xml += "<row>"
        for cell in row:
            sheet_xml += f'<c t="inlineStr"><is><t xml:space="preserve">{_xml_escape(cell)}</t></is></c>'
        sheet_xml += "</row>"
    sheet_xml += "</sheetData></worksheet>"
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheets><sheet name="{_xml_escape(sheet_name[:31])}" sheetId="1" r:id="rId1"/></sheets></workbook>'
    )
    wb_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        "</Relationships>"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("xl/workbook.xml", workbook)
        zf.writestr("xl/_rels/workbook.xml.rels", wb_rels)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return path


def _dialog_table_scrape_js(marker: str, header_needles: list[str]) -> str:
    return (
        r"""
JSON.stringify((()=>{
  const visible=(e)=>{ if(!e) return false; const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'; };
  const textOf=(e)=>(e.innerText||e.textContent||'').replace(/\s+/g,' ').trim();
  const dialog=[...document.querySelectorAll('.el-dialog')]
    .find(d=>visible(d)&&(d.innerText||'').includes(__MARKER__));
  if(!dialog) return {ok:false,error:'NO_DIALOG'};
  const needles=__NEEDLES__;
  const tables=[...dialog.querySelectorAll('.el-table')].filter(t=>{
    const text=t.innerText||'';
    return needles.every(n=>text.includes(n));
  });
  const candidates=tables.map((table,ti)=>{
    const headers=[...table.querySelectorAll('.el-table__header-wrapper th')]
      .map(th=>textOf(th)).filter(Boolean);
    const rows=[...table.querySelectorAll('.el-table__body-wrapper tbody tr')]
      .map((tr)=>{
        const cells=[...tr.querySelectorAll('td')].map(td=>{
          const img=td.querySelector('img');
          return {text:textOf(td), img:(img&&img.src)||''};
        });
        return cells;
      })
      .filter(cells=>cells.some(c=>c.text||c.img));
    return {ti,headers,rows,score:rows.length*10};
  }).sort((a,b)=>b.score-a.score);
  const best=candidates[0];
  if(!best) return {ok:false,error:'NO_TABLE',tableCount:tables.length,dialogText:(dialog.innerText||'').slice(0,1500)};
  if(!best.rows.length) return {ok:true,empty:true,headers:best.headers,rows:[],dialogText:(dialog.innerText||'').slice(0,1500)};
  const pagination=[...dialog.querySelectorAll('.el-pagination .btn-next, .el-pagination button')].filter(visible)
    .map(b=>({cls:String(b.className||''),disabled:b.disabled||String(b.className||'').includes('is-disabled')}));
  return {ok:true,headers:best.headers,rows:best.rows,hasPagination:pagination.length>0};
})())
"""
        .replace("__MARKER__", json.dumps(marker, ensure_ascii=False))
        .replace("__NEEDLES__", json.dumps(header_needles, ensure_ascii=False))
    )


_DIALOG_NEXT_PAGE_JS = r"""
JSON.stringify((()=>{
  const visible=(e)=>{ if(!e) return false; const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'; };
  const dialog=[...document.querySelectorAll('.el-dialog')]
    .find(d=>visible(d)&&(d.innerText||'').includes(__MARKER__));
  if(!dialog) return {clicked:false,error:'NO_DIALOG'};
  const btns=[...dialog.querySelectorAll('.el-pagination .btn-next, .el-pagination button')]
    .filter(visible)
    .filter(b=>!b.disabled&&!String(b.className||'').includes('is-disabled'));
  const next=btns.filter(b=>{
    const cls=String(b.className||'');
    const text=(b.innerText||b.getAttribute('aria-label')||'').trim();
    return cls.includes('btn-next')||text.includes('下一页')||cls.includes('arrow-right');
  }).pop();
  if(!next) return {clicked:false,reason:'NO_NEXT_BUTTON'};
  next.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
  next.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  next.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  next.click();
  return {clicked:true};
})())
""".replace("__MARKER__", "{}")


def _click_dialog_next_page(marker: str) -> dict[str, Any]:
    js = _DIALOG_NEXT_PAGE_JS.replace("{}", json.dumps(marker, ensure_ascii=False), 1)
    try:
        return json.loads(chrome_js(js))
    except Exception as exc:
        return {"clicked": False, "error": str(exc)}


def scrape_dialog_table_paginated(
    logger: Logger,
    marker: str,
    header_needles: list[str],
    max_pages: int = 30,
) -> dict[str, Any]:
    """Read all rows of an Element UI table inside a 店透视 dialog, following pagination."""
    seen: dict[str, list[dict[str, str]]] = {}
    headers: list[str] = []
    last_result: dict[str, Any] = {}
    for _ in range(max_pages):
        result = json.loads(chrome_js(_dialog_table_scrape_js(marker, header_needles)))
        last_result = result
        if result.get("error"):
            return {"ok": False, **result}
        if not headers and result.get("headers"):
            headers = [str(h) for h in result.get("headers") or []]
        added = 0
        for cells in result.get("rows") or []:
            key = "|".join(str(c.get("text", "")) for c in cells)
            if not key.strip("|"):
                key = json.dumps(cells, ensure_ascii=False, sort_keys=True)
            if key not in seen:
                seen[key] = cells
                added += 1
        if not result.get("hasPagination"):
            break
        click = _click_dialog_next_page(marker)
        if not click.get("clicked") or added == 0:
            break
        time.sleep(1.2)
    return {
        "ok": bool(seen),
        "empty": not seen and not last_result.get("error"),
        "headers": headers,
        "rows": list(seen.values()),
        "pages_seen": len(seen),
        "last": last_result,
    }


_TOOLBAR_STATS_JS = r"""
JSON.stringify((()=>{
  const textOf=(e)=>(e.innerText||e.textContent||'').replace(/\s+/g,' ').trim();
  const vis=(e)=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
  const items=[...document.querySelectorAll('*')].filter(e=>{
    if(!vis(e)) return false;
    const r=e.getBoundingClientRect();
    if(r.width>1300||r.height>260) return false;
    const cls=String(e.className||'');
    const t=textOf(e);
    return /item-value|toolbar-component-slot|toolbar-track|plain-hover|goods-image-download/i.test(cls) ||
      t==='商品数据' || t==='SKU预览' || t==='问大家' ||
      (t.includes('SKU数')&&t.includes('已售')&&t.includes('销售额约')) ||
      (t.includes('商品数据')&&t.includes('SKU预览')&&t.includes('问大家'));
  });
  let root=null;
  for(const el of items){
    let p=el;
    for(let i=0;i<8&&p;i++){
      if(!p) break;
      const t=textOf(p);
      if(
        (t.includes('商品数据')&&t.includes('SKU预览')&&t.includes('问大家')) ||
        (t.includes('SKU数')&&t.includes('已售')&&t.includes('销售额约'))
      ){
        if(!root||t.length<textOf(root).length) root=p;
        break;
      }
      p=p.parentElement;
    }
  }
  if(!root) return {ok:false,error:'NO_TOOLBAR',title:document.title||''};
  const h1=document.querySelector('h1');
  const shopSels=['.slogo-shopname','[class*="shopName"]','[class*="shop-name"]','.tb-shop-name','a[href*="shop"][class*="name"]'];
  let shop='';
  for(const sel of shopSels){
    const e=document.querySelector(sel);
    if(e&&textOf(e)){ shop=textOf(e).slice(0,60); break; }
  }
  return {
    ok:true,
    toolbarText:textOf(root).slice(0,3000),
    title:(h1&&textOf(h1)?textOf(h1):document.title||'').slice(0,220),
    shop
  };
})())
"""

_TOOLBAR_STAT_LABELS = ["已售", "销售额约", "评价", "收藏", "问大家", "付款人数", "月收货", "SKU数"]


def _parse_toolbar_stats(text: str) -> dict[str, str]:
    stats: dict[str, str] = {}
    for label in _TOOLBAR_STAT_LABELS:
        match = re.search(re.escape(label) + r"[：:\s]*¥?\s*([0-9][0-9.,万千+\-]*)", text)
        if match:
            stats[label] = match.group(1)
    return stats


def _clean_page_title(title: str) -> str:
    text = str(title or "").strip()
    for suffix in ("-淘宝网", "-tmall.com", "-天猫", "_淘宝网"):
        if text.endswith(suffix):
            text = text[: -len(suffix)].strip("-_ ")
    return text


def export_product_data_dom(logger: Logger, args: argparse.Namespace, item_id: str) -> Path:
    """商品数据：直接读店透视工具栏统计 + 页面标题/店铺，生成与历史导出一致的 xlsx。"""
    run_guard(logger, "before dom product scrape")
    logger.section("dom scrape product data")
    state = json.loads(chrome_js(_TOOLBAR_STATS_JS))
    logger.log(json.dumps({"toolbar_scrape": state}, ensure_ascii=False, indent=2))
    if not state.get("ok"):
        raise RuntimeError(f"DOM scrape toolbar not found: {state}")
    stats = _parse_toolbar_stats(str(state.get("toolbarText") or ""))
    title = _clean_page_title(str(state.get("title") or ""))
    shop = str(state.get("shop") or "")
    category = ""
    cat_match = re.search(r"([^\s]{2,40}(?:>[^\s]{2,40}){1,4})", str(state.get("toolbarText") or ""))
    if cat_match:
        category = cat_match.group(1)
    headers = ["店铺名称", "店铺类型", "商品标题", "商品ID", "类目", "上架", "SKU数", "已售", "销售额约", "评价", "收藏", "问大家", "付款人数", "月收货"]
    row = [
        shop,
        "",
        title,
        item_id,
        category,
        "",
        stats.get("SKU数", ""),
        stats.get("已售", ""),
        stats.get("销售额约", ""),
        stats.get("评价", ""),
        stats.get("收藏", ""),
        stats.get("问大家", ""),
        stats.get("付款人数", ""),
        stats.get("月收货", ""),
    ]
    if not title:
        raise RuntimeError(f"DOM scrape product title empty: {state}")
    target = logger.path.parent / f"商品数据ID_{item_id}_{datetime.now().strftime('%Y-%m-%d')}.xlsx"
    write_xlsx(target, "商品数据", headers, [row])
    logger.log(f"dom product xlsx written: {target}")
    return target


def export_sku_dom(logger: Logger, args: argparse.Namespace, item_id: str) -> tuple[Path, str, bool]:
    """SKU：打开 SKU预览 弹窗后直接读表格，生成与历史导出一致的 xlsx。"""
    open_sku_dialog(logger, args)
    logger.section("dom scrape sku table")
    # SKU 数据在弹窗打开后异步加载，轮询等待表格出现（最多 25 秒）
    scraped: dict[str, Any] = {}
    deadline = time.time() + 25.0
    while time.time() < deadline:
        scraped = scrape_dialog_table_paginated(logger, "SKU预览", ["价格"])
        if scraped.get("ok") and not scraped.get("empty"):
            break
        time.sleep(2.5)
    logger.log(json.dumps({"sku_scrape_rows": scraped.get("pages_seen", 0), "headers": scraped.get("headers")}, ensure_ascii=False))
    if not scraped.get("ok"):
        raise RuntimeError(f"DOM scrape SKU table failed: {scraped}")
    headers = scraped.get("headers") or []
    raw_rows = scraped.get("rows") or []

    def col(cells: list[dict[str, str]], needles: list[str]) -> str:
        for needle in needles:
            for i, h in enumerate(headers):
                if needle in h and i < len(cells):
                    value = str(cells[i].get("text") or "").strip()
                    if value:
                        return value
        return ""

    def col_price(cells: list[dict[str, str]]) -> str:
        for i, h in enumerate(headers):
            if "价格" in h and "券后" not in h and i < len(cells):
                value = str(cells[i].get("text") or "").strip()
                if value:
                    return value
        return col(cells, ["价格", "售价", "单价"])

    def first_img(cells: list[dict[str, str]]) -> str:
        for cell in cells:
            img = str(cell.get("img") or "").strip()
            if img.startswith("http"):
                return img
        return ""

    target_headers = ["SKU信息", "SKU图片", "SKUID", "商品ID", "价格", "券后价格", "颜色分类", "库存"]
    rows: list[list[str]] = []
    has_links = False
    for cells in raw_rows:
        sku_info = col(cells, ["SKU", "规格", "套餐", "颜色分类"]) or (str(cells[0].get("text") or "") if cells else "")
        img = first_img(cells)
        if img:
            has_links = True
        rows.append([
            sku_info,
            img,
            "",
            item_id,
            col_price(cells),
            col(cells, ["券后价格", "券后"]),
            col(cells, ["颜色分类"]) or sku_info,
            col(cells, ["库存"]),
        ])
    if not rows:
        raise RuntimeError("DOM scrape SKU table returned no rows")
    target = logger.path.parent / f"店透-SKU预览-表格-{item_id}-{datetime.now().strftime('%Y-%m-%d')}.xlsx"
    write_xlsx(target, f"店透-SKU预览-表格-{item_id}-{datetime.now().strftime('%Y-%m-%d')}"[:31], target_headers, rows)
    logger.log(f"dom sku xlsx written: {target} rows={len(rows)}")
    return target, "dom", has_links


def export_ask_dom(logger: Logger, args: argparse.Namespace, item_id: str) -> Path:
    """问大家：打开弹窗后直接读表格（含分页），生成与历史导出一致的 xlsx。"""
    close_dialog("SKU预览")
    run_guard(logger, "before dom ask open")
    logger.section("click ask (dom mode)")
    logger.log(json.dumps(click_toolbar_control("问大家"), ensure_ascii=False))
    state = wait_for_ask_dialog_ready(logger, ask_ready_timeout(args), poll_interval=diantoushi_poll_interval(args))
    if state.get("error"):
        raise RuntimeError(f"Could not open ask dialog: {state}")
    logger.section("dom scrape ask table")
    scraped = scrape_dialog_table_paginated(logger, "问大家分析", ["问题"])
    logger.log(json.dumps({"ask_scrape_headers": scraped.get("headers"), "row_count": scraped.get("pages_seen", 0)}, ensure_ascii=False))
    if not scraped.get("ok") and scraped.get("error"):
        raise RuntimeError(f"DOM scrape ask table failed: {scraped}")
    headers = scraped.get("headers") or []
    raw_rows = scraped.get("rows") or []

    def col(cells: list[dict[str, str]], needles: list[str]) -> str:
        for needle in needles:
            for i, h in enumerate(headers):
                if needle in h and i < len(cells):
                    value = str(cells[i].get("text") or "").strip()
                    if value:
                        return value
        return ""

    target_headers = ["昵称", "时间", "问题", "问答"]
    rows: list[list[str]] = []
    for cells in raw_rows:
        rows.append([
            col(cells, ["昵称"]),
            col(cells, ["时间", "日期"]),
            col(cells, ["问题"]),
            col(cells, ["问答", "回答", "答案"]),
        ])
    rows = [row for row in rows if row[2]]
    if not rows:
        # 无问大家数据（弹窗显示 暂无数据/0条数据）：与旧版导出一致，生成仅表头的空 xlsx
        empty_note = str((scraped.get("last") or {}).get("dialogText") or "")
        if "暂无数据" in empty_note or "0/0条数据" in empty_note or scraped.get("empty"):
            target = logger.path.parent / f"店透视-问大家分析-{item_id}-{datetime.now().strftime('%Y-%m-%d')}.xlsx"
            write_xlsx(target, f"店透视-问大家分析-{item_id}-{datetime.now().strftime('%Y-%m-%d')}"[:31], target_headers, [])
            logger.log(f"dom ask xlsx written (no ask data, headers only): {target}")
            return target
        raise RuntimeError("DOM scrape ask table returned no question rows")
    target = logger.path.parent / f"店透视-问大家分析-{item_id}-{datetime.now().strftime('%Y-%m-%d')}.xlsx"
    write_xlsx(target, f"店透视-问大家分析-{item_id}-{datetime.now().strftime('%Y-%m-%d')}"[:31], target_headers, rows)
    logger.log(f"dom ask xlsx written: {target} rows={len(rows)}")
    return target


def export_review_comments_dom(logger: Logger, args: argparse.Namespace, item_id: str, target_dir: Path) -> dict[str, Any]:
    """评价：打开弹窗后直接走 DOM 提取（跳过批量下载 UI 流程）。"""
    if args.skip_reviews:
        return {"ok": False, "status": "skipped_by_arg", "product_id": item_id, "time": now_stamp()}
    open_review_dialog(logger, args)
    filter_result = ensure_review_filter_default(logger, args)
    logger.section("dom scrape review table")
    extracted = extract_review_comments_table_dom(logger)
    rows = extracted.get("rows") or []
    payload = {
        "ok": bool(extracted.get("ok") and rows),
        "source": "diantoushi_review_comments_dom",
        "product_id": item_id,
        "fallback_reason": "",
        "raw_files": [],
        "extracted_files": [],
        "workbook_files": [],
        "raw_file_count": 0,
        "workbook_count": 0,
        "row_count": len(rows),
        "declared_total": extracted.get("declaredTotal"),
        "filter_default_review": bool(filter_result.get("ok")),
        "filter_note": "dom_scrape",
        "rows": rows,
        "time": now_stamp(),
    }
    target_dir.mkdir(parents=True, exist_ok=True)
    (target_dir / "review_comments.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.log(f"dom review json written: rows={len(rows)} ok={payload['ok']}")
    if not payload["ok"]:
        raise RuntimeError(f"DOM scrape review table failed: {extracted.get('error')}")
    return payload


def export_current_product(
    logger: Logger,
    args: argparse.Namespace,
    selected: dict[str, Any],
    target_dir: Optional[Path] = None,
    toolbar: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    toolbar = toolbar or wait_for_toolbar(logger, poll_interval=diantoushi_poll_interval(args))
    item_id = toolbar.get("item_id") or selected.get("item_id") or parse_item_id(chrome_title_url()["url"])
    if not item_id:
        raise RuntimeError("Could not determine item ID after navigation.")
    image_target_dir = target_dir or (logger.path.parent / f"product-page-images-{item_id}")
    try:
        product_page_images = download_product_page_images(logger, args, image_target_dir, item_id)
    except Exception as exc:
        product_page_images = {
            "ok": False,
            "error": str(exc),
            "product_id": item_id,
            "main_image_count": 0,
            "detail_image_count": 0,
            "failed_count": 0,
            "images": [],
        }
        logger.log(json.dumps({"product_page_images_error": product_page_images}, ensure_ascii=False, indent=2))
    if scrape_mode(args) == "dom":
        try:
            product_file = export_product_data_dom(logger, args, item_id)
        except Exception as exc:
            logger.log(f"dom product scrape failed, fallback to legacy download: {exc}")
            product_file = export_product_data(logger, args, item_id)
    else:
        product_file = export_product_data(logger, args, item_id)
    human_wait(logger, export_cooldown_seconds(args), "cooldown between product export and sku export")
    sku_file: Optional[Path] = None
    sku_variant = "missing"
    sku_has_links = False
    sku_status: dict[str, Any] = {"ok": True}
    try:
        if scrape_mode(args) == "dom":
            try:
                sku_file, sku_variant, sku_has_links = export_sku_dom(logger, args, item_id)
            except Exception as dom_exc:
                logger.log(f"dom sku scrape failed, fallback to legacy download: {dom_exc}")
                sku_file, sku_variant, sku_has_links = export_sku(logger, args, item_id)
        else:
            sku_file, sku_variant, sku_has_links = export_sku(logger, args, item_id)
    except Exception as exc:
        sku_status = {
            "ok": False,
            "error": str(exc),
            "reason": "sku_export_unavailable_or_timed_out",
            "time": now_stamp(),
        }
        logger.log(json.dumps({"sku_status": sku_status}, ensure_ascii=False, indent=2))
    ask_file: Optional[Path] = None
    ask_status: dict[str, Any] = {"ok": True}
    try:
        if scrape_mode(args) == "dom":
            try:
                ask_file = export_ask_dom(logger, args, item_id)
            except Exception as dom_exc:
                logger.log(f"dom ask scrape failed, fallback to legacy download: {dom_exc}")
                ask_file = export_ask(logger, args, item_id)
        else:
            ask_file = export_ask(logger, args, item_id)
    except Exception as exc:
        ask_status = {
            "ok": False,
            "error": str(exc),
            "reason": "ask_export_unavailable_or_timed_out",
            "time": now_stamp(),
        }
        logger.log(json.dumps({"ask_status": ask_status}, ensure_ascii=False, indent=2))
    try:
        close_dialog("问大家分析")
    except Exception:
        pass
    review_comments: dict[str, Any]
    try:
        if scrape_mode(args) == "dom":
            try:
                review_comments = export_review_comments_dom(logger, args, item_id, image_target_dir)
            except Exception as dom_exc:
                logger.log(f"dom review scrape failed, fallback to legacy download: {dom_exc}")
                review_comments = export_review_comments(logger, args, item_id, image_target_dir)
        else:
            review_comments = export_review_comments(logger, args, item_id, image_target_dir)
    except Exception as exc:
        review_comments = {
            "ok": False,
            "error": str(exc),
            "reason": "review_export_unavailable_or_timed_out",
            "product_id": item_id,
            "time": now_stamp(),
        }
        (image_target_dir / "review_comments.json").write_text(json.dumps(review_comments, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.log(json.dumps({"review_comments_status": review_comments}, ensure_ascii=False, indent=2))
    try:
        close_dialog("商品评价")
    except Exception:
        pass
    last_browser_action_epoch = time.time()
    summary = {
        "ok": True,
        "product_name": args.product_name,
        "item_id": item_id,
        "selected": selected,
        "product_file": str(product_file),
        "sku_file": str(sku_file) if sku_file else None,
        "ask_file": str(ask_file) if ask_file else None,
        "ask_status": ask_status,
        "sku_status": sku_status,
        "review_comments": {
            "ok": review_comments.get("ok"),
            "raw_file_count": review_comments.get("raw_file_count", 0),
            "workbook_count": review_comments.get("workbook_count", 0),
            "json_file": str(image_target_dir / "review_comments.json"),
        },
        "sku_export_variant": sku_variant,
        "sku_image_links_found": sku_has_links,
        "product_page_images": {
            "ok": product_page_images.get("ok"),
            "detail_image_mode": product_page_images.get("detail_image_mode"),
            "main_image_count": product_page_images.get("main_image_count", 0),
            "detail_image_count": product_page_images.get("detail_image_count", 0),
            "failed_count": product_page_images.get("failed_count", 0),
            "json_file": str(image_target_dir / "product_page_images.json"),
        },
        "last_browser_action_epoch": last_browser_action_epoch,
    }
    if target_dir is not None:
        item_dir = move_export_files_to_item_dir(logger, target_dir, product_file, sku_file, ask_file, summary)
        summary["target_dir"] = str(item_dir)
        summary["log_file"] = str(item_dir / "run.log")
        if not ask_status.get("ok"):
            (item_dir / "ask_status.json").write_text(json.dumps(ask_status, ensure_ascii=False, indent=2), encoding="utf-8")
        if args.import_mysql:
            try:
                import_result = maybe_import_mysql(logger, item_dir)
            except Exception as exc:
                import_result = {
                    "ok": False,
                    "status": "import_failed",
                    "error": str(exc),
                    "target_dir": str(item_dir),
                    "time": now_stamp(),
                }
                logger.log(json.dumps({"mysql_import": import_result}, ensure_ascii=False, indent=2))
            summary["mysql_import"] = import_result
            (item_dir / "mysql_import.json").write_text(json.dumps(import_result, ensure_ascii=False, indent=2), encoding="utf-8")
            (item_dir / "product_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def run_batch_pipeline(args: argparse.Namespace, logger: Logger) -> dict[str, Any]:
    logger.section("diantoushi rpa batch start")
    logger.log(json.dumps(vars(args), ensure_ascii=False, indent=2))
    master_dir = make_master_dir(args)
    results = []
    selected_total = 0
    seen_item_ids: set[str] = set()
    logger.log(json.dumps({
        "batch_download_strategy": "prefetch_all_pages_first" if args.prefetch_candidates_first else "sequential_page_first",
        "strategy_explanation": (
            "旧模式：先扫描多页候选再统一下载。"
            if args.prefetch_candidates_first
            else "默认模式：筛选价格区间并点击销量后，从第1页开始采集并立即下载；只有当前页候选不够 TopN 时才进入下一页。"
        ),
        "top_n": args.top_n,
        "search_pages": args.search_pages,
        "price_filter": {"min_price": args.min_price, "max_price": args.max_price},
    }, ensure_ascii=False, indent=2))

    def download_candidates(page_candidates: list[dict[str, Any]], total_available_hint: Optional[int] = None) -> None:
        nonlocal selected_total
        for selected in page_candidates:
            selected_total += 1
            selected["rank"] = selected_total
            item_id = selected["item_id"]
            item_title = selected.get("title", "")
            item_dir = master_dir / f"{selected_total:03d}-{item_id}-{safe_name(item_title)[:36]}"
            total_label = total_available_hint or args.top_n
            logger.section(f"batch item {selected_total}/{total_label} {item_id}")
            logger.log(json.dumps(selected, ensure_ascii=False, indent=2))
            try:
                toolbar = navigate_to_product_with_toolbar(
                    logger,
                    selected,
                    item_id,
                    toolbar_poll_interval=diantoushi_poll_interval(args),
                )
                summary = export_current_product(logger, args, selected, item_dir, toolbar=toolbar)
                results.append(summary)
            except Exception as exc:
                error_payload = {
                    "ok": False,
                    "rank": selected_total,
                    "item_id": item_id,
                    "selected": selected,
                    "error": str(exc),
                    "time": now_stamp(),
                }
                item_dir.mkdir(parents=True, exist_ok=True)
                (item_dir / "error.json").write_text(json.dumps(error_payload, ensure_ascii=False, indent=2), encoding="utf-8")
                shutil.copy2(logger.path, unique_path(item_dir / "run.log"))
                results.append(error_payload)
                logger.log(json.dumps(error_payload, ensure_ascii=False, indent=2))
                if args.stop_on_error:
                    raise
            if selected_total < args.top_n:
                last_browser_action = float((results[-1] or {}).get("last_browser_action_epoch") or time.time())
                remaining_delay = batch_delay_seconds(args) - (time.time() - last_browser_action)
                human_wait(logger, remaining_delay, "cooldown before next product")

    if args.prefetch_candidates_first:
        candidates = collect_top_search_candidates(
            logger,
            args.product_name,
            args.top_n,
            max_pages=args.search_pages,
            min_price=args.min_price,
            max_price=args.max_price,
            scroll_wait=speed_value(args, "search_scroll_wait"),
        )
        for candidate in candidates:
            seen_item_ids.add(candidate["item_id"])
        download_candidates(candidates, total_available_hint=len(candidates))
    else:
        for page_index in range(1, args.search_pages + 1):
            if selected_total >= args.top_n:
                break
            remaining = args.top_n - selected_total
            page_candidates = collect_one_sales_page_candidates(logger, args, page_index, remaining, seen_item_ids)
            if not page_candidates:
                logger.log(json.dumps({"page_index": page_index, "status": "no_more_candidates"}, ensure_ascii=False))
                continue
            for candidate in page_candidates:
                seen_item_ids.add(candidate["item_id"])
            download_candidates(page_candidates)
    market_analysis = maybe_run_market_analysis(logger, args, master_dir, selected_total)
    summary = {
        "ok": True,
        "product_name": args.product_name,
        "top_n": args.top_n,
        "price_filter": {"min_price": args.min_price, "max_price": args.max_price},
        "selected_count": selected_total,
        "success_count": sum(1 for result in results if result.get("ok")),
        "complete_count": sum(1 for result in results if result.get("ok") and result.get("ask_file")),
        "partial_count": sum(1 for result in results if result.get("ok") and not result.get("ask_file")),
        "failed_count": sum(1 for result in results if not result.get("ok")),
        "review_exported_count": sum(1 for result in results if (result.get("review_comments") or {}).get("ok")),
        "review_failed_count": sum(1 for result in results if result.get("ok") and not (result.get("review_comments") or {}).get("ok")),
        "mysql_import_requested": bool(args.import_mysql),
        "mysql_imported_count": sum(1 for result in results if (result.get("mysql_import") or {}).get("status") == "imported"),
        "mysql_import_failed_count": sum(1 for result in results if result.get("mysql_import") and not (result.get("mysql_import") or {}).get("ok")),
        "analysis_after_import_requested": bool(args.analyze_after_import),
        "market_analysis": market_analysis,
        "master_dir": str(master_dir),
        "results": results,
        "log_file": str(logger.path),
    }
    (master_dir / "batch_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.copy2(logger.path, unique_path(master_dir / "run.log"))
    logger.section("batch summary")
    logger.log(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary


def run_pipeline(args: argparse.Namespace, logger: Logger) -> dict[str, Any]:
    if args.top_n > 1:
        return run_batch_pipeline(args, logger)
    start_epoch = time.time()
    logger.section("diantoushi rpa start")
    logger.log(json.dumps(vars(args), ensure_ascii=False, indent=2))
    if args.product_url:
        selected = {"href": args.product_url, "item_id": parse_item_id(args.product_url), "selection": "direct_url"}
        toolbar = navigate_to_product_with_toolbar(
            logger,
            selected,
            selected.get("item_id") or "direct",
            toolbar_poll_interval=diantoushi_poll_interval(args),
        )
    else:
        selected = choose_highest_sales_product(logger, args.product_name, min_price=args.min_price, max_price=args.max_price)
        toolbar = navigate_to_product_with_toolbar(
            logger,
            selected,
            selected.get("item_id") or "selected",
            toolbar_poll_interval=diantoushi_poll_interval(args),
        )
    item_id = toolbar.get("item_id") or selected.get("item_id") or parse_item_id(chrome_title_url()["url"])
    if not item_id:
        raise RuntimeError("Could not determine item ID after navigation.")
    image_target_dir = logger.path.parent / f"product-page-images-{item_id}"
    try:
        product_page_images = download_product_page_images(logger, args, image_target_dir, item_id)
    except Exception as exc:
        product_page_images = {
            "ok": False,
            "error": str(exc),
            "product_id": item_id,
            "main_image_count": 0,
            "detail_image_count": 0,
            "failed_count": 0,
            "images": [],
        }
        logger.log(json.dumps({"product_page_images_error": product_page_images}, ensure_ascii=False, indent=2))
    if scrape_mode(args) == "dom":
        try:
            product_file = export_product_data_dom(logger, args, item_id)
        except Exception as exc:
            logger.log(f"dom product scrape failed, fallback to legacy download: {exc}")
            product_file = export_product_data(logger, args, item_id)
    else:
        product_file = export_product_data(logger, args, item_id)
    human_wait(logger, export_cooldown_seconds(args), "cooldown between product export and sku export")
    sku_file: Optional[Path] = None
    sku_variant = "missing"
    sku_has_links = False
    sku_status: dict[str, Any] = {"ok": True}
    try:
        if scrape_mode(args) == "dom":
            try:
                sku_file, sku_variant, sku_has_links = export_sku_dom(logger, args, item_id)
            except Exception as dom_exc:
                logger.log(f"dom sku scrape failed, fallback to legacy download: {dom_exc}")
                sku_file, sku_variant, sku_has_links = export_sku(logger, args, item_id)
        else:
            sku_file, sku_variant, sku_has_links = export_sku(logger, args, item_id)
    except Exception as exc:
        sku_status = {
            "ok": False,
            "error": str(exc),
            "reason": "sku_export_unavailable_or_timed_out",
            "time": now_stamp(),
        }
        logger.log(json.dumps({"sku_status": sku_status}, ensure_ascii=False, indent=2))
    ask_file: Optional[Path] = None
    ask_status: dict[str, Any] = {"ok": True}
    try:
        if scrape_mode(args) == "dom":
            try:
                ask_file = export_ask_dom(logger, args, item_id)
            except Exception as dom_exc:
                logger.log(f"dom ask scrape failed, fallback to legacy download: {dom_exc}")
                ask_file = export_ask(logger, args, item_id)
        else:
            ask_file = export_ask(logger, args, item_id)
    except Exception as exc:
        ask_status = {
            "ok": False,
            "error": str(exc),
            "reason": "ask_export_unavailable_or_timed_out",
            "time": now_stamp(),
        }
        logger.log(json.dumps({"ask_status": ask_status}, ensure_ascii=False, indent=2))
    try:
        close_dialog("问大家分析")
    except Exception:
        pass
    review_target_dir = logger.path.parent / f"review-comments-{item_id}"
    try:
        if scrape_mode(args) == "dom":
            try:
                review_comments = export_review_comments_dom(logger, args, item_id, review_target_dir)
            except Exception as dom_exc:
                logger.log(f"dom review scrape failed, fallback to legacy download: {dom_exc}")
                review_comments = export_review_comments(logger, args, item_id, review_target_dir)
        else:
            review_comments = export_review_comments(logger, args, item_id, review_target_dir)
    except Exception as exc:
        review_comments = {
            "ok": False,
            "error": str(exc),
            "reason": "review_export_unavailable_or_timed_out",
            "product_id": item_id,
            "time": now_stamp(),
        }
        review_target_dir.mkdir(parents=True, exist_ok=True)
        (review_target_dir / "review_comments.json").write_text(json.dumps(review_comments, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.log(json.dumps({"review_comments_status": review_comments}, ensure_ascii=False, indent=2))
    target_dir = collect_exports(logger, args.product_name, item_id, start_epoch)
    generated_exports_collected = copy_generated_export_files_to_target(logger, target_dir, product_file, ask_file)
    copied_product = generated_exports_collected.get("files", {}).get("product_file", {}).get("destination")
    copied_ask = generated_exports_collected.get("files", {}).get("ask_file", {}).get("destination")
    if copied_product:
        product_file = Path(copied_product)
    if copied_ask:
        ask_file = Path(copied_ask)
    target_sku_files = sorted(target_dir.glob("店透-SKU预览-表格-*.xlsx"))
    if target_sku_files:
        sku_file = target_sku_files[0]
    product_page_images_collected = move_product_page_images_to_target(logger, image_target_dir, target_dir)
    review_comments_collected = move_review_comments_to_target(logger, review_target_dir, target_dir)
    if not ask_status.get("ok"):
        (target_dir / "ask_status.json").write_text(json.dumps(ask_status, ensure_ascii=False, indent=2), encoding="utf-8")
    import_result = maybe_import_mysql(logger, target_dir) if args.import_mysql else None
    market_analysis = maybe_run_market_analysis(logger, args, target_dir, 1)
    try:
        close_dialog("问大家分析")
    except Exception:
        pass
    summary = {
        "ok": True,
        "product_name": args.product_name,
        "item_id": item_id,
        "selected": selected,
        "target_dir": str(target_dir),
        "product_file": str(product_file),
        "sku_file": str(sku_file) if sku_file else None,
        "ask_file": str(ask_file) if ask_file else None,
        "ask_status": ask_status,
        "sku_status": sku_status,
        "review_comments": {
            "ok": review_comments.get("ok"),
            "raw_file_count": review_comments.get("raw_file_count", 0),
            "workbook_count": review_comments.get("workbook_count", 0),
            "json_file": str(target_dir / "review_comments.json"),
            "collected": review_comments_collected,
        },
        "sku_export_variant": sku_variant,
        "sku_image_links_found": sku_has_links,
        "generated_exports_collected": generated_exports_collected,
        "product_page_images": {
            "ok": product_page_images.get("ok"),
            "detail_image_mode": product_page_images.get("detail_image_mode"),
            "main_image_count": product_page_images.get("main_image_count", 0),
            "detail_image_count": product_page_images.get("detail_image_count", 0),
            "failed_count": product_page_images.get("failed_count", 0),
            "json_file": str(target_dir / "product_page_images.json"),
            "collected": product_page_images_collected,
        },
        "mysql_import": import_result,
        "analysis_after_import_requested": bool(args.analyze_after_import),
        "market_analysis": market_analysis,
        "log_file": str(target_dir / "run.log"),
    }
    logger.section("summary")
    logger.log(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary


def spawn_background(args: argparse.Namespace) -> dict[str, Any]:
    run_root = Path(args.run_dir).expanduser() if args.run_dir else Path.home() / "Desktop" / f"店透视RPA-{safe_name(args.product_name)}-{fs_stamp()}"
    run_root.mkdir(parents=True, exist_ok=True)
    log_file = run_root / "run.log"
    command = [sys.executable, str(Path(__file__).resolve()), "--product-name", args.product_name, "--run-dir", str(run_root)]
    if args.product_url:
        command += ["--product-url", args.product_url]
    if args.import_mysql:
        command.append("--import-mysql")
    if args.analyze_after_import:
        command.append("--analyze-after-import")
    if args.analysis_keyword:
        command += ["--analysis-keyword", args.analysis_keyword]
    if args.analysis_limit is not None:
        command += ["--analysis-limit", str(args.analysis_limit)]
    if args.analysis_cost_price is not None:
        command += ["--analysis-cost-price", str(args.analysis_cost_price)]
    if args.analysis_shipping_cost != 0:
        command += ["--analysis-shipping-cost", str(args.analysis_shipping_cost)]
    if args.analysis_packaging_cost != 0:
        command += ["--analysis-packaging-cost", str(args.analysis_packaging_cost)]
    if args.analysis_labor_cost != 0:
        command += ["--analysis-labor-cost", str(args.analysis_labor_cost)]
    if args.analysis_platform_fee_rate != 0:
        command += ["--analysis-platform-fee-rate", str(args.analysis_platform_fee_rate)]
    if args.analysis_ad_fee_rate != 0:
        command += ["--analysis-ad-fee-rate", str(args.analysis_ad_fee_rate)]
    if args.analysis_target_margin != 0.30:
        command += ["--analysis-target-margin", str(args.analysis_target_margin)]
    if args.top_n != 1:
        command += ["--top-n", str(args.top_n)]
    if args.master_dir:
        command += ["--master-dir", args.master_dir]
    if args.speed_profile != "balanced":
        command += ["--speed-profile", args.speed_profile]
    if args.batch_delay is not None:
        command += ["--batch-delay", str(args.batch_delay)]
    if args.export_cooldown is not None:
        command += ["--export-cooldown", str(args.export_cooldown)]
    if args.ask_ready_timeout is not None:
        command += ["--ask-ready-timeout", str(args.ask_ready_timeout)]
    if args.download_poll_interval is not None:
        command += ["--download-poll-interval", str(args.download_poll_interval)]
    if args.review_pages != 10:
        command += ["--review-pages", str(args.review_pages)]
    if args.review_timeout is not None:
        command += ["--review-timeout", str(args.review_timeout)]
    if args.skip_reviews:
        command.append("--skip-reviews")
    if args.skip_product_images:
        command.append("--skip-product-images")
    if args.prefetch_candidates_first:
        command.append("--prefetch-candidates-first")
    if args.search_pages != 5:
        command += ["--search-pages", str(args.search_pages)]
    if args.min_price is not None:
        command += ["--min-price", str(args.min_price)]
    if args.max_price is not None:
        command += ["--max-price", str(args.max_price)]
    if args.stop_on_error:
        command.append("--stop-on-error")
    env = os.environ.copy()
    env["DTS_RPA_BACKGROUND_CHILD"] = "1"
    with log_file.open("ab") as log:
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, start_new_session=True, env=env)
    return {"pid": process.pid, "run_dir": str(run_root), "log_file": str(log_file), "command": command}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run 店透视 product research as a local background-friendly RPA.")
    parser.add_argument("--product-name", required=True, help="Taobao search keyword/product name.")
    parser.add_argument("--product-url", help="Optional direct Taobao/Tmall product URL.")
    parser.add_argument("--run-dir", help="Run log directory. Defaults to Desktop/店透视RPA-<product>-<timestamp>.")
    parser.add_argument("--background", action="store_true", help="Start the RPA in the background and return immediately.")
    parser.add_argument("--import-mysql", action="store_true", help="Run mysql-import after collecting export files.")
    parser.add_argument("--analyze-after-import", action="store_true", help="After all downloads/imports finish, run competitor market analysis and save it to MySQL.")
    parser.add_argument("--analysis-keyword", default=None, help="Keyword for post-import market analysis. Defaults to --product-name.")
    parser.add_argument("--analysis-limit", type=int, default=None, help="Competitor count limit for post-import analysis. Defaults to selected/downloaded count.")
    parser.add_argument("--analysis-cost-price", type=float, default=None, help="Your product cost for post-import profit simulation.")
    parser.add_argument("--analysis-shipping-cost", type=float, default=0.0, help="Shipping cost for post-import profit simulation.")
    parser.add_argument("--analysis-packaging-cost", type=float, default=0.0, help="Packaging cost for post-import profit simulation.")
    parser.add_argument("--analysis-labor-cost", type=float, default=0.0, help="Labor/operation cost for post-import profit simulation.")
    parser.add_argument("--analysis-platform-fee-rate", type=float, default=0.0, help="Platform fee rate for post-import profit simulation.")
    parser.add_argument("--analysis-ad-fee-rate", type=float, default=0.0, help="Ad/traffic fee rate for post-import profit simulation.")
    parser.add_argument("--analysis-target-margin", type=float, default=0.30, help="Target gross margin for post-import profit simulation.")
    parser.add_argument("--top-n", type=int, default=1, help="Export the top N search results by visible sales/payment count. Use 100 for Top100 batch mode.")
    parser.add_argument("--master-dir", help="Batch output root directory. Defaults to Desktop/店透视批量导出-<product>-TopN-<timestamp>.")
    parser.add_argument("--speed-profile", choices=sorted(SPEED_PROFILES), default="fast", help="Download pacing profile. Default fast shortens 店透视 export cooldowns/waits only; Taobao page pacing (batch_delay/search_scroll_wait) stays at balanced levels. Use conservative/balanced for >=20s export cooldowns.")
    parser.add_argument("--batch-delay", type=float, default=None, help="Seconds to wait between products in batch mode. Defaults by --speed-profile; MySQL import time counts toward this cooldown.")
    parser.add_argument("--export-cooldown", type=float, default=None, help="Minimum seconds between heavy 店透视 export actions. fast allows >=8s; conservative/balanced raise values below 20 to 20.")
    parser.add_argument("--ask-ready-timeout", type=float, default=None, help="Seconds to wait for 问大家 dialog readiness before marking it partial. Defaults by --speed-profile.")
    parser.add_argument("--download-poll-interval", type=float, default=None, help="Filesystem polling interval while waiting for downloaded xlsx files. Defaults by --speed-profile.")
    parser.add_argument("--review-pages", type=int, default=10, help="Download 店透视评价分析 comments from page 1 through this page. Defaults to 10.")
    parser.add_argument("--review-timeout", type=int, default=None, help="Seconds to wait for 店透视评价分析 comment export to finish. Defaults by --speed-profile.")
    parser.add_argument("--skip-reviews", action="store_true", help="Skip 店透视评价分析 comment export.")
    parser.add_argument("--scrape-mode", choices=["dom", "legacy"], default="dom", help="店透视数据获取方式：dom 直接读取面板已渲染数据并本地生成 xlsx/json（默认，更快更稳）；legacy 走旧版「下载 xlsx」流程。")
    parser.add_argument("--skip-product-images", action="store_true", help="Skip 店透视 商品图 main/detail image download attempt.")
    parser.add_argument("--prefetch-candidates-first", action="store_true", help="Old batch behavior: scan pages until enough candidates are collected before starting downloads. Default downloads page 1 first, then later pages only if needed.")
    parser.add_argument("--search-pages", type=int, default=5, help="Maximum Taobao search result pages to scan when collecting Top N candidates.")
    parser.add_argument("--min-price", type=float, default=None, help="Only download products whose parsed search-card price is >= this value.")
    parser.add_argument("--max-price", type=float, default=None, help="Only download products whose parsed search-card price is <= this value.")
    parser.add_argument("--stop-on-error", action="store_true", help="Stop batch mode after the first product failure.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.min_price is not None and args.max_price is not None and args.min_price > args.max_price:
        print(json.dumps({"ok": False, "error": "--min-price cannot be greater than --max-price"}, ensure_ascii=False, indent=2))
        return 2
    if args.review_pages < 1:
        print(json.dumps({"ok": False, "error": "--review-pages must be >= 1"}, ensure_ascii=False, indent=2))
        return 2
    if args.review_timeout is not None and args.review_timeout < 30:
        print(json.dumps({"ok": False, "error": "--review-timeout must be >= 30"}, ensure_ascii=False, indent=2))
        return 2
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
