---
name: diantoushi-product-research
description: Search Taobao/Tmall by product name, export product-listing intelligence with the 店透视/diantoushi browser toolbar, and optionally import the exported data into MySQL via $mysql-import. Use when Codex is given a product name or listing URL and needs to search Taobao, open a product detail page, export 商品数据, SKU预览, 问大家/大家问 .xlsx files, collect them into a Desktop folder, run mysql-import dry-run validation, or complete automatic database loading.
---

# Diantoushi Product Research

## Overview

Use this skill to turn a user-provided product name into a repeatable Taobao/Tmall 店透视 export package on the Desktop. Prefer RPA-style Computer Use interactions for Taobao/Tmall and 店透视 operations. Use JavaScript/DOM only for low-risk read-only guard checks, or as a controlled fallback for visible 店透视 export widgets after RPA clicks fail.

## Preconditions

- Confirm the user is already allowed to access the Taobao/Tmall page and the 店透视 account or extension. Do not bypass logins, captchas, paywalls, or platform restrictions.
- Work from either a user-provided product name/search term or a product URL. Product names are the default input: open Taobao, search the term, rank visible normal product results by sales/payment count, and open the highest-sales product detail tab.
- Verify the blue 店透视 toolbar appears under the Taobao/Tmall header. It may show rows such as `商品`, `店铺`, and `下载`, with controls like `SKU预览`, `商品数据`, `问大家`, `评价分析`, `排名查询`, `市场分析`, `全网找货`, and `主图&详情页仿写`.
- Keep track of files downloaded during the run. The demonstrated workflow saves 店透视 exports to the browser's default download location, usually `~/Downloads`.
- Run `scripts/check_taobao_guard.py` before export clicks and after any long wait. If it reports `guard_detected: true`, stop immediately, restore any changed browser settings, and ask the user to resolve the visible Taobao verification. Do not try to bypass, close, or brute-force verification.
- For unattended automation, avoid macOS save panels when possible. If Chrome's "ask where to save each file" setting is enabled and UI scripting cannot control the save panel, temporarily disable `download.prompt_for_download`, run the exports, then restore the user's original setting.
- On macOS, Chrome can sometimes leave a completed 店透视 export as a hidden file named like `~/Downloads/.com.google.Chrome.*` when `download.prompt_for_download` is enabled or the save panel is not accepted. If no visible `.xlsx` appears but a new hidden Chrome file is stable, validate it as an XLSX zip, inspect `xl/sharedStrings.xml` for the expected item ID/export fields, then copy or move it to the expected workbook filename before collecting exports.
- Final files must be placed in a Desktop folder named like `店透视导出-<商品名>-<商品ID>-<timestamp>`. Use `scripts/collect_exports.py` after exporting to move or copy matching workbooks into that folder.
- If the user asks for automatic database loading, call `$mysql-import` after collecting files. Always run mysql-import dry-run before real MySQL writes. If only `问大家` is missing, use `--allow-missing-qa` so product and SKU data are still loaded with zero QA rows.

## Anti-Risk Operating Rules

- Default to `RPA mode` for live Taobao/Tmall pages: operate Chrome with `computer-use` screenshots, accessibility targets, mouse clicks, keyboard typing, and human-paced waits.
- Avoid JS-driven clicking on Taobao/Tmall/店透视 controls unless RPA is blocked. JS-driven clicks can look unnaturally fast and may trigger platform or extension risk controls.
- When RPA clicking is blocked or returns stale/no-window errors, a controlled DOM fallback is allowed only for 店透视 extension widgets, never for Taobao search results, purchase/cart/favorite actions, login/verification dialogs, or platform forms. Before using it, run `scripts/check_taobao_guard.py`, require `guard_detected: false`, and click exactly one visible node whose text/class and bounding box match the intended 店透视 control. Log the clicked text and rectangle.
- Minimize Taobao navigation: use a product URL when available; otherwise run one search, choose the visible normal result with the highest parsed sales/payment count, and stay on that detail page. Do not open many candidate tabs.
- Do not repeatedly refresh, repeatedly search the same keyword, or click the same 店透视 control more than once in quick succession.
- Treat 店透视 export controls as network-heavy actions. Leave at least 20-40 seconds between export actions, and after clicking an export wait up to 90 seconds for a file before deciding what happened.
- If a dialog says `获取数据中`, `加载中`, `拼命加载中`, or export buttons are disabled, wait and re-check with `scripts/check_taobao_guard.py`; do not click other 店透视 controls while it is busy.
- DOM reads and screenshots are lower risk than export clicks, but keep them purposeful and avoid tight polling loops.
- If Taobao shows `淘宝验证`, `访问太频繁`, `验证码`, `安全验证`, or a slider/QR verification, stop. Report the exact term and the current URL. The user must resolve it or wait before continuing.
- Always restore Chrome's original download setting in a `finally`-style cleanup if it was changed.

## RPA Mode

Use this mode for normal runs.

1. Bring Chrome to the front and use `computer-use.get_app_state` before any UI interaction.
2. Navigate with the address bar or visible search box:
   - Prefer a direct product URL supplied by the user.
   - If only a product name is supplied, type it into Taobao search once.
3. Select one normal product result by ranking visible candidates by sales/payment count. Avoid opening multiple results.
4. Wait for the detail page and 店透视 toolbar to become visible. Use screenshots/accessibility text to confirm:
   - `diantoushi.com`
   - `下载`
   - `商品数据`
   - product title and item ID in the URL
5. Before clicking export, run `scripts/check_taobao_guard.py` as a read-only safety check. If guard is detected, stop.
6. Click `商品数据` once with Computer Use, not JavaScript. Wait 30-90 seconds.
7. Verify the downloaded workbook in `~/Downloads` with filesystem tools. Do not click `商品数据` again unless the user explicitly asks after a failed wait.
8. If the user asks for SKU or 问大家 too, wait 20-40 seconds between each export action and repeat the same guard check.

Use JS/DOM only for:

- Reading the current URL/title/text for diagnosis
- Running `scripts/check_taobao_guard.py`
- Inspecting whether a downloaded file appeared indirectly through the filesystem

Do not use JS/DOM for:

- Clicking Taobao search results
- Clicking 店透视 `商品数据`, `SKU预览`, `问大家`, or `导出表格` while RPA is working normally
- Closing or interacting with verification dialogs

If RPA is blocked and the guard script is clean, use a narrowly scoped JS fallback only for visible 店透视 controls. The fallback must:

- Match exact visible text such as `问大家`, `SKU预览`, or dialog-toolbar `导出表格`.
- Prefer class hints such as `item-value plain-hover` for toolbar items or a dialog containing `SKU预览` / `问大家分析`.
- Reject hidden or zero-size elements.
- Return/log the clicked text, node count, and bounding rectangle.
- Never close, click through, or interact with any dialog containing Taobao verification/security language.

## Workflow

### Background RPA Runner

For repeat runs where the user only provides a product name, prefer the local RPA runner. It starts a detached process, returns immediately, and writes detailed logs to the Desktop. This reduces Codex token usage because the browser/export work continues outside the conversation after startup.

Start a product research run:

```bash
python3 /Users/shuishoukeke/.codex/skills/diantoushi-product-research/scripts/run_diantoushi_rpa.py \
  --product-name "<商品名>" \
  --background
```

Start a run and import the collected files into MySQL after export:

```bash
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_PASSWORD='' MYSQL_DATABASE=sys \
python3 /Users/shuishoukeke/.codex/skills/diantoushi-product-research/scripts/run_diantoushi_rpa.py \
  --product-name "<商品名>" \
  --background \
  --import-mysql
```

The command prints JSON containing `pid`, `run_dir`, `log_file`, and `command`. Watch progress with:

```bash
tail -f "<log_file>"
```

The background runner does the normal workflow: open Taobao search, rank visible normal product cards by parsed sales/payment count, open the highest-sales product, check for Taobao guard states, export `商品数据`, export SKU using `导出表格 xlsx+图片链接` when available, export `问大家`, collect the workbooks into `~/Desktop/店透视导出-<商品名>-<商品ID>-<timestamp>`, and optionally run `$mysql-import`. It must still use the user's visible Chrome session and 店透视 extension. If Taobao verification, captcha, or risk-control text appears, the runner stops and records the reason in `run.log`; do not try to bypass it.

While each product detail page is open, the runner opens 店透视 `商品图` / `商品图自定义下载`, verifies that only `1:1主图` and `详情长图` are checked, clicks `按类型下载`, then moves and extracts only files created by that click into `product_page_images/main` and `product_page_images/detail`. The `detail` folder stores the exported detail long image, not the split detail-page images. It writes a `product_page_images.json` sidecar so `$mysql-import` can load those image assets into `product_page_image_asset` and `media_asset`. If this 店透视 export fails, the image step is marked failed; it must not scroll the page or use visible-page URL capture, because recommendation modules can contain images from other products.

Batch export the visible sales Top N products:

```bash
python3 /Users/shuishoukeke/.codex/skills/diantoushi-product-research/scripts/run_diantoushi_rpa.py \
  --product-name "<商品名>" \
  --top-n 100 \
  --search-pages 5 \
  --background
```

Batch export the sales Top N products inside a price range:

```bash
python3 /Users/shuishoukeke/.codex/skills/diantoushi-product-research/scripts/run_diantoushi_rpa.py \
  --product-name "<商品名>" \
  --top-n 100 \
  --search-pages 8 \
  --min-price 100 \
  --max-price 180 \
  --background
```

When `--min-price` or `--max-price` is set, the runner first opens Taobao's visible `区间` price filter, fills the low/high price inputs, confirms the filter, then clicks the visible `销量` sort. Candidate collection then parses the visible Taobao search-card price as a safety check, keeps only candidates in the inclusive range, and exports the Top N by parsed sales/payment count. Candidates with unparseable prices are skipped while a price filter is active, because they cannot be safely assigned to the requested price range.

Batch mode creates a master Desktop folder named like `店透视批量导出-<商品名>-Top100-<timestamp>`. It scans the current Taobao search page, scrolls to collect visible candidates, and if fewer than `--top-n` valid products are collected it clicks the visible `下一页` pagination control and continues scanning up to `--search-pages` pages. Each selected product is stored in a child folder named like `001-<商品ID>-<标题片段>` and contains that product's exported workbooks, `product_page_images/`, `product_page_images.json`, `product_summary.json`, and `run.log`. The master folder also contains `batch_summary.json` and the overall `run.log`. Product detail navigation uses clean canonical URLs first (`item.taobao.com/item.htm?id=...`, then `detail.tmall.com/item.htm?id=...`) and, if Chrome lands on `chrome-error://chromewebdata/` / `隐私设置错误` while waiting for the 店透视 toolbar, retries with the next clean URL instead of immediately marking the product failed. If `问大家` has no exportable rows, stays at `0/0条数据`, or its export button remains disabled, keep the already downloaded `商品数据` and `SKU预览` files in that product folder, write `ask_status.json`, and mark the product as partial instead of discarding the product.

Batch export and import each completed product into MySQL immediately after its files are saved:

```bash
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_PASSWORD='' MYSQL_DATABASE=sys \
python3 /Users/shuishoukeke/.codex/skills/diantoushi-product-research/scripts/run_diantoushi_rpa.py \
  --product-name "<商品名>" \
  --top-n 100 \
  --search-pages 5 \
  --import-mysql \
  --background
```

With `--import-mysql` in batch mode, every product folder is imported right after its `商品数据` and `SKU预览` files are moved into that folder. If `问大家` is present it is imported too; if `问大家` has no exportable rows or is unavailable, mysql-import runs with `--allow-missing-qa`, imports product/SKU data, and records zero QA rows plus `ask_status.json`. The runner always executes mysql-import's dry-run before the real insert, then writes `mysql_import.json` and updates `product_summary.json` with the `job_id`, inserted row counts, and verification counts. If product or SKU files are missing, the import is skipped with `status: skipped_missing_files` and the already downloaded files are preserved for a later retry.

Use batch mode carefully. It repeatedly opens product detail pages and exports heavy 店透视 data, so it can take hours for Top100 and is more likely to encounter Taobao verification or 店透视 loading limits. If verification/risk-control appears, stop and let the user resolve it; do not bypass it. If fewer than 100 product cards are available from the visible loaded search results, export only the candidates that were collected and record `selected_count` in `batch_summary.json`.

