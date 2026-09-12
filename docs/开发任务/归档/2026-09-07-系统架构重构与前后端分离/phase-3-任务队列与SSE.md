# Phase 3：任务、队列与 SSE

- [ ] 3.1 建立 BullMQ 队列、API/Worker 双进程和引用型 payload
      现状: 旧后端用进程内状态保存报告任务，新 Redis/BullMQ Worker 缺失
      依据: 图1-B4、图2、design.md「任务、队列与幂等」
      验证: `pnpm dev:backend && pnpm dev:worker` 并投递测试任务 ➔ 预期: API 与 Worker 独立启动，payload 只含 jobId/runId/accountId/traceId
      证据: 

- [ ] 3.2 实现任务创建、数据库事务和业务幂等
      现状: 旧实现使用内存报告状态和随机 jobId，新 `analysis_jobs` 及唯一约束缺失
      依据: 图1-B4、图1-C1、架构图「任务幂等」判据
      验证: `node test_job_idempotency.js` ➔ 预期: 相同业务唯一键并发提交只生成一个 active job，并返回同一个 jobId
      证据: 

- [ ] 3.3 实现任务状态、重试、超时、取消和 Worker 重启恢复
      现状: 新状态机和异常中断恢复规则缺失
      依据: 图1-B4、架构图「核心状态机」「Worker 恢复」
      验证: `node test_job_lifecycle.js` ➔ 预期: queued/active 可按规则进入 success、failure、cancelled 或 timeout；重启后不会重复扣费或重复创建结果
      证据: 

- [ ] 3.4 实现 SSE 进度、心跳、终态和断线恢复
      现状: 旧后端无标准 SSE 任务事件接口，新 Redis 事件与数据库恢复机制缺失
      依据: 图1-B5、图3-报告任务、design.md「SSE 设计」
      验证: `curl -N http://127.0.0.1:8787/api/analysis/jobs/<jobId>/events` ➔ 预期: 返回 `text/event-stream`，先发送当前状态，每 15 秒心跳并最终发送终态事件
      证据: 
