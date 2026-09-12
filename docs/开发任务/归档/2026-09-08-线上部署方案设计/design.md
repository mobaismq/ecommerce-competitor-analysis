# 线上部署与上线方案设计 (Online Deployment Design)

> ⚠️ **已被取代**：本目录原定 Nginx/PM2/RDS/OSS 的网页线上部署；现统一并入 `2026-09-10-桌面端与服务端架构方案`（服务端部署保留 Nginx+PM2+MySQL/Redis/OSS，但 RPA 职责移交桌面端）。保留仅供历史参考。
> 关联任务：2026-09-08-线上部署方案设计
> 承接：[2026-09-07-系统架构重构与前后端分离](../归档/2026-09-07-系统架构重构与前后端分离/design.md)（本地重构完成之后的线上专题）
> 本目录当前状态：**已补充第一版合理线上方案；不引入微服务、Kubernetes、复杂日志平台和灰度发布**

---

## 一、任务背景与本主题边界

本地首次重构方案已按“本地开发环境全新重构”立项完成设计（见上一任务目录）。本主题专门处理：

> **本地重构交付完成后，如何设计并实施线上部署与上线。**

本主题绝不与本地重构混淆，单独规划以下内容：

| 待设计项 | 说明 |
| :--- | :--- |
| 线上部署拓扑 | Nginx + PM2 + 云 RDS + Redis + OSS 等边界 |
| 线上数据初始化 | 由于无线上存量数据，按全新数据库建模初始化 |
| 图片存储线上方案 | StorageService 的 OSS 生产驱动接入 |
| 认证与安全的生产加固 | 长效 Access Token + localStorage、CORS、HTTPS/SSL、防抖防刷 |
| 线上日志/监控/告警 | 生产可观测性与异常发现 |
| 上线切换与回滚 | 停旧起新、版本管理、失败回退 |
| 硬件与云资源选型 | 服务器规格、云 RDS/Redis/OSS 选型 |

---

## 二、启动前置条件（进入 `/explore` 前必须满足）

- [ ] 本地重构已完成并通过本地验收（前后端可跑、数据库可初始化、核心业务可用、单测与 E2E 通过）。
- [ ] 本地重构目录 `2026-09-07-...` 已产出完整 `架构图.md` 与 `design.md`。
- [ ] 已明确线上目标环境（云厂商/机架、域名、可用预算区间）。

---

## 二·补、pnpm workspace 与线上部署的关系

**结论：pnpm workspace 是仓库级的依赖管理与构建组织方案，不是线上运行时架构，不影响线上部署方式。**

本地与线上使用同一套 workspace，但部署时只取构建产物：

| 环节 | 本地开发 | 线上部署 |
|---|---|---|
| 安装依赖 | `pnpm install` | `pnpm install --frozen-lockfile`（锁定版本） |
| 构建 | 实时热更新（Vite / Nest dev） | `pnpm build` 产出 `frontend/dist` 与 `backend/dist` |
| 前端 | Vite dev server（5173） | 只部署 `frontend/dist` 静态文件给 Nginx，不运行 Vite |
| 后端 | NestJS `start:dev`（8787） | 只启动 `backend/dist/main.js`，经 PM2 守护 |
| 工具目录 | `skills/` 本机直接调用 | 按需部署 Python 环境，不当作 Node 包 |

推荐线上构建方式（在项目根目录）：

```bash
# 1. 安装 frontend/backend 全部依赖（workspace 唯一锁文件，锁定版本）
pnpm install --frozen-lockfile

# 2. 构建前端与后端
pnpm build

# 3. 前端产物 → Nginx 静态目录
#    frontend/dist/  →  /var/www/ecommerce/frontend/dist/

# 4. 后端产物 → 运行目录，PM2 守护
#    backend/dist/   →  /var/www/ecommerce/backend/
#    pm2 start backend/dist/main.js --name ecommerce-backend
```

> 线上第一版建议保留完整项目目录（frontend/backend/package.json/pnpm-workspace.yaml/pnpm-lock.yaml）在服务器，用 pnpm 构建后再启动，部署简单直接；是否演进为“构建机产出、线上只收产物”属后续优化，不是本轮硬要求。

