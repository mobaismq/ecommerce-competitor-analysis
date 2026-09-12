# 桌面端 + 服务端技术方案设计（形态 B）

> 任务：2026-09-10-桌面端与服务端架构方案
> 背景：RPA 必须唤起用户本机浏览器，网页版无法实现，因此引入桌面端；用户管理与核心数据需要集中，因此保留服务端。
> 本方案取代 `2026-09-07-系统架构重构与前后端分离` 的纯单机取向，并取代 `2026-09-08-线上部署方案设计` 中与 RPA 相关的服务端职责划分。
>
> 架构图（拓扑、数据流、状态机、判据表）：[架构图/架构图.md](架构图/架构图.md)。当前以该 Markdown 为准；HTML/JSON/截图产物待方案定稿后重新生成。
> 任务拆解：[tasks.md](tasks.md)。

## 一、总体决策

| 领域 | 选型 | 本轮边界 |
|---|---|---|
| 桌面框架 | Electron + electron-vite + electron-builder | 桌面端只做 UI 与 RPA Agent，不承担核心数据 |
| 桌面 UI | React 18 + Vite + TanStack Query + Zustand | 渲染进程，复用原 `frontend/` |
| 服务端 | NestJS + Fastify + Prisma + MySQL | 用户/权限/任务/报告/AI 审计 |
| 工作流编排 | 轻量业务状态机 + Redis/BullMQ（FlowProducer） | 先覆盖任务的排队、阶段依赖、执行、进度、成功/失败/重试；不引入重型工作流平台 |
| 本地执行层 | SQLite + Prisma（桌面端） | Agent 本地队列/采集暂存，不存核心数据；失败后由用户重新执行 |
| 缓存与任务队列 | Redis + BullMQ | 服务端任务排队、任务 ID、并发控制、进度事件与短期任务状态；MySQL 保存业务事实 |
| 实时通信 | REST + SSE | SSE 仅推送，状态以数据库为准 |
| RPA | 桌面端 Agent + Node 主进程启动系统 Chrome（CDP 端口契约），Python 采集技能经 CDP 附加 | 使用 RPA 专用 profile；首次由用户在本应用内登录一次，之后保留登录态 |
| Python 运行时 | 安装包内置 python-build-standalone（install_only_stripped，全平台统一锁 3.12.x + 发布 tag）；uv 仅构建期 | Agent 调用 `skills/` 不用目标机器预装 Python；不内置 bash/powershell |
| AI | 豆包 Ark / OpenRouter（密钥集中服务端） | 桌面端不在本地暴露密钥 |
| 图片资产 | StorageDriver（开发本地目录 / 线上私有 OSS） | 桌面端不持有 OSS 长期凭据；开发环境写本地目录，线上采集图片按需预签名直传 OSS，服务端生成图片直接写 OSS |
| 认证 | 长效 JWT Access Token | 服务端签发，桌面端 safeStorage 加密后存 electron-store |
| 部署 | 服务端 Nginx + PM2（阿里云单机）；桌面端安装包 + 可配置自动更新源 | 不做微服务/K8s/灰度；GitHub Releases/阿里云静态源待最终选型 |
| 测试 | Jest / Vitest / Playwright E2E / Electron smoke | 本地可执行 |

## 二、工程组织

```text
ecommerce-competitor-analysis/
├── package.json              # 根级统一命令（setup/dev/build/desktop）
├── pnpm-workspace.yaml       # workspace: frontend, backend, desktop
├── docker-compose.yml        # 开发期 MySQL + Redis（仅开发调试）
├── .env.example
├── frontend/                 # React + Vite（桌面渲染进程 + 网页管理后台共用）
├── backend/                  # NestJS + Fastify + Prisma + BullMQ Worker（服务端）
├── desktop/                  # Electron 壳（electron-vite + SQLite + RPA Agent Worker）
├── skills/                   # Python/RPA/数据处理工具（原有资产，保留）
└── docs/
```

职责边界：

- `backend/`：唯一业务服务端 + BullMQ Worker（任务/AI/报告/资产）；
- `desktop/`：Electron 主进程、preload、SQLite 本地层、RPA Agent Worker；
- `frontend/`：渲染进程 UI，同时可作为纯网页管理后台复用；
- `skills/`：Python/Chrome/RPA 工具，由 Agent 按需调用，不作为 Node 包。

依赖与运行环境：

- `pnpm-workspace.yaml` 增加 `desktop` 包；根级 `setup` 覆盖 `pnpm install --frozen-lockfile`、Prisma generate、内置 Python、系统 Chrome 探测、Docker MySQL/Redis 健康；
- Electron/electron-vite/electron-builder/electron-updater、SQLite 本地层、playwright 等桌面依赖统一由 workspace lockfile 锁定；
- Python 依赖清单：`diantoushi-product-research` 清洗/检查脚本仅用标准库，CDP 采集脚本需 `playwright`（仅 wheel，不随包下载浏览器）；旧 `mysql-import/load_to_mysql.py` 的 `pymysql` 属旧直连 MySQL 路径，新导入通道不再内置；依赖在 CI 构建期用 uv 按 os/arch 安装并锁定版本，禁止运行时 `pip install`；
- Python 依赖统一收口在桌面端内置运行时，不做桌面端/服务端分头维护；业务需要新增 Python 工具（包括报告分析用 pandas 等）按统一清单内置；Python 运行时版本全平台统一锁 3.12.x（具体版本 + standalone 发布 tag），不按平台分版本；新增原生 C 扩展库按准入规则：仅进依赖清单（锁版本 + hash）、优先纯 Python 替代、mac arm64/x64 与 Windows x64 全平台探针验收 + 干净机器安装冒烟通过后才合入；
- 新增根级 `check-env` 脚本，全新环境首次安装后逐项验证 Node/pnpm/Chrome/Python/Prisma/Docker 可用。

### 重构前未提交骨架的处理原则（2026-09-12）

- 当前工作区中的 `frontend/`、NestJS `backend/`、Prisma 初版、Docker Compose 与 workspace 是 2026-09-07 方案留下的通用地基，不因桌面端重构整体删除；旧 `app/` 与 `backend/server.js` 继续保留到 Phase 7 迁移收口。
- 这批骨架不能直接视为新方案的最终实现：提交前先修复 backend 构建与日志落盘问题；健康检查、CORS、环境变量加载方式按本方案统一；Prisma schema/migration 按数据库全景在 Phase 1 重建。
- `AnalysisJob`、`RpaTask` 等初版命名和模型只作为现状参考，不作为最终业务事实源；最终以通用 `Job`、`AgentAssignment`、`ProviderProfile`、资产与审核模型为准。
- 根目录与 `backend/` 的环境变量示例必须明确唯一加载入口。新架构最终收敛到服务端 `backend/.env`；旧 `app/.env.local` 只在迁移期间兼容，不作为新业务入口。
- 当前骨架修正属于必要收口，不代表提前实现桌面端业务；desktop workspace、内置 Python、Chrome 探测和 BullMQ Worker 仍按 Phase 0-2 落地。

## 三、数据库全景（服务端 MySQL）

数据库从 0 重新设计，不再迁移旧 MySQL 数据；旧表只作为业务逻辑与字段来源参考。由 Prisma 全新定义，按以下域组织：

```text
租户与组织：tenants, departments, users, roles, permissions, user_roles,
            role_permissions, role_stores, platforms, stores
任务与工作流：jobs, job_events
采集与导入：collection_jobs, source_file_records
竞品快照：product_snapshots, product_sku_snapshots, product_qa_snapshots,
           product_review_snapshots
市场分析：analysis_runs, analysis_price_bands, analysis_band_products,
           analysis_band_images, analysis_product_analyses, analysis_insights,
           main_image_analyses
生图与发布：listing_drafts
资产：media_assets, generated_assets
Agent 与审核：agents, agent_assignments, review_records
系统能力：ai_usage_logs, ai_call_caches, system_configs
```

旧表映射说明（只映射逻辑，不迁移数据）：

| 旧表 | 新模型 | 说明 |
|---|---|---|
| `sys_account` | `User` | 账号/手机/部门/dataScope/状态/软删 |
| `sys_dept` | `Department` | 部门树 + tenantId |
| `sys_role` | `Role + RolePermission + RoleStore` | 逗号权限拆关系表 |
| `sys_menu/sys_button` | `Permission` | 语义 code + 类型，旧 1001/2001 等映射为 seed |
| `sys_platform` | `Platform` | 平台字典 |
| `sys_store` | `Store` | 平台店铺 + 授权/过期 |
| `crawl_job` | `CollectionJob` | 统一 RPA 采集与 Excel 导入 |
| `source_file_record` | `SourceFileRecord` | 源文件/图片引用 + storageKey |
| `product_snapshot` | `ProductSnapshot` | 竞品快照主表 |
| `product_sku_snapshot` | `ProductSkuSnapshot` | SKU 快照 |
| `product_qa_snapshot` | `ProductQaSnapshot` | 问大家 |
| `product_review_snapshot` | `ProductReviewSnapshot` | 评价/追评，供报告动态区块 |
| `media_asset` / `product_page_image_asset` | `MediaAsset` | 采集图片统一资产表 |
| `market_analysis_run` | `AnalysisRun` | 报告主表 |
| `market_price_band_*` | `AnalysisPriceBand` 等 | 价格带/竞品/图/洞察 |
| `market_price_band_product_analysis` | `AnalysisProductAnalysis` | 单商品分析 |
| `market_product_asset` | `GeneratedAsset` | 生成资产归类 |
| `product_main_image_analysis` | `MainImageAnalysis` | 单品主图 Vision 分析 |
| `market_main_image_ai_report` | `AiCallCache` | AI 结果缓存 |
| `generated_main_image` | `GeneratedAsset` | 生成图统一资产 |
| `market_listing_generation` | `ListingDraft` | 发布文案/提示词草稿 |
| `rpa_tasks` | `AgentRun`/`AgentAssignment` | Agent 执行记录 |

关键字段补齐原则：

- 所有组织/业务表带 `tenantId`；`Role` 按租户隔离，`Permission` 作为全局字典；
- 所有快照表带 `collectionJobId`、外部商品 ID、`snapshotTime`、`dataSnapshotDate`；
- 所有图片/文件表带 `storageKey/mimeType/size/sha256/sourceUrl`，二进制只放 OSS；
- `AnalysisRun` 带 `reportNo/reportHash/status/keyword/competitorCount/costModelJson/reportJson`；
- `Job` 是通用任务表，覆盖 `analysis/image_gen/listing/collection/import`，带 `businessKey/status/stage/attempt/checkpointStage/parentJobId/agentId/claimDeadline`；
- `AiUsageLog` 带 `attemptKey` 唯一键，配合检查点续跑防重复扣费；
- `ReviewRecord` 的决策为三态：`approved`（采纳）/ `rejected`（不采纳）/ `regenerate`（重新生成）；`regenerate` 由收尾任务创建新的生图批次并计入次数，单任务重新生成上限建议 3 次（待确认），超限后任务进入 `failure`，`rejected` 结束当前资产，`approved` 继续流程；
- 所有 DDL 只走 Prisma Migration，业务运行时禁止 CREATE/ALTER。

### 旧数据导入能力（不作为迁移）

`mysql-import` 保留为“桌面端数据导入通道”：Agent 在本地运行清洗脚本，生成结构化 JSON 后通过 `POST /api/collection-jobs/:id/results` 提交服务端；服务端负责校验、去重、写快照表、归档 OSS。Python 脚本不再直连 MySQL，不承担建表职责。

### 桌面端本地 SQLite（Agent 执行层）

- 存 Agent 本地待执行队列、采集中间数据（HTML/JSON/图片）索引、进程 PID、本地事件；
- 不存用户、权限、正式报告等核心业务数据（全部在服务端 MySQL）；
- 简单配置用 `electron-store`，敏感 token 经 Electron `safeStorage` 加密后再写入；
- SQLite 由桌面端 Prisma 管理（本地迁移，不写核心表）。
- 默认清理机制：应用启动时执行一次、运行期间每 6 小时执行一次；只清理已进入 `success/failure/cancelled` 终态且超过保留期的数据，`queued/collecting/uploading/running` 任务及其关联临时数据不清理；
- 默认保留策略：本地 SQLite 任务执行记录和事件保留 30 天；任务完成后的 HTML/JSON/图片等临时文件默认保留 7 天，之后删除；本地临时目录默认上限 2 GB，超过上限时按最旧的终态临时数据优先清理；
- 桌面端设置页提供“本地临时文件保留时间”入口，预设选项为 `1 天 / 3 天 / 7 天（默认） / 30 天`；用户可修改，设置写入 `electron-store`，清理任务读取最新配置；不提供无限期保留，避免本地数据无限累加；
- 用户修改保留时间只影响后续清理，不立即删除未达到新策略的数据；若改短，下一次清理按新值执行；若改长，已清理的数据不恢复；设置页同时显示当前临时目录占用，并提供“立即清理已过期数据”操作；
- 清理顺序：先删除文件，再删除 SQLite 索引；单个文件删除失败只记录日志，不阻塞其他清理；清理任务幂等，可重复执行；用户主动重试前不删除仍被任务引用的临时数据；
- 用户数据、token、配置、RPA 浏览器 profile 和登录态不属于自动清理范围；服务端已归档到 MySQL/OSS 的结果不依赖本地临时文件。

## 四、认证与权限

- 服务端签发长效 Access Token（如 7 天），桌面端登录后经 `safeStorage` 加密存入 electron-store；
- 渲染进程经由 preload 安全桥获取 token，HTTP 携带 `Authorization: Bearer`；
- 401 统一清态回登录页；登出时服务端与本地同时清态；
- 权限：JwtAuthGuard → PermissionGuard（语义 code）→ StoreScopeGuard → DataScope → 资源归属校验；
- 管理员在服务端管理用户/角色/租户/店铺范围；
- CORS 白名单集中配置：生产环境允许 `app://`（Electron 本地壳）与线上管理后台域名；开发环境追加 `http://127.0.0.1:5173`；`file://` 只作 Phase 0 临时兼容，不作为正式白名单；
- 生产服务端加固：HTTPS、CORS 白名单、登录限流、密钥只存服务端环境变量；不引入 Refresh Token 等额外机制。

## 五、任务队列与轻量业务工作流

第一版不使用重型工作流平台；使用 Redis/BullMQ（含 FlowProducer）负责任务投递、阶段依赖与执行并发，MySQL 保存业务事实，业务状态机负责约束任务的步骤和状态：

```text
分析任务（Job: analysis）
  ├─ queued：创建 MySQL 任务快照并写入 BullMQ
  ├─ collecting：桌面 Agent 领取任务并进行 RPA 采集
  ├─ uploading：图片/文件按策略上传 OSS，提交结构化采集结果
  ├─ analyzing：服务端 Worker 执行 AI 分析
  ├─ reporting：生成报告、写入 MySQL、保存资产引用
  └─ success / failure / cancelled：任务终态，由用户决定是否重试
```

