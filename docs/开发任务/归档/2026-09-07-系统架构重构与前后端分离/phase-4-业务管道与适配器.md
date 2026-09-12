# Phase 4：业务管道与适配器

- [ ] 4.1 实现统一 AI 适配器和 Mock provider
      现状: 旧 AI 逻辑位于 `app/src/server/aiMarketAnalysis.js` 等文件，新适配器接口缺失
      依据: 图1-C3、design.md「外部依赖边界」
      验证: `node test_ai_adapter_mock.js` ➔ 预期: Mock 调用返回统一结果，记录模型、耗时、Token 和状态，不触发真实付费 API
      证据: 

- [ ] 4.2 实现报告 Pipeline 和阶段结果落库
      现状: 旧报告流程集中在 `backend/server.js`，新 Pipeline Step 和数据库结果模型缺失
      依据: 图1-C1、图3-报告任务、design.md「报告存储统一性」
      验证: `node test_report_pipeline_mock.js` ➔ 预期: 使用离线 Mock 数据完成各阶段，结果写入 MySQL，任务进入 success
      证据: 

- [ ] 4.3 实现 PlatformAdapter、平台字典和淘宝适配器
      现状: 旧淘宝入口位于 `app/src/server/taobaoTopClient.js`，新平台适配器边界缺失
      依据: 图1-C4、design.md「多平台可扩展设计」
      验证: `node test_platform_adapter.js` ➔ 预期: 淘宝 Mock 响应转为统一 Product/Store/Category DTO，并保留 raw_payload
      证据: 

- [ ] 4.4 实现 AI 调用审计和关键业务日志埋点
      现状: 新 `ai_usage_logs`、`app.log` 关键节点日志和失败审计缺失
      依据: 图1-B7、架构图「AI 审计」「日志可观测」
      验证: `node test_ai_audit.js` ➔ 预期: 每次成功/失败/重试调用均有审计记录，app.log 含 requestId/jobId 且不记录密钥
      证据: 
