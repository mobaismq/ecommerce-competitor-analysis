# Phase 0：桌面端工程与基础壳

- [ ] 0.1 建立 desktop/ electron-vite 工程与主进程壳
      现状: `desktop/` 目录不存在；根 workspace 尚无 desktop 包
      依据: 图1-A1、design.md「工程组织」
      验证: `pnpm install && pnpm --filter desktop build` ➔ 预期: 主进程/preload/渲染进程构建通过
      证据:

- [ ] 0.2 接入渲染进程 React UI 与 preload 安全桥
      现状: `frontend/` 已可构建，尚未作为渲染进程接入 Electron
      依据: 图1-A2、图1-A3
      验证: `pnpm --filter desktop dev` 启动窗口 ➔ 预期: 窗口显示登录页，contextIsolation 开启，preload 暴露受限 API
      证据:

- [ ] 0.3 实现 safeStorage + electron-store 本地 token/配置存储
      现状: 桌面端无本地安全存储
      依据: 图1-A5、design.md「四、认证与权限」
      验证: `node test_desktop_store.js` 写入后重启仍可读 ➔ 预期: token 经 safeStorage 加密后持久化，明文不落盘
      证据:

- [ ] 0.9 增加设置页本地数据保留策略入口
      现状: 本地清理默认值已确定，但用户不可查看或调整
      依据: design.md「桌面端本地 SQLite（Agent 执行层）」、tasks.md「SQLite 清理默认值」
      验证: `node test_local_retention_settings.js` ➔ 预期: 设置页可选择 `1 天 / 3 天 / 7 天（默认） / 30 天`；配置写入 `electron-store`；可显示本地临时目录占用；可手动触发“立即清理已过期数据”；不提供无限期选项；修改后清理任务读取最新值
      证据:

- [ ] 0.4 初始化桌面端 SQLite 本地执行层与自动清理机制
      现状: 桌面端无本地 SQLite 队列与采集暂存
      依据: 图1-B4、图1-B5、design.md「三、数据库全景」（桌面端本地 SQLite）
      验证: `node test_desktop_sqlite.js` ➔ 预期: 本地队列、采集暂存索引、进程 PID 表可读写，迁移可重复执行；启动清理与每 6 小时清理生效；终态记录保留 30 天、终态临时文件默认保留 7 天、本地临时目录超过 2 GB 时按最旧终态数据清理；运行中/待执行任务不被清理
      证据:

- [ ] 0.8 建立桌面端清理策略专项测试
      现状: SQLite 清理默认规则已确定，边界测试尚未建立
      依据: design.md「桌面端本地 SQLite（Agent 执行层）」、tasks.md「SQLite 清理默认值」
      验证: `node test_sqlite_cleanup_policy.js` ➔ 预期: 只清理 success/failure/cancelled 且本地记录超过 30 天；queued/collecting/uploading/running 不清理；终态临时文件按设置页选择的保留时间清理（默认 7 天）；先删文件再删索引；文件删除失败不阻塞后续清理；重复执行幂等；临时目录超过 2 GB 时按最旧终态数据清理；token、配置、浏览器 profile 不受影响
      证据:

- [ ] 0.5 配置 electron-builder 打包、内置 Python 与 electron-updater 更新源占位
      现状: 无打包与更新管道，Python 运行时未内置；Python 方案已确认（python-build-standalone + uv 构建期 + extraResources）
      依据: 图1-A4、图1-A6、design.md「十一、桌面端打包与更新」
      验证: `pnpm --filter desktop build:package` ➔ 预期: 产出可安装 dmg/exe/AppImage，`resources/python` 与 `resources/skills` 完整（递归过滤，`bin/python3` 符号链接/权限不丢），更新源通过配置注入且可替换（GitHub Releases/阿里云静态源暂不定最终方案）；在无系统 Python 干净机器上 `spawn` 运行 `skills/` 探针成功且输出 UTF-8
      证据:

- [ ] 0.6 完成旧前端页面迁移盘点与新路由边界
      现状: 旧 `app/src/app/pages` 包含报告、主图/详情图、图库、平台商品、数据下载、看板、视频复刻等页面，尚未明确迁移或裁剪范围
      依据: tasks.md「历史代码迁移与功能收口」、design.md「工程组织」
      验证: 形成页面迁移矩阵；旧页面（登录、报告、图片生成、资产库、平台发布、数据下载、看板、视频复刻、设置等）全部在新 frontend/desktop 路由中有明确迁移归属
      证据:

- [ ] 0.7 依赖安装与运行环境探测
      现状: 根 workspace 只有 `frontend/backend`；desktop 依赖、Electron、内置 Python、系统 Chrome、Playwright、Prisma client、Docker 中间件均未做一键安装与探测
      依据: design.md「工程组织」「桌面端打包与更新」、tasks.md 现状基线
      验证: `pnpm setup`（含 desktop）与 `pnpm --filter desktop build` 在全新目录可复现 ➔ 预期: `pnpm install --frozen-lockfile` 通过；workspace 含 desktop；Prisma generate 成功；内置 Python 版本按 3.12.x 锁定清单复现，依赖（含 playwright wheel）可复现；内置 Python 可运行 `skills/`；系统 Chrome 可发现；MySQL/Redis 健康；根级 `check-env` 使用 `spawn`（shell:false）并注入 `PYTHONUTF8=1` 验证中文路径与输出编码，输出逐项通过
      证据:

- [ ] 0.10 收口重构前 backend 通用骨架
      现状: 未提交骨架的 `log-streams.ts` 当前存在 TypeScript 构建错误，日志目录未自动创建；健康检查仍只有 `/api/health`；环境变量示例尚未形成唯一加载入口
      依据: tasks.md「未提交骨架审查收口项」、design.md「重构前未提交骨架的处理原则」
      验证: `pnpm --filter backend build` 通过；无 `backend/logs` 目录时服务首次启动仍能正常落盘；`/api/health/live` 与 `/api/health/ready` 可用；新服务从 `backend/.env` 加载配置，旧 `app/.env.local` 不作为新入口
      证据:
