# competitor-analysis runbook

## What this package does

- Read competitor data from `cleaned_output/` in JSON mode now
- Read competitor data from MySQL later
- Output listing strategy, hero image direction, pricing analysis, and QA insights

## Entry point

```bash
python bin/run_competitor_analysis.py json-only --format both
```

## JSON mode

```bash
python bin/run_competitor_analysis.py json-only --format both
```

默认路径为（分享包未附带样例数据，运行时请用 `--input-dir` 指定自己的清洗目录）：
- `data/cleaned_output/`

## DB mode

```bash
python bin/run_competitor_analysis.py db-only --product-id 782761364607 --job-id 2 --format both
```

Prefer passing `--job-id` from the preceding mysql-import result when available.

## Market price-band report

按一个商品关键词分析一批竞品，并按价格带输出竞品数、销量、销额、链接、图片线索、卖点、问大家需求、利润测算和作图提示词：

```bash
python bin/run_competitor_analysis.py db-only \
  --market-report \
  --keyword "水平仪" \
  --limit 120 \
  --cost-price 100 \
  --save-to-db \
  --shipping-cost 0 \
  --packaging-cost 0 \
  --labor-cost 0 \
  --platform-fee-rate 0 \
  --ad-fee-rate 0 \
  --target-margin 0.30 \
  --format both
```

说明：
- `--cost-price` 不传时，只做竞品和价格带分析，不计算毛利。
- 当前数据库如果没有采集商品主图/详情图，报告会使用 SKU 图片链接和 `media_asset` 作为图片线索，并在报告中标注数据缺口。
- 当前数据库如果没有评价明细，报告会使用评价数量和问大家内容提炼需求。

## Query path for later listing generation

后续使用时先选商品品类，再选价格段，再选商品：

```sql
SELECT id, keyword, competitor_count, price_band_count, created_at
FROM market_analysis_run
ORDER BY created_at DESC;

SELECT id, price_band, competitor_count, price_min, price_max, price_avg
FROM market_price_band_analysis
WHERE run_id = ?;

SELECT id, product_id, product_title, price, sold_count, sales_amount, sku_count, qa_count, image_count
FROM market_price_band_product_analysis
WHERE run_id = ?
  AND price_band_id = ?
ORDER BY sold_count DESC, price ASC;
```

选中商品后，可通过 `market_product_asset`、`market_product_insight`、`market_listing_generation` 读取图片、卖点/需求和作图提示词。

## Hybrid mode

```bash
python bin/run_competitor_analysis.py hybrid --product-id 808636994094 --format both
```

## Outputs

Generated under `output/`:

- `competitor_analysis.md`
- `competitor_analysis.json`

## Cost input

You can provide your own cost file:

```bash
python bin/run_competitor_analysis.py json-only --cost-file examples/costs.csv --format both
```

Cost analysis is optional. If `--cost-file` is omitted, the report does not load the example cost file.

CSV format:

```csv
sku_name,cost_price,shipping_cost,packaging_cost,platform_fee_rate,target_band,target_sku_id
A款,20,0,0,0,引流价带,
```

Matching priority:
1. `target_sku_id`
2. `target_band` (`引流价带` / `主销价带` / `利润价带`)
3. fuzzy match against competitor `sku_info`

## Environment variables for DB mode

```powershell
$env:MYSQL_HOST="localhost"
$env:MYSQL_PORT="3306"
$env:MYSQL_USER="root"
$env:MYSQL_PASSWORD=""
$env:MYSQL_DATABASE="sys"
```
