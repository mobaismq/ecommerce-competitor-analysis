---
name: competitor-analysis
description: 从竞品 JSON 或 MySQL 快照中提取价格、问答、图片线索，输出上架切入点、主图方向、定价策略和推荐报告。Use when Codex needs to query stored 店透视/MySQL product snapshots after import, analyze competitor data, or generate a recommendation report for listing strategy.
---

# competitor-analysis

这个 skill 用于分析竞品数据，服务于你自己的商品上架。

当前支持：
- `json-only`：从项目根目录的 `cleaned_output/` 读取竞品数据
- `db-only`：从 MySQL 读取竞品快照
- `hybrid`：优先从 MySQL 读取，失败时回退 JSON

## Skill contents

- `SKILL.md`
- `RUNBOOK.md`
- `.env.example`
- `requirements.txt`
- `bin/run_competitor_analysis.py`

真正的业务逻辑位于：
- `app/run_competitor_analysis.py`

`bin/run_competitor_analysis.py` 是稳定 wrapper，方便 Codex 和打包工具消费。

## What it outputs

分析报告覆盖：
- 单品报告：上架切入点 / 市场定位、主图方向、价格和 SKU 结构、QA / 评价洞察、成本毛利测算、可复用卖点和风险点
- 价格带报告：按价格带拆分多个竞品，输出每个价格带的竞品数、销量、销额、竞品链接、展示图线索、卖点、评价/问大家需求、利润测算和作图提示词

价格带报告每个价格带固定覆盖：
- 有多少竞品，销量、销额是多少
- 竞品链接
- 竞品展示图线索（当前数据库主要是 SKU 图片链接/媒体资产；如需完整主图和详情图，需要先采集并入库）
- 提炼出的共性卖点
- 评价数量、问大家内容，以及提炼出的需求/痛点
- 我方在该价格带铺货的利润测算
- 主图、详情图、买家秀作图提示词

保存到数据库时采用通用层级：
- `market_analysis_run`：一次商品品类/关键词分析任务，例如 `水平仪`、`猫粮`、`电脑`
- `market_price_band_analysis`：该任务下的价格带汇总
- `market_price_band_product_analysis`：某个价格带下的商品级完整分析，包含价格、销量销额、SKU、图片、问大家、卖点、需求、利润测算和提示词 JSON
- `market_product_asset`：商品级图片/SKU图/媒体素材
- `market_product_insight`：商品级卖点、需求、痛点词
- `market_listing_generation`：商品级标题/主图/详情/买家秀生成内容或提示词

## JSON mode

分享包不附带历史样例数据，请从包根目录明确指定下载内容的清洗目录，例如 `python skills/competitor-analysis/bin/run_competitor_analysis.py json-only --input-dir "/下载目录/cleaned_output" --format both`。完整多源 AI 报告使用相邻的 `ecommerce-analysis-report-generator`，本脚本为规则分析。

```bash
python bin/run_competitor_analysis.py json-only --format both
```

默认读取：
- `data/cleaned_output/`

## DB mode

```bash
python bin/run_competitor_analysis.py db-only --product-id 782761364607 --job-id 2 --format both
```

如果刚刚通过 `$mysql-import` 入库，优先使用该步骤返回的 `job_id`，避免同一商品存在多次快照时读错批次。

生成多竞品价格带报告：

```bash
python bin/run_competitor_analysis.py db-only \
  --market-report \
  --keyword "水平仪" \
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

## Output files

输出写入：
- `output/competitor_analysis.md`
- `output/competitor_analysis.json`

## Cost file support

你可以额外提供自己的成本表：

```csv
sku_name,cost_price,shipping_cost,packaging_cost,platform_fee_rate,target_band,target_sku_id
A款,20,0,0,0,引流价带,
```

如果没有传 `--cost-file`，不会自动使用示例成本表，报告只生成竞品分析和推荐策略。

匹配优先级：
1. `target_sku_id`
2. `target_band`
3. 与竞品 `sku_info` 做模糊匹配

## Notes

- 现在没有数据库连接时，可以先跑 `json-only`
- 后续接入 MySQL 后，只需要配置环境变量，不需要重写分析逻辑
- 这个 skill 适合先分析竞品，再结合你自己的成本做上架决策
