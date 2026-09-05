---
name: market-analysis-report
description: 基于已入库的店透视竞品数据（product_snapshot / product_sku_snapshot / product_qa_snapshot / product_review_snapshot / media_asset 等表），调用豆包 Ark 生成《竞品市场分析与 Listing 图片生成策略报告》并落库 market_analysis_run.report_json。Use when 需要生成或重新生成竞品市场分析报告、执行单品主图 Vision 分析，或排查报告页三个动态区块（关键词矩阵 / 建议动作 / 主图卖点）的计算逻辑。
---

# market-analysis-report

这个 skill 是"电商竞品分析"四层流水线的**第三层（AI 分析生成）**，负责把前两层（`diantoushi-product-research` 采集 → `mysql-import` 入库）沉淀的数据，转成一份可直接用于 Listing 图片生成的策略报告。

> 核心代码：`app/src/server/aiMarketAnalysis.js`（约 6150 行）
> API 路由：`app/vite.config.ts`（Vite 插件中间件 `localRpaApi`）
> 前端展示：`app/src/app/pages/AnalysisReportView.tsx`
> 详细分析文档：项目根目录 `报告生成逻辑分析.md`（含全部 AI 提示词原文）

## 整体数据流（四层流水线）

```
第一层：RPA 数据采集   skills/diantoushi-product-research
第二层：数据清洗入库   skills/mysql-import  →  MySQL（sys 库）
第三层：AI 分析生成    market-analysis-report（本 skill）
   ① 单品主图分析（每商品一次 Vision 调用）→ product_main_image_analysis 表
   ② 整体报告生成（一次大调用）→ market_analysis_run.report_json
第四层：查看时动态计算（getAnalysisReportView）
   关键词矩阵 / 建议动作与评论反推 / 主图卖点 → 纯本地算法实时计算，不走 AI
```

**关键结论**：报告页三大动态区块（关键词矩阵、建议动作、主图卖点）是**每次查看时实时从数据库重新计算**的，修改过滤规则/停用词后刷新页面立即生效，无需重新生成报告。

---

## 前置条件

1. MySQL（`sys` 库）已有前两层入库的数据，关键表：
   - `product_snapshot` / `product_sku_snapshot` / `product_qa_snapshot`
   - `product_review_snapshot` / `media_asset` / `product_page_image_asset`
2. 本地配置已就绪（`app/.env.local` 中的数据库、豆包 Ark API Key 等）。
3. 前端 dev server 已启动（`npm run dev`），报告生成走 Vite 中间件的本地 API。

---

## 调用方式（API 接口）

| 接口 | 用途 |
|---|---|
| `POST /api/report/generate` | 触发报告生成（异步，返回 job） |
| `GET /api/report/generate-status` | 轮询生成进度/状态 |
| `GET /api/report/analysis-view?id=N` | 查看某次报告（含动态区块实时计算） |
| `GET /api/report/latest` | 读取最近一次报告 |
| `GET /api/report/products-view` | 查看报告涉及的商品列表 |
| `POST /api/report/product-main-image-analysis` | 单品主图分析 |

---

## 生成流程（两次 AI 调用）

### ① 单品主图分析 `collectProductMainImageAnalysisContent`

- **时机**：对每个商品单独调用，Vision 思考型模型，输入 1 张主图。
- **输入**：主图 + 商品标题 / SKU / 问大家数据。
- **角色**："资深电商商品图和用户需求分析师"。
- **产出**：`product_main_image_analysis.report_json`，是整体报告的核心输入。

### ② 整体报告生成 `collectOverallReportFromProductReportsContent`

- **时机**：所有单品主图分析入库后，一次纯文本大调用。
- **输入**：每个商品的单品分析报告 + 商品数据 + 问大家（≤8 条/品）+ 真实评价正文（≤8 条/品）+ 销售数据。
- **角色**："资深电商竞品策略分析师"。
- **产出**：`market_analysis_run.report_json`（报告 00~10 全部区块，Schema 见 `报告生成逻辑分析.md` 附录 D）。

---

## 报告区块：动态 vs 固化（务必区分）

| 区块 | 生成方式 | 改代码后是否生效 |
|---|---|---|
| KW 关键词矩阵（核心词 / 蓝海词） | 动态计算，纯本地算法 | 立即生效 |
| ACT 建议动作与评论反推（好评 Top3 / 差评 Top3） | 动态计算，纯本地算法 | 立即生效 |
| SELL 主图卖点 / 详情页卖点 | 动态计算（依赖①的 AI 结果） | 立即生效 |
| 00~10 AI 主报告区块 | 生成时固化入库 | **必须重新生成报告** |

---

## 动态区块的本地规则要点（改这里立即生效）

- **关键词停用词表** `KEYWORD_MATRIX_STOP_WORDS`：150+ 词（虚词连词、程度副词、技术字段名、泛化名词）。
- **好评/差评主题模板** `topicDefinitionsForKeyword`：按类目（纸品 / 食品 / 口罩 / 默认）返回主题 + 正则 + 反推卖点文案。
- **卖点过滤器链**：`isGarbageSellingPoint`（泛场景/品类词）→ `isGimmickTerm`（噱头词）→ `isPureQuantityTerm`（纯数量）→ SKU 变体名正则。
- **语义分组** `SEMANTIC_GROUPS`（13 组）：如 "40包/20包" → "整箱量贩超值装"。
- **类目视觉策略** `mainImageVisualByCategory`：性价比→规格对比、品质原料→微距特写、产地背书→地图标注。

---

## AI 提示词位置（原文见 `报告生成逻辑分析.md` 附录）

| 提示词 | 函数 | 用途 |
|---|---|---|
| A | `collectProductMainImageAnalysisContent` | 单品主图分析 |
| B | `collectOverallReportFromProductReportsContent` | 整体报告生成（主链路） |
| C | `collectVisualBatchContent` | 视觉批次分析（旧版批量链路） |
| C2 | `collectFinalReportContent` | 旧版最终报告（批量链路） |
| E | `generateAiPriceBands` | AI 价格区间划分（可选） |

---

## 关键工程细节 / 注意事项

1. **防幻觉设计**：提示词反复强调"保留原始数字、不编造评价、样本不足要明说"；本地有 `fallbackAiJsonFromReport` / `buildStrategyReportFallback` 两套兜底，AI 返回格式异常时用本地统计算法生成报告。
2. **类目自适应**：主题模板按搜索词判断纸品/食品/口罩类目，痛点和反推卖点文案随之切换。
3. **SKU 约束**：SKU 只允许作价格/规格背景，**不得当卖点或需求证据**；SKU 图不参与视觉分析。
4. **存储**：报告 JSON 存 `market_analysis_run.report_json`（LONGTEXT）；同关键词多次生成可通过 `mergeReportRuns` 合并展示。
5. **模型**：豆包 Ark Responses API，`doubao-seed-2-1-pro-260628` 思考型模型。
