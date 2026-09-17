# 旧页面全量迁移（2026-09-16）

> 任务：把 `apps/legacy/src/app/pages` 全部 28 个旧页面完整迁入新前端，一个都不能少。
> 方案基线：`docs/开发任务/2026-09-10-桌面端与服务端架构方案/design.md`、`架构图.md`（四图 + 唯一权威判据表）。
> 工作流：`.agents/workflows/plan.md` → 本目录 `tasks.md` + `phase-1..8`。执行走 `/apply`。
> 迁移判定：凡是旧系统已有真实后端/数据交互的页面必须接到新后端对应能力；旧系统即为 mock/桩的页面（商品主档、平台商品、一键复刻/复刻、账号信息等）按「接真 or 明确裁剪」决策迁移，不得遗漏、不得静默丢弃。

---

## 现状基线

> 证据来源：2026-09-16 全量代码盘点（`apps/legacy/src/app/pages` 28 页 vs `apps/desktop/src/renderer/src/pages` 8 文件 vs 新后端 Controller 全量路由）。
> **09-17 复核**：① 已有会话新增 3 个前端真页面——`AnalysisReportViewPage`（报告详情）、`DataAgentChatPage`（数据 Agent）、`ProductManagementPage`（平台商品）。② **前端已全量并入桌面端 renderer**：`apps/frontend` 删除，所有页面/样式/工具迁至 `apps/desktop/src/renderer/src`；桌面端 `main/index.ts` 统一加载 renderer、`HashRouter` 路由。下表路径均已按新位置（`apps/desktop/src/renderer/src`）更新；3 个已接真页面进入「复查」，其余待迁移项不变。

### 旧页面 28 → 新落点总账（一个都不能少）

| 旧页面 | 旧路由 | 新路由 | 现状 | 归属 Phase |
|---|---|---|---|---|
| LoginPage | /login | /login | ✅ 已迁移（新 LoginPage） | — |
| PhoneVerificationPage | /verify-phone | /settings/verify-phone | ✅ 已迁移（短信能力位预留，明确标注未接入短信） | P1 |
| ChangePasswordPage | /change-password | /settings/change-password | ✅ 已迁移（接 /api/auth/change-password） | P1 |
| ChangePhonePage | /change-phone | /settings/change-phone | ✅ 已迁移（接 /api/auth/change-phone） | P1 |
| AccountInfoPage | /settings/account-info | /settings/account-info | ✅ 已迁移（展示登录态账号 + 入口） | P1 |
| ProductMasterData | /product/master-data | /products/master-data | ⏳ StubPage；旧即 mock，需重新设计 | P6 |
| ProductManagement | /product/management | /products/management | ✅ 前端已接真 platform/products（ProductManagementPage） | P6·复查 |
| ManualListing | /product/management/manual | /products/management/manual | ⏳ StubPage；接 platform publish/store/categories | P6 |
| ProductImageSets | /product-sets | /content/product-sets | ⏳ StubPage；后端 product-sets 缺 | P3 |
| APlusDetail | /aplus | /content/aplus | ⏳ StubPage；后端 product-sets 缺 | P3 |
| ViralReplication | /replicate | /content/replicate | ⏳ StubPage；旧即 mock demo | P7 |
| ViralVideoReplication | /video-replicate | /content/video-replicate | ✅ 已迁移（VideoReplicatePage） | — |
| OneClickReplicate | /one-click-replicate | /content/one-click-replicate | ⚠️ 被误复用 VideoReplicatePage，语义错误 | P7 |
| AIDataCollection | /market/competitive/ai-collect | /analysis/collect | ✅ 已迁移（AnalysisCollectPage） | — |
| AnalysisReport | /market/competitive/report | /analysis/reports | ✅ 已迁移（ReportsListPage） | — |
| AnalysisReportView | /market/competitive/report/view | /analysis/reports/:id | ⏳ 前端已接真（AnalysisReportViewPage）；**后端仍缺竞品/主图分析聚合** | P2 |
| AnalysisProductsView | /market/competitive/report/products | /analysis/reports/:id/products | ⏳ StubPage；后端缺 products-view | P2 |
| DataAgentChat | /market/competitive/agent | /analysis/agent | ✅ 前端已接真（DataAgentChatPage） | P5·复查 |
| MarketReport | /market-report | /analysis/market-reports | ⏳ StubPage；后端缺生成工作台接口 | P2 |
| DataAnalytics | /analytics | /analytics | ✅ 已迁移（DataAnalyticsPage） | — |
| DataDownload | /data-download | /data/downloads | ⏳ StubPage；后端缺 rpa 触发/状态 | P4 |
| DataDownloadRun | /data-download/run | /data/downloads/:id | ⏳ StubPage；同上 | P4 |
| ImageGallery | /asset/image-gallery | /assets/images | ✅ 已迁移（AssetsPage） | — |
| VideoGallery | /asset/video-gallery | /assets/videos | ✅ 已迁移（VideoGalleryPage） | — |
| AssetLibrary | 未注册路由 | /assets | ✅ /assets 已由 AssetsPage 承接；待确认补路由或裁剪 | P7 |
| AccountManagement | /settings/account | /settings/accounts | ✅ 已迁移（AdminUsersPage） | — |
| RoleManagement | /settings/role | /settings/roles | ✅ 已迁移（AdminRolesPage） | — |
| StoreManagement | /settings/store | /settings/stores | ✅ 已迁移（AdminStoresPage） | — |

