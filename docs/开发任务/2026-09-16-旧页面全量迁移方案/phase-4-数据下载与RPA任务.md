# Phase 4 · 数据下载 / RPA 任务

> 归属旧页面（2 个）：DataDownload（数据下载/店透视 RPA 触发）、DataDownloadRun（导出运行跟随页）
> 目标：把 rpa 触发/状态/停止接成任务闭环，并把 `/data/downloads`、`/data/downloads/:id` 接成真实页面；打通桌面端采集链到服务端。
> 前置：R-1 桌面采集链最小闭环已通（`collection:start/cancel/status/probe` IPC + 演示模式可落库）；新后端 jobs + collection-jobs(`POST :jobId/results`) 已就绪。
> 验证原则：演示模式 + `rpa_runs/` 离线样本本地落库，禁止循环触发真实店透视爬虫（防封号）。

---

- [x] 4.1 接 rpa 触发/状态/停止为任务闭环（后端与IPC）
      现状: 旧页面依赖 `GET /api/rpa/status`、`POST /api/rpa/start`、`POST /api/rpa/stop`；新桌面端与服务端打通本地采集与服务端任务同步（`collection:start`、`collection:status`、`collection:cancel`、`collection:list`、`collection:probe` 及服务端 `POST /api/collection-jobs/:id/results`）。
      依据: 架构图-图1 B6、C2、C11；design.md「六、RPA Agent」「七、SSE」；旧表 `crawl_job → CollectionJob`
      验证: 演示模式创建采集任务 → 桌面端执行落库 → `collection:status` 查询状态与 logTail ➔ 预期: 状态 queued→running→success，本地工作目录写出 run.log 与 results；`pnpm --filter backend test` 14 套件 91 单测全部通过。
      证据: `apps/desktop/src/main/collection-handlers.ts` 扩展支持 `minPrice`、`maxPrice`、`topN`、`searchPages`、`speedProfile`、`importMysql` 全量参数，工作目录持久化与 `run.log` 日志实时回传；`pnpm --filter backend test` 结果：`Test Suites: 14 passed, 14 total; Tests: 91 passed, 91 total` (exit code 0)。

- [x] 4.2 前端接真数据下载与运行页
      现状: 旧 DataDownload/DataDownloadRun 中的 4 组预设标签、价格区间、TopN、搜索页数、速率档位、入库开关、演示模式、任务状态徽标、PID、开始时间、商品与参数摘要、`parseRpaProgress` 动态计算进度与阶段、本地工作目录、暗黑实时控制台日志窗口及历史任务切换全部 100% 迁移至 Arco Design。
      依据: 架构图-图1 A2；design.md「七、SSE」进度推送
      验证: `pnpm --filter desktop test` + `pnpm build` ➔ 预期: 两页完整合并为现代工作台，支持路由 `/data/downloads` 与 `/data/downloads/:id`，日志暗黑终端自动滚动/清屏/复制，无占位文本。
      证据: 新建 `apps/desktop/src/renderer/src/utils/rpaProgress.ts` 并编写 `rpaProgress.spec.ts`（5 项单测全部 pass）；重构 `apps/desktop/src/renderer/src/pages/DataDownloadPage.tsx`（560+ 行 Arco 完整交互）；`pnpm build` exit code 0 通过。

- [x] 4.3 桌面端采集链端到端（真实 RPA 与离线样本仿真）
      现状: R-1 最小闭环已扩展至多模式端到端：支持 `download-and-import`、`download-only`、`import-only`，离线样本与仿真日志生成，进程生命周期安全管理与用户取消机制。
      依据: 架构图-图1 B1–B5、A6；design.md「六、RPA Agent」
      验证: 本地离线样本驱动采集（不触真实爬虫防封号）→ 结构化写入结果 → 桌面端 UI 显示进度 ➔ 预期: 链路打通，进程回收正常，无孤儿进程。
      证据: `pnpm --filter desktop run collection-modes-smoke` 验证 `{"downloadOnlyStages":"download,collect-files,sync","downloadAndImportStages":"download,collect-files,import,sync","importOnlyStages":"collect-files,import,sync","downloadOnlyFiles":2,"downloadOnlyCounts":{},"downloadAndImportCounts":{"productCount":2,"skuCount":1,"fileCount":2},"importOnlyCounts":{"productCount":2,"skuCount":1,"fileCount":1},"invalidRejected":true}` (exit code 0)。