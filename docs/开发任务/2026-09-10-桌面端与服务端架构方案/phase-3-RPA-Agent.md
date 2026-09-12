# Phase 3：RPA Agent

- [ ] 3.1 实现 Agent 注册与 claim/accept/heartbeat/complete 协议
      现状: 无 Agent 设备注册与领取/租约机制
      依据: 图1-B1、design.md「外部执行节点契约」
      验证: 创建测试任务并投递队列 ➔ 预期: Agent 注册后限定时间内 claim 任务，服务端记录 assignment、agentId、leaseUntil，complete 后 BullMQ 子任务完成
      证据:

- [ ] 3.2 实现 RPA 专用 Chrome profile 启动（CDP 端口契约）与首次登录引导
      现状: 无浏览器唤起逻辑；专用 profile 需要首次人工登录
      依据: 图1-B2、design.md「六、RPA Agent」（浏览器控制分工：Node 主进程启动，Python 经 CDP 附加）
      验证: 提交测试任务 → Node 主进程以 RPA 专用 profile 启动系统 Chrome 并暴露 CDP 端口，Python CDP 探针可附加并打开目标页 ➔ 预期: 首次应用内人工登录一次后保留登录态；不读取/不抢占日常 Chrome profile（防误刷红线：仅本地测试页/离线样本）
      证据:

- [ ] 3.3 实现 Python 采集脚本进程管理、结构化结果提交与 OSS 预签名上传
      现状: `skills/` 有采集工具（CDP 脚本依赖 playwright），Agent 编排缺失；Python 需要内置运行时
      依据: 图1-B3、图1-B4、图1-B5、design.md「六、RPA Agent」
      验证: `node test_agent_upload.js` ➔ 预期: 主进程 `spawn(pythonPath, args, { shell: false })` 调内置 Python（含 playwright wheel）附加 CDP 完成离线样本采集；`PYTHONUTF8=1`/`PYTHONIOENCODING=utf-8` 生效；Agent 通过 StorageDriver 获取上传能力，开发环境写本地目录、线上环境通过预签名 URL 直传 OSS，完成后提交 storageKey 与结构化结果；无系统 Python 也可运行
      证据:

- [ ] 3.4 实现 Agent 单任务互斥、取消回收、失败终态与本地临时数据清理
      现状: 取消/回收逻辑缺失；采集中途不设置人工验证
      依据: 图1-B1、图1-B2、图1-B3、design.md「六、RPA Agent」
      验证: `node test_agent_recovery.js` ➔ 预期: 同一 Agent 不并发执行两个任务；遇验证码/风控任务直接 failure，Agent 关闭子进程；取消经心跳/轮询信号回收 Chrome/Python；Windows 用 `taskkill /F /T` 回收整个进程树；过期本地临时目录可清理
      证据:

- [ ] 3.5 迁移并适配 skills 采集工具与 Python 运行时
      现状: `skills/diantoushi-product-research`（CDP 脚本需 playwright）、`mysql-import`（旧直连路径需 pymysql）等旧工具未接入新 Agent 调用方式
      依据: `skills/`、design.md「六、RPA Agent」「三、数据库全景」
      验证: `node test_agent_skills.js` ➔ 预期: Agent 可在离线样本上调用迁移后的 CDP 采集技能；内置 Python 依赖按锁定清单复现（含 playwright wheel，不含 pymysql/旧直连路径）；mac AppleScript/Swift 路径收口为 CDP
      证据:

- [ ] 3.6 实现数据导入通道（mysql-import 清洗 → 服务端导入 API）
      现状: 旧 `mysql-import` 直连 MySQL 建表写库
      依据: design.md「三、数据库全景」「外部执行节点契约」
      验证: `node test_import_channel.js` ➔ 预期: 本地清洗生成结构化 JSON，经 `/api/collection-jobs/:id/results` 提交后服务端写快照表并归档文件，不再直连业务库；内置 Python 不含 pymysql/建表职责
      证据:

- [ ] 3.7 验证 Agent 本地清理策略与空间上限
      现状: Agent 临时文件清理和 SQLite 清理规则已确定，联动验证缺失
      依据: design.md「桌面端本地 SQLite（Agent 执行层）」
      验证: Agent 重启、任务取消、失败、重试后，过期终态临时文件按设置页保留时间清理（默认 7 天）；运行中任务不清理；超过 2 GB 时按最旧终态数据回收；登录态 profile 不受影响
      证据:
