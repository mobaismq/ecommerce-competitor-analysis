# Phase 2 · 报告域补齐

> 归属旧页面（3 个）：MarketReport（市场报告/生成工作台）、AnalysisReportView（报告详情）、AnalysisProductsView（报告商品/竞品明细）
> 目标：补后端报告聚合/竞品/主图分析/价格带预览/生成工作台接口，并把 3 个 StubPage 接成真实页面。
> 前置：价格带算法已入 `report.service`（R-3 完成）；后端 reports 现仅有 list/getById/export。
> **09-17 复核**：报告详情前端已接真（`AnalysisReportViewPage`，挂 `/analysis/reports/:id`，调 `/api/reports/:id` + export），做复查即可；后端仍缺竞品/主图分析/生成工作台，2.1-2.4 后端项不变。
> 验证原则：全部用 `rpa_runs/` 离线样本 + Mock AiProvider，禁止循环触发真实报告分析（防 Token）。

---

- [ ] 2.1 补报告详情聚合接口（analysis-view）
      现状: `apps/backend/src/reports/reports.controller.ts` `GET /api/reports/:id` 仅返回 report + priceBands；旧 AnalysisReportView 依赖 analysis-view 的多维区块（salesAnalysis/sellingAnalysis/demandAnalysis/layoutSuggestions/reviewAnalysis/qaAnalysis/keywordMatrix/priceBandProducts + 扁平 AI 字段）。
      依据: 架构图-图1 C4；design.md「五、任务队列」报告落库；旧表覆盖 `AnalysisRun/price_band_*`
      验证: `pnpm --filter backend test` 新增聚合服务单测（用离线 reportJson 样本）+ `curl -i http://127.0.0.1:8787/api/reports/:id` ➔ 预期: 200 且返回含竞品/价格带/卖点/需求/利润等区块。
      证据: (执行阶段回填)

- [ ] 2.2 补竞品商品/SKU 明细接口（products-view）
      现状: 旧 AnalysisProductsView 依赖 `GET /api/report/products-view?id=&keyword=`（商品/SKU/主图分析状态）与 `POST/GET /api/report/product-main-image-analysis`（主图 Vision 分析落 MainImageAnalysis）；新后端无对应接口。
      依据: 架构图-图1 C4、C13；design.md「八、图片与文件资产」；旧表 `product_snapshot/product_sku_snapshot/product_main_image_analysis`
      验证: `pnpm --filter backend test` 商品视图单测（离线样本）+ `curl -i .../api/reports/:id/products` ➔ 预期: 200 返回商品+SKU 列表；主图分析接口用 MockAiProvider，`pnpm --filter backend test` 通过。
      证据: (执行阶段回填)

- [ ] 2.3 补价格带预览与生成工作台接口（price-bands-preview / latest / products / generate / generate-status）
      现状: 旧 MarketReport 依赖 latest/products/price-bands-preview/generate/generate-status 并含成本/费率参数做利润测算；新后端 reports 无生成工作台接口（生成能力见 phase-4 数据下载/报告 Job 链路）。
      依据: 架构图-图1 C4、C8；design.md「五」分析任务状态机；R-3 价格带算法
      验证: 生成走 `Job(analysis)` + `report` 流程（Mock），`pnpm --filter backend test` 报告生成单测 + `curl` 建任务/轮询状态 ➔ 预期: 任务 queued→…→success，报告落库，价格带预览接口返回分带与利润测算。
      证据: (执行阶段回填)

- [ ] 2.4 迁移 openai-settings 到 ProviderProfile
      现状: 旧 MarketReport 的 `GET/POST /api/report/openai-settings`（存豆包 Ark key）已过时（火山 Ark 停用）；新后端用 `ProviderProfile` 统一管理 AI 配置（`provider-profiles` controller）。
      依据: design.md「AI 供应商适配 / 多供应商配置实例」；服务端旧逻辑迁移核对表
      验证: 删除旧 openai-settings 引用后 `pnpm --filter backend build` ➔ 预期: 构建通过，报告工作台的 AI 配置面板改读 ProviderProfile。
      证据: (执行阶段回填)

- [ ] 2.5 前端接真报告详情/报告商品/市场报告 3 个页面
      现状: `apps/desktop/src/renderer/src/main.tsx` 中 `/analysis/reports/:id`、`/:id/products`、`/analysis/market-reports` 均为 StubPage；后端接口经 2.1-2.3 补齐。
      依据: 架构图-图1 A2；页面迁移矩阵
      验证: `pnpm --filter frontend build` + 浏览器登录后访问 3 路由（用离线报告样本渲染）➔ 预期: 详情多维区块、商品/SKU 明细、市场报告生成工作台均渲染且可交互，无"模块待接入"占位。
      证据: (执行阶段回填)
