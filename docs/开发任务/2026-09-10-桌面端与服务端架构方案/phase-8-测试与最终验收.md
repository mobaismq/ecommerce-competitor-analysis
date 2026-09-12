# Phase 8：测试与最终验收

- [ ] 8.1 建立服务端 Jest 测试并覆盖核心能力（含 BullMQ/Redis、FlowProducer、Agent 租约与检查点续跑）
      现状: 无测试配置与用例
      依据: 图1-T1、design.md「十二、本地测试方案」
      验证: `pnpm --filter backend test` ➔ 预期: Guard/DTO/任务快照/幂等/队列/FlowProducer 流程树/Agent 领取与租约/外部完成/checkpoint 续跑/flow-finalizer/StorageDriver/轻量状态机测试全通过
      证据:

- [ ] 8.2 建立桌面端 Vitest/Playwright 测试（含内置 Python 与首次登录引导）
      现状: 桌面端测试缺失
      依据: 图1-T2
      验证: `pnpm --filter desktop test` ➔ 预期: XState 生命周期、SQLite 本地队列/临时数据清理、终态记录保留 30 天、临时文件默认保留 7 天且支持 1/3/7/30 天设置、2 GB 空间上限、RPA 专用 profile 首次登录引导、UI E2E 通过
      证据:

- [ ] 8.3 执行端到端联调与最终验收（Redis/BullMQ FlowProducer 下 Agent→服务端→AI(mock)→报告→图片生成→平台发布）
      现状: 各模块独立，未联调
      依据: 图1-T3、架构图「唯一权威判据表」
      验证: 桌面端登录→提交任务→Agent claim/心跳/complete→服务端 AI(mock)→报告展示→图片生成(mock)→结果人工审核→平台发布(mock)；检查点续跑与无旧数据迁移抽查通过 ✓ 全链路 ➔ 预期: 全链路通过，判据表全绿
      证据:

- [ ] 8.4 多 Provider Profile、安全与切换验收
      现状: 多厂商、多 key/baseURL、管理后台切换和运行中任务固定配置尚未形成最终验收
      依据: design.md「多供应商配置实例与后台切换」、phase-1、phase-4
      验证: 多个 Profile 可共存；后台切换后新任务使用新 Profile，运行中任务使用旧 Profile；禁用 Profile 后不能创建新任务；SSRF 校验拒绝危险 baseURL；Key 不出现在 API、日志、桌面端；AiUsageLog 记录 providerProfileId；Mock/自定义端点链路全通过
      证据:
