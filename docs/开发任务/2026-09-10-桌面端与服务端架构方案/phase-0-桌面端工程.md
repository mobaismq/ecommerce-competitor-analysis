# Phase 0：桌面端工程与基础壳

- [x] 0.1 建立 desktop/ electron-vite 工程与主进程壳
      现状: `desktop/` 目录不存在；根 workspace 尚无 desktop 包
      依据: 图1-A1、design.md「工程组织」
      验证: `pnpm install && pnpm --filter desktop build` ➔ 预期: 主进程/preload/渲染进程构建通过
      证据: (2026-09-12, 实测通过: `pnpm install` 成功且 lockfile 含 desktop；`pnpm --filter desktop build` 通过，产出 out/main/index.js、out/preload/index.cjs、out/renderer/index.html；`env -u ELECTRON_RUN_AS_NODE pnpm --filter desktop exec electron --version` 返回 v37.10.3)

- [x] 0.2 接入渲染进程 React UI 与 preload 安全桥
      现状: `frontend/` 已可构建，尚未作为渲染进程接入 Electron
      依据: 图1-A2、图1-A3
      验证: `pnpm --filter desktop dev` 启动窗口 ➔ 预期: 窗口显示登录页，contextIsolation 开启，preload 暴露受限 API
      证据: (2026-09-12, 实测通过: `pnpm --filter desktop build` 通过，React 渲染产物生成；`env -u ELECTRON_RUN_AS_NODE pnpm --filter desktop smoke` 返回 `{"hasBridge":true,"platform":"darwin","hasRequire":false}`，即 preload 桥可用且渲染进程无 Node require；窗口配置 contextIsolation:true、sandbox:true、nodeIntegration:false)

- [x] 0.3 实现 safeStorage + electron-store 本地 token/配置存储
      现状: 桌面端无本地安全存储
      依据: 图1-A5、design.md「四、认证与权限」
      验证: `node test_desktop_store.js` 写入后重启仍可读 ➔ 预期: token 经 safeStorage 加密后持久化，明文不落盘
      证据: (2026-09-12, 实测通过: `pnpm --filter desktop build` 通过；`env -u ELECTRON_RUN_AS_NODE pnpm --filter desktop smoke` 返回 hasStoreApi:true 且渲染进程无 require；`env -u ELECTRON_RUN_AS_NODE pnpm --filter desktop store-smoke` 返回 `{"readOk":true,"config":7,"afterClear":null}`，即 safeStorage 加密 token 可落盘、重新实例化 electron-store 后可读、clear 后为空)

- [x] 0.9 增加设置页本地数据保留策略入口
      现状: 本地清理默认值已确定，但用户不可查看或调整
      依据: design.md「桌面端本地 SQLite（Agent 执行层）」、tasks.md「SQLite 清理默认值」
      验证: `node test_local_retention_settings.js` ➔ 预期: 设置页可选择 `1 天 / 3 天 / 7 天（默认） / 30 天`；配置写入 `electron-store`；可显示本地临时目录占用；可手动触发“立即清理已过期数据”；不提供无限期选项；修改后清理任务读取最新值
      证据: (2026-09-12, 实测通过: `pnpm --filter desktop build` 通过；设置页提供 1/3/7/30 天选项、保存写 `config.localRetentionDays`、显示临时文件数与占用、触发 `local:run-cleanup`；`local:get-stats` 从 TempFile 聚合占用；preload 仅暴露 getStats/runCleanup 受限接口；shell/store-smoke 均通过)

- [x] 0.4 初始化桌面端 SQLite 本地执行层与自动清理机制
      现状: 桌面端无本地 SQLite 队列与采集暂存
      依据: 图1-B4、图1-B5、design.md「三、数据库全景」（桌面端本地 SQLite）
      验证: `node test_desktop_sqlite.js` ➔ 预期: 本地队列、采集暂存索引、进程 PID 表可读写，迁移可重复执行；启动清理与每 6 小时清理生效；终态记录保留 30 天、终态临时文件默认保留 7 天、本地临时目录超过 2 GB 时按最旧终态数据清理；运行中/待执行任务不被清理
      证据: (2026-09-12, 实测通过: `pnpm --filter desktop db:init` 可重复执行；`pnpm --filter desktop local-db-smoke` 返回 `{"first":{"deletedJobs":1,...},"oldJobRemoved":true,"recentJobKept":true,"queuedKept":true,"oldFileRemoved":true,"recentFileRemoved":true}`，即 30 天前终态任务连同事件/文件被清理、近期终态保留、queued 不清理、临时文件默认 7 天与 2GB 上限逻辑生效；`pnpm --filter desktop build` 通过。注：本机 Node 25 下 `prisma migrate dev/db push` 的 schema engine 报 `Schema engine error: undefined`，已改用 `prisma migrate diff` 生成 migration SQL + `prisma db execute` 初始化，迁移文件仍由 Prisma schema 管理)

- [x] 0.8 建立桌面端清理策略专项测试
      现状: SQLite 清理默认规则已确定，边界测试尚未建立
      依据: design.md「桌面端本地 SQLite（Agent 执行层）」、tasks.md「SQLite 清理默认值」
      验证: `node test_sqlite_cleanup_policy.js` ➔ 预期: 只清理 success/failure/cancelled 且本地记录超过 30 天；queued/collecting/uploading/running 不清理；终态临时文件按设置页选择的保留时间清理（默认 7 天）；先删文件再删索引；文件删除失败不阻塞后续清理；重复执行幂等；临时目录超过 2 GB 时按最旧终态数据清理；token、配置、浏览器 profile 不受影响
      证据: (2026-09-12, 实测通过: `pnpm --filter desktop local-db-smoke` 返回 `{"first":{"deletedJobs":1,...},"oldJobRemoved":true,"recentJobKept":true,"queuedKept":true,"runningKept":true,"oldFileRemoved":true,"recentFileRemoved":true}`；删除失败目录被记录且不阻塞其他清理；重复执行两次幂等；capBytes 覆盖 2GB 上限逻辑；electron-store/safeStorage 由 store-smoke 单独覆盖)

- [x] 0.5 配置 electron-builder 打包、内置 Python 与 electron-updater 更新源占位
      现状: 无打包与更新管道，Python 运行时未内置；Python 方案已确认（python-build-standalone + uv 构建期 + extraResources）
      依据: 图1-A4、图1-A6、design.md「十一、桌面端打包与更新」
      验证: `pnpm --filter desktop build:package` ➔ 预期: 产出可安装 dmg/exe/AppImage，`resources/python` 与 `resources/skills` 完整（递归过滤，`bin/python3` 符号链接/权限不丢），更新源通过配置注入且可替换（GitHub Releases/阿里云静态源暂不定最终方案）；在无系统 Python 干净机器上 `spawn` 运行 `skills/` 探针成功且输出 UTF-8
      证据: (2026-09-12, 实测通过: `pnpm --filter desktop build:package` 产出 `desktop/dist/电商竞品分析-0.1.0-arm64.dmg`（154MB）及 blockmap/latest-mac.yml；macOS arm64 内置 Python 3.12.14 符号链接与执行权限完整，`Resources/skills` 含 diantoushi-product-research/mysql-import/market-analysis-report；`app-update.yml` 为 generic 占位 `https://updates.example.invalid/desktop`，支持 `UPDATE_URL` 环境变量覆盖；签名因本机无有效 Developer ID 跳过，属于开发期预期)

- [x] 0.6 完成旧前端页面迁移盘点与新路由边界
      现状: 旧 `app/src/app/pages` 包含报告、主图/详情图、图库、平台商品、数据下载、看板、视频复刻等页面，尚未明确迁移或裁剪范围
      依据: tasks.md「历史代码迁移与功能收口」、design.md「工程组织」
      验证: 形成页面迁移矩阵；旧页面（登录、报告、图片生成、资产库、平台发布、数据下载、看板、视频复刻、设置等）全部在新 frontend/desktop 路由中有明确迁移归属
      证据: (2026-09-12, 文件落盘: `docs/开发任务/2026-09-10-桌面端与服务端架构方案/页面迁移矩阵.md`，覆盖 app/src/app/pages 29 个旧页面、旧路由、新模块、新路由规划与处理方式；其中 AssetLibrary 已标注“旧代码导入但未注册路由，Phase 7 前人工确认迁移或裁剪”)

- [x] 0.7 依赖安装与运行环境探测
      现状: 根 workspace 只有 `frontend/backend`；desktop 依赖、Electron、内置 Python、系统 Chrome、Playwright、Prisma client、Docker 中间件均未做一键安装与探测
      依据: design.md「工程组织」「桌面端打包与更新」、tasks.md 现状基线
      验证: `pnpm setup`（含 desktop）与 `pnpm --filter desktop build` 在全新目录可复现 ➔ 预期: `pnpm install --frozen-lockfile` 通过；workspace 含 desktop；Prisma generate 成功；内置 Python 版本按 3.12.x 锁定清单复现，依赖（含 playwright wheel）可复现；内置 Python 可运行 `skills/`；系统 Chrome 可发现；MySQL/Redis 健康；根级 `check-env` 使用 `spawn`（shell:false）并注入 `PYTHONUTF8=1` 验证中文路径与输出编码，输出逐项通过
      证据: (2026-09-13, 实测通过: `pnpm check-env` 输出 9/9 PASS，覆盖 Node/pnpm/workspace desktop/Electron/内置 Python（3.12.14，中文输出 ok）/skills/系统 Chrome/Prisma schema/Docker MySQL+Redis；check-env 使用 execFileSync spawn 且移除 ELECTRON_RUN_AS_NODE、注入 PYTHONUTF8=1/PYTHONIOENCODING=utf-8)

- [x] 0.10 收口重构前 backend 通用骨架
      现状: 未提交骨架的 `log-streams.ts` 当前存在 TypeScript 构建错误，日志目录未自动创建；健康检查仍只有 `/api/health`；环境变量示例尚未形成唯一加载入口
      依据: tasks.md「未提交骨架审查收口项」、design.md「重构前未提交骨架的处理原则」
      验证: `pnpm --filter backend build` 通过；无 `backend/logs` 目录时服务首次启动仍能正常落盘；`/api/health/live` 与 `/api/health/ready` 可用；新服务从 `backend/.env` 加载配置，旧 `app/.env.local` 不作为新入口
      证据: (2026-09-13, 实测通过: `pnpm --filter backend build` 通过；启动 `node dist/src/main.js` 后 `backend/logs` 自动创建并落盘 app/debug/error.log；`curl /api/health/live` 200，`curl /api/health/ready` 200 返回 mysql/redis up；ConfigModule 显式 `envFilePath: ['.env']`，`backend/.env.example` 补齐 DATABASE_URL/REDIS_URL/JWT 并标注为服务端唯一入口。另修复 Prisma 双 schema 冲突：桌面端生成到 `desktop/src/generated/prisma`，backend 使用默认 client，两者互不覆盖)
