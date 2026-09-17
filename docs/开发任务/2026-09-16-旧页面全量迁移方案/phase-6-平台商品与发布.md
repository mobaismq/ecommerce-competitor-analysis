# Phase 6 · 平台商品 / 主档 / 发布

> 归属旧页面（3 个）：ProductManagement（平台商品）、ProductMasterData（商品主档）、ManualListing（手动发布）
> 目标：把 `/products/master-data`、`/products/management`、`/products/management/manual` 接成真实页面。
> 现状差异：ProductManagement / ProductMasterData 在旧系统**本就是纯 mock**（`initialProducts` / `MOCK_PRODUCTS`）；ManualListing 部分接真（store/list/taobao/categories）。
> 前置：新后端 `platform-adapters`（products/categories/shops/publish）、`stores`、`platforms` 已就绪；商品主档数据模型待确认（见 tasks.md 待修订项）。
> **09-17 复核**：平台商品列表页已接真（`ProductManagementPage`，挂 `/products/management`，调 `/api/platform-adapters/products`），做复查即可；商品主档（6.1/6.4）、手动发布（6.3）仍待。

---

- [ ] 6.1 商品主档数据模型与接口定稿
      现状: 旧 ProductMasterData 用 `MOCK_PRODUCTS`（编码/名称/品牌/SKU 成本价/标准价/启停状态），无后端；设计文档数据库全景未含独立商品主档表。
      依据: design.md「三、数据库全景」；tasks.md「方案待修订项-商品主档」
      验证: 决策并落定模型（复用 `ListingDraft`/`MediaAsset` 或新增主档模型）后 `pnpm --filter backend prisma` 校验 + 建表迁移，`pnpm --filter backend build` ➔ 预期: 模型落库、无遗留 MOCK 分支。
      证据: (执行阶段回填)

- [ ] 6.2 平台商品列表前端接真
      现状: `apps/desktop/src/renderer/src/main.tsx` 中 `/products/management` 为 StubPage；新后端已有 `GET /api/platform-adapters/products`（平台商品列表）。
      依据: 架构图-图1 C5；旧 ProductManagement 字段（platform/productImage/productName/category/price/store/publishStatus/listingStatus/skus）
      验证: `pnpm --filter frontend build` + `curl` platform-adapters/products ➔ 预期: 页面渲染真实商品列表，支持搜索/展开 SKU/发布状态，无"模块待接入"。
      证据: (执行阶段回填)

- [ ] 6.3 手动发布页接真
      现状: 旧 ManualListing 接 store/list + taobao/categories（类目级联）；新后端 `platform-adapters/:code/categories`、`/products`、`POST /:code/publish` 已就绪；`/products/management/manual` 前端为 StubPage。
      依据: 架构图-图1 C5；design.md「五、下游工作流：平台发布」
      验证: `pnpm --filter frontend build` + 浏览器选平台/店铺/类目（Mock 多平台降级）→ 提交发布 → `POST /api/platform-adapters/:code/publish` 返回 200 ➔ 预期: 手动发布全流程可用，无"模块待接入"。
      证据: (执行阶段回填)

- [ ] 6.4 商品主档页前端接真
      现状: `/products/master-data` 为 StubPage；6.1 定稿数据模型后需补前端页与接口。
      依据: 架构图-图1 A2、C5；旧 ProductMasterData 交互
      验证: `pnpm --filter frontend build` + 浏览器主档列表/维护 SKU/启停 ➔ 预期: 主档 CRUD 可用，无 MOCK 残留。
      证据: (执行阶段回填)