---

## 三、本主题遵循的边界原则

1. **本地重构时不处理线上、线上专题不反向约束本地构**：两个主题隔离推进。
2. **线上无历史数据，可全新初始化**：不涉及旧数据迁移与回滚。
3. **仅在本地方案框架之上叠加生产能力**：不推翻本地选型（React+Vite、NestJS+Fastify、Prisma、BullMQ、Pino、Zustand 持久化 Token、browser-use 测试），只补齐 Nginx/PM2/RDS/OSS/SSL/监控等生产层。
4. **认证策略本地与线上统一**：统一采用长效 Access Token + Zustand/localStorage，不实现 Refresh Token；生产在 CORS、HTTPS/SSL、登录限流等网络与部署层做基础加固，不在业务层引入额外认证机制。

---

## 四、状态占位

> 以下文件待 `/plan` 阶段生成，当前不预写内容，避免与后续设计冲突。
> - `tasks.md`
> - `phase-*.md`

---

## 五、未决事项（待 `/explore` 阶段确认）

- [ ] 严谨部署模式：宿主机原生 Nginx + PM2（沿用本地既定方向）是否最终确认。
- [ ] 生产数据库是否强制使用云 RDS，还是允许迁移到单机自建。
- [ ] 生成图片生产存储是否确认接入 OSS。
- [ ] HTTPS 证书来源与域名归属。
- [ ] 是否需要容器化业务（默认倾向不容器化，仅中间件容器）。

> 说明：以上仅为主题立项时的初步占位，正式结论以 `/explore` 输出为准。

### 第一版线上基线

第一版推荐直接采用：单台应用服务器运行 Nginx、PM2、API 和 Worker；MySQL 使用云 RDS，Redis 使用云 Redis 或受保护的单机 Redis，图片使用私有 OSS。暂不做多机高可用、微服务拆分、Kubernetes、蓝绿发布和灰度发布。

### 线上运行拓扑

```text
浏览器
  ↓ HTTPS
Nginx
  ├── /       → frontend/dist
  └── /api    → NestJS API

NestJS API
  ├── MySQL/RDS
  ├── Redis
  ├── OSS
  ├── 外部 AI 服务
  └── 本机 Python/Chrome RPA

BullMQ Worker（独立 PM2 进程）
  ├── Redis
  ├── MySQL/RDS
  ├── OSS
  ├── 外部 AI 服务
  └── 本机 Python/Chrome RPA
```

API 与 Worker 仍属于同一个 `backend` 工程，只拆成两个运行进程：`ecommerce-api` 负责 HTTP/SSE，`ecommerce-worker` 负责 BullMQ、AI 和 RPA。Worker 长任务不应阻塞 API。

### 发布与回滚

第一版不采用蓝绿部署或灰度，使用简单可靠的版本目录：

```text
/var/www/ecommerce/releases/<version>/
/var/www/ecommerce/current -> releases/<version>/
```

发布流程：

1. 上传或拉取指定版本代码；
2. `pnpm install --frozen-lockfile` 锁定安装依赖；
3. `pnpm build` 构建前端与后端产物；
4. 执行 `prisma migrate deploy`（数据库变更前向兼容）；
5. 检查 API 健康接口；
6. 切换 `current` 符号链接；
7. 重启 `ecommerce-api` 与 `ecommerce-worker`；
8. 验证首页、登录、健康检查与任务创建。

回滚流程：

1. 将 `current` 切回上一个可用版本；
2. 重启 API 与 Worker；
3. 验证健康接口与核心接口。

数据库变更第一版约定：只使用前向兼容的 Prisma Migration，发布中不直接删除旧字段；即使线上没有旧数据，也保留常用备份与恢复手段。

### 数据库初始化与连接

第一次上线执行 `prisma migrate deploy`，不使用 `db push`；生产 seed 只做基础初始化，默认管理员密码通过部署配置设置，首次登录必须修改。应用数据库账号只保留必要权限；数据库不开放公网访问；连接信息只进入服务器环境配置，不写仓库。