- 业务唯一键由 `storeId + normalizedKeyword + analysisType` 组成，数据库唯一约束负责防重复；
- `jobs` 保存任务状态、阶段、进度、错误信息、attempt、checkpointStage，供 UI 查询；
- BullMQ Job 只传 `jobId/runId/tenantId/traceId` 等轻量引用，不传大 JSON 或图片；
- 队列至少拆分为 `desktop-rpa`、`server-ai`、`server-report`、`server-image-gen`、`server-listing`、`flow-finalizer`，每个队列独立设置并发数；
- 失败后进入 `failure`，用户点击“重试”从 `checkpointStage` 续跑；不重跑已完成的外部付费调用；
- AI 调用前先写 `AiUsageLog`（`attemptKey` 唯一），成功后复用结果，失败重试不重复扣费；
- 采集中途不再设置人工验证状态；遇验证码/风控直接失败，用户处理后重新点击任务；
- Agent 本地同一时刻只执行一个 RPA 任务；多台桌面端通过服务端分配接口竞争领取；后续如需 Agent 直连 BullMQ，再放开 Redis 私网/TLS 边界；

### 第一版参数默认值（2026-09-12 初稿，开发到 Phase 2/4 时按实测调整）

| 参数 | 初稿默认值 |
|---|---|
| `claimDeadline` | 60s，超时未领取进入 failure |
| `leaseTtlMs` | 120s，心跳中断超租约进入 failure |
| `heartbeatIntervalMs` | 15s |
| 任务保留时间 | 7 天 |
| 失败重试次数 | 3 次（checkpoint 续跑，不重放已成功阶段） |
| 重新生成上限 | 3 次 |
| 队列并发 | desktop-rpa 1；server-ai / server-image-gen 2；server-report / server-listing / flow-finalizer 1 |
| OSS 厂商/bucket | 开发环境用本地目录（LocalStorageDriver）；线上 OSS 待有环境后接入，只改配置与 StorageDriver 实现 |

### 外部执行节点契约（Agent / 人工审核统一模型）

`desktop-rpa` 与结果 `review` 都是 FlowProducer 的“外部完成”子任务：服务端 Worker 不消费，父任务等待；真实执行完成后，由服务端 API 调用 BullMQ `moveToCompleted`，流程树才继续。统一使用 HTTPS 契约：

```text
POST /api/agent/register            注册设备，返回 agentId/deviceSecret
POST /api/agent/tasks/claim         原子领取一个可执行任务
POST /api/agent/tasks/:jobId/accept 确认开始
POST /api/agent/tasks/:jobId/progress  上报进度
POST /api/agent/tasks/:jobId/heartbeat 心跳续租
POST /api/agent/tasks/:jobId/complete  提交结果并完成 BullMQ 子任务
POST /api/agent/tasks/:jobId/fail      失败上报
POST /api/agent/tasks/:jobId/cancel    取消信号（心跳响应同样携带）
POST /api/review-records/:id/decision  人工审核决策：approved / rejected / regenerate
```

服务端通过 `AgentAssignment` 保存 `agentId/status/leaseUntil/heartbeatAt`，领取用 Redis 原子锁 + MySQL 事务防并发；同一 Agent 同时只有一个活动任务。领取到期或心跳断超过租约后任务进入 `failure`，不自动转移，用户重试。后续云端 Agent、人工审核节点只需实现同一套协议即可接入。

参数与执行位置：

- `claimDeadline`、`leaseTtlMs`、`heartbeatIntervalMs`、队列并发、任务保留时间统一放服务端配置（env / `system_configs`），不新增独立进程；
- Agent 领取/心跳/完成走 API 进程的 HTTPS 接口；AI/报告/生图/发布/收尾走 BullMQ Worker 进程；
- 未领取或租约过期由 BullMQ Worker 内的定时 Sweeper 扫描并置为 `failure`，复用 Worker 进程，不新增部署组件；
- AI 调用在 Worker 内由统一 AI Adapter 执行，限流使用 `rpm/tpm/maxConcurrency/timeoutMs/retryPolicy` 配置；第一版单 Worker 用进程内令牌桶，多 Worker 时升级为 Redis 限流器。

### FlowProducer 编排模型

第一版使用 BullMQ FlowProducer 表达业务流内的阶段依赖，不新增部署组件：

- FlowProducer 的父任务会等待所有子任务成功后才进入执行；线性阶段用嵌套子任务表达，需要并行的子任务放在同一层；
- 流程树按业务场景编排：第一版只有分析、图片生成、平台发布三个场景，每个场景对应一棵固定模板（见下方示例），不做业务级通用组合编排引擎，也不允许执行实例自由组树；
- FlowProducer 仍提供线性嵌套、并行兄弟、扇入聚合等基础能力，但只在具体场景模板需要时使用；后续新增业务场景时，按该场景实际逻辑新增对应流程树模板，再扩展实现；
- 收尾任务读取子任务结果，更新 MySQL 状态与进度，并按配置决定是否创建下一个流程；
- MySQL 仍保存任务状态与业务事实，FlowProducer 只负责执行顺序与依赖，不替代数据库；
- 任意子任务失败即流程失败，任务进入 `failure`，由用户重试；不在第一版实现自动恢复。

```text
示例：分析任务执行实例
analysis-flow（收尾）
└─ report
   └─ analyze
      └─ collect（含 OSS 上传与结构化结果提交）

示例：图片生成任务执行实例
image-flow（收尾）
└─ review
   └─ generate
      └─ prompt

示例：平台发布任务执行实例
listing-flow（收尾）
└─ submit
   └─ upload-assets
```

