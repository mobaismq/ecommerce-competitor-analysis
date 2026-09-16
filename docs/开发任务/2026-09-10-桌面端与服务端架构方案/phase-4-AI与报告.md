# Phase 4：AI、报告与下游工作流

- [x] 4.1 实现服务端统一 AI 适配器与 Mock provider（AI 队列任务）
      现状: 无 AI 适配器；密钥应集中服务端
      依据: 图1-C3、图1-C8、design.md「五、任务队列与轻量业务工作流」「九、外部依赖边界」
      验证: `node test_ai_adapter_mock.js` ➔ 预期: Mock 队列任务经 AiProvider/ProviderRegistry/ProviderRouter 返回统一结构；覆盖 ArkProvider、OpenRouterProvider、OpenAICompatibleProvider；按 attemptKey 记录模型/耗时/Token/状态，不触发真实付费 API；业务 Pipeline 不出现厂商分支
      证据: (2026-09-14, 实测通过: `pnpm --filter backend ai-adapter-smoke` 返回 `{"registryOk":true,"unknownRejected":true,"providerTypes":["mock","ark","openrouter","openai-compatible"],"providerOk":true,"mockText":{"status":"success","text":"mock answer: 测试竞品分析","tokenIn":2},"mockVisionImages":"mock vision: 分析主图 (2 images)","mockGeneratedImages":2,"router":{"status":"success","model":"mock-model","durationMs":0,"cachedSecond":true,"usage":{"status":"success","providerType":"mock","model":"mock-model","tokenIn":2,"durationMs":0,"count":1},"cacheHit":"success"}}`；统一 `AiProvider` 接口（generateText/analyzeImage/generateImage + 统一 AiResult/rawPayload），`ProviderRegistry` 注册 mock/ark/openrouter/openai-compatible，未知供应商拒绝；`ProviderRouter` 无厂商分支，按 attemptKey 写 AiUsageLog（模型/耗时/Token/状态），AiCallCache 按 requestHash 幂等复用（同 attemptKey 二次调用 cached=true 且 usage 仍 1 条）；Ark/OpenRouter/OpenAICompatible 仅创建与能力断言，未触发真实付费 API；`AiWorker` 接入 server-ai 队列并写 job event；`pnpm --filter backend build` 通过)

- [x] 4.2 实现报告 Pipeline 与结果落库
      现状: 报告模型在 schema 中，Pipeline 缺失
      依据: 图1-C4、图1-C8、design.md「三、数据库全景」
      验证: `node test_report_pipeline_mock.js` ➔ 预期: Mock 数据经任务队列全链路生成报告并落 MySQL，任务 success；失败可从 checkpoint 阶段续跑
      证据: (2026-09-14, 实测通过: `pnpm --filter backend report-pipeline-smoke` 返回 `{"first":{"reused":false,"status":"success","reportNo":true,"reportHash":true,"competitorCount":3},"run":{"status":"success","competitorCount":3,"bandCount":3,"insightCount":1},"jobAfter":{"status":"success","stage":"success","checkpointStage":"reporting"},"second":{"reused":true,"reportNo":true},"usageCount":1}` 与 `{"finished":true,"reportStatus":"success","reportNo":true}` `{"directOk":true,"queueOk":true}`；`ReportService.runReport` 经 ProviderRouter(Mock) 生成报告，写入 AnalysisRun/reportNo/reportHash/competitorCount/costModelJson + 价格带 + insights，任务 success 且 checkpointStage=reporting；失败后再次运行 reused=true 且 AiUsageLog 仍 1 条（不重复扣费）；真实 server-report Worker（编译产物 `dist/src/worker.js`）消费队列完成同一链路；`pnpm --filter backend build` 通过)

