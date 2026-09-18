# 电商竞品分析系统

桌面端（Electron + RPA Agent）+ 服务端（NestJS + MySQL + 内嵌任务调度器）架构。桌面端负责登录、RPA 采集、本地结果存储与图片内容工具；服务端负责账号权限、任务队列、AI 报告、资产存储与可选同步。

## 目录结构

- `apps/backend/`：NestJS 服务端（API + 内嵌任务调度器），配置入口 `apps/backend/.env`
- `apps/desktop/`：Electron 桌面应用（主进程 + preload + 渲染层）。**业务 UI 全量在 `apps/desktop/src/renderer/`**（原 `apps/frontend` 已合并于此），UI 组件用 [Arco Design React](https://arco.design/react/docs/start)，样式入口 `apps/desktop/src/renderer/src/main.tsx`；含本地 SQLite、内置 Python、RPA Chrome 控制
- `apps/legacy/`：旧版单体应用（`legacy:cleanup` 清理目标，仅供迁移参考）
- `skills/`：采集/清洗/旧报告脚本，旧报告 skill 仅作迁移参考
- `scripts/`：环境检查、旧应用归档脚本

根目录为 pnpm monorepo，`pnpm-workspace.yaml` 以 `apps/*` 聚合各应用包；后续如抽共享代码可新增 `packages/` 层（workspace 已按 glob 聚合，无需改配置）。

## 本地启动

### 1. 前置要求

- Node.js（建议 20+）
- pnpm 10
- Docker（本地 MySQL）

### 2. 安装与初始化

```bash
pnpm install
docker compose up -d mysql
pnpm --filter backend db:migrate
pnpm --filter backend db:seed
pnpm --filter desktop db:init
pnpm check-env
```

首次使用先准备配置：

```bash
cp apps/backend/.env.example apps/backend/.env
```

本地默认 MySQL 已指向 Docker（3308），可直接使用；申请到 OpenRouter Key 后，把 `apps/backend/.env` 里 `OPENROUTER_API_KEY` 的占位符替换成真实 Key，火山引擎 Ark 不再需要。

### 2.1 初始化命令说明（仅首次/改模型时需要）

- `pnpm --filter backend db:migrate`：首次建表或更新模型时执行（生产与已有库推荐 `pnpm --filter backend exec prisma migrate deploy`）
- `pnpm --filter backend db:seed`：首次初始化权限/管理员/平台字典，重复执行安全（幂等）
- `pnpm --filter desktop db:init`：首次初始化桌面端本地 SQLite
- `pnpm check-env`：全环境连通性自检（Node/Docker/MySQL/Chrome/Python 等）

首次按上面顺序跑一次即可；之后每次开发只需 `pnpm dev`，不用重复执行初始化。

### 2.2 本地数据库

| 服务 | 地址 / 连接 | 查看方式 |
|---|---|---|
| MySQL | `127.0.0.1:3308`，用户/密码 `root/root`，库 `ecommerce_competitor` | `pnpm --filter backend exec prisma studio`（浏览器 `:5555`），或 `docker compose exec mysql mysql -uroot -proot ecommerce_competitor` |
| 桌面端 SQLite | `apps/desktop/data/desktop.db` | `sqlite3 apps/desktop/data/desktop.db` 或 SQLite 客户端打开 |


### 3. 本地启动

本项目为**原生桌面应用客户端**形态（唯一产品界面，业务 UI 在桌面端渲染层）。日常开发只需一个命令：

```bash
pnpm dev      # 一键启动：后端 API（含内嵌任务调度器）+ Electron 桌面客户端
```

按需单开某一模块：

```bash
pnpm dev:desktop    # 仅启动桌面客户端（需已有后端 API 运行）
pnpm dev:backend    # 仅启动后端 API（http://127.0.0.1:8787）
```

### 4. 本地服务访问地址

| 服务 | 本地访问入口 | 说明 |
|---|---|---|
| **原生桌面客户端** | `pnpm dev` 或 `pnpm dev:desktop` | Electron 桌面应用原生窗口，负责完整业务界面（登录/报告/采集/RPA/图片处理/设置） |
| **后端 API 服务** | `http://127.0.0.1:8787` | NestJS REST API 服务（全局前缀 `/api`） |
| **数据库 Web 控制台** | `http://localhost:5555` | Prisma Studio 可视化管理面板（执行 `pnpm --filter backend exec prisma studio`） |

> **安全与账号说明**：
> - 为防凭证泄露，所有初始账号与密码均**仅在本地 `apps/backend/.env`** 中配置（参见 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 与 `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD`）。
> - 首次使用或修改密码后，执行 `pnpm --filter backend db:seed` 即可完成账号与权限的初始化/刷新。

## 常用命令

| 命令 | 作用 | 说明 |
|---|---|---|
| `pnpm dev` | **启动桌面端全套** | 同时拉起后端 API（含内嵌任务调度器）+ Electron 桌面客户端 |
| `pnpm dev:desktop` | **单启桌面客户端** | 仅启动 Electron 桌面原生窗口（适合已有后端 API 时） |
| `pnpm check-env` | 环境自检 | 检查 Node/pnpm/Chrome/Python/Prisma/Docker |
| `pnpm build` | 全仓项目编译 | 编译 backend 及 desktop 全部子包 |
| `pnpm test` | 全自动化单元测试 | 执行后端与桌面端单元测试套件 |
| `pnpm typecheck` | **全仓静态类型检查** | 一键并发检查所有子包 TypeScript 错误，防止标红问题带入 |
| `pnpm --filter backend db:seed` | 刷新账号与初始数据 | 初始化/重置权限、管理员账号、平台字典（幂等可重入） |
| `pnpm --filter backend exec prisma studio` | 启动数据库 Web 控制台 | 打开浏览器 `http://localhost:5555` 图形化查看全部 35 张表 |
| `docker compose exec mysql mysql -uroot -proot ecommerce_competitor` | 进入 MySQL 终端 | 容器内快速进入 MySQL 交互命令行 |
| `pnpm --filter backend openrouter-env-fallback-smoke` | OpenRouter Key 回退冒烟 |

完整冒烟命令见各 `phase-*.md` 任务证据。

## 打包

### 前后端构建（部署/验证用）

- `pnpm --filter backend build`：编译服务端，产物 `apps/backend/dist/`
- `pnpm --filter desktop build`：编译 Electron 主进程/渲染（业务 UI）/preload，产物 `apps/desktop/out/`
- `pnpm -r build`：一键构建所有包（backend/desktop）

### 发布渠道

桌面端发布有三条路径，先记一句关系：**`build:local-package` 是"总指挥"，内部会自动调用 `desktop build:package`，再把各产物归拢到一起**。所以它俩不是并列的两个功能，而是"总命令"和"其中一步"。

| 命令 / 方式 | 干什么 | 产物在哪 | 什么时候用 |
|---|---|---|---|
| `pnpm --filter desktop build:package` | **只打桌面安装包**（DMG/EXE）。内部依次执行：desktop 编译 → 准备内置 Python → electron-builder 打包。安装包已自带完整业务 UI（renderer 编译产物）+ 内置 Python + 采集技能，**不含** backend 服务端 | `apps/desktop/dist/` | 只想要单个安装包给用户试用时用，最快 |
| `pnpm build:local-package` | **一键打全包**：依次编译 backend → desktop，再调用上面的 `build:package`，最后把两份产物统一拷贝、归拢到 `dist/local-package/` | `dist/local-package/` | 想一次性拿到"安装包 + 服务端编译产物"做完整验证或部署时用 |
| GitHub Actions（推送 `v*` tag） | **线上正式发布**：自动构建 macOS/Windows 并发布 | 发布到远端 | 用户意向确认后，走正式渠道时用 |

> 一句话记忆：`build:local-package` = 编译两端（backend + desktop）+ 调用 `build:package` + 归拢产物。只改了桌面端、只想要安装包，就用 `build:package`；要全套产物才用 `build:local-package`。

`dist/local-package/` 归拢后的内容：

- `installer/`：桌面安装包（DMG/EXE，含完整业务 UI + 内置 Python）—— 由上面的 `build:package` 产物复制而来
- `server/`：backend 服务端编译产物（部署到远程服务器，**不随**桌面安装包分发）

> 关键澄清：桌面安装包（DMG/EXE）里自带完整业务 UI（renderer 编译产物），`server/` **不会装进安装包**。`server/` 部署到远程服务器，桌面应用通过 HTTP API 联网访问。当前以本地内测包为主，确认用户意向后再配置线上正式渠道。

## 注意事项

- 数据库、JWT、AI Key、OSS Secret 等敏感配置只写入各自 `.env`，不提交 git；`.env.example` 只放占位符和注释
- Key 只存服务端，桌面端不保存明文；日志会自动脱敏
- 旧 `apps/legacy/`、`apps/backend/server.js` 仅供迁移参考，人工本地验收通过后执行 `pnpm legacy:cleanup --apply` 直接删除，不归档保留；正式任务只走新 backend
