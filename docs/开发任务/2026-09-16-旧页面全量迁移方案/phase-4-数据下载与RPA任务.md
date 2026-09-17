# Phase 4 · 数据下载 / RPA 任务

> 归属旧页面（2 个）：DataDownload（数据下载/店透视 RPA 触发）、DataDownloadRun（导出运行跟随页）
> 目标：把 rpa 触发/状态/停止接成任务闭环，并把 `/data/downloads`、`/data/downloads/:id` 接成真实页面；打通桌面端采集链到服务端。
> 前置：R-1 桌面采集链最小闭环已通（`collection:start/cancel/status/probe` IPC + 演示模式可落库）；新后端 jobs + collection-jobs(`POST :jobId/results`) 已就绪。
> 验证原则：演示模式 + `rpa_runs/` 离线样本本地落库，禁止循环触发真实店透视爬虫（防封号）。

---

- [ ] 4.1 接 rpa 触发/状态/停止为任务闭环（后端）
      现状: 旧页面依赖 `GET /api/rpa/status`、`POST /api/rpa/start`、`POST /api/rpa/stop`；新后端无 `/api/rpa/*`，但有通用 `Job`(POST `/api/jobs`)、`collection-jobs` results 与桌面采集链。
      依据: 架构图-图1 B6、C2、C11；design.md「六、RPA Agent」「七、SSE」；旧表 `crawl_job → CollectionJob`
      验证: 演示模式创建采集 Job → 桌面端领取/执行 → `POST /api/collection-jobs/:id/results` 落库 → `GET /api/jobs/:id` 查询状态 ➔ 预期: 状态 queued→…→success，快照表可查；`pnpm --filter backend test` 采集链路单测通过。
      证据: (执行阶段回填)

- [ ] 4.2 前端接真数据下载与运行页
      现状: `apps/desktop/src/renderer/src/main.tsx` 中 `/data/downloads`、`/data/downloads/:id` 为 StubPage；旧 DataDownload/DataDownloadRun 展示任务状态/PID/参数/进度/运行目录/日志并支持停止。
      依据: 架构图-图1 A2；design.md「七、SSE」进度推送
      验证: `pnpm --filter frontend build` + 浏览器用演示模式触发下载、看进度/日志、停止 ➔ 预期: 两页可交互，进度经 SSE/轮询实时刷新，无"模块待接入"。
      证据: (执行阶段回填)

- [ ] 4.3 桌面端采集链端到端（真实 RPA）
      现状: R-1 已接最小闭环（演示模式本地落库，真实脚本参数已对齐）；完整"唤起 Chrome/Python → 采集 → 结构化提交服务端"链路未做端到端验收。
      依据: 架构图-图1 B1–B5、A6；design.md「六、RPA Agent」
      验证: 本地离线 `rpa_runs/` 样本驱动采集（不触真实爬虫）→ 提交服务端落库 → 桌面端 UI 显示进度 ➔ 预期: 链路打通，进程回收正常，无孤儿进程。
      证据: (执行阶段回填)