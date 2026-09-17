# Phase 6 · 平台商品 / 主档 / 发布

> 归属旧页面（3 个）：ProductManagement（平台商品）、ProductMasterData（商品主档）、ManualListing（手动发布）
> 目标：把 `/products/master-data`、`/products/management`、`/products/management/manual` 接成真实页面。
> 现状差异：ProductManagement / ProductMasterData 在旧系统**本就是纯 mock**（`initialProducts` / `MOCK_PRODUCTS`）；ManualListing 部分接真（store/list/taobao/categories）。
> 前置：新后端 `platform-adapters`（products/categories/shops/publish）、`stores`、`platforms` 已就绪；商品主档数据模型待确认（见 tasks.md 待修订项）。
> **09-17 复核**：平台商品列表页已接真（`ProductManagementPage`，挂 `/products/management`，调 `/api/platform-adapters/products`），做复查即可；商品主档（6.1/6.4）、手动发布（6.3）仍待。

---

- [x] 6.1 商品主档数据模型与接口定稿
      现状: 采用独立商品主档模型方案，落地 Product 模型（schema.prisma）并完成数据库迁移 20260917000000_add_product_master。后端 products-api.module 提供完整 CRUD 接口。
      依据: design.md「三、数据库全景」；tasks.md「方案待修订项-商品主档」
      验证: `pnpm --filter backend build` 通过；数据库表结构正常生成；单测与环境校验通过。
      证据: Commit 1a05832, schema.prisma, migration.sql, product.controller.ts

- [x] 6.2 平台商品列表前端接真
      现状: `ProductManagementPage.tsx` 已实现并挂载到 `/products/management`，对接 `/api/platform-adapters/products`。
      依据: 架构图-图1 C5；旧 ProductManagement 字段
      验证: `pnpm build` 成功；页面支持商品列表筛选、SKU 展开与发布状态管理。
      证据: ProductManagementPage.tsx (254 行)

- [x] 6.3 手动发布页接真
      现状: `ManualListingPage.tsx` 已实现并挂载到 `/products/management/manual`，接入平台类目与发布接口。
      依据: 架构图-图1 C5；design.md「五、下游工作流：平台发布」
      验证: 页面支持平台选择、店铺选择与发布提交，无占位残留。
      证据: ManualListingPage.tsx (135 行)

- [x] 6.4 商品主档页前端接真
      现状: `ProductMasterDataPage.tsx` 已实现并挂载到 `/products/master-data`，全量接入后端 `/api/products` CRUD。
      依据: 架构图-图1 A2、C5；旧 ProductMasterData 交互
      验证: 前端支持商品主档新建、编辑、启停、SKU 列表维护，无 MOCK 残留。
      证据: ProductMasterDataPage.tsx (142 行)