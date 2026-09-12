# 本地系统架构重构任务清单

> 依据：`架构图.md`、`design.md`、`.agents/workflows/plan.md`
> 范围：仅拆解 2026-09-07 本地重构；线上部署待补齐架构图后单独拆解。

## 现状基线

| 资产/能力 | 状态 | 证据 |
|---|---|---|
| 旧 React/Vite 前端 | 已有，作为业务参考，不直接纳入新 workspace | `app/src/app/`、`app/package.json` |
| 旧 Node 后端 | 已有，本轮替换，不保留兼容层 | `backend/server.js:1` |
| 旧业务服务 | 已有，迁移为新模块时参考 | `app/src/server/aiMarketAnalysis.js`、`taobaoTopClient.js` 等 |
| Python/RPA/数据处理工具 | 已有，保留并通过边界调用 | `skills/` |
| 根级 pnpm workspace | 缺失 | 根目录无 `package.json`、`pnpm-workspace.yaml` |
| 新 frontend 工程 | 缺失 | 根目录无 `frontend/` |
| NestJS/Prisma/BullMQ/Pino 后端 | 缺失 | `backend/` 当前仅有旧 Node 文件 |
| 本地 MySQL/Redis 编排 | 缺失 | 根目录无 `docker-compose.yml` |
| 离线 RPA 样本 | 未发现 | 根目录无 `rpa_runs/`，需使用 Mock/测试替身验证 |

## 阶段状态表

| Phase | 阶段 | 前置依赖 | 独立交付判据 | 状态 |
|---|---|---|---|---|
| 0 | 外部依赖与环境探测 | 无 | SDK、运行环境和离线验证边界形成结论 | ✅ 已完成 |
| 1 | 工程地基与基础设施 | Phase 0 | `pnpm setup` 成功，健康检查可用 | 🔄 进行中 |
| 2 | 认证与权限 | Phase 1 | 登录、localStorage 恢复、403 越权均可验证 | pending |
| 3 | 任务、队列与 SSE | Phase 1 | 任务幂等、消费、取消、恢复和 SSE 可验证 | pending |
| 4 | 业务管道与 AI/平台适配 | Phase 3 | Mock 数据跑通报告流程并完成审计 | pending |
| 5 | 图片资产 | Phase 1、Phase 4 | 资产可保存、鉴权读取和清理 | pending |
| 6 | RPA 进程管理 | Phase 3 | Mock/测试进程可启动、停止、超时和回收 | pending |
| 7 | 测试与最终验收 | Phase 2-6 | 单测、集成测试、E2E 和验收判据通过 | pending |

## 全局里程碑

| 里程碑 | 完成标准 |
|---|---|
| M1 工程可启动 | workspace、Docker、NestJS、React、Prisma 初始化和健康检查通过 |
| M2 认证闭环 | 登录、退出、刷新页面恢复、401 清态、权限拒绝通过 |
| M3 异步闭环 | 创建、幂等、消费、进度、取消、失败和重启恢复通过 |
| M4 业务闭环 | Mock AI/平台数据完成报告流程，AI 审计完整 |
| M5 资产与 RPA 闭环 | 图片接口和 RPA 生命周期通过 |
| M6 重构验收完成 | 本地验收、单测、集成测试、browser-use E2E 和构建通过 |

## 方案待修订项

- [ ] 外部 AI、淘宝 API、Python/Chrome 的 SDK 参数、超时、限流和错误码在 Phase 0 回填 `[待实测]` 结论。
- [ ] `analysis_jobs` 的 active 超时阈值、重试次数和退避间隔在实现前确定并写入统一配置。
- [ ] 线上部署目录仍缺 `架构图.md` 四张图和唯一判据表，完成前不拆线上任务。
- [ ] `app.log`、`error.log`、本地 `debug.log` 的实际 Pino destination/轮转组件在 Phase 1 验证支持能力。

## 阻塞登记

当前无本地重构阻塞。线上部署任务受“缺少线上 `架构图.md`”约束，属于后置依赖，不阻塞本地重构。
