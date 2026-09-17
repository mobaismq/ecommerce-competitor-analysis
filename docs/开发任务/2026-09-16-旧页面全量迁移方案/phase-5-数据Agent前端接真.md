# Phase 5 · 数据 Agent 前端接真

> 归属旧页面（1 个）：DataAgentChat（数据智能体对话）
> 目标：把 `/analysis/agent` 从 StubPage 接成真实对话页面。
> **09-17 复核**：前端已接真——`apps/desktop/src/renderer/src/pages/DataAgentChatPage.tsx` 已挂 `/analysis/agent`，调 `GET /api/data-agent/datasets` + `POST /api/data-agent/chat`。本 Phase 进入「复查」，重点核对字段/流式是否与旧页面一致，无遗留则闭环。
> 前置：后端 `data-agent` controller 已具备 `GET /datasets`、`POST /chat`（含 datasetId/jobId 兼容）。
> 验证原则：对话用 Mock AI，禁止高频触发真实大模型。

---

- [ ] 5.1 对齐数据集字段与流式返回
      现状: 旧 DataAgentChat 依赖 `datasets` 的 title/keyword/priceRange/competitorCount/collectTime/status 字段与 `ask` 的流式回答；新 `data-agent.service.ts` 返回字段需与之一致，且 `chat` 目前是否流式待核实。
      依据: 架构图-图1 C13；design.md「AI 供应商适配」统一 AiProvider；旧表 `market_analysis_run`
      验证: `curl -i http://127.0.0.1:8787/api/data-agent/datasets?keyword=xx`（登录态）➔ 预期: 200 返回含 6 字段的数据集列表；`POST /api/data-agent/chat` 用 Mock 返回 answer，`pnpm --filter backend test` 通过。
      证据: (执行阶段回填)

- [ ] 5.2 前端接真数据 Agent 对话页
      现状: `apps/desktop/src/renderer/src/main.tsx` 中 `/analysis/agent` 为 StubPage；旧 DataAgentChat 为"左数据集选择 + 右问答聊天（快捷问题/历史 8 条/流式）"。
      依据: 架构图-图1 A2；页面迁移矩阵
      验证: `pnpm --filter frontend build` + `pnpm --filter frontend test`（对话渲染）+ 浏览器选数据集、问答、看流式回答 ➔ 预期: 对话链路可用，无"模块待接入"。
      证据: (执行阶段回填)