以上即第一版三个场景的固定流程树模板；同一场景第一版不引入自由组树能力，避免通用 DAG 编排器。

跨任务串联按业务配置决定：默认不强制自动串联；若启用“分析 → 图片生成 → 平台发布”自动流水线，前一场景的执行实例收尾时创建后一场景的新执行实例，创建动作仍在服务端完成。

### 下游工作流：图片生成与平台发布

分析任务产出报告后，业务可按需发起两个独立的下游任务，不强制自动串联：

```text
图片生成任务
  ├─ queued：基于报告与商品原图创建任务
  ├─ prompting：整理商品信息并生成主图/详情图提示词
  ├─ generating：调用 AI 生成图片，写入 OSS 并记录资产引用
  ├─ reviewing：人工审核（采纳 / 不采纳 / 重新生成）
  └─ success / failure / cancelled

平台发布任务
  ├─ queued：选择商品、图片与发布平台创建任务
  ├─ uploading_assets：将生成图等资产上传到平台图片空间
  ├─ submitting_listing：提交商品信息并发布
  └─ success / failure / cancelled
```

- 图片生成输入为分析报告、商品原图、平台尺寸与合规要求，输出主图/详情图等资产；
- 平台发布通过 `PlatformAdapter` 对接淘宝 TOP 等开放接口；未开放接口的平台先支持手动发布，任务记录状态与结果；
- 新增队列 `server-image-gen`、`server-listing`；失败后同样由用户重试，不引入自动恢复；
- 图片生成与平台发布都是独立业务任务，不改变分析任务状态机；
- 分析、图片生成、平台发布等业务场景均按执行实例使用 FlowProducer；是否自动串联作为业务配置，不规定固定流程树模板。

## 六、RPA Agent（桌面端核心）

桌面端 Agent 作为“外部执行节点”接入，不直连 Redis/BullMQ；主进程启动常驻 Agent，与服务端通过 HTTPS 交互：

- Agent 首次注册：使用登录用户 token 注册设备，服务端返回 `agentId/deviceSecret`，记录平台、版本、能力；
- 领取：`POST /api/agent/tasks/claim` 原子领取 `desktop-rpa` 子任务，写入 `AgentAssignment`；
- 执行：唤起系统 Chrome（playwright + RPA 专用 profile）→ 运行内置 Python 采集 → 按资产策略上传 OSS → 提交结构化结果；
- RPA 专用 profile 首次由用户在应用内人工登录一次（淘宝/店透视），之后保留登录态，不读取用户日常 Chrome profile；
- 本地 SQLite 承担执行层：本地任务记录、采集中间数据索引、进程 PID；不做浏览器/采集过程断点续传，任务级重试由服务端 `checkpointStage` 续跑；
- 进度通过 `progress` 接口上报，SSE 推回 UI；
- 取消/失败：服务端标记终态，心跳/轮询返回取消信号，Agent 关闭 Chrome/Python 子进程；
- 同一 Agent 严格单任务执行，多任务在服务端队列中等待。

Agent 生命周期：

```text
idle → running(Chrome/Python) → uploading → done | error | cancelled
```

防护：进程 PID 持久化到 SQLite、任务领取使用服务端租约/状态校验、同一 Agent 本地互斥；Agent 重启后不自动续跑，由用户重新重试。

### 浏览器控制与 Python 运行时分工（2026-09-12 确认）

- 桌面端主进程（Node）负责：发现系统 Chrome、以 RPA 专用 profile 启动浏览器并暴露 CDP 端口（DevToolsActivePort/固定端口契约）、应用内首次登录引导与登录态保留、取消/退出时回收 Chrome 与 Python 进程树；Node playwright 用于登录引导与 UI E2E，不作为 RPA 页面控制的唯一实现；
- Python 采集技能负责：经 Chrome DevTools Protocol 附加到该浏览器实例，复用现有跨平台 `run_diantoushi_rpa_cdp.py` 逻辑；macOS 旧 AppleScript/Swift 路径只作历史参考，Phase 7 收口为 CDP 路径；
- 第一版即按上述分工落地，CDP 附加为正式路线；后续若将页面控制整体迁入 Node，只替换浏览器会话模块，业务技能逻辑保持 CDP 契约不变；
- 桌面端内置 Python 是项目统一 Python 工具环境，所有 Python 依赖（含报告分析可能用到的 pandas 等）统一在此维护，不按功能拆分桌面/服务端两套清单；
- 因此内置 Python 依赖清单包含 `playwright`（wheel 即可）；若后续把 CDP 交互整体迁入 Node，再从 Python 依赖中移除 `playwright`；
- 主进程统一用 `child_process.spawn(pythonPath, args, { shell: false })` 调 Python，不经过任何 shell，安装包不内置 bash/powershell/Cygwin/MSYS2；
- spawn 环境固定注入 `PYTHONUTF8=1`、`PYTHONIOENCODING=utf-8`；mac 端启动前对 Python 可执行文件执行 `fs.chmodSync(path, 0o755)` 兜底；Windows 取消/退出用 `taskkill /F /T /PID` 或等价进程树回收，避免孤儿进程；
- Python 路径统一解析：Windows 为 `resources/python/python.exe`，macOS/Linux 为 `resources/python/bin/python3`（基于 `process.resourcesPath`，开发期与打包期分别处理）。

