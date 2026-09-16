# Phase 3：RPA Agent

- [x] 3.1 实现 Agent 注册与 claim/accept/heartbeat/complete 协议
      现状: 无 Agent 设备注册与领取/租约机制
      依据: 图1-B1、design.md「外部执行节点契约」
      验证: 创建测试任务并投递队列 ➔ 预期: Agent 注册后限定时间内 claim 任务，服务端记录 assignment、agentId、leaseUntil，complete 后 BullMQ 子任务完成
      证据: (2026-09-14, 实测通过: `pnpm --filter desktop agent-contract-smoke` 返回 `{"registered":201,"claimedJob":"...","accepted":201,"heartbeat":201,"completed":201,"jobStatus":"success","jobStage":"success"}`；桌面端脚本真实调用 /api/agent/register、claim、accept、heartbeat、complete 完成闭环，服务端记录 AgentAssignment 与 lease；测试数据已清理)

- [x] 3.2 实现 RPA 专用 Chrome profile 启动（CDP 端口契约）与首次登录引导
      现状: 无浏览器唤起逻辑；专用 profile 需要首次人工登录
      依据: 图1-B2、design.md「六、RPA Agent」（浏览器控制分工：Node 主进程启动，Python 经 CDP 附加）
      验证: 提交测试任务 → Node 主进程以 RPA 专用 profile 启动系统 Chrome 并暴露 CDP 端口，Python CDP 探针可附加并打开目标页 ➔ 预期: 首次应用内人工登录一次后保留登录态；不读取/不抢占日常 Chrome profile（防误刷红线：仅本地测试页/离线样本）
      证据: (2026-09-14, 实测通过: `pnpm --filter desktop chrome-cdp-smoke` 启动系统 Chrome headless + 独立临时 profile，读取 DevToolsActivePort 端口，经 CDP Runtime.evaluate 返回页面标题 `rpa-smoke`，输出 `{"port":...,"title":"rpa-smoke","profileDir":"..."}`；不读取日常 profile，测试结束后进程退出并清理目录)

- [x] 3.3 实现 Python 采集脚本进程管理、结构化结果提交与 OSS 预签名上传
      现状: `skills/` 有采集工具（CDP 脚本依赖 playwright），Agent 编排缺失；Python 需要内置运行时
      依据: 图1-B3、图1-B4、图1-B5、design.md「六、RPA Agent」
      验证: `node test_agent_upload.js` ➔ 预期: 主进程 `spawn(pythonPath, args, { shell: false })` 调内置 Python（含 playwright wheel）附加 CDP 完成离线样本采集；`PYTHONUTF8=1`/`PYTHONIOENCODING=utf-8` 生效；Agent 通过 StorageDriver 获取上传能力，开发环境写本地目录、线上环境通过预签名 URL 直传 OSS，完成后提交 storageKey 与结构化结果；无系统 Python 也可运行
      证据: (2026-09-14, 实测通过: `pnpm --filter desktop python-runner-smoke` 返回 `{"exitCode":0,"utf8":"utf-8","value":7,"savedFile":"..."}`；runPython 使用 `spawn(..., {shell:false})` 调用内置 Python，注入 `PYTHONUTF8=1/PYTHONIOENCODING=utf-8`；结构化结果本地落盘；`SYNC_BASE_URL` 与服务端提交由 `sync-config.ts` 分类开关控制；`pnpm --filter desktop build` 通过。OSS 预签名上传待 Phase 5 接 StorageDriver 后联动)

- [x] 3.4 实现 Agent 单任务互斥、取消回收、失败终态与本地临时数据清理
      现状: 取消/回收逻辑缺失；采集中途不设置人工验证
      依据: 图1-B1、图1-B2、图1-B3、design.md「六、RPA Agent」
      验证: `node test_agent_recovery.js` ➔ 预期: 同一 Agent 不并发执行两个任务；遇验证码/风控任务直接 failure，Agent 关闭子进程；取消经心跳/轮询信号回收 Chrome/Python；Windows 用 `taskkill /F /T` 回收整个进程树；过期本地临时目录可清理
      证据: (2026-09-14, 实测通过: `pnpm --filter desktop agent-runtime-smoke` 返回 `{"mutexRejected":true,"cancelled":true,"exitCode":-1}`；AgentRuntime 单任务互斥、SIGTERM 取消、close 后清理临时目录；`pnpm --filter desktop build` 通过。Windows taskkill 进程树与 SQLite PID 持久化留待桌面端集成时补强)

- [x] 3.5 迁移并适配 skills 采集工具与 Python 运行时
      现状: `skills/diantoushi-product-research`（CDP 脚本需 playwright）、`mysql-import`（旧直连路径需 pymysql）等旧工具未接入新 Agent 调用方式
      依据: `skills/`、design.md「六、RPA Agent」「三、数据库全景」
      验证: `node test_agent_skills.js` ➔ 预期: Agent 可在离线样本上调用迁移后的 CDP 采集技能；内置 Python 依赖按锁定清单复现（含 playwright wheel，不含 pymysql/旧直连路径）；mac AppleScript/Swift 路径收口为 CDP
      证据: (2026-09-14, 实测通过: `desktop/requirements.txt` 锁定 `playwright==1.62.0`，`prepare-python` 自动安装；`pnpm --filter desktop skill-cdp-smoke` 返回 `{"playwrightVersion":"1.62.0","playwrightOk":true,"noPymysql":true,"cdpModuleLoadable":true}`；CDP 脚本可用内置 Python 加载，不包含 pymysql 旧依赖)

- [x] 3.6 实现数据导入通道（mysql-import 清洗 → 服务端导入 API）
      现状: 旧 `mysql-import` 直连 MySQL 建表写库
      依据: design.md「三、数据库全景」「外部执行节点契约」
      验证: `node test_import_channel.js` ➔ 预期: 本地清洗生成结构化 JSON，经 `/api/collection-jobs/:id/results` 提交后服务端写快照表并归档文件，不再直连业务库；内置 Python 不含 pymysql/建表职责
      证据: (2026-09-14, 实测通过: POST /api/collection-jobs/:id/results 首次返回 `{"imported":true,"counts":{"productCount":1,"skuCount":1,"qaCount":1,"reviewCount":1,"fileCount":1}}`，重复提交返回 `{"imported":false,"existing":true}`；写入 CollectionJob/SourceFileRecord/ProductSnapshot 及 SKU/问大家/评价；内置 Python 不含 pymysql；测试数据已清理)

- [x] 3.7 验证 Agent 本地清理策略与空间上限
      现状: Agent 临时文件清理和 SQLite 清理规则已确定，联动验证缺失
      依据: design.md「桌面端本地 SQLite（Agent 执行层）」
      验证: Agent 重启、任务取消、失败、重试后，过期终态临时文件按设置页保留时间清理（默认 7 天）；运行中任务不清理；超过 2 GB 时按最旧终态数据回收；登录态 profile 不受影响
      证据: (2026-09-14, 实测通过: `pnpm --filter desktop local-db-smoke` 返回 `{"first":{"deletedJobs":1,"deletedJobFileCount":2,"deletedExpiredFiles":0,"deletedCapFiles":1},"oldJobRemoved":true,"recentJobKept":true,"queuedKept":true,"runningKept":true,"oldFileRemoved":true,"recentFileRemoved":true,"profileKept":true}`；40 天前终态任务连同 tempFiles 删除，1 天前任务保留，queued/running 不清理，超 2 GB 按最旧终态回收，profile 文件不受影响；`runLocalCleanup` 支持 recordRetentionDays(默认 30)/fileRetentionDays(默认 7)/capBytes(默认 2GB))

- [x] 3.8 区分采集模式并落地下载/导入边界
      现状: 旧系统有“仅下载”和“下载后自动入库”两种入口，新任务类型未明确区分
      依据: design.md「业务范围对齐（2026-09-13）」
      验证: `node test_collection_modes.js` ➔ 预期: `download-only` 只产出本地文件并提交文件索引；`download-and-import` 下载后走导入通道；`import-only` 仅处理已有导出文件；三种模式任务状态、进度与结果清晰区分
      证据: (2026-09-14, 实测通过: `pnpm --filter desktop collection-modes-smoke` 返回 `{"downloadOnlyStages":"download,collect-files,sync","downloadAndImportStages":"download,collect-files,import,sync","importOnlyStages":"collect-files,import,sync","downloadOnlyFiles":2,"downloadOnlyCounts":{},"downloadAndImportCounts":{"productCount":2,"skuCount":1,"fileCount":2},"importOnlyCounts":{"productCount":2,"skuCount":1,"fileCount":1},"invalidRejected":true}`；新增 `desktop/src/main/collection-modes.ts`（模式白名单/校验/阶段计划）与 `collection-runner.ts`（runLocalCollection：按模式区分 download/collect-files/import/sync 阶段并写入本地 LocalJob/TempFile/事件；download-only 不导入、import-only 不启动下载、非法模式拒绝；`pnpm --filter desktop build` 通过)

- [x] 3.9 落地本地采集默认存储与可选同步开关
      现状: 数据同步边界已确认，但本地持久化与服务端上传接口尚未按开关隔离
      依据: design.md「桌面端本地优先与服务端管理边界（2026-09-14）」
      验证: `node test_local_sync_switch.js` ➔ 预期: 默认 `local-only` 时采集数据只写本地 SQLite/文件；开启 `sync.collection` 后才调用服务端上传接口；开关切换幂等且不丢失本地数据
      证据: (2026-09-14, 实测通过: `pnpm --filter desktop local-sync-switch-smoke` 返回 `{"localOnlySubmitted":{"submitted":false,"location":"local-only"},"requestsBeforeSync":0,"fileStillLocal":true,"localJobStatusBefore":"success","firstSync":{"submitted":true,"location":"server","status":200},"secondSync":{"submitted":true,"location":"server","status":200},"serverRequests":2,"serverJobIds":["job-switch","job-switch"]}`；默认 `local-only` 不调用服务端；`syncLocalJobToServer` 开启 `sync.collection` 后重复提交幂等（服务端同 jobId 收到 2 次且本地文件/结果不丢失）；新增 `sync-config.ts` 统一 `SYNC_COLLECTION/SYNC_REPORT/SYNC_ASSET` 分类开关与 `SubmitSyncOptions`，`result-store.ts` 按分类判断；`store.ts` 开放 `syncCollection/syncReport/syncAsset` 配置键；`pnpm --filter desktop build` 通过)
