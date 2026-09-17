# Phase 5 · 数据 Agent 前端接真

> 归属旧页面（1 个）：DataAgentChat（数据智能体对话）
> 目标：把 `/analysis/agent` 从 StubPage 接成真实对话页面。
> **09-17 复核**：前端已接真——`apps/desktop/src/renderer/src/pages/DataAgentChatPage.tsx` 已挂 `/analysis/agent`，调 `GET /api/data-agent/datasets` + `POST /api/data-agent/chat`。本 Phase 进入「复查」，重点核对字段/流式是否与旧页面一致，无遗留则闭环。
> 前置：后端 `data-agent` controller 已具备 `GET /datasets`、`POST /chat`（含 datasetId/jobId 兼容）。
> 验证原则：对话用 Mock AI，禁止高频触发真实大模型。

---

- [x] 5.1 对齐数据集字段与流式返回
      现状: `data-agent.controller.ts` 与 `data-agent.service.ts` 已就绪，支持 `GET /api/data-agent/datasets` 与 `POST /api/data-agent/chat`，返回结构与前端对话模型对齐。
      依据: 架构图-图1 C13；design.md「AI 供应商适配」统一 AiProvider；旧表 `market_analysis_run`
      验证: 后端单测 `agent.service.spec.ts` 覆盖通过，接口支持 datasetId 与问题提问。
      证据: data-agent.controller.ts, agent.service.spec.ts

- [x] 5.2 前端接真数据 Agent 对话页
      现状: `DataAgentChatPage.tsx` 已全量实现（477 行）并挂载到 `/analysis/agent`。左侧支持真实数据集下拉与切换、快捷问题推荐；右侧支持对话历史、输入提问与 AI 回答交互。
      依据: 架构图-图1 A2；页面迁移矩阵
      验证: `pnpm build` 成功；页面交互流畅，无 StubPage 占位。
      证据: DataAgentChatPage.tsx