---
name: mysql-import
description: 清洗店透视/电商 Excel、提取 SKU 图片，并把结果导入 MySQL。Use when Codex needs to import a 店透视 export folder containing 商品数据、SKU预览、问大家 .xlsx files into MySQL, run dry-run validation, or load cleaned_output JSON snapshots.
---

# mysql-import

这个 skill 用于把店透视导出的电商 Excel 数据做成一条完整流水线：

1. 清洗 3 份 Excel
2. 提取 SKU 内嵌图片，并保留 SKU 图片链接
3. 读取商品详情页侧写 `product_page_images.json`，保存商品主图、详情图、详情长图等页面图片资产
4. 生成 `cleaned_output/*.json`
5. 把清洗结果和图片元数据导入 MySQL

## Skill directory contents

本 skill 是按 `skill-creator` 更容易打包和消费的方式组织的：

- `SKILL.md`：技能说明
- `RUNBOOK.md`：运行说明
- `.env.example`：环境变量示例
- `requirements.txt`：Python 依赖
- `bin/run_mysql_import.py`：skill 内部入口

真正的项目逻辑由 skill 目录里的脚本实现：

- `clean_data.py`
- `load_to_mysql.py`
- `run_mysql_import.py`

skill 内的 `bin/run_mysql_import.py` 是稳定 wrapper，它会调用 skill 目录内的真正入口。

## From a 店透视 export folder

当桌面文件夹里已有三份导出表格时，先定位文件：

- `商品数据ID_*.xlsx`
- `店透-SKU预览-表格-*.xlsx`
- `店透视-问大家分析-*.xlsx`

然后运行：

```bash
python /Users/shuishoukeke/.codex/skills/mysql-import/bin/run_mysql_import.py clean-and-load \
  --product-file "<folder>/商品数据ID_....xlsx" \
  --sku-file "<folder>/店透-SKU预览-表格-....xlsx" \
  --qa-file "<folder>/店透视-问大家分析-....xlsx" \
  --output-dir "<folder>/cleaned_output" \
  --dry-run
```

如果商品只有 `商品数据` 和 `SKU预览`，但 `问大家` 没有可导出数据，可使用：

```bash
python /Users/shuishoukeke/.codex/skills/mysql-import/bin/run_mysql_import.py clean-and-load \
  --product-file "<folder>/商品数据ID_....xlsx" \
  --sku-file "<folder>/店透-SKU预览-表格-....xlsx" \
  --output-dir "<folder>/cleaned_output" \
  --allow-missing-qa \
  --dry-run
```

这种模式会生成空的 `product_qa_snapshot.clean.json`，正式导入时商品和 SKU 会入库，问大家为 0 条。

dry-run 通过后，确认 MySQL 环境变量已设置，再去掉 `--dry-run` 正式导入。正式导入前 loader 会自动用 `CREATE TABLE IF NOT EXISTS` 补齐缺失的数据表，不会重建或清空已有表。

## Modes

### load-only

对已有 `cleaned_output/` 执行 dry-run 或正式导入：

```bash
python /Users/shuishoukeke/.codex/skills/mysql-import/bin/run_mysql_import.py load-only --dry-run
```

### init-schema

只初始化 MySQL 表结构，不导入数据：

```bash
python /Users/shuishoukeke/.codex/skills/mysql-import/bin/run_mysql_import.py init-schema
```

### clean-and-load

先清洗，再 dry-run，再正式导入：

```bash
python /Users/shuishoukeke/.codex/skills/mysql-import/bin/run_mysql_import.py clean-and-load --dry-run
```

## Real import

```bash
python /Users/shuishoukeke/.codex/skills/mysql-import/bin/run_mysql_import.py load-only
```

## Environment

需要这些环境变量：

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

其中 `MYSQL_PASSWORD` 可以为空字符串。

PowerShell 示例见 `RUNBOOK.md`，默认示例值见 `.env.example`。

## Expected behavior

- 每次正式导入都会先确保所需表存在，然后新建一条 `crawl_job`
- 导入的是快照数据，不覆盖历史批次
- 图片只导出为文件并保存元数据，不写入 Blob；如果 SKU 表含 `SKU图片` / `图片链接` / `SKU图片链接`，会同步写入 `product_sku_snapshot.sku_image_url`
- 如果商品目录包含 `product_page_images.json`，会把商品详情页采集到的 `main_image` / `detail_image` 写入专表 `product_page_image_asset`，并同步合并到通用 `media_asset`
- SKU 原始价格写入 `product_sku_snapshot.price` / `coupon_price`；导入时会同步汇总到 `product_snapshot.min_price`、`max_price`、`min_coupon_price`、`max_coupon_price`、`effective_min_price`、`effective_max_price`，方便按商品做价格带分析。

## Validation

先跑 dry-run：

```bash
python .claude/skills/mysql-import/bin/run_mysql_import.py load-only --dry-run
```

再跑正式导入，最后在 MySQL 回查：

```sql
SELECT COUNT(*) FROM product_snapshot WHERE job_id = ?;
SELECT COUNT(*) FROM product_sku_snapshot WHERE job_id = ?;
SELECT COUNT(*) FROM product_qa_snapshot WHERE job_id = ?;
SELECT COUNT(*) FROM media_asset WHERE job_id = ?;
SELECT COUNT(*) FROM product_page_image_asset WHERE job_id = ?;
```
