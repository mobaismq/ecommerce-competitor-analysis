# 本地系统技术方案设计

> ⚠️ **已被取代**：本目录的纯本地/单机取向已被 `2026-09-10-桌面端与服务端架构方案` 取代（桌面端解决 RPA 唤起浏览器，服务端集中管理用户与数据）。保留仅供历史参考，不再作为实施依据。
> 任务：2026-09-07-系统架构重构与前后端分离
> 适用范围：本地首次开发环境
> 交付目标：一次性完成新架构重构，完成后直接使用新系统；不保留旧实现兼容层。
> 线上部署、OSS、Nginx、PM2、RDS 等另行在 `2026-09-08-线上部署方案设计` 讨论。

## 一、总体决策

| 领域 | 本地方案 | 本轮边界 |
|---|---|---|
| 前端 | React 18 + Vite + TanStack Query + Zustand | 独立 frontend 工程 |
| 后端 | NestJS + Fastify | 独立 backend 单体工程 |
| 数据库 | MySQL Docker + Prisma | 全新 schema，可删除重建 |
| 队列 | Redis Docker + BullMQ | 本地异步任务与事件 |
| 实时通信 | REST + SSE | SSE 仅推送，状态以数据库为准 |
| 文件 | LocalStorageService，写入 `backend/uploads` | 本轮不接 OSS |
| 认证 | 长效 JWT Access Token | 本地持久化到 Zustand/localStorage；不实现 Refresh Token |
| 权限 | 语义 Code + DataScope + StoreScope | 不兼容旧数字 ID/CSV |
| RPA | 后端受控调用本机 Python/Chrome | 不做云端集群 |
| 外部 AI | 按能力选择豆包 Ark/OpenRouter 等 | Key 只读环境变量；调用失败需审计 |
| 日志 | nestjs-pino + pino（本地 pino-pretty） | 结构化日志 + requestId，脱敏 |
| 测试 | 单元/组件：Vitest + React Testing Library；后端：Jest；前端 E2E：browser-use | 本地可执行、不依赖线上 |
| 工程组织 | pnpm workspace（根目录统一管理 frontend、backend） | 不额外增加外层 `app/` 目录 |

本地运行时建议将 HTTP API 与 BullMQ Worker 分为两个进程，但仍属于同一个 `backend` 工程：API 进程负责 REST、SSE 和查询接口，Worker 进程负责队列消费、AI 调用和 RPA 任务。这样可以避免长时间任务阻塞 HTTP 服务，同时保持本地与线上运行模型一致。

### 工程组织决策

仓库根目录直接作为工程根，不再增加一个只用于包裹子目录的外层 `app/`。这样根级配置、Docker、本地脚本和文档都能保持清晰，后续新增 `shared/`、`scripts/` 或其他 workspace 包时也只需在根目录扩展。

```text
ecommerce-competitor-analysis/
├── package.json              # 根级统一安装、初始化、启动和构建命令
├── pnpm-workspace.yaml       # 声明 frontend、backend workspace
├── pnpm-lock.yaml            # 唯一依赖锁文件
├── docker-compose.yml        # 本地 MySQL + Redis
├── .env.example              # 环境变量模板
├── frontend/                 # React + Vite 前端
├── backend/                  # NestJS + Fastify + Prisma 后端
├── skills/                   # Python/RPA/数据处理工具
├── scripts/                  # 根级辅助脚本
└── docs/                     # 项目文档
```

不采用 npm 与 pnpm 混用；根目录使用 pnpm workspace 统一安装，frontend 和 backend 各自只声明自身运行依赖。

### 明确排除引入更多框架

技术栈以“够用、本地可运行、不过度设计”为准则，**本轮不引入以下框架**：

| 候选 | 是否引入 | 理由 |
|---|---|---|
| 前端 Next.js | 否 | 内部 B 端系统无 SEO/SSR 需求；引入会增加第二个 Node 运行时、SSR 边界与部署复杂度 |
| 后端 Express / Koa | 否 | 已选 NestJS，Fastify 作为其 HTTP 适配器 |
| GraphQL / tRPC | 否 | REST + DTO 校验已满足，协议更直观 |
| Temporal / Camunda | 否 | BullMQ + Pipeline 已够用，无跨天人工审批流 |
| Kubernetes / 微服务 | 否 | 单体后端即可，本地规模无需分布式治理 |
| OpenTelemetry / Jaeger | 否 | Pino + requestId 满足本地可观测；完整链路系统留线上 |

