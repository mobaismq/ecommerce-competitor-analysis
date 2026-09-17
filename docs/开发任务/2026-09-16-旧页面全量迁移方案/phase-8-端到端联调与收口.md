# Phase 8 · 端到端联调与收口

> 目标：全链路联调、回归测试、旧代码删除。
> 前置：Phase 1–7 完成。

---

- [ ] 8.1 全链路端到端联调
      现状: 各 Phase 后端/前端分别验证过，尚未串联「登录 → 采集(RPA 离线样本/Mock) → 报告 → 图片生成 → 审核 → 平台发布」全链路。
      依据: 架构图-图1 T3；design.md「十二、本地测试方案」
      验证: 本地起栈（desktop + backend + Redis/BullMQ）用离线样本/Mock 走通全链路 → 逐环节查状态/落库 ➔ 预期: 全链路无断点，终态数据可查。
      证据: (执行阶段回填)

- [ ] 8.2 全量回归测试
      现状: `pnpm build`、`pnpm test`（backend Jest + frontend Vitest）需在全部迁移后回归全绿。
      依据: AGENTS.md「验证与构建命令」
      验证: `pnpm build` ➔ 预期: 三包构建成功；`pnpm test` ➔ 预期: backend 与 frontend 测试全绿（含新增 P1–P7 单测）。
      证据: (执行阶段回填)

- [ ] 8.3 旧代码删除收口
      现状: `apps/legacy/` 与 `apps/backend/server.js` 为待删项（`scripts/cleanup-legacy.mjs` dry-run 通过）；server.js 与新 main.ts 互斥占 8787 端口。
      依据: 复盘核查清单 R-5；design.md「重构前未提交骨架处理原则」
      验证: 人工本地验收核心流程无旧代码依赖后执行 `pnpm legacy:cleanup --apply`，随后 `pnpm build` + 起服务冒烟 ➔ 预期: 旧目录删除、新栈可独立启动。
      证据: (执行阶段回填)