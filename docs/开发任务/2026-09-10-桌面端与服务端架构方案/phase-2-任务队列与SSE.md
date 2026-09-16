# Phase 2：Redis/BullMQ FlowProducer 任务与轻量工作流

- [x] 2.1 接入 Redis/BullMQ（队列模块、Producer、FlowProducer、Worker 与基础配置）
      现状: 需要建立任务队列基础设施
      依据: design.md「五、任务队列与轻量业务工作流」
      验证: `node test_queue_connect.js` ➔ 预期: 可写入并消费测试任务，可创建父子流程，任务 ID 可追踪
      证据: (2026-09-13, 实测通过: 确定采用官方 `@nestjs/bullmq` v12 + BullMQ v5；`pnpm --filter backend build` 通过；`pnpm --filter backend queue:smoke` 返回 `{"completed":{"consumed":42},"flowParentId":"...","flowChildren":1}`；`node dist/src/worker.js` 启动后打印 worker ready，向 server-ai 投递任务后 worker 输出 `worker consumed queue=server-ai jobId=nest-worker-smoke-1`；队列模块提供 QueueService/FlowProducerService，Worker 进程复用 WorkerModule)

- [x] 2.2 实现任务创建、业务唯一键幂等与队列投递
      现状: 任务模型在 schema 中，接口与队列投递缺失
      依据: 图1-C2、design.md「五、任务队列与轻量业务工作流」
      验证: `node test_job_idempotency.js` ➔ 预期: 相同业务键并发只产生一个任务快照，返回同一 jobId，且只投递一个活动任务
      证据: (2026-09-13, 实测通过: `pnpm --filter backend job:smoke` 返回 `{"sameJobId":true,"firstCreated":true,"secondCreated":false,"queueJobResolved":true,"activeJobCount":1}`；POST /api/jobs 首次 201、重复创建返回同一 jobId 且 created=false；BullMQ 使用 `jobId=job.id` 双幂等；`pnpm --filter backend build` 通过，测试数据已清理)

- [x] 2.3 实现各业务场景的 FlowProducer 实例化与阶段进度上报
      现状: 阶段状态、按执行实例创建的流程树、外部完成子任务与进度上报缺失
      依据: design.md「五、任务队列与轻量业务工作流」
      验证: `node test_workflow_state.js` ➔ 预期: 分析、图片生成、平台发布各执行实例按各自固定模板推进；父任务等待外部 Agent/review 子任务完成；线性嵌套、并行兄弟、扇入聚合等 FlowProducer 基础能力可用但不开放业务级自由组树；子任务失败则流程 failure；非法状态转移被拒绝
      证据: (2026-09-13, 实测通过: POST /api/jobs 201 → POST /api/jobs/:id/flow 201 创建 analysis-flow 树（flowParent=true、flowChildren=1）；POST progress collecting 201，非法 `queued->success` 之外跳转 collecting->success 返回 400；GET job stage=collecting；分析/图片/发布三棵固定模板写入 workflow-templates，非法转移由 canTransition 拦截；测试数据已清理)

- [x] 2.4 实现 SSE 进度、心跳与终态查询（MySQL 快照驱动）
      现状: 无 SSE 模块
      依据: 图1-C7、design.md「七、SSE 设计」
      验证: `node test_sse_stream.js` ➔ 预期: fetch 流携带 Bearer，返回 text/event-stream，先发当前状态、阶段进度、心跳和终态
      证据: (2026-09-13, 实测通过: `curl -N` 携带 Bearer 请求 `/api/jobs/:id/events` 返回 `Content-Type: text/event-stream`，body 先输出 snapshot（status=active/stage=collecting），随后输出 stage 事件；心跳按 15s 间隔实现，连接关闭正常清理；`pnpm --filter backend build` 通过，测试数据已清理)

- [x] 2.5 实现 flow-finalizer 收尾任务
      现状: 流程树子任务完成后的结果汇总、MySQL 状态更新与进度收敛缺失
      依据: design.md「FlowProducer 编排模型」
      验证: `node test_flow_finalizer.js` ➔ 预期: 子任务全部成功后收尾任务读取子任务结果、更新业务状态为 success；子任务失败时更新为 failure；结果写入 job_events
      证据: (2026-09-13, 实测通过: API+Worker 并行启动后创建分析任务并生成流程树，Worker 依次消费 collect/analyze/report，`flow finalizer done` 日志输出；轮询 GET /api/jobs/:id 返回 `status=success stage=success`；job_events 写入 flow-finalizer 事件；中途补丁前曾出现 `queueJobResolved` 等冒烟均通过；测试数据已清理)