> 已迁移 10 页；09-17 又接真 3 页（报告详情/数据 Agent/平台商品，其中报告详情后端聚合仍待补）；纯占位待迁移 15 页。

### 后端能力现状（对照旧页面接口）

| 能力域 | 旧接口 | 新后端现状 | 缺口 |
|---|---|---|---|
| 报告 | /api/report/latest·products·price-bands-preview·generate·generate-status·analysis-view·products-view·product-main-image-analysis·main-image-ai-report | reports: `GET /` `GET /:id` `POST/:runId/export`；价格带算法已入 R-3 | ❌ 缺 analysis-view/products-view/主图分析/生成工作台/价格带预览 |
| 图片生成 | /api/product-sets/*（9 个） | images: 仅 `POST /:id/decision`（审核） | ❌ 生成工作流全缺，需接 image-prompt.ts 规则引擎 |
| 数据下载 | /api/rpa/start·status·stop | jobs + collection-jobs results + desktop 采集链（R-1 最小闭环已通） | ⚠️ 需接成任务/导出闭环 |
| 数据 Agent | /api/agent/datasets·ask | data-agent: `GET /datasets` `POST /chat` | ✅ 后端有，前端待接 |
| 平台/发布 | /api/store·/api/taobao/categories·/api/account | platform-adapters: categories/shops/products/publish；stores/categories 有 | ⚠️ 商品主档数据源缺（需重新设计） |
| 个人中心 | /api/account/change-password | auth: 仅 `POST login`；users: PATCH/DELETE | ⚠️ 改密/改手机接口待收口 |
| 短信验证码 | 旧为 TODO 桩 | 无 | ⚠️ 本轮实现 or 明确裁剪（待确认，见待修订项） |

---

## 阶段状态表

> 依赖方向：P1/P5 相对独立可先行；P2/P3/P4/P6 均先补后端再接前端；P7 依赖 P3 生图能力决策；P8 收口联调依赖全部。P1–P7 之间除 P7↔P3 外互不阻塞，可并行推进。

| Phase | 名称 | 状态 | 前置 | 归属旧页面 |
|---|---|---|---|---|
| 1 | 个人中心与账号安全 | ✅ 已完成（修改密码/换绑手机/个人中心） | — | 4 页 |
| 2 | 报告域补齐 | ✅ 已完成（报告详情/竞品明细/市场报告已全量接真） | — | MarketReport / AnalysisReportView / AnalysisProductsView |
| 3 | 图片生成工作流 | ✅ 已完成（规则引擎+套图接口+生成工作台已接真） | — | ProductImageSets / APlusDetail |
| 4 | 数据下载/RPA 任务 | ✅ 已完成（旧版预设/参数/进度解析/暗黑终端/历史任务抽屉已全量接真） | R-1 桌面采集链 | DataDownload / DataDownloadRun |
| 5 | 数据 Agent 前端接真 | ✅ 已完成（前端对话工作台+后端接口全量接真） | — | DataAgentChat |
| 6 | 平台商品/主档/发布 | ✅ 已完成（商品主档模型+CRUD+平台列表+手动发布已接真） | — | ProductManagement / ProductMasterData / ManualListing |
| 7 | 资产生成与复刻收口 | ✅ 已完成（一键复刻完整工作台实现，资产库与图片库解耦） | P3 决策 | AssetLibrary / OneClickReplicate / ViralReplication |
| 8 | 端到端联调与收口 | 🔄 进行中（全量页面迁入桌面端 Electron 渲染层） | P1–P7 | 全量回归 + 旧代码删除 |

---

## 全局里程碑

- M1：15 个纯占位待迁移页面 + 3 个已接真页面（复查）全部收口为真实页面与路由（非 StubPage）。
- M2：后端缺口（报告聚合/图片生成/数据下载/商品主档/改密）全部有落点并可通过 curl/smoke 验证。
- M3：`pnpm build` 与 `pnpm test`（backend + frontend）全绿。
- M4：人工本地走通核心链路后执行 `pnpm legacy:cleanup --apply` 删除旧 `apps/legacy/` 与 `apps/backend/server.js`。

---

## 方案待修订项

- [ ] **短信验证码（P1）**：旧 PhoneVerificationPage/ChangePhonePage 发送与提交均为 TODO 桩，无真实短信服务。本轮：默认先实现「前端交互 + 服务端改密/改手机接口 + 验证码能力位预留」，真实短信接入或明确裁剪，待人工确认后定稿，不阻塞其余 Phase。
- [ ] **商品主档（P6）**：旧 ProductMasterData 为纯 mock（`MOCK_PRODUCTS`）。需确认数据落点：复用 `ListingDraft`/`MediaAsset` 还是新增 `Product` 主档模型（设计文档数据库全景未含独立商品主档表）。定稿后再排任务。
- [ ] **一键复刻/复刻（P7）**：旧 OneClickReplicate/ViralReplication 为纯 mock demo。决策：复用 P3 图片生成能力做成真实功能，还是保持 demo 入口并标注"未接入"。建议接入 P3 生图，待确认。
- [ ] **AssetLibrary（P7）**：旧页面未注册路由。已由 `/assets`(AssetsPage) 承接，确认是否需要独立页补路由或直接裁剪。

---

## 阻塞登记

- 真实 AI/淘宝 Key（OpenRouter、淘宝 AppKey）：P2/P3/P4 验证一律用 Mock/离线样本，不依赖真实 Key 即可推进；真实 Key 到位后补限流/错误码实测。
- 商品主档数据模型：P6 需待「待修订项」确认后定稿。
- 旧代码删除（M4）：需人工本地验收后执行。