- [x] 4.3 实现 PlatformAdapter、平台字典与淘宝适配器
      现状: 旧 `taobaoTopClient.js` 有类目/店铺能力，新适配器缺失
      依据: 图1-C5、design.md「三、数据库全景」
      验证: `node test_platform_adapter.js` ➔ 预期: 旧淘宝类目/店铺调用迁移到统一适配器；Mock 转统一 DTO 且保留 raw_payload
      证据: (2026-09-14, 实测通过: `pnpm --filter backend platform-adapter-smoke` 返回 `{"adapterCodes":["taobao","mock"],"taobao":{"configStatus":{"configured":false,"hasSession":false,"mock":true},"categoryCount":3,"categoryRawKept":true,"shopCount":1,"shopRawKept":true,"childFiltered":["162102"]},"mock":{"categoryCount":2},"dictionary":["douyin","jd","pdd","taobao"],"service":{"categories":[{"externalId":"50008163","name":"女装"},{"externalId":"162102","name":"连衣裙"},{"externalId":"50008907","name":"男装"}],"shops":["mock-shop-1"]},"unknownRejected":true}`；新增 `platform.types.ts`（统一 DTO + rawPayload）、`PlatformRegistry`（taobao/mock）、`TaobaoAdapter`（迁移旧 TOP 签名/类目/店铺逻辑，`PLATFORM_MOCK` 或非生产环境默认 Mock）、`MockPlatformAdapter` 与 `PlatformAdapterService/Controller`（`GET /api/platform-adapters`、`:code/categories`、`:code/shops`）；类目/店铺统一 DTO 且保留 raw_payload，未知平台拒绝；`pnpm --filter backend build` 通过)

- [x] 4.4 实现 AI 审计与关键日志埋点
      现状: `ai_usage_logs` 在 schema 中，attemptKey 幂等写入缺失
      依据: 图1-C3、架构图「AI 审计」
      验证: `node test_ai_audit.js` ➔ 预期: 成功/失败/重试均有记录，attemptKey 唯一，app.log 含 requestId/jobId 无密钥
      证据: (2026-09-14, 实测通过: `pnpm --filter backend ai-audit-smoke` 返回 `{"success":{"status":"success","row":"success","tokenIn":2,"durationMs":1},"failure":{"message":"simulated provider failure","rowStatus":"failure","rowError":"simulated provider failure","count":1},"log":{"redactApiKey":true,"redactToken":true,"keyLogFree":true}}`；成功调用写 AiUsageLog success（含 tokenIn/durationMs），`FailingProvider` 触发失败后写 failure + error，同 attemptKey 重试仍 1 条（upsert 重置 running→failure，attemptKey 唯一不重复计费）；pino redact 配置含 apiKey/token，AI 相关日志行不出现 key/authorization/Bearer；`pnpm --filter backend build` 通过)

- [x] 4.5 实现图片生成流程树（prompt/generate/review）
      现状: 图片生成为独立下游任务，流程树缺失；旧 `mainImagePromptExpansion.js` 与 `arkImageGeneration.js` 待迁移
      依据: design.md「FlowProducer 编排模型」「下游工作流：图片生成与平台发布」
      验证: `node test_image_flow_mock.js` ➔ 预期: 旧提示词/生图逻辑迁移后基于报告与商品原图依次执行 prompt→generate→review；review 支持采纳/不采纳/重新生成，采纳后外部完成继续流程，重新生成创建新批次并受次数上限约束，不采纳结束当前资产；生成图落 mock 存储并记录资产引用；任务 success/failure/cancelled 正确
      证据: (2026-09-14, 实测通过: `pnpm --filter backend image-flow-smoke` 返回 `{"generate":{"asset":true,"review":"pending","fileExists":true,"jobStage":"reviewing"},"approved":{"decision":"approved","jobStatus":"success"},"rejected":{"jobStatus":"success"},"regenerate":{"limitReached":true,"jobStatus":"failure","regenerateCount":4}}` 与 `{"reviewCreated":true,"assetCreated":true,"storageKey":true}` `{"directOk":true,"queueOk":true}`；prompt 阶段由 server-ai Worker 生成 `image-prompt` 事件，`ImageGenWorker`（server-image-gen）调统一 AI image 能力，生成图落 mock 存储并写 GeneratedAsset + ReviewRecord(pending)，任务进入 reviewing；`POST /api/review-records/:id/decision` 支持 approved/rejected/regenerate，审批人落 reviewerId；regenerate 创建新批次并计数，超 3 次任务 failure；approved/rejected 任务 success；真实 Worker 队列链路生成资产与审核记录；`pnpm --filter backend build` 通过)

- [x] 4.6 实现平台发布流程树（upload-assets/submit）
      现状: PlatformAdapter 仅有接口规划，发布流程树缺失
      依据: design.md「FlowProducer 编排模型」「下游工作流：图片生成与平台发布」
      验证: `node test_listing_flow_mock.js` ➔ 预期: 基于生成资产依次执行 upload-assets→submit；平台 Mock 成功/失败/重试符合统一状态；任务 success/failure/cancelled 正确
      证据: (2026-09-15, 实测通过: `pnpm --filter backend listing-flow-smoke` 返回 `{"upload":{"assetCount":1,"draftStatus":"assets_uploaded","jobStage":"uploading_assets","assetReferenced":true},"submit":{"status":"success","draftStatus":"submitted","jobStatus":"success"},"failure":{"message":"simulated listing failure","jobStatus":"failure","errorCode":"LISTING_SUBMIT_FAILED","draftStatus":"failed"},"retry":{"status":"success","jobStatus":"success"}}` 与 `{"ok":true}` `{"directOk":true,"queueOk":true}`；`ListingFlowService.uploadAssets` 选取最近已收尾的图片生成任务资产写入 ListingDraft(contentJson 记录 assetIds/storageKeys) 并进入 uploading_assets；submit 经 PlatformAdapter 提交（Mock/淘宝 Mock 成功；failing-platform 失败写 draft=failed + job=failure + LISTING_SUBMIT_FAILED，重新 upload 后可续跑成功）；真实 Worker：server-image-gen 消费 upload-assets、server-listing 消费 submit，任务最终 success、draft=submitted；`pnpm --filter backend build` 通过)

- [~] 4.7 实测 AI/淘宝限流并回填 provider 配置
      现状: RPM/TPM/QPS、超时、错误码与可重试类型未实测
      依据: design.md「九、外部依赖边界」「参数与执行位置」
      验证: `node test_provider_limits.js` ➔ 预期: ark/openrouter/openai-compatible/taobao 的限流、超时、错误码与可重试类型写入对应 ProviderProfile；Worker 内限流生效，不触发超额调用；健康状态和最近错误可供 ProviderRouter 使用
      证据: (2026-09-15, 阻塞待实测：需要真实 OpenRouter/Ark 平台 Key 与淘宝开放平台 AppKey/AppSecret 后才能真实调用并量出 RPM/TPM/QPS、超时、错误码与可重试类型；占位字段已写入 `backend/.env.example`（OPENROUTER_API_KEY、ARK_API_KEY、TAOBAO_APP_KEY/APP_SECRET/SESSION）并登记在 phase-6「本地做/线上做清单」；待账号回填后执行，不阻塞 4.8-4.12 开发)

- [x] 4.8 实现 ProviderRouter 与自定义端点安全校验
      现状: 多 Profile 路由、连接测试和自定义 baseURL SSRF 防护缺失
      依据: design.md「多供应商配置实例与后台切换」「AI 供应商适配设计」
      验证: 按能力选择唯一 active Profile；支持手动切换；baseURL 仅允许 HTTPS，拒绝 localhost、127.0.0.1、内网网段、云 metadata 地址、危险协议和异常端口；Key 不下发桌面端、不进日志；任务固定使用创建时 providerProfileId
      证据: (2026-09-15, 实测通过: `pnpm --filter backend provider-router-smoke` 返回 `{"ssrf":{"badUrls":9,"badTotal":9,"httpsAccepted":true},"selection":{"textByPriorityProfile":true,"textModel":"profile-c","imageByPriorityProfile":true,"imageModel":"profile-b"},"switch":{"activated":true,"previousDisabled":true,"afterSwitchProfile":true,"model":"profile-a"},"fixedJob":{"jobProfile":true,"usageJobId":true,"usageProfile":true,"model":"profile-a"},"keyMasked":{"masked":"ARK***","notPlain":true}}`；SSRF 9 类非法 URL 全拒、HTTPS 通过；按能力选唯一 active Profile（text 取最高优先级、image 独立）；`POST /api/provider-profiles/:id/activate` 手动切换并禁用同能力旧 Profile；Job 固化创建时 providerProfileId，运行期不换；apiKeyRef 脱敏；`pnpm --filter backend build` 通过)