后端最终技术栈固定为：NestJS + Fastify + Prisma + BullMQ + Redis + nestjs-pino + class-validator + Swagger，不叠加其他业务框架。

## 二、数据库全景

数据库由 Prisma 全新定义，建议模型如下：

```text
多租户：tenants
组织权限：users, roles, permissions, user_roles, role_permissions,
          departments, stores, role_stores, platforms
分析业务：analysis_runs, analysis_products, analysis_price_bands,
          analysis_images
任务系统：analysis_jobs, job_events
资产系统：generated_assets
系统能力：ai_usage_logs, system_configs, rpa_tasks
```

设计要求：

- 权限使用标准关系表，不使用逗号分隔字段；
- 所有表包含必要的创建时间、更新时间和业务状态；
- 任务表具有业务唯一键，避免重复扣费；
- 报告正文统一存 MySQL 业务表，Redis 不放报告正文，只保存队列与短期事件；
- 图片记录保存 `storageKey`、`mimeType`、`size`、`originalName`，不把二进制塞进数据库；
- 所有 DDL 只通过 Prisma Migration 管理，业务运行时禁止 CREATE/ALTER TABLE。

### 1. 报告存储统一性

所有报告（无论大小）统一保存在 MySQL 业务表，例如 `analysis_runs.report_json` 或关联内容表。是否存在大报告的区别不影响存储位置，只影响读取方式：

```text
小型报告：report_json 直接内联在 analysis_runs 记录中
大型报告：正文写入 analysis_runs 的 LONGTEXT 字段，或拆出 analysis_report_content 表按 runId 关联
```

两种方式都应统一走 MySQL，**不把报告正文放进 Redis job payload**。Redis 只存：

```text
bull 队列索引
任务状态
SSE 瞬时事件
防重锁
```

实现时建议统一采用一个内容列（`report_json LONGTEXT`），所有报告都落这一列，避免“大报告一套、小报告另一套”的双轨逻辑。MySQL 的 LONGTEXT 可容纳 MB 级文本，对当前规模无需拆分表；仅当后续出现超大附件时才考虑按文件存储，本轮统一用 MySQL。

### 2. 多租户设计

系统按多租户模型设计，业务数据通过 `tenant_id` 隔离：

```text
tenants
├── 每个租户可有自己的组织权限数据
├── 业务表（analysis_runs、analysis_products、图片、任务等）带 tenant_id
└── 所有跨租户查询强制带 tenant_id 过滤
```

后端在认证后从登录上下文取得 `tenant_id`，在所有业务查询与写入中强制注入，防止跨租户越权。前端登录时选择或确定所属租户，列表与详情均按租户隔离。本地开发默认只建一个租户，但表结构与查询逻辑按多租户标准设计，避免后续为多租户大规模改表。

### 3. 多平台可扩展设计

不止淘宝，需支持京东、拼多多、抖店等多个电商平台。采用“平台字典 + 适配器接口 + 标准化领域模型 + 原始响应留存”四层结构：

```text
platforms           平台字典表（taobao/jd/pdd/douyin...）
platform_adapters   平台适配器接口（按 platform code 分发）
                     ├─ 标准化商品/店铺/分类输出
                     └─ 保留各平台原始响应（raw_payload）
analysis_*          统一标准化领域模型（不随平台变化）
```

- `platforms` 表存平台枚举与启用状态，新增平台只需插入一行字典 + 新增一个适配器，无需改动业务表结构；
- 后端定义统一接口（如 `PlatformAdapter`），各平台实现同一套方法：`auth、listShops、listCategories、fetchProducts`；
- 适配器把各平台差异字段归一化为统一的 `StoreDTO / ProductDTO / CategoryDTO`，业务层只依赖标准化模型；
- 各平台原始返回另存 `raw_payload`，便于排查与后续字段补充，不因差异丢失信息；
- 前端按平台类型展示，通用能力（报告、套图、权限）与平台无关。

本轮至少实现 `platforms` 字典 + `PlatformAdapter` 接口 + 淘宝适配器，京东/拼多多/抖店适配器按接入顺序逐个补充。

