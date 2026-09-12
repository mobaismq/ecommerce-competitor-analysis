# Phase 4：AI、报告与下游工作流

- [ ] 4.1 实现服务端统一 AI 适配器与 Mock provider（AI 队列任务）
      现状: 无 AI 适配器；密钥应集中服务端
      依据: 图1-C3、图1-C8、design.md「五、任务队列与轻量业务工作流」「九、外部依赖边界」
      验证: `node test_ai_adapter_mock.js` ➔ 预期: Mock 队列任务经 AiProvider/ProviderRegistry/ProviderRouter 返回统一结构；覆盖 ArkProvider、OpenRouterProvider、OpenAICompatibleProvider；按 attemptKey 记录模型/耗时/Token/状态，不触发真实付费 API；业务 Pipeline 不出现厂商分支
      证据:

- [ ] 4.2 实现报告 Pipeline 与结果落库
      现状: 报告模型在 schema 中，Pipeline 缺失
      依据: 图1-C4、图1-C8、design.md「三、数据库全景」
      验证: `node test_report_pipeline_mock.js` ➔ 预期: Mock 数据经任务队列全链路生成报告并落 MySQL，任务 success；失败可从 checkpoint 阶段续跑
      证据:

- [ ] 4.3 实现 PlatformAdapter、平台字典与淘宝适配器
      现状: 旧 `taobaoTopClient.js` 有类目/店铺能力，新适配器缺失
      依据: 图1-C5、design.md「三、数据库全景」
      验证: `node test_platform_adapter.js` ➔ 预期: 旧淘宝类目/店铺调用迁移到统一适配器；Mock 转统一 DTO 且保留 raw_payload
      证据:

- [ ] 4.4 实现 AI 审计与关键日志埋点
      现状: `ai_usage_logs` 在 schema 中，attemptKey 幂等写入缺失
      依据: 图1-C3、架构图「AI 审计」
      验证: `node test_ai_audit.js` ➔ 预期: 成功/失败/重试均有记录，attemptKey 唯一，app.log 含 requestId/jobId 无密钥
      证据:

- [ ] 4.5 实现图片生成流程树（prompt/generate/review）
      现状: 图片生成为独立下游任务，流程树缺失；旧 `mainImagePromptExpansion.js` 与 `arkImageGeneration.js` 待迁移
      依据: design.md「FlowProducer 编排模型」「下游工作流：图片生成与平台发布」
      验证: `node test_image_flow_mock.js` ➔ 预期: 旧提示词/生图逻辑迁移后基于报告与商品原图依次执行 prompt→generate→review；review 支持采纳/不采纳/重新生成，采纳后外部完成继续流程，重新生成创建新批次并受次数上限约束，不采纳结束当前资产；生成图落 mock 存储并记录资产引用；任务 success/failure/cancelled 正确
      证据:

- [ ] 4.6 实现平台发布流程树（upload-assets/submit）
      现状: PlatformAdapter 仅有接口规划，发布流程树缺失
      依据: design.md「FlowProducer 编排模型」「下游工作流：图片生成与平台发布」
      验证: `node test_listing_flow_mock.js` ➔ 预期: 基于生成资产依次执行 upload-assets→submit；平台 Mock 成功/失败/重试符合统一状态；任务 success/failure/cancelled 正确
      证据:

- [ ] 4.7 实测 AI/淘宝限流并回填 provider 配置
      现状: RPM/TPM/QPS、超时、错误码与可重试类型未实测
      依据: design.md「九、外部依赖边界」「参数与执行位置」
      验证: `node test_provider_limits.js` ➔ 预期: ark/openrouter/openai-compatible/taobao 的限流、超时、错误码与可重试类型写入对应 ProviderProfile；Worker 内限流生效，不触发超额调用；健康状态和最近错误可供 ProviderRouter 使用
      证据:

- [ ] 4.8 实现 ProviderRouter 与自定义端点安全校验
      现状: 多 Profile 路由、连接测试和自定义 baseURL SSRF 防护缺失
      依据: design.md「多供应商配置实例与后台切换」「AI 供应商适配设计」
      验证: 按能力选择唯一 active Profile；支持手动切换；baseURL 仅允许 HTTPS，拒绝 localhost、127.0.0.1、内网网段、云 metadata 地址、危险协议和异常端口；Key 不下发桌面端、不进日志；任务固定使用创建时 providerProfileId
      证据:
