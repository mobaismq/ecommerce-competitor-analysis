#!/usr/bin/env python3
import json
import re
import subprocess
import sys
import argparse
from typing import Optional


CHECK_JS = r"""
(() => {
  const isVisible = (el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || 1) !== 0 &&
      rect.width > 0 &&
      rect.height > 0;
  };
  const text = document.body ? document.body.innerText : "";
  const dialogs = [...document.querySelectorAll('[role=dialog],.el-dialog,.el-message,.el-notification,.el-popper')]
    .filter(isVisible)
    .map(e => (e.innerText || e.textContent || "").trim())
    .filter(Boolean);
  const combined = [text, ...dialogs].join("\n");
  const guardPatterns = [
    "淘宝验证",
    "访问太频繁",
    "请稍后重试",
    "安全验证",
    "验证码",
    "滑块",
    "人机验证"
  ];
  const busyPatterns = [
    "获取数据中",
    "加载中",
    "请稍候",
    "正在导出"
  ];
  const controls = [...document.querySelectorAll('button,a,div,span')]
    .map(e => (e.innerText || e.textContent || "").trim())
    .filter(t => ["商品数据", "SKU预览", "问大家", "导出表格"].includes(t));
  const itemId = new URL(location.href).searchParams.get("id") || (location.href.match(/[?&]id=(\d+)/) || [])[1] || null;
  return JSON.stringify({
    href: location.href,
    title: document.title,
    item_id: itemId,
    guard_detected: guardPatterns.some(p => combined.includes(p)),
    busy_detected: busyPatterns.some(p => combined.includes(p)),
    matched_guard_terms: guardPatterns.filter(p => combined.includes(p)),
    matched_busy_terms: busyPatterns.filter(p => combined.includes(p)),
    toolbar_present: combined.includes("diantoushi.com") || combined.includes("店透视"),
    export_controls: [...new Set(controls)],
    dialogs: dialogs.slice(0, 8).map(t => t.slice(0, 300))
  });
})()
"""


def run_chrome_js(js: str, window_id: Optional[int] = None) -> str:
    if window_id is None:
        target = "set targetWindow to front window"
    else:
        target = f'''
  if not (exists window id {window_id}) then error "Target Chrome window is closed"
  set targetWindow to window id {window_id}
  set index of targetWindow to 1
'''
    script = f'''
tell application "Google Chrome"
  if (count of windows) = 0 then make new window
  {target}
  set jsResult to execute active tab of targetWindow javascript {json.dumps(js, ensure_ascii=False)}
end tell
return jsResult
'''
    result = subprocess.run(["osascript"], input=script, text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "osascript failed")
    return result.stdout.strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--window-id", type=int, default=None)
    args = parser.parse_args()
    try:
        raw = run_chrome_js(CHECK_JS, args.window_id)
        data = json.loads(raw)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2))
        return 1

    data["ok"] = not data.get("guard_detected")
    print(json.dumps(data, ensure_ascii=False, indent=2))
    return 2 if data.get("guard_detected") else 0


if __name__ == "__main__":
    raise SystemExit(main())