## 七、SSE 设计

标准接口：

```text
POST /api/analysis/runs               创建任务并投递 BullMQ，返回 jobId
GET  /api/analysis/jobs/:jobId        查询状态（MySQL 快照）
GET  /api/analysis/jobs/:jobId/events SSE 实时事件
POST /api/analysis/jobs/:jobId/cancel 取消任务
POST /api/agent/tasks/:jobId/progress 桌面端上报进度
POST /api/agent/tasks/:jobId/complete 桌面端提交结果
POST /api/collection-jobs/:id/results 桌面端提交清洗后的导入数据
```

事件统一含 `{id, type, data}`；连接建立先发当前状态，每 15 秒心跳；断线不影响任务；进度由 BullMQ 事件与 MySQL 快照驱动，SSE 仅转发。

- SSE 认证不用浏览器原生 `EventSource`（无法带 header），统一用 `fetch + ReadableStream` 携带 `Authorization: Bearer`，网页端与桌面端同一实现；
- Nginx 部署必须配置 `proxy_buffering off`、`proxy_cache off`、足够长的 `proxy_read_timeout`，否则 SSE 会被缓冲或断连。

## 八、图片与文件资产（StorageDriver，开发本地目录 / 线上 OSS）

- 存储按环境选择驱动：本地开发环境默认用项目内本地目录（LocalStorageDriver），线上环境用 OSS；OSS 后续有环境时再调试，业务代码只依赖 StorageDriver 接口；
- 线上 OSS Bucket 私有；桌面端和前端只使用服务端签发的短时预签名 URL，不保存 OSS 长期凭据；
- OSS 环境与目录前缀设计为 `{env}/{tenantId}/{bizType}/{runId}/{randomId}`；OSS 厂商/区域、dev/prod bucket 划分 `[待补充]`，线上接入时确认；开发环境复用同一前缀规则落本地目录；
- 桌面端采集的商品主图、SKU 图、详情图按业务配置上传；服务端生成图片和报告导出文件线上直接写 OSS，开发环境写本地目录；
- 原始 HTML/JSON 默认只保留在桌面端临时目录，不作为第一版 OSS 必传资产；
- 服务端先鉴权并生成上传凭证，Agent 直传后调用 confirm 接口；服务端校验对象存在、大小、MIME 后写入资产记录；
- 数据库存 `storageKey/mimeType/size/originalName/runId/sourceUrl` 等引用，不存二进制；
- 上传成功但写库失败清理孤儿对象；任务失败/取消产生的临时文件按保留期清理；
- 第一版不做 CDN、图片处理和复杂多级归档；
- 存储统一抽象为 `StorageDriver`：`signUploadUrl / confirmUpload / head / delete / getReadUrl / putObject`；开发环境用 `LocalStorageDriver`（项目本地目录），线上 OSS 驱动只实现同一接口，后续接入不改业务代码。

## 九、外部依赖边界

| 能力 | 服务商/实现 | 凭据位置 | 失败处理 |
|---|---|---|---|
| 文本/视觉分析 | 豆包 Ark / OpenRouter | 服务端环境变量 | 任务失败 + AI 审计 + 重试 |
| 图片生成 | OpenRouter 或确定图像服务 | 服务端环境变量 | 重试、失败审计 |
| 淘宝能力 | TOP SDK/API | 服务端环境变量 | 错误码转统一错误 |
| RPA | 桌面端 Python/Chrome | 用户本机登录态 | 状态失败、回收进程 |

具体模型、超时、限流实现前以 SDK 与本地实测为准，不把未验证配额写成硬事实。

### AI 供应商适配设计（2026-09-12 确认）

- 业务 Pipeline 只面向能力，不面向厂商：定义统一 `AiProvider` 接口，按能力拆分 `generateText` / `analyzeImage` / `generateImage`，输入输出统一 DTO，返回统一 `AiResult`；
- 供应商注册表：`ark`、`openrouter`、`openai-compatible` 等各实现一个 Provider 并注册；Worker 按能力获取 Provider，不在业务代码做供应商分支；
- `OpenAICompatibleProvider` 作为通用自定义端点实现：适用于第三方“key + baseURL + model”的 OpenAI 兼容调用，不依赖厂商 SDK，直接 HTTP 调用 `chat/completions`、`images/generations` 等接口；配置 `baseUrl/apiKey/model/capabilities/timeoutMs/retryPolicy/limits`，模型与端点变化只改配置，不写业务代码；
- 模型与限额放配置：`AI_PROVIDER_TEXT`、`AI_PROVIDER_IMAGE` 与各自 `model/rpm/tpm/maxConcurrency/timeoutMs/retryPolicy`；模型变化只改配置，新增供应商只增加 Provider 实现与注册；
- 第一版每个能力只启用一个供应商，不做自动路由/容灾；切换供应商手工改配置；
- key/baseURL 只存服务端环境变量或加密配置，不落桌面端、不出现在日志；用户自带 key+URL（BYOK）第一版不做，后续做时在 `OpenAICompatibleProvider` 上增加加密存储、租户配额与审计；
- `AiUsageLog`（attemptKey）审计与检查点续跑不因供应商不同而分支；
- 测试用 `MockAiProvider` 实现同一接口，Pipeline 不依赖具体厂商。

### 多供应商配置实例与后台切换（2026-09-12 确认）

- `AiProvider` 是代码适配器，`ProviderProfile` 是可管理的配置实例；同一适配器可以对应多个 Profile，例如多个 Ark/OpenRouter key、多个自定义 baseURL；
- `ProviderProfile` 至少包含 `id/name/type/baseUrl/apiKeyRef/capabilities/modelConfig/timeoutMs/retryPolicy/limits/enabled/priority/healthStatus`；未来按租户或店铺隔离时预留 `tenantId/storeId`；
- `ProviderRouter` 按能力和配置选择 Profile，业务 Pipeline 不感知具体厂商、key 或 URL；第一版每个能力只启用一个 active Profile，后续可在 Router 层扩展备用 Profile、冷却时间和故障切换；
- 管理后台后续可新增、编辑、启用、禁用、测试连接和切换 Profile；切换只影响新任务，正在执行的任务固定使用创建时的 `providerProfileId`；
- `Job` 与 `AiUsageLog` 记录 `providerProfileId/providerType/model`；URL 日志只保留 host 或脱敏地址，API Key 永不入日志；
- `apiKeyRef` 指向服务端环境变量、加密配置或 SecretStore，管理后台只显示脱敏值，不返回完整 key；BYOK 第一版仍不做。

### 第一版环境变量参考值（旧项目同事提供，2026-09-12 录入）

> 以下为旧项目实际使用的 AI/模型环境变量初值，已同步录入 `app/.env.example`（原有）与 `backend/.env.example`（2026-09-12 补齐）。`OPENROUTER_API_KEY` 仍为占位符；新架构 Phase 4 迁移为 ProviderProfile 配置，Phase 7 收敛到 backend `.env`。模型名、超时、限额均属参考初值，实现前以 SDK 与本地实测为准。

| 变量 | 参考值 | 用途 |
|---|---|---|
| OPENROUTER_API_KEY | YOUR_OPENROUTER_API_KEY_HERE | OpenRouter 密钥占位符 |
| OPENROUTER_IMAGE_MODEL | openai/gpt-image-2 | 图片生成模型 |
| OPENROUTER_VISION_MODEL | deepseek/deepseek-v4-flash-vision-exp | 视觉分析模型 |
| OPENROUTER_VISION_FALLBACK_MODEL | openai/gpt-4.1-mini | 视觉分析兜底模型 |
| ARK_ANALYSIS_MODEL | doubao-seed-2-1-pro-260628 | 豆包 Ark 分析模型 |
| ARK_ANALYSIS_MAX_IMAGES | 20 | 单任务最大分析图片数 |
| ARK_ANALYSIS_BATCH_IMAGES | 5 | 图片分批大小 |
| ARK_ANALYSIS_TIMEOUT_MS | 120000 | 单次分析超时 |
| ARK_PRODUCT_ANALYSIS_MAX_OUTPUT_TOKENS | 8000 | 商品分析最大输出 token |
| ARK_PRICE_BAND_MAX_OUTPUT_TOKENS | 3000 | 价格带分析最大输出 token |
| ARK_OVERALL_REPORT_MAX_OUTPUT_TOKENS | 10000 | 总报告最大输出 token |
| ARK_DATA_AGENT_MAX_OUTPUT_TOKENS | 3000 | 数据 Agent 最大输出 token |

> 注意：同事原文件未包含 `ARK_API_KEY`，但旧代码实际读取该变量（缺省回退 `OPENAI_API_KEY`），实际配置时需要补上。

## 十、日志与可观测性

- 服务端：`nestjs-pino`，终端全量输出；落盘 `app.log`（业务关键逻辑 + 人工埋点）、`error.log`（warn/error + 4xx/5xx 请求）；线上不产生 debug.log；单文件 5 MB、只保留当前文件；
- 桌面端：本地日志落到系统应用数据目录（app/error/debug），开发期 debug 仅终端；
- 三类日志均带 requestId/jobId/tenantId，可按 ID 串联；
- `Authorization`、密码、API Key 一律脱敏；`.gitignore` 忽略日志目录；
- 服务端部署由 PM2 守护，`/api/health/live` 与 `/api/health/ready` 存活/就绪探测，最低限度监控（进程、CPU/内存/磁盘、error.log 人工检查、任务失败与队列积压可查）。

## 十一、桌面端打包与更新

- electron-builder + GitHub Actions 产出 macOS dmg / Windows exe / Linux AppImage；
- 开发机只有 macOS 也足够：macOS 产物在本机/`macos-latest` 产出，Windows 产物由 GitHub Actions `windows-latest` 矩阵产出，不需要购买 Windows 电脑；
- GitHub Actions 多平台发布为 electron-builder 官方支持路线（官方 CI/CD 文档提供 macos/windows/linux 矩阵与 tag 自动发布 workflow）；真实落地案例：`Zettlr`、`marktext`、electron-vite 官方模板 `electron-vite-vue`，其 Releases 均含 Windows exe、macOS dmg 与 `latest.yml/blockmap`；
- Windows 冒烟：优先在 mac 上安装 Windows 虚拟机后验证安装、启动、登录与 RPA（CDP）；虚拟机就绪前暂不验证，不阻塞开发；未签名时 Windows SmartScreen 会提示“不常见应用”，内部使用接受；
- Windows 代码签名后续可继续走 CI（证书 + Azure Trusted Signing / osslsigncode），不需要常备 Windows 机器；
- electron-updater 自动更新，更新源使用 GitHub Releases；阿里云服务器只部署服务端，不承担更新包静态托管；
- 若 GitHub 仓库为私有，桌面端读取 Release 需要 GH_TOKEN；更新源主方案与阿里云静态兜底方案待专门讨论（2026-09-12 记录），暂不决定；
- 安装包内置 Python 运行时：`python-build-standalone` `install_only_stripped`（固定版本/发布 tag），uv 只在 CI 构建期安装依赖并锁定（requirements lock + hash），安装包内不执行 pip install；目标机器无需预装 Python；
- 体积策略以功能与稳定性为准：`install_only_stripped` 解压约 60MB 作为基线，不设激进裁剪目标；后续若需新增原生库（如 pandas/lxml），接受包体增长，按“依赖清单 + 全平台验收 + 发版”引入；
- Python 资产按 os/arch 独立打包：macOS arm64/x64、Windows x64（Linux AppImage 同）；CI 矩阵与 standalone 资产一一对应，暂不做 universal 包；
- electron-builder `extraResources` 使用递归过滤（如 `**/*`，不要用 `*/*`）将 Python 与 `skills/` 放入 `resources/`；打包后验证 `bin/python3` 符号链接/执行权限不丢失；
- Prisma engine、playwright driver 等 native 二进制需排除 asar（asarUnpack 或 extraResources），并在安装包冒烟中覆盖；
- 打包后必须在无系统 Python 的干净机器上验证 `spawn` 运行 `skills/` 探针、UTF-8 编码、执行权限与进程树回收；Apple Silicon 上未签名/未公证二进制需做可执行性冒烟；
- 更新时保留本地 token 与配置，不破坏用户数据；
- 首版不做 macOS 公证/Windows 签名（内部使用接受），对外分发前补；
- 数据目录：`~/Library/Application Support/<App>/`（或 Windows `%APPDATA%`），放配置、日志、采集缓存。

## 十二、本地测试方案

- 服务端 Jest + Supertest：Guard、Service、任务快照、幂等、DTO、OSS/存储 mock；
- BullMQ/Redis 测试：验证任务入队、外部完成、领取/租约、检查点续跑、进度事件与任务保留期；
- 轻量业务状态机测试：验证 queued/collecting/uploading/analyzing/reporting + 检查点重试 + 终态转移；
- 桌面端 Vitest（XState 状态机、SQLite 本地队列/临时数据清理）+ Playwright（渲染 UI E2E）；
- 端到端联调：本地 Redis/BullMQ + mock OSS 下 Agent→服务端→AI(mock)→报告，禁止触发真实付费接口与真实线上爬虫；
- browser-use 等既有 skill 保留用于 RPA 本地验证，优先使用离线样本/Mock。

## 十三、技术债务与明确不做

| 妥协项 | 当前选择 | 风险 | 升级条件 |
|---|---|---|---|
| Electron 体积 | 桌面端单壳 | 安装包约 150MB | 用户量大时评估 Tauri（需 Rust 重写） |
| 长效 Access Token | 本地加密存储 | XSS/本机窃取风险 | 对外多人公网后加固 |
| Python 内置运行时 | 安装包内置；体积以效果为准，不激进裁剪 | 包体随功能增长 | 后续按需下载或系统 Python |
| 私有 GitHub 仓库更新 | 桌面端需 GH_TOKEN | 分发受限 | 仓库公开或改用阿里云静态更新源 |
| 单机 Agent | 每客户端一个 Agent | 同客户端多任务并发受限 | 任务并发超阈值 |
| Redis/BullMQ | 核心任务排队、并发与进度事件 | 需要维护 Redis 与 Worker | 任务量极小时可降级为 MySQL 任务表 |
| XState | 桌面端本地状态机 | 仅建模本地生命周期 | 本地生命周期模型不再够用时重构成独立编排组件 |
| LangGraph.js | 未来 AI 内部编排候选 | 仅 AI 子流程 | AI 多 Agent 场景引入 |
| n8n | 未来外围低代码平台候选 | 独立产品形态 | 运营自助编排需求出现时评估 |
| 无自动同步 | 数据只在服务端 | 多端需重新登录拉取 | 补充离线缓存/同步 |
| 未签名 | 内部分发 | 系统安全提示 | 对外分发前补签名/公证 |

本轮明确不做：纯单机模式、桌面端承担核心数据、复杂分布式工作流平台、云端 RPA 集群、微服务/K8s/灰度、云盘式多端同步、OSS CDN 与复杂图片处理。

本轮明确不迁移旧数据：系统从 0 重新开发，旧 MySQL 表不导入、不回刷，只作为旧逻辑/字段语义的参考；旧代码能力按 Phase 7 迁移到新服务。