## 三、认证与权限

### 1. 认证

本地开发采用**持久化 Access Token** 的简化方案，不实现 Refresh Token：

- 登录签发一个有效期较长（如 1 天或 7 天）的 Access Token；
- Access Token 写入 Zustand，并通过 `persist` 持久化到 `localStorage`；
- 页面刷新后前端自动从 `localStorage` 恢复，Axios 拦截器自动携带 `Authorization: Bearer <token>`；
- Token 过期或 401 时，清理认证状态并跳转登录页；
- 登出时清除 localStorage 中的 Token；
- 后端所有受保护接口独立校验 Token，前端持久化只负责便利性，不构成安全边界。

认证状态机简化为：

```text
anonymous → authenticated → token_expired → logged_out
```

安全取舍说明：

- Access Token 存 `localStorage` 在 XSS 场景存在被读取风险，本次为内部系统且追求本地开发简洁，接受该取舍；
- 保留最低保护：Token 设置过期时间、登录接口限流、登出清理、401 统一清态、前端不做不安全 HTML 注入；
- 不把密码、API Key 等更敏感内容写入 localStorage；
- 线上与本地认证策略统一（长效 Access Token + localStorage），生产仅在 CORS、HTTPS/SSL、登录限流等网络与部署层基础加固，见 `2026-09-08-线上部署方案设计`。

### 2. 权限

后端按顺序执行：

```text
JwtAuthGuard
 → PermissionGuard（语义 permission code）
 → StoreScopeGuard
 → DataScope 过滤条件
 → 业务资源归属校验
```

前端只使用新的语义 Code，例如：

```tsx
<Permission code="market:report:generate">
  <Button>生成报告</Button>
</Permission>
```

## 四、任务、队列与幂等

### 1. 任务模型

状态限定为：

```text
queued → active → success
              ├→ failure
              ├→ cancelled
              └→ timeout
```

`analysis_jobs` 保存任务状态、业务唯一键、`runId`、错误信息、开始/结束时间和重试次数。

### 2. 幂等

报告生成使用规范化后的业务键，例如：

```text
storeId + normalizedKeyword + analysisType
```

数据库唯一约束是最终防线；Redis 锁只用于削峰，不能单独承担幂等。重复请求返回已有 `jobId`，而不是再次调用 AI。

### 3. 队列边界

BullMQ payload 只保存：

```text
jobId, runId, accountId, traceId
```

原始采集数据、报告正文和图片均通过 MySQL 或本地 StorageService 按 ID 读取。

Worker 重启后必须处理异常中断任务：长期处于 `active` 的任务按超时规则转为 `timeout` 或重新进入 `queued`；可重试错误使用有限次数和退避间隔，不可重试错误直接进入 `failure`。每次重试都保留重试次数和错误原因，不能因 Worker 重启重复创建业务结果或重复扣费。

## 五、SSE 设计

标准接口：

```text
POST /api/analysis/runs              创建任务，返回 jobId
GET  /api/analysis/jobs/:jobId       查询当前状态
GET  /api/analysis/jobs/:jobId/events SSE 实时事件
POST /api/analysis/jobs/:jobId/cancel 取消任务
```

事件统一包含：

```json
{"id":"event-1","type":"progress","data":{"percent":50,"stage":"vision"}}
```

要求：

- 连接建立后先发送当前任务状态；
- 每 15 秒发送心跳；
- SSE 断线不影响后台任务；
- 前端断线后先查询状态，再重新建立连接；
- 终态必须包括 success、failure、cancelled、timeout；
- Redis 事件丢失时，以数据库状态恢复。

## 六、本地图片存储

当前旧代码写入 `public/generated/product-sets`，新系统不再沿用。

本轮实现：

```text
LocalStorageService
 → backend/uploads/{safe-generated-key}
 → generated_assets
 → GET /api/assets/:assetId
```

要求：

- 文件名由后端生成，不使用用户输入拼接路径；
- 校验 MIME、扩展名和大小；
- 数据库只保存引用信息；
- 资源接口检查访问权限；
- StorageService 保留统一接口，线上 OSS 驱动另行实现。

商品原始图片保留外部 URL，不在本轮强制下载和保存。