1. Prepare the run:
   - Interpret a short user input such as `抽纸`, `心相印抽纸`, or `户外水平仪` as the product search term.
   - Record a run start timestamp before any export begins; use this as `--since-epoch` for `scripts/collect_exports.py`.
   - If unattended downloads are needed, record Chrome's original `download.prompt_for_download` value, set it to `false`, and restore it after the export package is complete.
   - Run a guard preflight:

```bash
python /Users/shuishoukeke/.codex/skills/diantoushi-product-research/scripts/check_taobao_guard.py
```

   - If the script reports `guard_detected: true`, stop before clicking any export control.

2. Reach the target listing:
   - If given a product URL, open it directly and wait for the page and 店透视 toolbar to load.
   - If given a product name/keyword, open Taobao, search the keyword once, rank visible normal item cards by sales/payment count, choose the highest-sales result, and wait for the Tmall/Taobao detail page to load.
   - Read visible item cards and extract `已售`, `人付款`, `付款人数`, or equivalent sales text. Parse `万+` as at least `10000`, `千+` as at least `1000`, then strip `+`, `人`, and `件`.
   - Exclude ad-only interstitials, shop pages, broken links, unrelated recommendations, and links that do not lead to a real `item.taobao.com` or `detail.tmall.com` product page.
   - Prefer a result whose title closely matches the product name and appears to be an actual product listing; among matching normal product results, choose the one with the highest parsed sales/payment count.
   - If several plausible results tie on sales or sales text is missing, prefer the higher-ranked visible result and mention the tie/limitation in the final summary.
   - Log the top candidates with title, URL, raw sales text, parsed sales count, and the selected reason before navigating.
   - Record the product URL and item ID from the URL or 店透视 dialogs.

3. Capture the base listing context:
   - Product title, shop name, visible rating or shop scores, price or promotion price, sold count, review count, collection count, delivery/service promise, and product URL.
   - Note visible toolbar metrics such as SKU count, sales count, sales amount, evaluations, favorites, payment count, monthly receipts, and 问大家 count when present.

4. Export 商品数据:
   - Run `scripts/check_taobao_guard.py` before clicking.
   - Click `商品数据` in the 店透视 `下载` area with Computer Use / visible UI, not JavaScript.
   - Do not click it again immediately. Wait for a download, a 店透视 dialog, or a guard/busy state.
- When the macOS save panel opens, accept the default filename unless the user requested a specific folder or naming scheme.
- Click `保存` and wait until the browser returns to the product page.
- Verify a workbook named like `商品数据ID_<item-id>_<date>.xlsx` was downloaded.
- If the workbook does not appear but a new `.com.google.Chrome.*` file appears in `~/Downloads`, wait until its size is stable, confirm `file` reports `Microsoft Excel 2007+` or Python `zipfile` can open it, and normalize it to `商品数据ID_<item-id>_<date>.xlsx` only after confirming the shared strings contain the target item ID.
   - Expected sheet/table fields include `店铺名称`, `店铺类型`, `商品标题`, `商品ID`, `类目`, `上架`, `SKU数`, `已售`, `销售额约`, and `评价`.

