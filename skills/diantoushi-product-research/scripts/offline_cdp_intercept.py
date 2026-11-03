#!/usr/bin/env python3
"""Offline CDP Fetch interception smoke test.

The route API is Playwright's wrapper over Chromium's CDP Fetch domain. This
script never contacts Taobao: every request targets offline.invalid and is
fulfilled, delayed, or aborted locally.
"""
from __future__ import annotations

import json
import time
from typing import Any

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

from check_taobao_guard import CHECK_JS


PAGE = """
<!doctype html>
<html><head><title>offline-guard-fixture</title></head>
<body>
  <div id="status">安全验证</div>
  <iframe src="https://offline.invalid/_____tmd_____/punish?action=captcha"></iframe>
  <script>
    window.results = {};
    Promise.all([
      fetch('https://offline.invalid/api/respond').then(r => r.json()).then(v => window.results.respond = v),
      fetch('https://offline.invalid/api/delay').then(r => r.text()).then(v => window.results.delay = v),
      fetch('https://offline.invalid/api/abort').then(() => window.results.abort = 'unexpected-success').catch(() => window.results.abort = 'failed')
    ]).then(() => { window.results.done = true; });
  </script>
</body></html>
"""


def guard_snapshot(page) -> dict[str, Any]:
    """Reuse the production detector so the offline fixture exercises the real branch."""
    raw = page.evaluate(CHECK_JS)
    return json.loads(raw)


def main() -> int:
    requests: list[str] = []
    counts = {"respond": 0, "delay": 0, "abort": 0, "punish": 0}
    delay_started = 0.0

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page()

            def intercept(route) -> None:
                nonlocal delay_started
                url = route.request.url
                requests.append(url)
                if url.endswith('/api/respond'):
                    counts['respond'] += 1
                    route.fulfill(status=200, content_type='application/json', body=json.dumps({"items": [], "offline": True}))
                elif url.endswith('/api/delay'):
                    counts['delay'] += 1
                    delay_started = time.monotonic()
                    time.sleep(0.15)
                    route.fulfill(status=200, body='delayed-offline')
                elif url.endswith('/api/abort'):
                    counts['abort'] += 1
                    route.abort('failed')
                elif '/punish' in url:
                    counts['punish'] += 1
                    route.fulfill(status=200, content_type='text/html', body='<html>offline punish fixture</html>')
                else:
                    route.abort('blockedbyclient')

            page.route('https://offline.invalid/**', intercept)
            page.set_content(PAGE)
            page.wait_for_function("() => window.results && window.results.done === true")
            results = page.evaluate('window.results')
            snapshot = guard_snapshot(page)
            browser.close()
    except PlaywrightError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 1

    delay_elapsed_ms = round((time.monotonic() - delay_started) * 1000) if delay_started else 0
    result = {
        "ok": (
            results.get('respond', {}).get('offline') is True
            and results.get('delay') == 'delayed-offline'
            and results.get('abort') == 'failed'
            and results.get('done') is True
            and snapshot.get('guard_detected') is True
            and snapshot.get('punish_detected') is True
            and counts == {"respond": 1, "delay": 1, "abort": 1, "punish": 1}
            and all('taobao.com' not in url for url in requests)
        ),
        "intercept": {"counts": counts, "delay_elapsed_ms": delay_elapsed_ms},
        "page_results": results,
        "guard_snapshot": snapshot,
        "requests": requests,
        "real_taobao_requests": [url for url in requests if 'taobao.com' in url],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['ok'] else 2


if __name__ == '__main__':
    raise SystemExit(main())