### Redis 生产参数

Redis 不作为业务事实源，任务状态以 MySQL 为准；Redis 只承担 BullMQ 队列、短期事件和锁。设置密码或 ACL，不开放公网访问；BullMQ 的 completed/failed 任务设置合理保留时间；Redis 短暂不可用时接口返回明确错误且不产生重复任务。

## 六、线上认证与日志方向

### 1. 认证

线上与本地统一采用长效 Access Token + Zustand/localStorage，不实现 Refresh Token：登录签发有效期较长（如 1 天或 7 天）的 Access Token，前端持久化到 `localStorage`，Axios 自动携带 `Authorization: Bearer <token>`，过期或 401 时清态跳登录页。

生产只做网络与部署层的基础加固，不做额外认证机制：仅允许 HTTPS，CORS 仅允许正式前端域名，登录接口做基础限流，JWT 密钥只存在于服务器环境配置；不引入独立认证中心、短时 Token、HttpOnly Cookie 或服务端会话。

### 2. Pino 日志

线上沿用本地 `nestjs-pino + pino`，但不使用 `pino-pretty` 作为生产输出：

```text
NestJS → Pino JSON stdout → PM2/Docker/云日志采集
```

线上沿用 `app.log` 与 `error.log`，不产生 `debug.log`；每类当前文件上限 5 MB，不保留历史文件，后续容量不足再按需调整。`app.log` 只记录业务关键逻辑和人工埋点，`error.log` 记录 warn/error、异常堆栈和 4xx/5xx 请求，不记录全量 HTTP 访问日志。第一版建议由应用日志组件负责两个文件的落盘，PM2 只负责进程管理，不重复轮转同一文件；日志必须脱敏。

### 3. Nginx 与 SSE

线上必须为 SSE 配置最基本的代理参数：关闭代理缓冲、关闭 SSE 缓存、设置足够长的读取超时并保持连接；后端每 15 秒发送心跳。前端断线后先查询任务状态再重新连接 SSE；SSE 不是事实源，任务最终状态仍从数据库读取。

### 4. OSS 文件方案

Bucket 默认私有，文件通过后端鉴权后读取或由后端生成短时有效的预签名 URL；OSS Key 包含租户、业务对象和随机 ID；大小、MIME、扩展名继续由后端校验。数据库保存 `storageKey`，不保存永久公开 URL；上传成功但数据库写入失败时清理孤儿对象，数据库写入成功但上传失败时记录失败并允许任务重试。第一版不需要 CDN 和复杂图片处理。

### 5. 健康检查与最低监控

健康检查拆为存活与就绪两个接口：`GET /api/health/live` 表示进程存活，`GET /api/health/ready` 表示 MySQL、Redis 等必要依赖可用、可以接收请求。上线验收至少覆盖：Nginx 可访问、HTTPS 正常、前端静态资源可加载、API 健康检查 200、MySQL/Redis 可连接、Worker 可消费、OSS 可上传读取、AI 配置有效、日志可写入。

最低监控不引入监控平台：PM2 进程异常自动重启，服务器 CPU/内存/磁盘可查看并有磁盘不足处理方式，`error.log` 可人工查看，任务失败与超时可在数据库查询，Redis 队列积压可查询。

### 6. pnpm workspace 的线上边界

pnpm workspace 不要求线上运行整个 monorepo，也不影响 Nginx、PM2、RDS、Redis 或 OSS 的部署：

```bash
# 在项目根目录锁定安装 frontend/backend 依赖
pnpm install --frozen-lockfile

# 在根目录构建两个 workspace 包
pnpm build

# Nginx 只托管前端构建产物
# frontend/dist/ → Nginx 静态目录

# Node/PM2 只启动后端构建产物
pnpm --filter backend start
# 或：node backend/dist/main.js
```

线上不执行 `pnpm dev`，不启动 Vite 开发服务器；`skills/` 按需部署 Python 运行环境，不作为 Node workspace 包。若后续采用构建机发布，也只需上传 `frontend/dist`、`backend/dist` 和必要运行时文件，不改变应用架构。