5. Export SKU intelligence:
   - Run `scripts/check_taobao_guard.py` before clicking.
   - Open `SKU预览` from the 店透视 toolbar with Computer Use / visible UI, not JavaScript.
   - Wait for the `SKU预览-类目ID... 商品ID...` dialog. It may initially show SKU image cards with `价格`, `券后价格`, `SKUID`, `库存`, and `套餐类型`.
   - Select the `导出表格` radio option if `导出图片` is active. This only changes the preview/export mode.
   - Prefer exporting `导出表格 xlsx+图片链接` from the dialog export dropdown. This is the default SKU export variant because downstream analysis and MySQL import need stable image URLs.
   - If the dropdown is available, open the caret beside the dialog toolbar `导出表格` command and choose the exact menu item `导出表格 xlsx+图片链接`, even if another item is marked `默认`.
   - When selecting a dropdown export variant programmatically, target a short visible menu item such as `导出表格 xlsx+图片链接`; reject large container nodes whose text includes many options like `导出报表模版...导出表格 xlsx+图片链接...`.
   - If `导出表格 xlsx+图片链接` is unavailable, fall back in this order: `导出表格 xlsx+图片`, then normal `导出表格 xlsx`. When falling back, log the reason and preserve any available image URLs from the SKU preview DOM in a sidecar CSV.
   - Click the separate `导出表格` toolbar command or selected dropdown menu item. Some icon-only buttons expose only glyph titles; use nearby visible text to identify the correct export control. Do not confuse the radio option with the toolbar export command.
   - Do not click export variants repeatedly; pick one variant and wait for the resulting file.
   - If a dropdown menu is used, prefer `导出表格 xlsx+图片链接`. The UI may expose variants such as `导出表格 csv`, `导出表格 xlsx`, `导出表格 xlsx+图片`, and `导出表格 xlsx+图片链接`; choose the image-link variant by default.
   - Save the file from the macOS save panel.
- Verify a workbook named like `店透-SKU预览-表格-<item-id>-<date>.xlsx` was downloaded.
- If Chrome leaves the SKU export as a hidden `.com.google.Chrome.*` file, validate that the workbook shared strings contain `SKUID`, `商品ID`, and the target item ID before normalizing it to `店透-SKU预览-表格-<item-id>-<date>.xlsx`.
   - Validate that the exported workbook contains image-link data: the `SKU图片` / `图片链接` column should contain `http://` or `https://` URLs when `xlsx+图片链接` was selected. If no URL appears, inspect the SKU preview DOM for image URLs and create `SKU图片清单-<item-id>-<date>.csv` with `SKUID`, `商品ID`, SKU text, price, stock, and image URL.
   - Expected table fields include `SKU信息`, `SKU图片` or `图片链接`, `SKUID`, `商品ID`, `价格`, `券后价格`, `套餐类型`/`规格`, and `库存`.

6. Export question/customer-demand data:
   - Run `scripts/check_taobao_guard.py` before clicking.
   - Open `问大家` or `大家问` from the toolbar with Computer Use / visible UI, not JavaScript.
   - Wait for the `问大家分析` dialog. It may show `精简模式`, `完整模式`, category filters such as `全部`, `质量`, `香味`, `尺寸`, `好用`, `关注`, and `纸张`, plus a table.
   - If export controls are disabled, wait for the table to load before clicking. Watch the footer for states such as `拼命加载中`, a percent counter, or `已成功加载：0/0条数据`. A first load can take several minutes; `清理缓存` may unstick a stalled 50% load.
   - Do not save an empty workbook when the table still says `暂无数据` or export buttons are disabled. Retry by switching `完整模式`, using `清理缓存`, closing/reopening the `问大家` dialog once, and waiting again.
   - Treat large full-history question exports as high-risk. If the footer says there are many pages, export the currently loaded page(s) by default. Ask the user before auto-loading many pages such as 50+ or all pages.
   - Click `导出表格`, save from the macOS save panel, and return to the product page.
   - If the macOS save panel opens with `保存` disabled, cancel once, re-trigger export after the table is fully loaded, and accept the default filename. If save panels remain unreliable, temporarily disable Chrome `download.prompt_for_download`, export, then restore the original setting.
- Verify a workbook named like `店透视-问大家分析-<item-id>-<date>.xlsx` was downloaded.
- If Chrome leaves the question export as a hidden `.com.google.Chrome.*` file, validate that the workbook shared strings contain `问题` and `问答` plus at least one visible question from the loaded dialog before normalizing it to `店透视-问大家分析-<item-id>-<date>.xlsx`.
   - Expected table fields include `昵称`, `时间`, `问题`, and `问答`.

7. Collect files into a Desktop folder:
   - Run the helper script from this skill after the exports finish:

```bash
python /Users/shuishoukeke/.codex/skills/diantoushi-product-research/scripts/collect_exports.py \
  --product-name "<商品名>" \
  --item-id "<商品ID>" \
  --since-epoch "<run-start-epoch>"
```

   - By default the script moves matching files from `~/Downloads` into a new Desktop folder.
   - Use `--copy` only when the user wants to leave duplicates in `~/Downloads`.
   - Verify the script summary has at least one `product_data`, one `sku_preview`, and one `ask_all` file. If any kind is missing, inspect the relevant 店透视 dialog and retry that export.
   - Verify the SKU workbook or sidecar `SKU图片清单-*.csv` contains image links. If only embedded images were exported, keep the workbook and extracted images, but state that image URLs were not available from 店透视 for that run.

8. Import into MySQL when requested:
   - Locate the three workbooks in the Desktop folder:
     - `商品数据ID_*.xlsx`
     - `店透-SKU预览-表格-*.xlsx`
     - `店透视-问大家分析-*.xlsx`
   - Run `$mysql-import` dry-run with `clean-and-load`:

```bash
python /Users/shuishoukeke/.codex/skills/mysql-import/bin/run_mysql_import.py clean-and-load \
  --product-file "<desktop-folder>/商品数据ID_....xlsx" \
  --sku-file "<desktop-folder>/店透-SKU预览-表格-....xlsx" \
  --qa-file "<desktop-folder>/店透视-问大家分析-....xlsx" \
  --output-dir "<desktop-folder>/cleaned_output" \
  --dry-run
```

   - If dry-run passes and MySQL environment variables are available, run the same command without `--dry-run`.
   - Required MySQL environment variables: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE`.
   - Include the mysql-import output in the final summary: cleaned row counts, missing media paths, job ID if a real import ran, and any connection/schema errors.

9. Inspect optional sections when relevant:
   - `评价分析`: summarize review themes, common praise, complaints, and product attributes.
   - `商品图`, `车图下载`, or `买家秀`: gather image/creative patterns if the user asks about creative or listing assets.
   - `相似同款`, `全网找货`, or competitor controls: compare price, sales, title keywords, and visual positioning.
   - `主图&详情页仿写` or AI controls: use only to draft copy when the user explicitly asks for copywriting support.

10. Produce the research output:
   - Lead with the product identity and URL.
   - List the Desktop folder path and exported files with workbook sheet names, row counts, image-link availability, and the key columns found.
   - Separate hard observations from inference. Label inferred opportunities as `Inference` or `建议`.
   - Include SKU findings, customer-question themes, pricing/sales signals, positioning signals, mysql-import status, and recommended next checks.
   - If a file did not download, a save dialog was cancelled, or data was hidden/paginated, state the limitation and the exact UI area that needs another pass.

## Automation Notes

- Prefer clicking controls by visible text: `商品数据`, `SKU预览`, `导出表格`, `问大家`, `评价分析`, `相似同款`, `全网找货`, and `保存`.
- Before every export click, run `scripts/check_taobao_guard.py`. A nonzero exit with `guard_detected` means stop and ask the user to resolve verification.
- Wait for 店透视 overlays to finish loading before reading tables; loading states may show a placeholder logo, blank table, `暂无数据`, `拼命加载中`, or a progress footer. Do not export until table rows are visible and the export button is enabled.
- After each save, verify the expected workbook appears in the download folder and can be opened as an `.xlsx`.
- If using Chrome AppleScript automation, first ensure `Allow JavaScript from Apple Events` is enabled. Page JavaScript can click visible 店透视 controls, but System Events may still be unable to press macOS save dialogs.
- When temporarily changing Chrome download behavior, record the original value, restore it after the run, and confirm the restored value.
- For timestamp filtering on macOS, do not rely on GNU-only `find -newermt @<epoch>`. Use Python `Path.stat().st_mtime` comparisons, `touch -t` marker files, or BSD-compatible predicates instead.
- Use `scripts/collect_exports.py` for final file placement instead of manually guessing filenames. It filters by item ID and run start time, creates the Desktop folder, moves/copies matching `.xlsx` files, and validates workbook metadata when `openpyxl` is available.
- Treat database writes as a two-stage operation: dry-run first, then real import only after validation passes and connection details are available.
- Preserve the user's browser/session state. Do not add items to cart, purchase, contact sellers, favorite listings, or submit forms unless specifically asked.
- Redact personal account information, cookies, order information, private chats, and any proprietary paid data the user has not asked to expose.