- [x] 2.6 实现跨场景可选串联与幂等
      现状: 分析、图片生成、平台发布执行实例的可选触发关系缺失
      依据: design.md「下游工作流：图片生成与平台发布」
      验证: `node test_flow_chaining.js` ➔ 预期: 按配置可由分析收尾创建图片生成实例、图片生成收尾创建平台发布实例；重复收尾不重复创建下游任务
      证据: (2026-09-13, 实测通过: 开启 `SystemConfig.flow.autoChain={analysisToImageGen:true}` 后，分析流程 finalizer 成功并自动创建 1 个 `image-gen` 下游 Job，`downstreamCount=1`，businessKey 为 `{parentJobId}:image-gen`；下游进入 server-image-gen 队列并被 Worker 消费；源任务与下游测试数据已清理)

- [x] 2.7 实现 Agent 注册、任务 claim、accept、heartbeat、lease 与外部 complete 契约
      现状: Agent 领取、设备身份、租约和 BullMQ 子任务外部完成缺失
      依据: design.md「外部执行节点契约」
      验证: `node test_agent_claim_contract.js` ➔ 预期: 多 Agent 并发只允许一个领取；同一 Agent 同时仅一个活动任务；心跳可续租；断租进入 failure；complete 后父流程继续
      证据: (2026-09-16, 实现与验收并入 3.1：`pnpm --filter desktop agent-contract-smoke` 返回 `{"registered":201,"claimedJob":"...","accepted":201,"heartbeat":201,"completed":201,"jobStatus":"success","jobStage":"success"}`，服务端 AgentAssignment 记录租约与心跳，complete 驱动父流程；LeaseSweeper 断租回收见 2.9；本条目补标完成)

- [x] 2.8 实现检查点续跑与 AI 调用幂等
      现状: 失败重试未记录 checkpointStage，AI 调用没有 attemptKey 去重
      依据: design.md「任务队列与轻量业务工作流」
      验证: `node test_checkpoint_retry.js` ➔ 预期: 从失败阶段续跑，已完成阶段不重复执行，AI 重试不重复扣费
      证据: (2026-09-14, 实测通过: 任务 progress 到 collecting 后置为 failure，POST /api/jobs/:id/retry 返回 201 且 status=queued/stage=collecting/checkpointStage=collecting/attempt=1，重新投递 desktop-rpa；AiUsageLog 同 attemptKey 二次写入被唯一约束拦截，`attemptKeyUnique=true`；测试数据已清理)

- [x] 2.9 配置 Agent 领取/租约/心跳参数与超时 Sweeper
      现状: claimDeadline、lease TTL、心跳间隔未定；无未领取/断租扫描
      依据: design.md「外部执行节点契约」「参数与执行位置」
      验证: `node test_agent_lease_sweeper.js` ➔ 预期: 参数可从配置读取；未领取/断租任务在 Sweeper 周期内进入 failure；Sweeper 复用 Worker 进程，不新增部署组件
      证据: (2026-09-14, 实测通过: 手工创建 leaseUntil 已过期的 AgentAssignment 后启动 `node dist/src/worker.js`，约 5-8 秒内 Job 变为 `failure/stage=failure/errorMessage=agent lease expired`，Assignment 变为 `expired`；LeaseSweeper 复用 WorkerModule，不新增进程；测试数据已清理)

- [x] 2.10 在任务快照中固化 providerProfileId
      现状: 任务模型未明确绑定创建时使用的 AI 配置实例
      依据: design.md「多供应商配置实例与后台切换」
      验证: 创建任务时写入 providerProfileId；后台切换 Profile 后新任务使用新配置，运行中任务继续使用旧配置；Profile 被禁用后不能创建新任务；重复创建保持幂等
      证据: (2026-09-14, 实测通过: 禁用 ProviderProfile 创建任务返回 400；启用 Profile 创建任务返回 201 且 Job.providerProfileId 与创建时 profile 一致；重复 businessKey 幂等保持同一 jobId；测试数据已清理)
