# 电商竞品分析系统

桌面端（Electron + RPA Agent）+ 服务端（NestJS + MySQL + Redis/BullMQ）架构。桌面端负责登录、RPA 采集、本地结果存储与图片内容工具；服务端负责账号权限、任务队列、AI 报告、资产存储与可选同步。

## 目录结构

- `apps/backend/`：NestJS 服务端（API + BullMQ Worker），配置入口 `apps/backend/.env`
- `apps/frontend/`：React 渲染端，本地开发地址 `http://127.0.0.1:5173`
- `apps/desktop/`：Electron 桌面应用，本地 SQLite、内置 Python、RPA Chrome 控制
- `apps/legacy/`：旧版单体应用（`legacy:cleanup` 清理目标，仅供迁移参考）
- `skills/`：采集/清洗/旧报告脚本，旧报告 skill 仅作迁移参考
- `scripts/`：环境检查、旧应用归档脚本
- `docs/开发任务/2026-09-10-桌面端与服务端架构方案/`：任务清单与设计文档（先读 `待办事项清单.md`）

根目录为 pnpm monorepo，`pnpm-workspace.yaml` 以 `apps/*` 聚合各应用包；后续如抽共享代码可新增 `packages/` 层（workspace 已按 glob 聚合，无需改配置）。

## 本地启动

### 1. 前置要求

- Node.js（建议 20+）
- pnpm 10
- Docker（本地 MySQL/Redis）

### 2. 安装与初始化

```bash
pnpm install
docker compose up -d mysql redis
pnpm --filter backend db:migrate
pnpm --filter backend db:seed
pnpm --filter desktop db:init
pnpm check-env
```

首次使用先准备配置：

```bash
cp apps/backend/.env.example apps/backend/.env
```

本地默认数据库/Redis 已指向 Docker（3308/6380），可直接使用；申请到 OpenRouter Key 后，把 `apps/backend/.env` 里 `OPENROUTER_API_KEY` 的占位符替换成真实 Key，火山引擎 Ark 不再需要。

### 2.1 初始化命令说明（仅首次/改模型时需要）

- `pnpm --filter backend db:migrate`：首次或修改数据库模型时执行（建表/迁移）
- `pnpm --filter backend db:seed`：首次初始化权限/管理员/平台字典，重复执行安全（幂等）
- `pnpm --filter desktop db:init`：首次初始化桌面端本地 SQLite

首次按上面顺序跑一次即可；之后每次开发只需 `pnpm dev`，不用重复执行初始化。

### 3. 启动服务

一键启动 API + Worker + 前端：

```bash
pnpm dev
```

或分开启动：

```bash
pnpm dev:backend    # API：http://127.0.0.1:8787
pnpm dev:worker     # BullMQ Worker
pnpm dev:frontend   # 前端：http://127.0.0.1:5173
pnpm dev:desktop    # Electron 桌面端
```

### 4. 本地账号

`db:seed` 会创建两个账号（初始密码来自 `apps/backend/.env`，上线前必须修改）：

- `admin`：业务租户管理员，账号 `ADMIN_USERNAME`，密码 `ADMIN_PASSWORD`
- `super_admin`：平台超级管理员（开发方），密码 `SUPER_ADMIN_PASSWORD`

## 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm check-env` | 检查 Node/pnpm/Chrome/Python/Prisma/Docker |
| `pnpm --filter backend build` | 编译服务端 |
| `pnpm --filter frontend build` | 构建前端 |
| `pnpm --filter desktop build` | 构建桌面端 |
| `pnpm --filter backend db:seed` | 初始化权限/管理员/平台字典 |
| `pnpm --filter desktop local-db-smoke` | 本地 SQLite 清理冒烟 |
| `pnpm --filter backend report-pipeline-smoke` | 报告 Pipeline 冒烟 |
| `pnpm --filter backend openrouter-env-fallback-smoke` | OpenRouter Key 回退冒烟 |

完整冒烟命令见各 `phase-*.md` 任务证据。

## 打包

### 前后端构建（部署/验证用）

- `pnpm --filter backend build`：编译服务端，产物 `apps/backend/dist/`
- `pnpm --filter frontend build`：构建前端页面，产物 `apps/frontend/dist/`
- `pnpm --filter desktop build`：编译 Electron 主进程/渲染/preload，产物 `apps/desktop/out/`
- `pnpm -r build`：一键构建所有包（backend/frontend/desktop）

### 发布渠道

桌面端发布有三条路径，先记一句关系：**`build:local-package` 是"总指挥"，内部会自动调用 `desktop build:package`，再把各产物归拢到一起**。所以它俩不是并列的两个功能，而是"总命令"和"其中一步"。

| 命令 / 方式 | 干什么 | 产物在哪 | 什么时候用 |
|---|---|---|---|
| `pnpm --filter desktop build:package` | **只打桌面安装包**（DMG/EXE）。内部依次执行：desktop 编译 → 准备内置 Python → electron-builder 打包。安装包已自带桌面 UI + 内置 Python + 采集技能，**不含** `frontend/` 前端、**不含** backend 服务端 | `apps/desktop/dist/` | 只想要单个安装包给用户试用时用，最快 |
| `pnpm build:local-package` | **一键打全包**：依次编译 backend → frontend → desktop，再调用上面的 `build:package`，最后把三份产物统一拷贝、归拢到 `dist/local-package/` | `dist/local-package/` | 想一次性拿到"安装包 + 前端页面 + 服务端编译产物"做完整验证或部署时用 |
| GitHub Actions（推送 `v*` tag） | **线上正式发布**：自动构建 macOS/Windows 并发布 | 发布到远端 | 用户意向确认后，走正式渠道时用 |

> 一句话记忆：`build:local-package` = 编译三端 + 调用 `build:package` + 归拢产物。只改了桌面端、只想要安装包，就用 `build:package`；要全套产物才用 `build:local-package`。

`dist/local-package/` 归拢后的内容：

- `installer/`：桌面安装包（DMG/EXE，含内置 Python 与桌面自带 UI）—— 由上面的 `build:package` 产物复制而来
- `web/`：`frontend/` 前端构建产物（独立 Web 界面，可放到服务端静态托管）
- `server/`：backend 服务端编译产物（部署到远程服务器，**不随**桌面安装包分发）

> 关键澄清：桌面安装包（DMG/EXE）里只有桌面端自带的那套 UI，`web/` 和 `server/` **不会装进安装包**。`web/` 用于远程静态托管、`server/` 部署到远程服务器，桌面应用通过 HTTP API 联网访问它们。当前以本地内测包为主，确认用户意向后再配置线上正式渠道。

## 注意事项

- 数据库、Redis、JWT、AI Key、OSS Secret 等敏感配置只写入各自 `.env`，不提交 git；`.env.example` 只放占位符和注释
- Key 只存服务端，桌面端不保存明文；日志会自动脱敏
- 旧 `apps/legacy/`、`apps/backend/server.js` 仅供迁移参考，人工本地验收通过后执行 `pnpm legacy:cleanup --apply` 直接删除，不归档保留；正式任务只走新 backend
