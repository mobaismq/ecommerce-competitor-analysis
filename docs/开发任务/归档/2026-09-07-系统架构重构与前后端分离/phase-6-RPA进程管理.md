# Phase 6：RPA 进程管理

- [ ] 6.1 实现 RPA 任务状态和 Python/Chrome 进程管理
      现状: 旧 RPA 入口分散在现有工具中，新 `rpa_tasks` 和受控子进程服务缺失；无离线 `rpa_runs/` 样本
      依据: 图1-B8、图1-C5、design.md「RPA」
      验证: `node test_rpa_process.js` 使用测试替身进程 ➔ 预期: 启动、查询、停止、超时、失败和 PID 回收状态均符合状态机
      证据: 

- [ ] 6.2 接入 BullMQ 任务取消、服务重启和孤儿进程清理
      现状: 新 Worker 与 RPA 进程没有取消联动和重启恢复逻辑
      依据: 图1-B4、图1-B8、架构图「RPA 停止」判据
      验证: `node test_rpa_recovery.js` ➔ 预期: 取消任务会回收子进程，Worker 重启后孤儿进程被识别并清理，任务进入明确终态
      证据: 