任务失败、取消或重试产生的临时文件需要有清理规则；数据库记录删除后，对应生成文件也应进入清理流程。清理任务只删除能够确认不再被业务记录引用的文件，避免误删仍在使用的资产。

## 七、外部依赖边界

| 能力 | 服务商/实现 | 凭据 | 失败处理 |
|---|---|---|---|
| 文本/视觉分析 | 豆包 Ark（以实际 SDK/API 为准） | 环境变量 | 任务失败 + AI 审计 |
| 图片生成 | OpenRouter 或确定的图像服务 | 环境变量 | 重试、失败审计 |
| 淘宝能力 | TOP SDK/API | 环境变量 | 错误码转换为统一错误 |
| RPA | 本机 Python/Chrome | 本机登录态 | 状态失败、回收进程 |

具体模型、参数、超时和限流在实现前以 SDK 文档和本地实测为准，不把未经验证的配额写成硬事实。

## 八、本地工程与运行方式

使用 pnpm workspace 在根目录统一管理。

```text
ecommerce-competitor-analysis/
├── package.json              # 根级：pnpm setup / pnpm dev / pnpm build
├── pnpm-workspace.yaml       # packages: frontend, backend
├── docker-compose.yml        # MySQL + Redis
├── frontend/                 # React + Vite
├── backend/                  # NestJS + Fastify + Prisma
└── skills/                   # Python/RPA/数据处理
```

### 1. 首次安装与初始化（一条命令）

```bash
pnpm setup
```

等价于依次执行：

```bash
# 1) 启动本地基础设施：MySQL 数据库 + Redis 队列
docker compose up -d mysql redis

# 2) 一次性安装 frontend + backend 全部依赖（根 pnpm workspace，唯一锁文件）
pnpm install

# 3) 按 Prisma Schema 创建本地数据库结构（全新，可删除重建）
pnpm --filter backend db:migrate

# 4) 写入默认管理员、角色、权限与基础字典
pnpm --filter backend db:seed
```

### 2. 日常统一启动（一条命令）

```bash
pnpm dev
```

同时启动后端与前端，日志分色、一次 Ctrl+C 全部停止。也可分开启动：

```bash
pnpm dev:backend     # 仅启动 NestJS 后端
pnpm dev:frontend    # 仅启动 Vite 前端
pnpm infra:up        # 仅启动 MySQL + Redis
pnpm infra:down      # 停止 MySQL + Redis
```

### 3. 根级 package.json 脚本建议

```json
{
  "scripts": {
    "setup": "docker compose up -d mysql redis && pnpm install && pnpm --filter backend db:migrate && pnpm --filter backend db:seed",
    "dev": "concurrently -k -n backend,frontend -c blue,green \"pnpm --filter backend start:dev\" \"pnpm --filter frontend dev\"",
    "dev:backend": "pnpm --filter backend start:dev",
    "dev:frontend": "pnpm --filter frontend dev",
    "infra:up": "docker compose up -d mysql redis",
    "infra:down": "docker compose down",
    "build": "pnpm -r build"
  }
}
```

> 其中 `backend`、`frontend` 为 workspace 包名，需在各自 `package.json` 中明确 `name` 字段，并保证 backend 依赖自身声明的全部运行依赖，frontend 不再依赖 `mysql2` 等服务端包。

前端 Vite 只配置 `/api` 开发代理，不再 import 数据库、AI、RPA 或其他服务端业务代码。

## 九、验收要求

### 功能

- 默认管理员可登录；
- 无权限请求返回 403；
- 部门和店铺范围过滤有效；
- 报告任务可创建、消费、完成和失败；
- 重复请求只产生一个任务；
- SSE 可收到进度和终态；
- 图片可写入并通过资源接口读取；
- RPA 可启动、查询、停止；
- AI 调用成功和失败均有审计记录。

### 工程

- MySQL/Redis 可由 Docker 启动；
- Prisma migration/seed 可执行；
- backend 和 frontend 可独立启动；
- frontend build 成功；
- 后端不执行运行时 DDL；
- 前端无 mysql2 等服务端依赖；
- 关键模块有可执行的单元/集成验证。

## 十、日志与可观测性

后端使用 `nestjs-pino` + `pino`，本地开发使用 `pino-pretty` 输出易读日志，不引入 OpenTelemetry、Jaeger、ELK 等重型系统。

日志至少包含：

- `requestId`、HTTP 方法、路径、状态码和耗时；
- `jobId`、`runId`、RPA 任务 ID；
- AI 模型、调用耗时、Token 用量和结果状态；
- 错误消息与堆栈；
- `Authorization`、密码、API Key 等敏感字段必须脱敏。

同一个 `requestId` 应能关联 HTTP 请求、队列任务、Worker 和 AI 调用日志。

### 日志文件位置与轮转

日志同时输出到终端和 `backend/logs/`，本地与线上统一使用同一套配置（`debug.log` 仅本地开发产生）：

```text
backend/logs/
├── app.log      # 业务关键逻辑 + 人工埋点（info，非全量）
├── error.log    # warn/error、异常堆栈、4xx/5xx 请求
└── debug.log    # 开发期临时 debug 日志，仅本地开发
```

- `nestjs-pino` 负责结构化日志，`pino-pretty` 负责终端全量可读输出；HTTP 访问日志只在终端展示，不落盘；
- `app.log` 只写业务关键逻辑与人工要求埋点的日志（AI 调用、队列任务、RPA 运行开始/结束/失败、鉴权决策、外部服务结果等），不写全量访问日志、心跳轮询、循环内逐项处理；
- `error.log` 只写 warn/error、异常堆栈，以及 HTTP 状态码 ≥ 400 的请求（自动提升为 warn 级别写入），便于单独排查错误请求；
- `debug.log` 为开发期临时调试日志（`logger.debug` 级别），仅本地开发使用，功能验证通过后随代码删除、不进入提交；
- 三类日志均带 `requestId`/`jobId`，可按同一 ID 串联排查；
- 日志文件使用 Pino destination 或专用轮转组件写入，不由业务代码手写追加；
- 每类日志单文件 **5 MB**，达到上限后轮转（不直接覆盖当前文件），只保留当前文件、不保留历史文件，单类总量约 **5 MB**，后续容量不足再按需调整；
- 业务日志不写数据库，避免日志量影响业务表；AI 调用、RPA 任务的业务台账继续走 `ai_usage_logs`、`rpa_tasks` 等数据库表；
- `backend/logs/` 必须加入 `.gitignore`，禁止提交日志、Token、密码和 API Key。

日志容量上限为每类约 5 MB（app/error/debug 三类合计约 15 MB）；达到上限后只保留当前文件，后续容量不足再按需调整。

## 十一、本地测试方案

### 1. 单元测试与组件测试

- 前端：`Vitest` + `React Testing Library`，测试 hooks、stores、权限组件、API 状态和关键页面组件；
- 后端：NestJS 推荐的 `Jest`，测试 Guard、Service、Pipeline Step、StorageService、任务状态和 DTO 校验；
- 外部 AI、Redis、文件系统使用 mock 或本地测试替身，单元测试不得真实扣费或调用 RPA。

### 2. 接口与集成测试

使用 Jest/Supertest（或 NestJS 对应测试工具）验证：

- 登录、Token 校验和 401/403；
- Prisma 数据库读写；
- BullMQ 任务创建、幂等和状态更新；
- SSE 事件格式和终态；
- 本地图片保存及资源读取；
- RPA 启停接口的授权和异常处理。

### 3. 浏览器端到端测试

引入 [browser-use](https://github.com/browser-use/browser-use) 作为浏览器自动化测试工具，封装为项目 skill。测试只连接本地 frontend/backend，使用测试数据库和测试账号，禁止连接生产地址、真实 RPA 账号和真实付费 AI 接口。

browser-use skill 负责：

- 启动前检查前后端和测试数据；
- 按场景执行登录、权限、报告创建、任务进度、图片访问等流程；
- 保存截图、页面 URL、关键文本和失败日志；
- 测试完成后清理测试任务和临时文件；
- 失败时停止，不自动重复提交真实业务任务。

browser-use 是 Python 工具，不放入 frontend/backend 的 Node 依赖；其运行环境和命令由 `skills/browser-use-testing/` 单独维护。

## 十二、技术债务与明确不做

本轮不保留旧 Node 后端、旧 Cookie Session、旧数字权限 ID、旧 CSV 权限字段、旧数据库表和旧图片路径兼容。线上部署与生产安全加固见 `2026-09-08-线上部署方案设计`。
