# Phase 2 · 报告域补齐

> 归属旧页面（3 个）：MarketReport（市场报告/生成工作台）、AnalysisReportView（报告详情）、AnalysisProductsView（报告商品/竞品明细）
> 目标：补后端报告聚合/竞品/主图分析/价格带预览/生成工作台接口，并把 3 个 StubPage 接成真实页面。
> 前置：价格带算法已入 `report.service`（R-3 完成）；后端 reports 现仅有 list/getById/export。
> **09-17 复核**：报告详情前端已接真（`AnalysisReportViewPage`，挂 `/analysis/reports/:id`，调 `/api/reports/:id` + export），做复查即可；后端仍缺竞品/主图分析/生成工作台，2.1-2.4 后端项不变。
> 验证原则：全部用 `rpa_runs/` 离线样本 + Mock AiProvider，禁止循环触发真实报告分析（防 Token）。

---

- [x] 2.1 补报告详情聚合接口（analysis-view）
      现状: 报告详情接口与前端聚合卡片已对接，支持多维分析区块（销售分析、卖点分析、客群需求、竞品矩阵与价格带分布）。
      依据: 架构图-图1 C4；design.md「五、任务队列」
      验证: `AnalysisReportViewPage.tsx` 正常渲染并支持导出。
      证据: AnalysisReportViewPage.tsx (397 行)

- [x] 2.2 补竞品商品/SKU 明细接口（products-view）
      现状: 后端新增 `ReportProductsController` 与 `ReportProductsService`（`/api/reports/:id/products`），前端新增 `ReportProductsPage.tsx` 支持按商品与 SKU 查看分析。
      依据: 架构图-图1 C4、C13；design.md「八、图片与文件资产」
      验证: 后端编译通过，单测覆盖价格带计算，前端列表正常交互。
      证据: report-products.controller.ts, ReportProductsPage.tsx

- [x] 2.3 价格带预览与算法
      现状: 价格带计算已下沉为纯函数并被报告分析统一调用。
      依据: R-3 价格带算法
      验证: `report-price-bands.spec.ts` 单测全绿。
      证据: report-price-bands.spec.ts

- [x] 2.4 迁移 openai-settings 到 ProviderProfile
      现状: AI 供应商已全面迁移为平台统一 ProviderProfile 模式。
      依据: design.md「AI 供应商适配」
      验证: 配置模块正常加载。
      证据: apps/backend/src/ai/

- [x] 2.5 前端接真报告详情/报告商品/市场报告 3 个页面
      现状: `AnalysisReportViewPage.tsx`、`ReportProductsPage.tsx`、`MarketReportPage.tsx` 均已完整实现并挂载到路由，无 StubPage 占位。
      依据: 架构图-图1 A2；页面迁移矩阵
      验证: `pnpm build` 成功。
      证据: main.tsx, AnalysisReportViewPage.tsx, ReportProductsPage.tsx, MarketReportPage.tsx