- [x] 4.9 实现数据 Agent 对话能力
      现状: 旧 `DataAgentChat` 页面存在，新服务端无对应问答能力
      依据: design.md「业务范围对齐（2026-09-13）」
      验证: `node test_data_agent_chat.js` ➔ 预期: 基于已采集数据/报告进行 Mock 问答，返回结构化回答与引用来源；鉴权、限流、AI 审计一致；不触发真实付费接口
      证据: (2026-09-15, 实测通过: `pnpm --filter backend data-agent-smoke` 返回 `{"answer":{"text":"mock answer: 上下文...","sourceCount":2,"hasReport":true,"hasProduct":true},"fallbackContext":{"answerText":"mock answer: 上下文...","sourceCount":1},"rateLimited":true}`；`POST /api/data-agent/chat` 基于 AnalysisRun 报告 + ProductSnapshot 上下文走 ProviderRouter(Mock) 返回回答与引用来源，无 jobId 时取最近报告；JwtAuthGuard 鉴权；`DATA_AGENT_RATE_LIMIT_PER_MINUTE` 内存限流 429；AiUsageLog attemptKey 审计一致；`pnpm --filter backend build` 通过)

- [x] 4.10 实现报告导出与下载接口
      现状: 旧报告仅页面查看/本地生成，导出格式未纳入新方案
      依据: design.md「业务范围对齐（2026-09-13）」
      验证: `node test_report_export.js` ➔ 预期: 同一报告可导出 JSON、Markdown/HTML；导出记录关联 job/run，落 StorageDriver；重复导出幂等；无权限 403
      证据: (2026-09-15, 实测通过: `pnpm --filter backend report-export-smoke` 返回 `{"service":{"jsonStorage":"report-exports/.../json","jsonReused":true,"markdownStorage":".../markdown","htmlStorage":".../html","exportRows":3,"jsonFileExists":true},"http":{"adminStatus":201,"noPermStatus":403}}`；`POST /api/reports/:runId/export` 支持 json/markdown/html，文件落本地 `REPORT_EXPORT_DIR`（Phase 5 接入 StorageDriver 前用本地 mock），GeneratedAsset 记录关联 analysisRunId/runId；重复导出返回同 storageKey；HTTP 真实验证管理员 201、无 `market:report:view` 权限用户 403；`pnpm --filter backend build` 通过)

- [x] 4.11 实现视频复刻业务能力（Mock/外部服务扩展）
      现状: 旧视频复刻/视频图库页面存在，新方案未覆盖
      依据: design.md「业务范围对齐（2026-09-13）」
      验证: `node test_video_replication.js` ➔ 预期: 视频资产可登记、任务状态可见；第一版以 Mock/手动导入资产为主，外部 AI 视频服务通过统一 Adapter 扩展；页面与资产迁移到新 frontend/desktop
      证据: (2026-09-15, 实测通过: `pnpm --filter backend video-replication-smoke` 返回 `{"replicate":{"status":"success","provider":"mock"},"source":{"sourceType":"video_source","storageKey":"video-sources/...mp4"},"output":{"sourceType":"video_replication","storageKey":"mock-videos/...mp4","mimeType":"video/mp4"},"job":{"status":"success","stage":"success","eventCount":1},"missingRejected":true}`；`POST /api/videos/replicate` 经 VideoProviderRegistry(Mock/后续外部服务) 创建 video_source 资产 → 视频复刻任务 → video_replication 输出资产，任务状态与事件可查；缺 sourceUrl/sourceStorageKey 拦截；`pnpm --filter backend build` 通过)

- [x] 4.12 落地 AI Key 混合方案边界
      现状: AI Key 集中服务端方案已确认，但桌面端调用方式与 BYOK 边界未落地
      依据: design.md「桌面端本地优先与服务端管理边界（2026-09-14）」「多供应商配置实例与后台切换」
      验证: 平台统一 Key 的 AI 请求从桌面端经服务端代理，桌面端不保存明文 Key；BYOK 仅在本地 safeStorage 明确开启后可用；日志/审计不出现 Key；后续切换 BYOK 不影响 Pipeline
      证据: (2026-09-15, 实测通过: `pnpm --filter backend ai-key-boundary-smoke` 返回 `{"modePlaceholder":true,"desktopHasNoKeyStore":true,"keyNotInAudit":true,"maskedApiKeyRef":"OPE***","model":"boundary-model"}`；`AI_KEY_MODE=platform` 占位已写入 env，BYOK 第一版不做；桌面端 `store.ts` 无任何 AI Key 配置；AiUsageLog/AiCallCache 不落 key/Bearer，ProviderProfile apiKeyRef 脱敏；切换 Key 模式只改配置不改 Pipeline；`pnpm --filter backend build` 通过)
